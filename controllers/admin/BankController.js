const sqlModel = require("../../config/db");

exports.getBankDetail = async (req, res, next) => {
  try {
    // const id = req.params?.id || "";
    const whereClause = {};
    for (const key in req.query) {
      if (req.query.hasOwnProperty(key)) {
        whereClause[key] = req.query[key];
      }
    }

    // const whereClause = id ? { id } : {};
    const data = await sqlModel.select("emp_bank_detail", {}, whereClause);

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

exports.insertBankDetail = async (req, res, next) => {
  try {
    const id = req.params.id || "";
    const {
      emp_id,
      company_id,
      acc_holder_name,
      acc_number,
      bank_name,
      ifsc_code,
    } = req.body;

    const validation = validateFields({
      emp_id,
      company_id,
      acc_holder_name,
      acc_number,
      bank_name,
      ifsc_code,
    });

    if (!validation.valid) {
      return res.status(400).send({
        status: false,
        message: validation.message,
        statusCode: 1,
      });
    }

    const insert = {
      emp_id,
      company_id,
      acc_holder_name,
      acc_number,
      bank_name,
      ifsc_code,
    };
    if (id) {
      const backRecord = await sqlModel.select(
        "emp_bank_detail",
        {},
        {
          emp_id: id,
        }
      );

      if (backRecord.length === 0) {
        insert.created_at = getCurrentDateTime();
        const saveData = await sqlModel.insert("emp_bank_detail", insert);

        if (saveData.error) {
          return res.status(200).send(saveData);
        } else {
          return res.status(200).send({ status: true, message: "Data Saved" });
        }
      } else {
        insert.updated_at = getCurrentDateTime();
        const saveData = await sqlModel.update("emp_bank_detail", insert, {
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
