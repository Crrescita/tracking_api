const admin = require("firebase-admin");
const base64ServiceAccountKey = process.env.GOOGLE_CLOUD_KEY;

// const serviceAccount = require("./location-tracker-17a8e-firebase-adminsdk-46i56-54c5098f05");

const serviceAccount = JSON.parse(
  Buffer.from(base64ServiceAccountKey, "base64").toString("utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
