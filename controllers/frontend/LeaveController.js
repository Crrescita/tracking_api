const sqlModel = require("../../config/db");

exports.createLeaveRequest = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res
        .status(400)
        .send({ status: false, message: "Token is required" });
    }

    const [employee] = await sqlModel.select(
      "employees",
      ["id", "company_id"],
      { api_token: token }
    );

    if (!employee) {
      return res
        .status(404)
        .send({ status: false, message: "Employee not found" });
    }

    const leaveRequestId = req.params.id;
    const insert = { ...req.body };

    insert.emp_id = employee.id;
    insert.company_id = employee.company_id;
    insert.created_at = getCurrentDateTime();

    const validation = validateFields({
      from_date: insert.from_date,
      to_date: insert.to_date,
      leave_type: insert.leave_type,
    });

    if (!validation.valid) {
      return res.status(400).send({
        status: false,
        message: validation.message,
        statusCode: 1,
      });
    }

    let saveData;
    if (leaveRequestId) {
      const existingLeaveRequest = await sqlModel.select(
        "leave_request",
        ["id"],
        { id: leaveRequestId, emp_id: employee.id }
      );

      if (existingLeaveRequest.length > 0) {
        const updateCondition = { id: leaveRequestId };
        saveData = await sqlModel.update(
          "leave_request",
          insert,
          updateCondition
        );
      } else {
        return res.status(404).send({
          status: false,
          message: "Leave request not found",
        });
      }
    } else {
      saveData = await sqlModel.insert("leave_request", insert);
    }

    if (saveData.error) {
      return res.status(200).send(saveData);
    } else {
      const msg = leaveRequestId ? "Data Updated" : "Data Saved";
      return res.status(200).send({ status: true, message: msg });
    }
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};
