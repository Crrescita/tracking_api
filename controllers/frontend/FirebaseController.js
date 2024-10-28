const sqlModel = require("../../config/db");
const admin = require("../../firebase");
// exports.setFcmToken = async (req, res) => {
//   try {
//     const token = req.headers.authorization?.split(" ")[1];

//     if (!token) {
//       return res
//         .status(200)
//         .send({ status: false, message: "Token is required" });
//     }

//     const [employee] = await sqlModel.select(
//       "employees",
//       ["id", "company_id", "name", "image"],
//       { api_token: token }
//     );

//     if (!employee) {
//       return res
//         .status(404)
//         .send({ status: false, message: "Employee not found" });
//     }

//     const { fcm_token } = req.body;

//     if (!fcm_token) {
//       return res
//         .status(400)
//         .send({ status: false, message: "FCM token is required" });
//     }

//     const existingToken = await sqlModel.select("employees", ["fcm_token"], {
//       id: employee.id,
//     });

//     const tokenData = {
//       fcm_token: fcm_token,
//     };

//     if (existingToken.length > 0) {
//       tokenData.fmc_updated_at = getCurrentDateTime();
//       await sqlModel.update("employees", tokenData, { id: employee.id });

//       res
//         .status(200)
//         .send({ status: true, message: "FCM Token updated successfully." });
//     } else {
//       await sqlModel.update(
//         "employees",
//         {
//           ...tokenData,
//           fmc_created_at: getCurrentDateTime(),
//         },
//         { id: employee.id }
//       );

//       res
//         .status(200)
//         .send({ status: true, message: "FCM Token inserted successfully." });
//     }
//   } catch (error) {
//     res.status(500).send({ status: false, error: error.message });
//   }
// };

exports.setFcmTokenAndNotify = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res
        .status(400)
        .send({ status: false, message: "Authorization token is required" });
    }

    const [employee] = await sqlModel.select(
      "employees",
      ["id", "company_id", "name", "image"],
      { api_token: token }
    );

    if (!employee) {
      return res
        .status(404)
        .send({ status: false, message: "Employee not found" });
    }

    const { fcm_token } = req.body;

    if (!fcm_token) {
      return res
        .status(400)
        .send({ status: false, message: "FCM token is required" });
    }

    const existingToken = await sqlModel.select("employees", ["fcm_token"], {
      id: employee.id,
    });

    const tokenData = { fcm_token };
    const dateField =
      existingToken.length > 0 ? "fmc_updated_at" : "fmc_created_at";
    tokenData[dateField] = getCurrentDateTime();

    // Update or insert the FCM token
    await sqlModel.update("employees", tokenData, { id: employee.id });

    // Send notification after setting the FCM token
    const message = {
      notification: {
        title: "Welcome!",
        body: `Hello ${employee.name}, you have successfully registered your device for notifications.`,
      },
      token: fcm_token,
      android: { priority: "high" },
      apns: {
        payload: {
          aps: { sound: "default" },
        },
      },
    };

    admin
      .messaging()
      .send(message)
      .then(() => {
        res.status(200).send({
          status: true,
          message:
            existingToken.length > 0
              ? "FCM Token updated and notification sent."
              : "FCM Token inserted and notification sent.",
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

// exports.sendNotification = async (req, res) => {
//   try {
//     const { fcm_token } = req.body;

//     if (!fcm_token) {
//       return res
//         .status(400)
//         .send({ status: false, message: "FCM token is required" });
//     }

//     // Define the notification message
//     const message = {
//       notification: {
//         title: "Hello!",
//         body: "This is a test notification.",
//       },
//       token: fcm_token,
//       android: { priority: "high" },
//       apns: {
//         payload: {
//           aps: { sound: "default" },
//         },
//       },
//     };

//     // Send the message through FCM
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

exports.sendNotification = async (req, res) => {
  try {
    const { fcm_token } = req.body;

    if (!fcm_token) {
      return res
        .status(400)
        .send({ status: false, message: "FCM token is required" });
    }

    const message = {
      token: fcm_token,
      notification: {
        title: "Hello!",
        body: "This is a test notification.",
      },
      data: {
        title: "Hello!",
        body: "This is a data notification for handling in foreground.",
        click_action: "FLUTTER_NOTIFICATION_CLICK",
      },
      android: {
        priority: "high",
        notification: {
          channel_id: "high_importance_channel",
          sound: "default",
          color: "#FF0000",
          click_action: "OPEN_ACTIVITY_1",
        },
      },
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

    admin
      .messaging()
      .send(message)
      .then(() => {
        res.status(200).send({
          status: true,
          message: "Notification sent successfully.",
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

exports.receiveLocationData = async (req, res) => {
  try {
    const {
      emp_id,
      fcm_token,
      latitude,
      longitude,
      battery_status,
      is_motion,
      internet_status,
    } = req.body;

    if (!emp_id || !fcm_token || !latitude || !longitude) {
      return res.status(400).send({
        status: false,
        message: "Employee ID, FCM token, latitude, and longitude are required",
      });
    }

    // const [adminToken] = await sqlModel.select("fcm_tokens", ["fcm_token"], {
    //   fcm_token,
    // });

    // if (!adminToken) {
    //   return res.status(404).send({
    //     status: false,
    //     message: "adminToken not found",
    //   });
    // }

    // if (adminToken.fcm_token !== fcm_token) {
    //   return res.status(403).send({
    //     status: false,
    //     message: "Invalid FCM token ",
    //   });
    // }

    // Save location data to the database
    // await sqlModel.insert("employee_locations", {
    //   emp_id,
    //   latitude,
    //   longitude,
    //   timestamp: new Date(),
    // });

    // Define the notification message
    const notificationTitle = "Location Update Received";
    const notificationBody = `Hello , your location has been successfully updated.`;

    const message = {
      token: fcm_token,
      notification: {
        title: notificationTitle,
        body: notificationBody,
      },
      data: {
        emp_id: emp_id.toString(),
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        // click_action: "FLUTTER_NOTIFICATION_CLICK",
      },
      android: {
        priority: "high",
        notification: {
          channel_id: "location_updates",
          sound: "default",
          click_action: "OPEN_LOCATION_ACTIVITY",
        },
      },
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

    // Send the notification
    await admin.messaging().send(message);

    // Respond with success
    res.status(200).send({
      status: true,
      message: "Location data received and notification sent successfully",
    });
  } catch (error) {
    console.error("Error processing location data:", error);
    res
      .status(500)
      .send({ status: false, message: "Failed to process location data" });
  }
};
