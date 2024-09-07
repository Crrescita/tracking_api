const sqlModel = require("../../config/db");

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
        await sqlModel.update("fcm_tokens", tokenData, { user_id: userId });
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
