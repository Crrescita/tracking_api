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

async function addHistory(
  request_id,
  request_response_id,
  action_by,
  action_type,
  from_status,
  to_status,
  version,
  message,
) {
  // 1️⃣ Get latest history for this request
    const [lastHistory] = await sqlModel.select(
      "request_history",
      ["id"],
      { request_id: request_id }, // explicit WHERE request_id = ?
      "ORDER BY id DESC LIMIT 1"
    );

  const payload = {
    request_response_id,
    action_by,
    action_type,
    from_status,
    to_status,
    version,
    message,
    updated_at: getCurrentDateTime(),
  };

  if (lastHistory?.id) {
    // 2️⃣ Update latest history
    await sqlModel.update(
      "request_history",
      payload,
      { id: lastHistory.id }
    );
  } else {
    // 3️⃣ Insert new history
    await sqlModel.insert("request_history", {
      request_id,
      ...payload,
      created_at: getCurrentDateTime(),
    });
  }
}



// Admin: list with filters
exports.getAllRequests = async (req, res) => {
  try {
    const {
      company_id,
      status,
      type,
      date_from,
      date_to,
      limit = 50,
      offset = 0,
    } = req.query;

    /* ------------------ REQUIRED PARAMS ------------------ */
    if (!company_id) {
      return res.status(400).json({
        status: false,
        message: "company_id is required",
      });
    }

    if (!type) {
      return res.status(400).json({
        status: false,
        message: "type is required",
      });
    }

    /* ------------------ FILTERS ------------------ */
    let where = " WHERE r.company_id = ? AND r.type = ? ";
    const params = [company_id, type];

    if (date_from && date_to) {
      where += " AND r.created_at BETWEEN ? AND ? ";
      params.push(date_from, date_to);
    }

    /* ------------------ PAGINATION ------------------ */
    const limitVal = Number(limit) || 50;
    const offsetVal = Number(offset) || 0;

    /* ------------------ QUERY ------------------ */
		const query = `
SELECT 
  r.id,
  r.title,
  r.description,
  r.priority,
  r.status,
  r.created_at,
  ra.file_path AS attachment_file,
  e.name,
  e.mobile,
  e.email,
  de.name AS designation_name,
  b.name AS branch_name,
  d.name AS department_name,
  CASE
    WHEN e.image IS NOT NULL THEN CONCAT(?, e.image)
    ELSE e.image
  END AS image
FROM requests r
LEFT JOIN request_attachments ra 
  ON ra.id = (
    SELECT ra2.id
    FROM request_attachments ra2
    WHERE ra2.request_id = r.id
    ORDER BY ra2.id DESC
    LIMIT 1
  )
LEFT JOIN employees e ON e.id = r.emp_id
LEFT JOIN designation de ON e.designation = de.id
LEFT JOIN branch b ON e.branch = b.id
LEFT JOIN department d ON e.department = d.id
${where}
ORDER BY r.id DESC
LIMIT ${limitVal} OFFSET ${offsetVal}
`;




              const list = await sqlModel.customQuery(query, [
                process.env.BASE_URL,
                ...params,
              ]);

  console.log("SQL:", query);


    /* ------------------ LATEST RESPONSE (N+1 but safe) ------------------ */
    for (const r of list) {
      const [latestResp] = await sqlModel.customQuery(
        `
        SELECT id, version, admin_note, file_path, responded_by
        FROM request_responses
        WHERE request_id = ?
        ORDER BY version DESC
        LIMIT 1
        `,
        [r.id]
      );

      r.latest_response = latestResp
        ? {
            id: latestResp.id,
            version: latestResp.version,
            admin_note: latestResp.admin_note,
            file_url: latestResp.file_path
              ? buildS3Url(latestResp.file_path)
              : null,
            responded_by: latestResp.responded_by,
          }
        : null;
    }

    return res.status(200).json({
      status: true,
      count: list.length,
      data: list,
    });
  } catch (error) {
    console.error("getAllRequests error:", error);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}


exports.getRequestById = async (req, res) => {
  try {
    const {
      id,
      company_id,
      status,
      type,
      date_from,
      date_to,
      limit = 50,
      offset = 0,
    } = req.query;

    /* ------------------ REQUIRED PARAMS ------------------ */
     if (!id) {
      return res.status(400).json({
        status: false,
        message: "id is required",
      });
    }
    if (!company_id) {
      return res.status(400).json({
        status: false,
        message: "company_id is required",
      });
    }

    if (!type) {
      return res.status(400).json({
        status: false,
        message: "type is required",
      });
    }

    /* ------------------ FILTERS ------------------ */
    let where = " WHERE r.company_id = ? AND r.type = ? AND r.id = ? ";
    const params = [company_id, type, id];

    if (type) {
      where += " AND r.type = ? ";
      params.push(type);
    }

    if (date_from && date_to) {
      where += " AND r.created_at BETWEEN ? AND ? ";
      params.push(date_from, date_to);
    }

    /* ------------------ PAGINATION ------------------ */
    const limitVal = Number(limit) || 50;
    const offsetVal = Number(offset) || 0;

    /* ------------------ QUERY ------------------ */
   const query = `
  SELECT 
    r.id,
    r.title,
    r.description,
    r.priority,
    r.status,
    r.nextFollowup,
    r.created_at,
    ra.file_path AS attachment_file,
    e.name,
    e.mobile,
    e.email,
    de.name AS designation_name,
    b.name AS branch_name,
    d.name AS department_name,
    CASE
      WHEN e.image IS NOT NULL THEN CONCAT(?, e.image)
      ELSE e.image
    END AS image
  FROM requests r
  LEFT JOIN request_attachments ra ON ra.request_id = r.id
  LEFT JOIN employees e 
    ON e.id = r.emp_id
   AND e.company_id = r.company_id
  LEFT JOIN designation de ON e.designation = de.id
  LEFT JOIN branch b ON e.branch = b.id
  LEFT JOIN department d ON e.department = d.id
  ${where}
  LIMIT 1
`;


    const list = await sqlModel.customQuery(query, [
      process.env.BASE_URL,
      ...params,
    ]);

      if (!list || list.length === 0) {
      return res.status(200).json({ status: false, message: "Request not found" });
    }

    const request = list[0];

    request.attachment_file_url = request.attachment_file
  ? buildS3Url(request.attachment_file)
  : null;

// optional: remove raw path if you don’t want to expose it
delete request.attachment_file;


    /* ------------------ LATEST RESPONSE (N+1 but safe) ------------------ */
    // for (const r of list) {
      const [latestResp] = await sqlModel.customQuery(
        `
        SELECT id, version, admin_note, file_path, responded_by
        FROM request_responses
        WHERE request_id = ?
        ORDER BY version DESC
        LIMIT 1
        `,
        [request.id]
      );

      request.latest_response = latestResp
        ? {
            id: latestResp.id,
            version: latestResp.version,
            admin_note: latestResp.admin_note,
            file_url: latestResp.file_path
              ? buildS3Url(latestResp.file_path)
              : null,
            responded_by: latestResp.responded_by,
          }
        : null;
    // }

     const history = await sqlModel.customQuery(
      `
      SELECT
        rh.id,
        rh.request_id,
        rh.request_response_id,
        rh.from_status,
        rh.to_status,
        rh.action_type,
        rh.message,
        rh.version,
        rh.created_at,
        u.name AS action_by_name,
        rr.admin_note,
        rr.file_path AS response_file_path
      FROM request_history rh
      LEFT JOIN company u ON u.id = rh.action_by
      LEFT JOIN request_responses rr ON rh.request_response_id = rr.id
      WHERE rh.request_id = ?
      ORDER BY rh.version ASC, rh.created_at ASC
      `,
      [request.id]
    );

    request.history = history.map(h => ({
  ...h,
  response_file_url: h.response_file_path
    ? buildS3Url(h.response_file_path)
    : null
}));


    // request.history = history || [];

    return res.status(200).json({
      status: true,
      data: request,
    });
  } catch (error) {
    console.error("getAllRequests error:", error);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};


// Admin: respond to request (upload file; increases version)
exports.respondToRequest = async (req, res) => {
  try {
    // admin authenticated via users table; req.user should be set by your verifyToken middleware
    const adminUser = req.user;
    const requestId = req.params.id;

    // fetch request
    const reqRows = await sqlModel.select("requests", ["id","type","status","current_version"], { id: requestId });
    if (!reqRows || reqRows.length === 0) return res.status(200).send({ status: false, message: "Request not found" });

    const reqRow = reqRows[0];
    const newVersion = (parseInt(reqRow.current_version, 10) || 0) + 1;

const [lastResp] = await sqlModel.execute(
  `
  SELECT file_path
  FROM request_responses
  WHERE request_id = ?
  ORDER BY version DESC
  LIMIT 1
  `,
  [requestId]
);


    let uploadedKey = lastResp?.file_path || null;

    if (req.fileFullPath && req.fileFullPath.length > 0) {
      uploadedKey = null;

      for (const relPath of req.fileFullPath) {
        const projectRoot = path.resolve(__dirname, "..", "..");
        const localAbs = path.join(projectRoot, "public", relPath);

        try {
          const keyPrefix = `${reqRow.type}/${requestId}/v${newVersion}`;
          const { key } = await uploadLocalFileToS3(localAbs, keyPrefix);

          uploadedKey = uploadedKey || key;

          // await sqlModel.insert("request_attachments", {
          //   request_id: requestId,
          //   file_path: relPath,
          //   file_type: path.extname(localAbs).replace(".", ""),
          //   created_at: getCurrentDateTime(),
          // });

          fs.unlinkSync(localAbs);
        } catch (e) {
          console.error("S3 upload failed:", e.message);
        }
      }
    }
    // let uploadedKey = null;
    // if (req.fileFullPath && req.fileFullPath.length > 0) {
    //   // admin used same multer; files are in req.fileFullPath
    //   // upload each (we'll only save the first as primary response file_path)
    //   for (const relPath of req.fileFullPath) {
    //     const projectRoot = path.resolve(__dirname, "..", "..");
    //     const localAbs = path.join(projectRoot, "public", relPath);
    //     try {
    //       const keyPrefix = `${reqRow.type}/${requestId}/v${newVersion}`;
    //       const { key, url } = await uploadLocalFileToS3(localAbs, keyPrefix);

    //       // store each attachment in request_responses_attachments (optional) OR store primary path in request_responses
    //       uploadedKey = uploadedKey || key;

    //       // save response attachment record
    //       await sqlModel.insert("request_attachments", {
    //         request_id: requestId,
    //         // version: newVersion,
    //         file_path: relPath,
    //         file_type: path.extname(localAbs).replace(".", ""),
    //         created_at: getCurrentDateTime(),
    //       });

    //       fs.unlinkSync(localAbs);
    //     } catch (e) {
    //       console.error("admin S3 upload failed", e.message);
    //     }
    //   }
    // }

    // save response row
    const insertResp = {
      request_id: requestId,
      version: newVersion,
      file_path: uploadedKey,
      admin_note: req.body.admin_note || null,
      responded_by: adminUser.id,
      responded_at: getCurrentDateTime(),
    };

    // await sqlModel.insert("request_responses", insertResp);

    const respInsertResult = await sqlModel.insert("request_responses", insertResp);

// depending on your sqlModel implementation
const adminResponseId =
  respInsertResult?.insertId ||
  respInsertResult?.[0]?.insertId ||
  null;

    // update request current_version and status
    const prevStatus = reqRow.status;

    const now = new Date();
const followUpDate = addDays(now, 2);
const followUpDateTime = followUpDate
  .toISOString()
  .slice(0, 19)
  .replace("T", " ");


    await sqlModel.update("requests", { current_version: newVersion, status: "ready",nextFollowup:'2_day',nextFollowup_date: followUpDateTime, updated_at: getCurrentDateTime() }, { id: requestId });

    // record history
    await addHistory(
                      requestId,
                      adminResponseId, 
                      adminUser.id,   
                      "response_uploaded",
                      prevStatus,
                      "ready",
                      newVersion,
                      req.body.admin_note || "Admin responded"
                    );

    // await addHistory(requestId, adminUser.id, "response_uploaded", prevStatus, "responded", newVersion, req.body.admin_note || "Admin responded");

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
console.log("Updating status:", requestId, status);
     const rows = await sqlModel.select(
      "requests",
      ["status"],
      { id: requestId }
    );

    if (!rows || rows.length === 0) {
      return res.status(404).send({
        status: false,
        message: "Request not found",
      });
    }

    const prevStatus = rows[0].status;

    await sqlModel.update(
      "requests",
      {
        status,
        updated_at: getCurrentDateTime(),
      },
      { id: requestId }
    );

    // await addHistory(requestId, adminUser.id, "status_changed", prevStatus, status, null, `Status changed to ${status}`);

    await addHistory(
  requestId,           // request_id
  null,                // request_response_id ✅
  adminUser.id,        // action_by
  "status_changed",    // action_type
  prevStatus,          // from_status
  status,              // to_status
  null,                // version
  `Status changed to ${status}`
);

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


exports.deleteRequest = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        status: false,
        message: "Request id is required",
      });
    }

    // check exists
    const exists = await sqlModel.select(
      "requests",
      ["id"],
      { id }
    );

    if (!exists || exists.length === 0) {
      return res.status(404).json({
        status: false,
        message: "Request not found",
      });
    }

    // delete child records first (important)
    await sqlModel.execute(
      `DELETE FROM request_responses WHERE request_id = ?`,
      [id]
    );

    await sqlModel.execute(
      `DELETE FROM request_attachments WHERE request_id = ?`,
      [id]
    );

     await sqlModel.execute(
      `DELETE FROM request_history WHERE request_id = ?`,
      [id]
    );

    // delete main request
    await sqlModel.execute(
      `DELETE FROM requests WHERE id = ?`,
      [id]
    );

    return res.status(200).json({
      status: true,
      message: "Request deleted successfully",
    });
  } catch (error) {
    console.error("deleteRequest error:", error);
    return res.status(500).json({
      status: false,
      message: "Failed to delete request",
    });
  }
};


exports.deleteRequestMultiple = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        status: false,
        message: "Ids array is required",
      });
    }

    await sqlModel.execute(
      `DELETE FROM request_responses WHERE request_id IN (?)`,
      [ids]
    );

    await sqlModel.execute(
      `DELETE FROM request_attachments WHERE request_id IN (?)`,
      [ids]
    );

      await sqlModel.execute(
      `DELETE FROM request_history WHERE request_id IN (?)`,
      [id]
    );

    // delete requests
    const result = await sqlModel.execute(
      `DELETE FROM requests WHERE id IN (?)`,
      [ids]
    );

    return res.status(200).json({
      status: true,
      message: "Requests deleted successfully",
      deletedCount: result?.affectedRows || 0,
    });
  } catch (error) {
    console.error("deleteRequestMultiple error:", error);
    return res.status(500).json({
      status: false,
      message: "Failed to delete requests",
    });
  }
};



