const sqlModel = require("../../config/db");
const path = require("path");

exports.createSupport = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(200).send({
        status: false,
        message: "Token is required",
      });
    }

    const [employee] = await sqlModel.select(
      "employees",
      {},
      { api_token: token }
    );

    if (!employee) {
      return res.status(404).send({
        status: false,
        message: "Employee not found",
      });
    }

    const insertData = {
      ...req.body,
      emp_id: employee.id,
      company_id: employee.company_id,
      created_at: getCurrentDateTime(),
    };

    if (req.files && req.files.image) {
      insertData.media = req.fileFullPath.find((path) =>
        path.includes("image")
      );
    }

    const saveData = await sqlModel.insert("support", insertData);

    return res.status(200).send({
      status: true,
      message:
        "Support request has been successfully created. Our team will reach out to you shortly.",
      data: saveData,
    });
  } catch (error) {
    return res.status(500).send({
      status: false,
      error: error.message,
    });
  }
};
