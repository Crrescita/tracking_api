// const admin = require("firebase-admin");
// const base64ServiceAccountKey = process.env.GOOGLE_CLOUD_KEY;
// require('dotenv').config();
// // const serviceAccount = require("./location-tracker-17a8e-firebase-adminsdk-46i56-54c5098f05");

// const serviceAccount = JSON.parse(
//   Buffer.from(base64ServiceAccountKey, "base64").toString("utf8")
// );

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
// });

// module.exports = admin;


require('dotenv').config();
const admin = require("firebase-admin");

const base64ServiceAccountKey = process.env.GOOGLE_CLOUD_KEY;

if (!base64ServiceAccountKey) {
  throw new Error("Missing GOOGLE_CLOUD_KEY in environment variables.");
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(
    Buffer.from(base64ServiceAccountKey, "base64").toString("utf8")
  );
} catch (error) {
  throw new Error("Failed to decode or parse GOOGLE_CLOUD_KEY: " + error.message);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
