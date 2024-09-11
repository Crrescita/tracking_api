const sqlModel = require("../../config/db");

exports.createSupport = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res
        .status(400)
        .send({ status: false, message: "Token is required" });
    }

    const [employee] = await sqlModel.select(
      "employees",
      {},
      { api_token: token }
    );

    if (!employee) {
      return res
        .status(404)
        .send({ status: false, message: "Employee not found" });
    }

    const insert = { ...req.body };

    insert.emp_id = employee.id;
    insert.company_id = employee.company_id;

    if (req.files && req.files.image) {
      insert.media = req.fileFullPath.find((path) => path.includes("image"));
    }
  } catch (error) {
    return status(500).status({ status: 500, error: error.message });
  }
};
