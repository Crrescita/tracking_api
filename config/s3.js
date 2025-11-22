// config/s3.js
const AWS = require("aws-sdk");
const fs = require("fs");
const path = require("path");

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION || "ap-south-1",
});

const s3 = new AWS.S3();
const BUCKET = process.env.AWS_S3_BUCKET || "telindia";
const BASE_URL = `https://${BUCKET}.s3.${process.env.AWS_REGION || "ap-south-1"}.amazonaws.com/`;

/**
 * Upload a local file (absolute path) to S3 under the given keyPrefix.
 * @param {string} localAbsolutePath - full path to local file (e.g. /project/public/images/requests/...)
 * @param {string} keyPrefix - e.g. requests/quotation/123/v1
 * @returns {Promise<{ key: string, url: string }>}
 */
async function uploadLocalFileToS3(localAbsolutePath, keyPrefix) {
  if (!fs.existsSync(localAbsolutePath)) {
    throw new Error("Local file not found: " + localAbsolutePath);
  }

  const fileContent = fs.readFileSync(localAbsolutePath);
  const fileName = path.basename(localAbsolutePath).replace(/\s/g, "_");
  const key = `${keyPrefix}/${Date.now()}_${fileName}`;

  const params = {
    Bucket: BUCKET,
    Key: key,
    Body: fileContent,
    ACL: "public-read",
  };

  const uploaded = await s3.upload(params).promise();
  return { key, url: uploaded.Location || `${BASE_URL}${key}` };
}


/**
 * Delete object by S3 key (key only, not full url)
 */
async function deleteByKey(key) {
  if (!key) return;
  await s3
    .deleteObject({
      Bucket: BUCKET,
      Key: key,
    })
    .promise();
}

module.exports = { uploadLocalFileToS3, deleteByKey, BASE_URL };
