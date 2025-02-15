const { db } = require('./firebase');
const { Expo } = require('expo-server-sdk');

const EXPO_ACCESS_TOKEN  =  'SzGXow1JeRY1neT-ZWXVU8SzwQQep2IHKx-VW3-p'

// Initialize Expo SDK
const expo = new Expo({
    accessToken: 'SzGXow1JeRY1neT-ZWXVU8SzwQQep2IHKx-VW3-p',
    useFcmV1: true,
});

// Helper function to send notifications to partners
const sendNotificationsToPartners = async (partners, order) => {
  

    // const message = {
    //     to:'ExponentPushToken[xSf6bEJMUCD-xxqMUoBYLp]',
    //     title: 'Hello!',
    //     body: 'This is a test notification.',
    //   };
  
      // Send the notification
    //   const ticket = await expo.sendPushNotificationsAsync([message]);
    //   console.log('Notification ticket:', ticket);

    const tokens = partners.map(partner => partner.expoPushToken).filter(token => token && Expo.isExpoPushToken(token));
    const title = 'New Delivery Request';
    const body = `Order from  10 km)`;

    if (tokens.length === 0) {
      console.log('No valid Expo Push Tokens found.');
      return;
    }


    // Construct the notification messages
    // const messages = tokens.map(token => ({
    //   to: token,
    //   title,
    //   body,
    // }));

    const messages = tokens
    .map((pushToken) => ({
      to: pushToken,
      sound: 'default',
      title,
      body,
      data: { extraData: 'Nouvelle commande disponible' }, // Tu peux envoyer des données supplémentaires
    }));


    try {
      const tickets = [];

      console.log('Sending notifications...');
      const ticketChunks = await expo.sendPushNotificationsAsync(messages);

      console.log('Notifications sent.', ticketChunks);
      //res.status(200).json({ success: true, ticketChunks });
      // for (const chunk of ticketChunks) {
      //   try {
      //     const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      //     tickets.push(...ticketChunk);
      //   } catch (error) {
      //     console.error('Error sending notifications:', error);
      //   }
      // }
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error });
    }

    // Split tokens into chunks (Expo limits the number of tokens per request)
    //const chunks = expo.chunkPushNotifications(messages);

    // // Send notifications in batches


    // for (const chunk of ticketChunks) {
    //   try {
    //     const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
    //     tickets.push(...ticketChunk);
    //   } catch (error) {
    //     console.error('Error sending notifications:', error);
    //   }
    // }
};

// Helper function to send notifications to customers
const sendNotificationToCustomer = async (userId) => {
  try {
    const customerDoc = await db.collection('users').doc(userId).get();
    const customer = customerDoc.data();

    if (!customer || !customer.expoPushToken || !Expo.isExpoPushToken(customer.expoPushToken)) {
      console.log('Customer or valid Expo Push Token not found.');
      return;
    }

    // Construct the notification message
    const message = {
      to: customer.expoPushToken,
      title: 'Order Update',
      body: 'Your meal is on its way!',
    };

    // Send the notification
    const ticket = await expo.sendPushNotificationsAsync([message]);
    console.log('Notification ticket:', ticket);
  } catch (error) {
    console.error('Error sending notification to customer:', error);
  }
};

module.exports = { sendNotificationsToPartners, sendNotificationToCustomer };