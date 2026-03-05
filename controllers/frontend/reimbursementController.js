const sqlModel = require("../../config/db");
const { getCurrentDateTime } = require("../../config/datetime");
const path = require("path");
const fs = require("fs");
const { uploadLocalFileToS3, deleteFileFromS3 } = require("../../config/s3");

const getCurrentDate = () => {
  const currentDate = new Date();

  const options = {
    timeZone: "Asia/Kolkata",
  };
  const year = currentDate.toLocaleString("en-US", {
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
  const month = String(currentDate.getMonth() + 1).padStart(2, "0");
  const day = String(currentDate.getDate()).padStart(2, "0");

  const formattedDate = `${year}-${month}-${day}`;

  return formattedDate;
};

function fixMulterRelativePath(relPath) {
  if (relPath.startsWith("public/")) return relPath;
  if (relPath.startsWith("images/")) return "public/" + relPath;
  return relPath;
}

function buildLocalAbsolutePath(relPath) {
    if (relPath.startsWith("public/")) {
    return path.join(process.cwd(), relPath);
  }

  return path.join(process.cwd(), "public", relPath);
}


exports.getReimbursementTypes = async (req, res) => {
  try {

    const token = req.headers.authorization?.split(" ")[1];

    if (!token)
      return res.status(200).send({
        status: false,
        message: "Token is required"
      });

    const [user] = await sqlModel.select(
      "employees",
      ["id", "company_id"],
      { api_token: token }
    );

    if (!user)
      return res.status(200).send({
        status: false,
        message: "User not found"
      });

    const types = await sqlModel.select(
      "reimbursement_types",
      ["id", "name"],
      {
        company_id: user.company_id,
        is_active: 1
      }
    );

    return res.status(200).send({
      status: true,
      message: "Reimbursement types fetched successfully",
      data: types
    });

  } catch (error) {

    console.error(error);

    return res.status(200).send({
      status: false,
      message: error.message
    });

  }
};

exports.createReimbursementType = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token)
      return res.status(200).send({ status: false, message: "Token is required" });

    const [user] = await sqlModel.select(
      "employees",
      ["id", "company_id"],
      { api_token: token }
    );

    if (!user)
      return res.status(200).send({ status: false, message: "User not found" });   

    if (!req.body.name)
      return res.status(200).send({ status: false, message: "Type name required" });

    const insert = {
      company_id: user.company_id,
      name: req.body.name,
      // description: req.body.description || null,
      is_active: 1,
      created_at: getCurrentDateTime(),
      updated_at: getCurrentDateTime(),
    };

    const result = await sqlModel.insert("reimbursement_types", insert);

    if (result.error)
      return res.status(200).send(result);

    return res.status(200).send({
      status: true,
      message: "Reimbursement type created",
      type_id: result.insertId,
    });
  } catch (error) {
    console.error(error);
    return res.status(200).send({ status: false, message: error.message });
  }
};

exports.updateReimbursementAttachment = async (req, res) => {
  try {

    const token = req.headers.authorization?.split(" ")[1];
    if (!token)
      return res.status(200).send({ status: false, message: "Token required" });

    const [user] = await sqlModel.select(
      "employees",
      ["id", "company_id"],
      { api_token: token }
    );

    if (!user)
      return res.status(200).send({ status: false, message: "User not found" });

    const { reimbursement_id, attachment_id } = req.body;

    if (!reimbursement_id || !attachment_id)
      return res.status(200).send({
        status: false,
        message: "reimbursement_id and attachment_id required",
      });

    // check attachment
    const [attachment] = await sqlModel.select(
      "reimbursement_attachments",
      ["id", "file_path"],
      { id: attachment_id, reimbursement_id }
    );
console.log("Attachment found:", attachment);
    if (!attachment)
      return res.status(200).send({
        status: false,
        message: "Attachment not found",
      });

    if (!req.fileFullPath || req.fileFullPath.length === 0)
      return res.status(200).send({
        status: false,
        message: "File required",
      });

    const relPath = req.fileFullPath[0];

    const fixed = fixMulterRelativePath(relPath);
    const localAbsolute = buildLocalAbsolutePath(fixed);

    let newKey = "";

    try {

      const keyPrefix = `reimbursement/${reimbursement_id}`;

      const { key } = await uploadLocalFileToS3(localAbsolute, keyPrefix);

      newKey = key;

      // delete old file from S3
      if (attachment.file_path) {
        await deleteFileFromS3(attachment.file_path);
      }
console.log("New file uploaded to S3 with key:", newKey);
      // update DB
    await sqlModel.update(
  "reimbursement_attachments",
  {
    file_path: newKey,
    file_type: path.extname(localAbsolute).replace(".", ""),
    updated_at: getCurrentDateTime()
  },
  { id: attachment_id, reimbursement_id }
);

      // delete local file
      fs.unlinkSync(localAbsolute);

    } catch (err) {
      console.error("Upload failed:", err.message);
    }

    return res.status(200).send({
      status: true,
      message: "Attachment updated successfully",
      file_path: `https://${process.env.AWS_S3_BUCKET}.s3.${
                  process.env.AWS_REGION || "ap-south-1"
                }.amazonaws.com/${newKey}`
    });

  } catch (error) {
    console.error(error);
    return res.status(200).send({
      status: false,
      message: error.message,
    });
  }
};

exports.applyReimbursement = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token)
      return res.status(200).send({ status: false, message: "Token is required" });

    const [user] = await sqlModel.select(
      "employees",
      ["id", "company_id", "name", "image"],
      { api_token: token }
    );

    if (!user)
      return res.status(200).send({ status: false, message: "User not found" });

    if (!req.body.reimbursement_type_id)
      return res.status(200).send({ status: false, message: "Type is required" });

    // if (!req.body.amount)
    //   return res.status(200).send({ status: false, message: "Amount is required" });

    // Insert reimbursement
    const insert = {
      emp_id: user.id,
      company_id: user.company_id,
      reimbursement_type_id: req.body.reimbursement_type_id,
    //   amount: req.body.amount,
    //   description: req.body.description || null,
      status: "pending",
      applied_date: getCurrentDate(),
      created_at: getCurrentDateTime(),
      updated_at: getCurrentDateTime(),
    };

    const saveData = await sqlModel.insert("reimbursements", insert);

    if (saveData.error)
      return res.status(200).send(saveData);

    const reimbursement_id = saveData.insertId;

    let attachment_id = 0;

    /* =========================
       MULTIPLE FILE UPLOAD
    ========================== */
    if (
      req.fileFullPath &&
      Array.isArray(req.fileFullPath) &&
      req.fileFullPath.length > 0
    ) {
      for (const relPath of req.fileFullPath) {
        const fixed = fixMulterRelativePath(relPath);
        const localAbsolute = buildLocalAbsolutePath(fixed);

        try {
          const keyPrefix = `reimbursement/${reimbursement_id}`;

          const { key, url } = await uploadLocalFileToS3(
            localAbsolute,
            keyPrefix
          );

          const result = await sqlModel.insert(
            "reimbursement_attachments",
            {
              reimbursement_id,
              file_path: key,
              file_type: path.extname(localAbsolute).replace(".", ""),
              created_at: getCurrentDateTime(),
            }
          );

          attachment_id = result.insertId;

          // delete local file
          fs.unlinkSync(localAbsolute);
        } catch (e) {
          console.error("S3 upload failed:", e.message);
        }
      }
    }

    /* =========================
       HISTORY (Optional)
    ========================== */
    // await addHistory(
    //   reimbursement_id,
    //   user.id,
    //   "reimbursement_created",
    //   null,
    //   "pending",
    //   0,
    //   "Reimbursement applied",
    //   null,
    //   insert.description,
    //   attachment_id
    // );

    /* =========================
       NOTIFICATION TO ADMIN
    ========================== */
    // const tokens = await sqlModel.select(
    //   "fcm_tokens",
    //   ["fcm_token"],
    //   { user_id: user.company_id }
    // );

    // if (tokens.length > 0) {
    //   const messageContent = `New reimbursement request from ${user.name}`;

    //   const notificationPromises = tokens.map(({ fcm_token }) => {
    //     return adminMessaging.messaging().send({
    //       notification: {
    //         title: `New Reimbursement Request`,
    //         body: messageContent,
    //         image: user.image
    //           ? `${process.env.BASE_URL}${user.image}`
    //           : "",
    //       },
    //       token: fcm_token,
    //     });
    //   });

    //   try {
    //     await Promise.all(notificationPromises);

    //     await sqlModel.insert("notification", {
    //       company_id: user.company_id,
    //       title: "New Reimbursement",
    //       body: messageContent,
    //       image: user.image,
    //       status: "unread",
    //       timestamp: getCurrentDateTime(),
    //     });
    //   } catch (e) {
    //     console.error("FCM error", e.message);
    //   }
    // }

    return res.status(200).send({
      status: true,
      message: "Reimbursement applied successfully",
      reimbursement_id,
    });
  } catch (error) {
    console.error(error);
    return res.status(200).send({ status: false, message: error.message });
  }
};

exports.getReimbursementsByMonth = async (req, res) => {
  try {

    const token = req.headers.authorization?.split(" ")[1];
    if (!token)
      return res.status(200).send({ status: false, message: "Token is required" });

    const [user] = await sqlModel.select(
      "employees",
      ["id", "company_id"],
      { api_token: token }
    );

    if (!user)
      return res.status(200).send({ status: false, message: "User not found" });

    const month = req.query.month;
    const year = req.query.year;

    if (!month || !year)
      return res.status(200).send({
        status: false,
        message: "Month and year required",
      });

    const query = `
      SELECT 
        r.id,
        r.status,
        r.applied_date,
        rt.name AS reimbursement_type
      FROM reimbursements r
      LEFT JOIN reimbursement_types rt 
        ON rt.id = r.reimbursement_type_id
      WHERE r.emp_id = ?
      AND MONTH(r.applied_date) = ?
      AND YEAR(r.applied_date) = ?
      ORDER BY r.applied_date DESC
    `;

    const reimbursements = await sqlModel.customQuery(query, [
      user.id,
      month,
      year,
    ]);

    // Attachments fetch
    for (const item of reimbursements) {

      const attachments = await sqlModel.select(
        "reimbursement_attachments",
        ["id", "file_path", "file_type"],
        { reimbursement_id: item.id }
      );

      item.attachments = attachments.map((a) => ({
        id: a.id,
        file_url: `https://${process.env.AWS_S3_BUCKET}.s3.${
                  process.env.AWS_REGION || "ap-south-1"
                }.amazonaws.com/${a.file_path}`,
        file_type: a.file_type,
      }));
    }

    return res.status(200).send({
      status: true,
      data: reimbursements,
    });

  } catch (error) {
    console.error(error);
    return res.status(200).send({
      status: false,
      message: error.message,
    });
  }
};
