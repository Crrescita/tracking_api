// controllers/frontend/RequestsController.js
const path = require("path");
const fs = require("fs");
const sqlModel = require("../../config/db");
const { uploadLocalFileToS3 } = require("../../config/s3");
const adminMessaging = require("../../firebase"); // your firebase setup (same as leave controller)
const { getCurrentDateTime } = require("../../config/datetime"); // assume you have or create similar helper

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

async function addHistory(request_id, action_by, action_type, from_status, to_status, version, message,title, description) {
  await sqlModel.insert("request_history", {
    request_id,
    action_by,
    action_type,
    from_status,
    to_status,
    version,
    message,
    title,
    description,
    created_at: getCurrentDateTime(),
  });
}

/**
 * Create request (user)
 * - expects token header (same flow as leave controller)
 * - accepts multipart files through existing multerConfig (req.fileFullPath populated)
 */
exports.createRequest = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(200).send({ status: false, message: "Token is required" });

    const [user] = await sqlModel.select("employees", ["id", "company_id", "name", "image"], { api_token: token });
    if (!user) return res.status(200).send({ status: false, message: "User not found" });

    const insert = {
      emp_id: user.id,
      type: req.body.type, // expected: 'quotation'|'invoice'|...
      title: req.body.title || null,
      description: req.body.description || null,
      priority: req.body.priority || "medium",
      status: "requested",
      current_version: 0,
      created_at: getCurrentDateTime(),
      updated_at: getCurrentDateTime(),
    };

    const saveData = await sqlModel.insert("requests", insert);
    if (saveData.error) return res.status(200).send(saveData);

    const request_id = saveData.insertId;

    // If multer saved files locally, multerConfig pushes paths to req.fileFullPath (array of 'images/<folder>/<file>')
    if (
          req.fileFullPath &&
          Array.isArray(req.fileFullPath) &&
          req.fileFullPath.length > 0
        ) {
          const uploadedRecords = [];

          for (const relPath of req.fileFullPath) {
            // 🔥 Fix multer path (add `public/` prefix)
            const fixed = fixMulterRelativePath(relPath);

            // 🔥 Convert to absolute local path
            const localAbsolute = buildLocalAbsolutePath(fixed);

            try {
              const keyPrefix = `${insert.type}/${request_id}/v0`;

              const { key, url } = await uploadLocalFileToS3(localAbsolute, keyPrefix);

              await sqlModel.insert("request_attachments", {
                request_id,
                file_path: key, // store S3 key (best practice)
                file_type: path.extname(localAbsolute).replace(".", ""),
                created_at: getCurrentDateTime(),
              });

              // delete local file
              fs.unlinkSync(localAbsolute);

              uploadedRecords.push({ key, url });
            } catch (e) {
              console.error("S3 upload failed for", relPath, e.message);
            }
          }
        }


    // history
    await addHistory(request_id, user.id, "request_created", null, "requested", 0, "User created request", req.body.title, req.body.description);

    // notify company admins (FCM) similar to leave flow
    const tokens = await sqlModel.select("fcm_tokens", ["fcm_token"], { user_id: user.company_id });
    if (tokens.length > 0) {
      const messageContent = `New ${insert.type} request from ${user.name}`;
      const notificationPromises = tokens.map(({ fcm_token }) => {
        return adminMessaging.messaging().send({
          notification: {
            title: `New ${insert.type} Request`,
            body: messageContent,
            image: user.image ? `${process.env.BASE_URL}${user.image}` : "",
          },
          token: fcm_token,
        });
      });
      try {
        await Promise.all(notificationPromises);
        await sqlModel.insert("notification", {
          company_id: user.company_id,
          title: "New Request",
          body: messageContent,
          image: user.image,
          status: "unread",
          timestamp: getCurrentDateTime(),
        });
      } catch (e) {
        console.error("FCM error", e.message);
      }
    }

    return res.status(200).send({ status: true, message: "Request created", request_id });
  } catch (error) {
    console.error(error);
    return res.status(200).send({ status: false, error: error.message });
  }
};

/**
 * Get all requests for the authenticated employee (list)
 */
exports.getRequestsByEmployee = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(200).send({ status: false, message: "Token is required" });

    const [user] = await sqlModel.select("employees", ["id", "company_id", "name", "image"], { api_token: token });
    if (!user) return res.status(200).send({ status: false, message: "User not found" });

    const requests = await sqlModel.customQuery(
      `SELECT r.* , u.name as employee_name
       FROM requests r
       LEFT JOIN employees u ON u.id = r.emp_id
       WHERE r.emp_id = ?
       ORDER BY r.id DESC`,
      [user.id]
    );

    // enrich with attachments and latest admin response
    for (const r of requests) {
      const attachments = await sqlModel.select("request_attachments", ["id", "file_path", "file_type", "created_at"], {
        request_id: r.id,
      });

      // convert stored S3 key to full url
      const attachmentsWithUrl = attachments.map((a) => ({
        ...a,
        file_url: a.file_path ? `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || "ap-south-1"}.amazonaws.com/${a.file_path}` : null,
      }));
      r.attachments = attachmentsWithUrl;
      console.log("admin response");
      console.log(r);
      // latest admin response (highest version)
      const [latestResp] = await sqlModel.customQuery(
        `SELECT rr.* , u.username as admin_name FROM request_responses rr
         LEFT JOIN users u ON u.id = rr.responded_by
         WHERE rr.request_id = ?  
         ORDER BY rr.version DESC LIMIT 1`,
        [r.id]
      );

      if (latestResp) {
        latestResp.file_url = latestResp.file_path ? `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || "ap-south-1"}.amazonaws.com/${latestResp.file_path}` : null;
      }
      r.admin_response = latestResp || null;
    }

    return res.status(200).send({ status: true, data: requests });
  } catch (error) {
    console.error(error);
    return res.status(200).send({ status: false, error: error.message });
  }
};

/**
 * Get single request detail (attachments, responses, history)
 */
exports.getRequestDetail = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(200).send({ status: false, message: "Token is required" });

    const [user] = await sqlModel.select("employees", ["id"], { api_token: token });
    if (!user) return res.status(200).send({ status: false, message: "User not found" });

    const requestId = req.params.id;

    const requestRows = await sqlModel.select("requests", ["*"], {
      id: requestId,
      emp_id: user.id
    });

    if (!requestRows || requestRows.length === 0) {
      return res.status(200).send({ status: false, message: "Request not found" });
    }

    const r = requestRows[0]; // FIXED

    // Attachments
    const attachments = await sqlModel.select("request_attachments", "*", {
      request_id: requestId
    });

    r.attachments = attachments.map((a) => ({
      ...a,
      file_url: a.file_path
        ? `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || "ap-south-1"}.amazonaws.com/${a.file_path}`
        : null
    }));

    // Responses
    // const responses = await sqlModel.select("request_responses", "*", {
    //   request_id: requestId
    // });
    const responses = await sqlModel.select(
                          "request_responses",
                          "*",
                          { request_id: requestId },
                          {
                            orderBy: "id DESC", // or created_at DESC
                            limit: 1
                          }
                        );

    const latestResponse = responses[0] || null;
    r.admin_response = latestResponse ? {
      ...latestResponse,
      file_url: latestResponse.file_path
        ? `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || "ap-south-1"}.amazonaws.com/${latestResponse.file_path}`
        : null
    } : null;

    // r.admin_response = responses.map((rr) => ({
    //   ...rr,
    //   file_url: rr.file_path
    //     ? `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || "ap-south-1"}.amazonaws.com/${rr.file_path}`
    //     : null
    // }));

    // History
    const history = await sqlModel.select("request_history", "*", {
      request_id: requestId
    });
 
    r.history = history.map((a) => ({
      ...a,
      type:r.type,
      priority:r.priority,
      status:r.status,
    }));


    return res.status(200).send({ status: true, data: r });
  } catch (error) {
    console.error(error);
    return res.status(200).send({ status: false, error: error.message });
  }
};


/**
 * Update (modify) request by user
 * Allowed only when status in ('pending','in_review') — this check is enforced below
 */
exports.modifyRequest = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(200).send({ status: false, message: "Token is required" });

    const [user] = await sqlModel.select("employees", ["id"], { api_token: token });
    if (!user) return res.status(200).send({ status: false, message: "User not found" });

    const requestId = req.params.id;
    const [existing] = await sqlModel.select("requests", ["status", "type", "current_version","title","description"], { id: requestId, emp_id: user.id });
    if (!existing || existing.length === 0) return res.status(200).send({ status: false, message: "Request not found" });
    console.dir("requests requests");
    console.log(existing);
    const reqRow = existing;
    if (!["requested"].includes(reqRow.status)) {
      return res.status(200).send({ status: false, message: "Cannot modify request in current status" });
    }

    const updateData = {
      title: req.body.title,
      description: req.body.description,
      priority: req.body.priority || reqRow.priority,
      current_version:reqRow.current_version+1,
      updated_at: getCurrentDateTime(),
    };

    await sqlModel.update("requests", updateData, { id: requestId });
    console.log("FILES:", req.files);
    console.log("FILEFULLPATH:", req.fileFullPath);

    if (!req.files || req.files.length === 0) {
      console.log("❌ No files uploaded in this request");
    } else {
      console.log("✅ Uploaded files:", req.files.map(f => f.filename));
    }
    // If files uploaded, upload them to S3 under same version (v0 user uploads or create new user-modification folder)
    console.log("req.fileFullPath");
    console.log(req.fileFullPath);
    if (req.fileFullPath && req.fileFullPath.length > 0) {
      for (const relPath of req.fileFullPath) {

        const fixed = fixMulterRelativePath(relPath);
        const localAbsolute = buildLocalAbsolutePath(fixed);

        try {
          const keyPrefix = `${reqRow.type}/${requestId}/v0`;

          const { key, url } = await uploadLocalFileToS3(localAbsolute, keyPrefix);

          await sqlModel.insert("request_attachments", {
            request_id: requestId,
            file_path: key,
            file_type: path.extname(localAbsolute).replace(".", ""),
            created_at: getCurrentDateTime(),
          });

          fs.unlinkSync(localAbsolute);

        } catch (err) {
          console.error("S3 upload failed →", err.message);
        }
      }
    }else{
      console.dir("Image not found")
    }

    await addHistory(requestId, user.id, "request_modified", reqRow.status, reqRow.status, (reqRow.current_version+1), "requested updated",reqRow.title,reqRow.description);

    return res.status(200).send({ status: true, message: "Request updated" });
  } catch (error) {
    console.error(error);
    return res.status(200).send({ status: false, error: error.message });
  }
};

/**
 * Delete request by user (allowed only if pending)
 */
exports.deleteRequest = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(200).send({ status: false, message: "Token is required" });

    const [user] = await sqlModel.select("employees", ["id"], { api_token: token });
    if (!user) return res.status(200).send({ status: false, message: "User not found" });

    const requestId = req.params.id;
    const [existing] = await sqlModel.select("requests", ["status"], { id: requestId, emp_id: user.id });
    if (!existing || existing.length === 0) return res.status(200).send({ status: false, message: "Request not found" });

    const status = existing[0].status;
    if (status !== "requested") return res.status(200).send({ status: false, message: "Only pending requests can be deleted" });

    await sqlModel.delete("requests", { id: requestId });
    await sqlModel.delete("request_attachments", { request_id: requestId });
    await sqlModel.delete("request_responses", { request_id: requestId });
    await sqlModel.delete("request_history", { request_id: requestId });

    await addHistory(requestId, user.id, "request_deleted", status, null, null, "User deleted request",title,description);

    return res.status(200).send({ status: true, message: "Request deleted" });
  } catch (error) {
    console.error(error);
    return res.status(200).send({ status: false, error: error.message });
  }
};

exports.deleteAttachment = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(200).send({ status: false, message: "Token is required" });

    const [user] = await sqlModel.select("employees", ["id"], { api_token: token });
    if (!user) return res.status(200).send({ status: false, message: "User not found" });

    const requestId = req.params.id;
    const [existing_att] = await sqlModel.select("request_attachments", ["request_id"], { id: requestId, emp_id: user.id });
    if (!existing_att || existing_att.length === 0) return res.status(200).send({ status: false, message: "Attachment not found" });

    const [existing] = await sqlModel.select("requests", ["status"], { id: existing_att[0].request_id, emp_id: user.id });
    if (!existing || existing.length === 0) return res.status(200).send({ status: false, message: "Request not found" });

    const status = existing[0].status;
    if (status !== "requested") return res.status(200).send({ status: false, message: "Only pending requests can be deleted" });

    await sqlModel.delete("request_attachments", {id:requestId});

    return res.status(200).send({ status: true, message: "Request deleted" });
  }catch(error){
    console.error(error);
    return res.status(200).send({ status: false, error: error.message });
  }
}

exports.shareRequest = async (req, res) => {
    try {
    const { name, email, mobile, request_id } = req.body;

    if (!name || !email || !mobile || !request_id) {
      return res.status(400).json({ message: "All fields are required!" });
    }
    
    const saveData = await sqlModel.insert("share_requests_logs", {name:name,email:email,mobile:mobile, request_id:request_id});

    if (saveData.error) {
       return res.status(200).send({ status: false, error: error.message });
    }else{
       return res.status(200).send({ status: true, message: "Detail submitted successfully!", });
    }

  } catch (error) {
    console.error("Submit Error:", error);
    return res.status(500).json({ message: "Server error", error });
  }
}

exports.getfollowup = async (req, res) => {
     try {
          return res.status(200).send({ status: true, data:[{'label':"1 Day", 'value':"1_day"},{'label':"2 Day", 'value':"2_day"},{'label':"3 Day", 'value':"3_day"},{'label':"Closed", 'value':"Closed"}] ,message: "Detail submitted successfully!", });
     }catch(err){
        console.error("Submit Error:", error);
        return res.status(500).json({ message: "Server error", error });
     }
}


exports.updateRequestStatus = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(200).send({ status: false, message: "Token is required" });

    const [user] = await sqlModel.select("employees", ["id"], { api_token: token });
    if (!user) return res.status(200).send({ status: false, message: "User not found" });

    const requestId = req.params.id;
    const [existing] = await sqlModel.select("requests", ["status", "type", "current_version","title","description"], { id: requestId, emp_id: user.id });
    if (!existing || existing.length === 0 || req.body.status === '') return res.status(200).send({ status: false, message: "Request not found or invalid status." });
    console.dir("requests requests");
    console.log(existing);
    const reqRow = existing;
    if (!["requested"].includes(reqRow.status)) {
      return res.status(200).send({ status: false, message: "Cannot modify request in current status" });
    }

    const updateData = {
      status:req.body.status,
      updated_at: getCurrentDateTime(),
    };

    await sqlModel.update("requests", updateData, { id: requestId });
    

    await addHistory(requestId, user.id, "request_modified", reqRow.status, reqRow.status, (reqRow.current_version), "status updated",reqRow.title,reqRow.description);

    return res.status(200).send({ status: true, message: "Request updated" });
  } catch (error) {
    console.error(error);
    return res.status(200).send({ status: false, error: error.message });
  }
};

exports.getRequestMenuData = async (req, res) => {
  try {
    const { type } = req.query;

    if (!type) {
      return res.status(400).json({
        status: false,
        message: "Type is required",
      });
    }
    const REQUEST_TYPE_CONFIG = {
                                    quotation: [
                                      {
                                        id: "raise_request",
                                        type: "quotation",
                                        title: "Raise a Request",
                                      },
                                      {
                                        id: "submitted_requests",
                                        type: "quotation",
                                        title: "Submitted Quotations",
                                      },
                                    ],

                                    invoice: [
                                      {
                                        id: "raise_invoice",
                                        type: "invoice",
                                        title: "Raise Invoice",
                                      },
                                      {
                                        id: "submitted_invoices",
                                        type: "invoice",
                                        title: "Submitted Invoices",
                                      },
                                    ],

                                    statement: [
                                      {
                                        id: "account_statement",
                                        type: "statement",
                                        title: "Account Statement",
                                      },
                                      {
                                        id: "download_statement",
                                        type: "statement",
                                        title: "Download Statement",
                                      },
                                    ],

                                    credit_note: [
                                      {
                                        id: "raise_credit_note",
                                        type: "credit_note",
                                        title: "Raise Credit Note",
                                      },
                                      {
                                        id: "submitted_credit_notes",
                                        type: "credit_note",
                                        title: "Submitted Credit Notes",
                                      },
                                    ],

                                    stock_status: [
                                      {
                                        id: "current_stock",
                                        type: "stock_status",
                                        title: "Current Stock",
                                      },
                                      {
                                        id: "stock_history",
                                        type: "stock_status",
                                        title: "Stock History",
                                      },
                                    ],
        };

    const data = REQUEST_TYPE_CONFIG[type];

    if (!data) {
      return res.status(400).json({
        status: false,
        message: "Invalid type",
        allowed_types: Object.keys(REQUEST_TYPE_CONFIG),
      });
    }

    return res.status(200).json({
      status: true,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};




