const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");
const base64ServiceAccountKey = process.env.GOOGLE_CLOUD_KEY;

const serviceAccount = JSON.parse(
  Buffer.from(base64ServiceAccountKey, "base64").toString("utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
