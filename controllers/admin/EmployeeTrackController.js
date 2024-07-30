const sqlModel = require("../../config/db");

exports.getCoordinates = async (req, res, next) => {
  try {
    const whereClause = {};

    for (const key in req.query) {
      if (req.query.hasOwnProperty(key)) {
        whereClause[key] = req.query[key];
      }
    }

    const data = await sqlModel.select("emp_tracking", {}, whereClause);

    if (data.error) {
      return res.status(500).send(data);
    }

    if (data.length === 0) {
      return res.status(200).send({ status: false, message: "No data found" });
    }

    // const result = await Promise.all(
    //   data.map(async (item) => {
    //     item.image = item.image ? `${process.env.BASE_URL}${item.image}` : "";

    //     return item;
    //   })
    // );

    res.status(200).send({ status: true, data: data });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};

exports.getEmpLoginDetail = async (req, res, next) => {
  try {
    const emp_id = req.params?.emp_id || "";
    const companyId = req.query?.company_id || "";

    let whereClause = {};
    if (emp_id) {
      whereClause.emp_id = emp_id;
    }
    if (companyId) {
      whereClause.company_id = companyId;
    }

    const data = await sqlModel.select("emp_login_history", {}, whereClause);

    if (data.error) {
      return res.status(200).send(data);
    }

    res.status(200).send({ status: true, data: data });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};

exports.getEmpLiveLocation = async (req, res, next) => {
  try {
    const whereClause = {};

    for (const key in req.query) {
      if (req.query.hasOwnProperty(key)) {
        whereClause[key] = req.query[key];
      }
    }

    const data = await sqlModel.select("emp_tracking", {}, whereClause);

    if (data.error) {
      return res.status(500).send(data);
    }

    if (data.length === 0) {
      return res.status(200).send({ status: false, message: "No data found" });
    }

    const item = data[data.length - 1];
    // item.image = item.image ? `${process.env.BASE_URL}${item.image}` : "";

    res.status(200).send({ status: true, data: item });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};

exports.getAttendence = async (req, res, next) => {
  try {
    const { company_id, date } = req.query;

    if (!company_id || !date) {
      return res.status(400).send({
        status: false,
        message: "Company id and date are required",
      });
    }

    // Base URL for images
    const baseUrl = process.env.BASE_URL || "http://your-default-base-url.com/";

    // Base query with LEFT JOIN to get all employees and their check-in statuses
    let query = `
      SELECT e.name,
             e.mobile,
             e.email,
             e.designation,
             e.employee_id,
             CASE
               WHEN e.image IS NOT NULL THEN CONCAT(?, e.image)
               ELSE e.image
             END AS image,
             c.date,
             c.check_in_time,
             c.check_out_time,
             CASE 
               WHEN c.emp_id IS NULL THEN 'pending' 
               ELSE c.checkin_status 
             END AS checkin_status
      FROM employees e
      LEFT JOIN check_in c ON e.id = c.emp_id AND e.company_id = c.company_id AND c.date = ?
      WHERE e.company_id = ?
    `;

    const values = [baseUrl, date, company_id];

    const data = await sqlModel.customQuery(query, values);

    if (data.length === 0) {
      return res.status(200).send({ status: false, message: "No data found" });
    }

    res.status(200).send({ status: true, data: data });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};
