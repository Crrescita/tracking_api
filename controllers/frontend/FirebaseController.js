const sqlModel = require("../../config/db");

exports.setFcmToken = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res
        .status(200)
        .send({ status: false, message: "Token is required" });
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

    const tokenData = {
      fcm_token: fcm_token,
    };

    if (existingToken.length > 0) {
      tokenData.fmc_updated_at = getCurrentDateTime();
      await sqlModel.update("employees", tokenData, { id: employee.id });

      res
        .status(200)
        .send({ status: true, message: "FCM Token updated successfully." });
    } else {
      await sqlModel.update(
        "employees",
        {
          ...tokenData,
          fmc_created_at: getCurrentDateTime(),
        },
        { id: employee.id }
      );

      res
        .status(200)
        .send({ status: true, message: "FCM Token inserted successfully." });
    }
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};
