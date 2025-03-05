import express from 'express';
import http from 'http';
import cors from 'cors';
import { setupSocket } from './socket.js';
import { db } from './firebase.js';
import { sendNotificationsToPartners, sendNotificationToCustomer } from './notifications.js';
import { calculateDistance } from './utils/distance.js';


const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Setup WebSocket
setupSocket(server);

const activeOrders = {}; // { partnerId: orderId }

// Listen for Firestore changes
const setupOrderListener = () => {

  db.collection("orders").onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      const order = change.doc.data();
      const orderId = change.doc.id;
      const partnerID = order?.deliveryPartnerId

      if (change.type === "added" || change.type === "modified") {
        if (partnerID) {
          activeOrders[partnerID] = orderId;
        }
      }

      if (change.type === "removed") {
        if (partnerID) {
          delete activeOrders[partnerID];
        }
      }
    })
  });

  db.collection('orders').where('status.current', '==', 'PENDING').onSnapshot(async (snapshot) => {
    for (const change of snapshot.docChanges()) {
      if (change.type === 'added') {
        const order = change.doc.data();
        try {
          const partners = await getNearbyPartners(order.restaurantLocation);
          if (partners.length > 0) {
            await sendNotificationsToPartners(partners, order);
          } else {
            console.warn('⚠️ Aucun livreur disponible à proximité.');
          }
        } catch (error) {
          console.error('❌ Erreur lors du traitement de la commande:', error);
        }
      }
    }
  });

  db.collection('orders').where('status.current', '==', 'PICKEDUP').onSnapshot(async (snapshot) => {
    for (const change of snapshot.docChanges()) {
      if (change.type === 'added') {
        const newData = change.doc.data();
        try {
          await sendNotificationToCustomer(newData.userId);
        } catch (error) {
          console.error('❌ Erreur lors de la notification du client:', error);
        }
      }
    }
  });
};

// Helper function to get nearby partners
const getNearbyPartners = async (location) => {
  const partnersRef = db.collection('delivery_partners');
  const querySnapshot = await partnersRef.where('isOnline', '==', true).get();
  return querySnapshot.docs.map(doc => doc.data())
    //.filter(partner => calculateDistance(location, partner.location) <= 10);
};

export const getActiveOrders = () => {return activeOrders};

// Start server and listener
server.listen(5000, () => {
  console.log('✅ Serveur en cours d’exécution sur le port 5000');
  setupOrderListener();
});

