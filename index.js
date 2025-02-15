const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const http = require('http'); // For Socket.IO
const { Server } = require('socket.io');

// Initialize Express app and HTTP server
const app = express();
const server = http.createServer(app); // Create HTTP server
const io = new Server(server, {
  cors: {
    origin: '*', // Adjust for production (e.g., your app's URL)
  },
});

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(require('./service-account-key.json')),
});
const db = admin.firestore();

// Middleware
app.use(cors());
app.use(express.json());

// ----------------------------------------------
// WebSocket Logic for Real-Time Location Updates
// ----------------------------------------------
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Listen for location updates from delivery partners
  socket.on('location_update', async (data) => {
    const { orderId, partnerId, location } = data;

    try {
      // Update partner's location in Firestore
      await admin.firestore().collection('deliveryPartners').doc(partnerId).update({
        location: new admin.firestore.GeoPoint(location.latitude, location.longitude),
      });

      // Broadcast location to the customer watching this order
      io.to(`order_${orderId}`).emit('location_updated', {
        orderId,
        location,
      });
    } catch (error) {
      console.error('Error updating location:', error);
    }
  });

  // Let customers join a "room" to listen for their order's location
  socket.on('join_order', (orderId) => {
    socket.join(`order_${orderId}`);
    console.log(`Customer joined order room: order_${orderId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// ----------------------------------------------
// Listen for Firestore changes (replace Cloud Functions)
// ----------------------------------------------
const setupOrderListener = () => {
  db.collection('orders').onSnapshot(async (snapshot) => {
    for (const change of snapshot.docChanges()) {
      if (change.type === 'added') {
        const order = change.doc.data();
        try {
          const partners = await getNearbyPartners(order.restaurantLocation);

          await sendNotificationsToPartners(partners, order);
        } catch (error) {
          console.error('Error processing new order:', error);
        }
      }

      if (change.type === 'modified') {
        const newData = change.doc.data();
        const oldData = change.oldData;
        if (newData.status === 'picked_up' && oldData.status !== 'picked_up') {
          try {
            await sendNotificationToCustomer(newData.customerId);
          } catch (error) {
            console.error('Error notifying customer:', error);
          }
        }
      }
    }
  });
};

// ----------------------------------------------
// Helper Functions
// ----------------------------------------------
const getNearbyPartners = async (location) => {
  const partnersRef = db.collection('delivery_partners');
  const querySnapshot = await partnersRef.where('isOnline', '==', true).get();

  // Filter partners within 10km (client-side example)
  return querySnapshot.docs.map(doc => doc.data())

   // .filter(partner => calculateDistance(location, partner.location) <= 10);
};

const sendNotificationsToPartners = async (partners, order) => {
  try {
    // Extract FCM tokens from partners
    const tokens = partners.map(partner => partner.fcmToken).filter(t => t);

    const title = 'New Delivery Request';
    const body = `Order from la vielle marmite 10 km)`;

    console.log('Tokens:', tokens);

    if (tokens.length === 0) {
      console.log('No valid FCM tokens found.');
      return;
    }

    // Construct the multicast message
    // const message = {
    //   notification: {
    //     title: 'New Delivery Request',
    //     body: `Order from ${order.restaurantName} (${order.distance} km)`,
    //   },
    //   tokens: tokens,
    // };

        // Construct the notification payload
        const messages = tokens.map(token => ({
          to: token,
          title,
          body,
        }));

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });


    const result = await response.json();

    // Send the multicast message
   // const response = await admin.messaging().sendEachForMulticast(message);

    // Log the results
    //console.log(`${response.successCount} messages were sent successfully`);
    if (!result) {
      console.log('Some messages failed to send:', response.responses);
    }
  } catch (error) {
    console.error('Error sending notifications:', error);
  }
};

const sendNotificationToCustomer = async (customerId) => {
  try {
    const customerDoc = await db.collection('customers').doc(customerId).get();
    const customer = customerDoc.data();

    if (!customer || !customer.fcmToken) {
      console.log('Customer or FCM token not found.');
      return;
    }

    // Send notification to the customer
    await admin.messaging().send({
      token: customer.fcmToken,
      notification: {
        title: 'Order Update',
        body: 'Your meal is on its way!',
      },
    });

    console.log('Notification sent to customer:', customerId);
  } catch (error) {
    console.error('Error sending notification to customer:', error);
  }
};

// Helper function to calculate distance (example implementation)
const calculateDistance = (loc1, loc2) => {
  const R = 6371; // Earth's radius in km
  const dLat = ((loc2.latitude - loc1.latitude) * Math.PI) / 180;
  const dLon = ((loc2.longitude - loc1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((loc1.latitude * Math.PI) / 180) *
      Math.cos((loc2.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

// Start server and listener
server.listen(5000, () => {
  console.log('Server running on port 5000');
  setupOrderListener();
});
































// const express = require('express');
// const admin = require('firebase-admin');
// const cors = require('cors');
// const http = require('http'); // Add this

// const { Server } = require('socket.io');

// const app = express();

// const server = http.createServer(app); // Create HTTP server
// const io = new Server(server, { // Initialize Socket.io
//   cors: {
//     origin: '*', // Adjust for production (e.g., your app's URL)
//   },
// });



// admin.initializeApp({
//   credential: admin.credential.cert(require('./service-account-key.json')),
// });
// const db = admin.firestore();

// app.use(cors());
// app.use(express.json());




// console.log('Firebase Admin SDK initialized:', admin.messaging);

// // ----------------------------------------------
// // WebSocket Logic for Real-Time Location Updates
// // ----------------------------------------------
// io.on('connection', (socket) => {
//     console.log('Client connected:', socket.id);
  
//     // Listen for location updates from delivery partners
//     socket.on('location_update', async (data) => {
//       const { orderId, partnerId, location } = data;
  
//       // 1. Update partner's location in Firestore
//       await admin.firestore().collection('deliveryPartners').doc(partnerId).update({
//         location: new admin.firestore.GeoPoint(location.latitude, location.longitude),
//       });
  
//       // 2. Broadcast location to the customer watching this order
//       io.to(`order_${orderId}`).emit('location_updated', {
//         orderId,
//         location,
//       });
//     });
  
//     // Let customers join a "room" to listen for their order's location
//     socket.on('join_order', (orderId) => {
//       socket.join(`order_${orderId}`);
//       console.log(`Customer joined order room: order_${orderId}`);
//     });
  
//     socket.on('disconnect', () => {
//       console.log('Client disconnected:', socket.id);
//     });
//   });
  

// // ----------------------------------------------
// // Listen for Firestore changes (replace Cloud Functions)
// // ----------------------------------------------
// const setupOrderListener = () => {
//   db.collection('orders').onSnapshot((snapshot) => {
//     snapshot.docChanges().forEach(async (change) => {
//       if (change.type === 'added') {
//         const order = change.doc.data();
//         const partners = await getNearbyPartners(order.restaurantLocation);
//         sendNotificationsToPartners(partners, order);
//       }

//       if (change.type === 'modified') {
//         const newData = change.doc.data();
//         const oldData = change.oldData;
//         if (newData.status === 'picked_up' && oldData.status !== 'picked_up') {
//           sendNotificationToCustomer(newData.customerId);
//         }
//       }
//     });
//   });
// };

// // ----------------------------------------------
// // Helper Functions
// // ----------------------------------------------
// const getNearbyPartners = async (location) => {
//   const partnersRef = db.collection('deliveryPartners');
//   const querySnapshot = await partnersRef
//     .where('isOnline', '==', true)
//     .get();

//   // Filter partners within 10km (client-side example)
//   return querySnapshot.docs
//     .map(doc => doc.data())
//     .filter(partner => calculateDistance(location, partner.location) <= 10);
// };

// const sendNotificationsToPartners = (partners, order) => {
//   const tokens = partners.map(partner => partner.fcmToken).filter(t => t);
//   const message = {
//     notification: {
//       title: 'New Delivery Request',
//       body: `Order from ${order.restaurantName} (${order.distance} km)`,
//     },
//     tokens: tokens,
//   };
//   admin.messaging().sendEachForMulticast(message);
// };

// const sendNotificationToCustomer = async (customerId) => {
//   const customerDoc = await db.collection('customers').doc(customerId).get();
//   const customer = customerDoc.data();
  
//   admin.messaging().send({
//     token: customer.fcmToken,
//     notification: {
//       title: 'Order Update',
//       body: 'Your meal is on its way!',
//     },
//   });
// };

// // Start server and listener
// app.listen(5000, () => {
//   console.log('Server running on port 5000');
//   setupOrderListener();
// });