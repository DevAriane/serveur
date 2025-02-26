import { Server } from "socket.io"; // `io` n'existe pas dans socket.io v4, `Server` suffit
import { db } from "./firebase.js";
import { getActiveOrders } from "./server.js";

//const { getActiveOrders } = require('./server');




export const setupSocket = (server) => {
  const socketServer = new Server(server, {
    cors: {
      origin: "*", // Adjust for production (e.g., your app's URL)
    },
  });

  socketServer.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Listen for location updates from delivery partners
    socket.on("location_update", async (data) => {
      console.log('updatate location');
      const {partnerId, location } = data;

      console.log('updatate location' , location);
      try {
        // Update partner's location in Firestore
        await db
          .collection("delivery_partners")
          .doc(partnerId)
          .update({
            partnerLocation: location,
          });

        const activeOrders = getActiveOrders();

        console.log(' ctiveOrders', activeOrders);

        // Check from the in-memory cache instead of querying Firestore
        const orderId = activeOrders && Object.keys(activeOrders).includes(partnerId) ? activeOrders[partnerId] : null;

        if (orderId) {
          console.log('orderId 111', orderId);
          // Broadcast location to the customer
          socketServer.to(`order_${orderId}`).emit("location_updated", {
            orderId,
            location,
          });
        }

      } catch (error) {
        console.error("Error updating location:", error);
      }
    });

    // Let customers join a "room" to listen for their order's location
    socket.on("join_order", (orderId) => {
      socket.join(`order_${orderId}`);
      console.log(`Customer joined order room: order_${orderId}`);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });
};

