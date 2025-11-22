// controllers/admin/AdminRequestController.js
const path = require("path");
const fs = require("fs");
const sqlModel = require("../../config/db");
const { uploadLocalFileToS3 } = require("../../config/s3");
const adminMessaging = require("../../firebase");
const { getCurrentDateTime } = require("../../config/datetime");

// helper to convert s3 key -> full url
const buildS3Url = (key) => {
  if (!key) return null;
  return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || "ap-south-1"}.amazonaws.com/${key}`;
};

async function addHistory(request_id, action_by, action_type, from_status, to_status, version, message) {
  await sqlModel.insert("request_history", {
    request_id,
    action_by,
    action_type,
    from_status,
    to_status,
    version,
    message,
    created_at: getCurrentDateTime(),
  });
}

// Admin: list with filters
exports.getAllRequests = async (req, res) => {
  try {
    // optional filters: type, status, emp_id, date_from, date_to
    const { type, status, emp_id, date_from, date_to, limit = 50, offset = 0 } = req.query;
    let where = " WHERE 1=1 ";
    const params = [];

    if (type) { where += " AND r.type = ? "; params.push(type); }
    if (status) { where += " AND r.status = ? "; params.push(status); }
    if (emp_id) { where += " AND r.emp_id = ? "; params.push(emp_id); }
    if (date_from && date_to) { where += " AND r.created_at BETWEEN ? AND ? "; params.push(date_from, date_to); }

    const query = `SELECT r.*, u.name as employee_name FROM requests r LEFT JOIN employees u ON u.id = r.emp_id ${where} ORDER BY r.id DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit,10)); params.push(parseInt(offset,10));

    const list = await sqlModel.customQuery(query, params);

    // attach latest response summary
    for (const r of list) {
      const [latestResp] = await sqlModel.customQuery(
        `SELECT * FROM request_responses WHERE request_id = ? ORDER BY version DESC LIMIT 1`, [r.id]
      );
      if (latestResp) {
        r.latest_response = {
          id: latestResp.id,
          version: latestResp.version,
          admin_note: latestResp.admin_note,
          file_url: latestResp.file_path ? buildS3Url(latestResp.file_path) : null,
          responded_by: latestResp.responded_by,
        };
      } else {
        r.latest_response = null;
      }
    }

    return res.status(200).send({ status: true, data: list });
  } catch (error) {
    console.error(error);
    return res.status(200).send({ status: false, error: error.message });
  }
};

// Admin: respond to request (upload file; increases version)
exports.respondToRequest = async (req, res) => {
  try {
    // admin authenticated via users table; req.user should be set by your verifyToken middleware
    const adminUser = req.user;
    const requestId = req.params.id;

    // fetch request
    const [reqRows] = await sqlModel.select("requests", ["id","type","status","current_version"], { id: requestId });
    if (!reqRows || reqRows.length === 0) return res.status(200).send({ status: false, message: "Request not found" });

    const reqRow = reqRows[0];
    const newVersion = (reqRow.current_version || 0) + 1;

    let uploadedKey = null;
    if (req.fileFullPath && req.fileFullPath.length > 0) {
      // admin used same multer; files are in req.fileFullPath
      // upload each (we'll only save the first as primary response file_path)
      for (const relPath of req.fileFullPath) {
        const projectRoot = path.resolve(__dirname, "..", "..");
        const localAbs = path.join(projectRoot, "public", relPath);
        try {
          const keyPrefix = `${reqRow.type}/${requestId}/v${newVersion}`;
          const { key, url } = await uploadLocalFileToS3(localAbs, keyPrefix);

          // store each attachment in request_responses_attachments (optional) OR store primary path in request_responses
          uploadedKey = uploadedKey || key;

          // save response attachment record
          await sqlModel.insert("request_response_attachments", {
            request_id: requestId,
            version: newVersion,
            file_path: key,
            file_type: path.extname(localAbs).replace(".", ""),
            created_at: getCurrentDateTime(),
          });

          fs.unlinkSync(localAbs);
        } catch (e) {
          console.error("admin S3 upload failed", e.message);
        }
      }
    }

    // save response row
    const insertResp = {
      request_id: requestId,
      version: newVersion,
      file_path: uploadedKey,
      admin_note: req.body.admin_note || null,
      responded_by: adminUser.id,
      responded_at: getCurrentDateTime(),
    };
    await sqlModel.insert("request_responses", insertResp);

    // update request current_version and status
    const prevStatus = reqRow.status;
    await sqlModel.update("requests", { current_version: newVersion, status: "responded", updated_at: getCurrentDateTime() }, { id: requestId });

    // record history
    await addHistory(requestId, adminUser.id, "response_uploaded", prevStatus, "responded", newVersion, req.body.admin_note || "Admin responded");

    // send FCM notifications to company users (same pattern)
    const companyId = adminUser.company_id || null;
    if (companyId) {
      const tokens = await sqlModel.select("fcm_tokens", ["fcm_token"], { user_id: companyId });
      if (tokens && tokens.length > 0) {
        const messageContent = `Request #${requestId} has a new response.`;
        const notificationPromises = tokens.map(({ fcm_token }) => {
          return adminMessaging.messaging().send({
            notification: {
              title: "Request Responded",
              body: messageContent,
            },
            token: fcm_token,
          });
        });

        try {
          await Promise.all(notificationPromises);
          await sqlModel.insert("notification", {
            company_id: companyId,
            title: "Request Responded",
            body: messageContent,
            status: "unread",
            timestamp: getCurrentDateTime(),
          });
        } catch (e) {
          console.error("FCM admin error", e.message);
        }
      }
    }

    return res.status(200).send({ status: true, message: "Response uploaded", version: newVersion });
  } catch (error) {
    console.error(error);
    return res.status(200).send({ status: false, error: error.message });
  }
};

// Admin: update status only
exports.updateStatus = async (req, res) => {
  try {
    const adminUser = req.user;
    const requestId = req.params.id;
    const { status } = req.body;

    const [existing] = await sqlModel.select("requests", ["status"], { id: requestId });
    if (!existing || existing.length === 0) return res.status(200).send({ status: false, message: "Request not found" });

    const prevStatus = existing[0].status;
    await sqlModel.update("requests", { status, updated_at: getCurrentDateTime() }, { id: requestId });

    await addHistory(requestId, adminUser.id, "status_changed", prevStatus, status, null, `Status changed to ${status}`);

    return res.status(200).send({ status: true, message: "Status updated" });
  } catch (error) {
    console.error(error);
    return res.status(200).send({ status: false, error: error.message });
  }
};

// Admin: get history for a request
exports.getHistory = async (req, res) => {
  try {
    const requestId = req.params.id;
    const history = await sqlModel.select("request_history", "*", { request_id: requestId });
    return res.status(200).send({ status: true, data: history });
  } catch (error) {
    console.error(error);
    return res.status(200).send({ status: false, error: error.message });
  }
};

exports.getSingleRequest = async (req, res) => {
  try {
    const requestId = req.params.id;

    if (!requestId) {
      return res.status(200).send({
        status: false,
        message: "Request ID is required",
      });
    }

    // === FETCH MAIN REQUEST ===
    const [request] = await sqlModel.customQuery(
      `
        SELECT r.*, 
               e.name AS employee_name,
               e.image AS employee_image,
               e.phone AS employee_phone,
               e.email AS employee_email
        FROM requests r
        LEFT JOIN employees e ON r.emp_id = e.id
        WHERE r.id = ?
      `,
      [requestId]
    );

    if (!request) {
      return res.status(200).send({
        status: false,
        message: "Request not found",
      });
    }

    // === FETCH S3 UPLOADED FILES ===
    const files = await sqlModel.select(
      "request_files",
      ["id", "file_url", "file_type", "version"],
      { request_id: requestId }
    );

    // === FETCH ADMIN RESPONSE ===
    const [adminResponse] = await sqlModel.select(
      "request_admin_response",
      ["id", "admin_id", "note", "status", "response_date"],
      { request_id: requestId }
    );

    // === FETCH HISTORY ===
    const history = await sqlModel.customQuery(
      `
        SELECT h.*, 
               u.name AS updated_by_name
        FROM request_history h
        LEFT JOIN users u ON h.updated_by = u.id
        WHERE h.request_id = ?
        ORDER BY h.id DESC
      `,
      [requestId]
    );

    return res.status(200).send({
      status: true,
      message: "Request details fetched successfully",
      data: {
        request,
        files,
        admin_response: adminResponse || {},
        history,
      },
    });

  } catch (error) {
    return res.status(200).send({
      status: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


