import admin from "firebase-admin";
//mport serviceAccount from "./service-account-key.json" assert { type: "json" };

const serviceAccount = JSON.parse(
  Buffer.from(process.env.SERVICE_ACCOUNT_KEY, "base64").toString("utf-8")
);

// Initialisation de Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

export { admin, db };
