const sqlModel = require("../../config/db");
const admin = require("firebase-admin");
const crypto = require("crypto");

exports.setFcmToken = async (req, res) => {
  try {
    const { userId, fcmToken, device_info } = req.body;

    // Ensure all required fields are provided
    if (!userId || !fcmToken || !device_info) {
      return res
        .status(400)
        .send({ status: false, message: "Missing required fields." });
    }

    const existingToken = await sqlModel.select("fcm_tokens", ["*"], {
      user_id: userId,
    });

    const tokenData = {
      user_id: userId,
      fcm_token: fcmToken,
      device_info: device_info,
    };

    if (existingToken.length > 0) {
      (tokenData.updated_at = getCurrentDateTime()),
        await sqlModel.update("fcm_tokens", tokenData, {
          device_info: device_info,
        });
      res
        .status(200)
        .send({ status: true, message: "FCM Token updated successfully." });
    } else {
      // Insert new token
      await sqlModel.insert("fcm_tokens", {
        ...tokenData,
        created_at: getCurrentDateTime(),
      });
      res
        .status(200)
        .send({ status: true, message: "FCM Token inserted successfully." });
    }
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};

exports.sendCustomNotification = async (req, res) => {
  try {
    const {
      emp_id,
      type,
      fcm_token: requestFcmToken,
      title: customTitle,
      body: customBody,
      type: notification_type,
    } = req.body;

    if (!emp_id || !type) {
      return res.status(400).send({
        status: false,
        message: "Employee ID and type are required",
      });
    }

    const [employee] = await sqlModel.select(
      "employees",
      ["fcm_token", "name"],
      { id: emp_id }
    );

    if (!employee || !employee.fcm_token) {
      return res.status(404).send({
        status: false,
        message: "Employee not found or FCM token not set",
      });
    }

    const fcm_token = employee.fcm_token;

    let title = "Notification";
    let body = `Hello Employee ${employee.name}, you have a new notification.`;
    let dataPayload = {
      emp_id: emp_id.toString(),
      // type: type.toString(),
      requestFcmToken: requestFcmToken || "",
      request_live_location: type == "1" ? "true" : "false",
      // click_action: "FLUTTER_NOTIFICATION_CLICK",
    };

    if (type == "1") {
      // Live Location Request
      title = "Live Location Request";
      body = `Hello Employee ${employee.name}, please share your live location.`;
      const random8DigitInt = Math.floor(10000000 + Math.random() * 90000000);
      const stringifiedInt = random8DigitInt.toString();

      // dataPayload.notificationId = crypto.randomBytes(8).toString("hex");
      dataPayload.notificationId = stringifiedInt;

      dataPayload.notificationType = type.toString();
    } else if (type == "2" && customTitle && customBody && notification_type) {
      title = customTitle;
      body = customBody;

      const notificationRecord = await sqlModel.insert("emp_notification", {
        emp_id,
        title: customTitle,
        body: customBody,
        type: notification_type,
        created_at: getCurrentDateTime(),
      });

      const notification_id = notificationRecord.insertId;
      dataPayload.notificationId = notification_id.toString();
      dataPayload.notificationType = type.toString();
    }
    dataPayload.title = title;
    dataPayload.body = body;
    const message = {
      // topic: "global_info",
      token: fcm_token,
      // notification: { title, body },
      data: dataPayload,
      // android: {
      //   priority: "high",
      //   notification: {
      //     channel_id: "high_importance_channel",
      //     sound: "default",
      //     click_action: "OPEN_ACTIVITY_1",
      //   },
      // },
      apns: {
        payload: {
          aps: {
            sound: "default",
            contentAvailable: true,
          },
        },
        headers: {
          "apns-priority": "10",
        },
      },
    };
    console.log(message);
    // Send the FCM message
    admin
      .messaging()
      .send(message)
      .then(() => {
        res.status(200).send({
          status: true,
          message: "Notification sent successfully.",
          notification_id: dataPayload.notification_id, // Return the notification ID in response
        });
      })
      .catch((error) => {
        console.error("Error sending FCM notification:", error);
        res.status(500).send({ status: false, message: "Notification failed" });
      });
  } catch (error) {
    res.status(500).send({ status: false, message: error.message });
  }
};

// exports.sendCustomNotification = async (req, res) => {
//   try {
//     const { emp_id, type, fcm_token: requestFcmToken } = req.body;

//     if (!emp_id || !type) {
//       return res.status(400).send({
//         status: false,
//         message: "Employee ID and type are required",
//       });
//     }

//     const [employee] = await sqlModel.select(
//       "employees",
//       ["fcm_token", "name"],
//       { id: emp_id }
//     );

//     if (!employee || !employee.fcm_token) {
//       return res.status(404).send({
//         status: false,
//         message: "Employee not found or FCM token not set",
//       });
//     }

//     const fcm_token = employee.fcm_token;

//     let title = "Notification";
//     let body = `Hello Employee ${employee.name}, you have a new notification.`;

//     if (type == "1") {
//       title = "Live Location Request";
//       body = `Hello Employee ${employee.name}, please share your live location.`;
//     } else if (type === "task") {
//       title = "New Task Assigned";
//       body = `Hello Employee ${employee.name}, a new task has been assigned to you.`;
//     } else if (type === "reminder") {
//       title = "Reminder";
//       body = `Hello Employee ${employee.name}, this is a reminder for your upcoming task.`;
//     }

//     const message = {
//       token: fcm_token,
//       notification: { title, body },
//       data: {
//         emp_id: emp_id.toString(),
//         type: type.toString(),
//         requestFcmToken,
//         request_live_location: type == "1" ? "true" : "false",
//         click_action: "FLUTTER_NOTIFICATION_CLICK",
//       },
//       android: {
//         priority: "high",
//         notification: {
//           channel_id: "high_importance_channel",
//           sound: "default",
//           click_action: "OPEN_ACTIVITY_1",
//         },
//       },
//       apns: {
//         payload: {
//           aps: {
//             sound: "default",
//             contentAvailable: true,
//           },
//         },
//         headers: {
//           "apns-priority": "10",
//         },
//       },
//     };
//     // console.log(message);
//     // Send the FCM message
//     admin
//       .messaging()
//       .send(message)
//       .then(() => {
//         res.status(200).send({
//           status: true,
//           message: "Notification sent successfully.",
//         });
//       })
//       .catch((error) => {
//         console.error("Error sending FCM notification:", error);
//         res.status(500).send({ status: false, message: "Notification failed" });
//       });
//   } catch (error) {
//     res.status(500).send({ status: false, message: error.message });
//   }
// };

// const sendNotification = async (userId, message) => {
//     const tokens = await FcmToken.findAll({ where: { userId } });
//     const fcmTokens = tokens.map(t => t.fcmToken);

//     const notificationPayload = {
//         notification: {
//             title: 'Notification Title',
//             body: message
//         },
//         tokens: fcmTokens
//     };

//     await fcm.sendMulticast(notificationPayload);
// };

exports.sendGlobalInfoToTopic = async (req, res) => {
  // Extract message details from the request body
  const { message, type } = req.body;

  if (!message || !type) {
    return res.status(400).json({ error: "Message and type are required." });
  }

  const notificationMessage = {
    topic: "global_info", // Ensure all users are subscribed to this topic
    notification: {
      title: "Reminder",
      body: message,
    },
    data: {
      infoType: type,
      title: "Reminder",
      body: message,
    },
  };

  try {
    const response = await admin.messaging().send(notificationMessage);
    console.log("Notification sent to topic:", response);
    return res
      .status(200)
      .json({ message: "Notification sent successfully.", response });
  } catch (error) {
    console.error("Error sending notification to topic:", error);
    return res
      .status(500)
      .json({ error: "Failed to send notification.", details: error.message });
  }
};
