import admin from "firebase-admin";
import serviceAccount from "./service-account-key.json" assert { type: "json" };

// Initialisation de Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

export { admin, db };
