const sqlModel = require("../../config/db");

exports.getSalaryDetail = async (req, res, next) => {
  try {
    const whereClause = {};
    for (const key in req.query) {
      if (req.query.hasOwnProperty(key)) {
        whereClause[key] = req.query[key];
      }
    }
    console.log(req.user);
    const data = await sqlModel.select("emp_salary_detail", {}, whereClause);

    if (data.error) {
      return res.status(500).send(data);
    }

    if (data.length === 0) {
      return res.status(200).send({ status: false, message: "No data found" });
    }
    res.status(200).send({ status: true, data: data });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};

exports.insertSalaryDetail = async (req, res, next) => {
  try {
    const id = req.params.id || "";
    const { emp_id, salary, basic_salary } = req.body;

    const validation = validateFields({
      emp_id,
      salary,
      basic_salary,
    });

    if (!validation.valid) {
      return res.status(400).send({
        status: false,
        message: validation.message,
        statusCode: 1,
      });
    }

    const insert = {
      company_id: req.user.id,
      emp_id,
      salary,
      basic_salary,
    };

    if (id) {
      const salaryRecord = await sqlModel.select(
        "emp_salary_detail",
        {},
        {
          emp_id: id,
        }
      );

      if (salaryRecord.length === 0) {
        insert.created_at = getCurrentDateTime();
        const saveData = await sqlModel.insert("emp_salary_detail", insert);

        if (saveData.error) {
          return res.status(200).send(saveData);
        } else {
          return res.status(200).send({ status: true, message: "Data Saved" });
        }
      } else {
        insert.updated_at = getCurrentDateTime();
        const saveData = await sqlModel.update("emp_salary_detail", insert, {
          emp_id: id,
        });

        if (saveData.error) {
          return res.status(200).send(saveData);
        } else {
          return res
            .status(200)
            .send({ status: true, message: "Data Updated" });
        }
      }
    }
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};
