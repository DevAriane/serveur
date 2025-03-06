import { Server } from "socket.io"; // `io` n'existe pas dans socket.io v4, `Server` suffit
import { db } from "./firebase.js";
import { getActiveOrders } from "./server.js";

export const setupSocket = (server) => {
  const socketServer = new Server(server, {
    cors: {
      origin: "*", // Change selon ton domaine
      //methods: ["GET", "POST"]
    },
    allowEIO3: true, // Ajout pour éviter certains bugs
    transports: ["websocket", "polling"], // Assure la compatibilité
  });

  socketServer.on("connection", (socket) => {
    console.log("🟢 Nouvelle connexion WebSocket :", socket.id);
    // Listen for location updates from delivery partners 
    socket.on("location_update", async (data) => {
      console.log('new Location')
      const { partnerId, location } = data;
      console.log('Nl : ', location)
      console.log('Nl partner : ', partnerId)
      try {
        // Update partner's location in Firestore
        await db.collection("delivery_partners").doc(partnerId).update({
          partnerLocation: location,
        });

        const activeOrders = getActiveOrders();

        // Check from the in-memory cache instead of querying Firestore
        const orderId =
          activeOrders && Object.keys(activeOrders).includes(partnerId)
            ? activeOrders[partnerId]
            : null;

        if (orderId) {
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
      console.log('join order : ', orderId);
      socket.join(`order_${orderId}`);
      console.log(`Customer joined order room: order_${orderId}`);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });
};
