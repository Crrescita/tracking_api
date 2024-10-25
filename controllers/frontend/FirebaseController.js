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
