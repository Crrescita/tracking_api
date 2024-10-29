const sqlModel = require("../../config/db");
const admin = require("../../firebase");
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

const getCurrentTime = () => {
  const currentDate = new Date();

  const hour = String(currentDate.getHours()).padStart(2, "0");
  const minute = String(currentDate.getMinutes()).padStart(2, "0");
  const second = String(currentDate.getSeconds()).padStart(2, "0");

  const formattedTime = `${hour}:${minute}:${second}`;

  return formattedTime;
};

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
      motion,
      internet_status,
    } = req.body;

    const requiredFields = {
      emp_id,
      fcm_token,
      latitude,
      longitude,
      battery_status,
      motion,
      internet_status,
    };

    for (const [key, value] of Object.entries(requiredFields)) {
      if (!value) {
        return res.status(200).json({
          status: false,
          message: `${key.replace("_", " ")} is required`,
        });
      }
    }

    const [employee] = await sqlModel.select(
      "employees",
      ["name", "company_id"],
      {
        id: emp_id,
      }
    );

    if (!employee) {
      return res
        .status(200)
        .json({ status: false, message: "Employee not found" });
    }

    const company_id = employee.company_id;

    // const parseDateTime = (datetimeMobile) => {
    //   let dateTimeFormatted;

    //   if (!isNaN(datetimeMobile)) {
    //     const dateObj = new Date(parseFloat(datetimeMobile) * 1000);
    //     const date = dateObj.toISOString().split("T")[0];
    //     const time = dateObj.toTimeString().split(" ")[0];

    //     dateTimeFormatted = `${date} ${time}`;
    //   } else {
    //     dateTimeFormatted = datetimeMobile;
    //   }

    //   return dateTimeFormatted;
    // };

    // const datetimeFormatted = parseDateTime(datetime_mobile); // Format datetime_mobile

    // const [date, time] = datetimeFormatted.split(" "); // Split into date and time

    const newCheckInData = {
      company_id,
      emp_id,
      latitude,
      longitude,
      battery_status,
      date: getCurrentDate(),
      time: getCurrentTime(),
      created_at: getCurrentDateTime(),
      // gps_status: gps_status ? gps_status : "",
      internet_status,
      motion,
      datetime_mobile: getCurrentDateTime(),
      status: "requested",
      // row_id,
      // ...rest,
    };

    // console.log(newCheckInData);
    // Insert tracking data into emp_tracking table
    const result = await sqlModel.insert("emp_tracking", newCheckInData);

    // Define the notification message
    const notificationTitle = "Location Update Received";
    const notificationBody = `Hello ${employee.name},location has been successfully updated.`;

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
