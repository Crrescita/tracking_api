const sqlModel = require("../../config/db");

exports.getRecord = async (req, res, next) => {
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

    const { id: emp_id, company_id } = employee;

    if (!emp_id || !company_id) {
      return res.status(400).send({
        status: false,
        message: "Employee ID and company ID are required",
      });
    }

    // Fetch data from emp_attendance
    // const query = `
    //     SELECT
    //       SUM(COALESCE(CAST(total_duration AS UNSIGNED), 0)) AS total_duration,
    //       COUNT(DISTINCT CASE WHEN checkin_status = 'Check-in' THEN date END) AS total_checkins,
    //       SUM(COALESCE(CAST(total_distance AS UNSIGNED), 0)) AS total_distance

    //     FROM emp_attendance
    //     WHERE emp_id = ? AND company_id = ?
    //   `;
    // //   SUM(COALESCE(CAST(total_leave_days AS UNSIGNED), 0)) AS remaining_leave_days
    // const [data] = await sqlModel.customQuery(query, [emp_id, company_id]);

    // Get the month and year from query parameters or default to current month
    const queryDate = req.query.date || new Date().toISOString().split("T")[0];
    const [year, month] = queryDate.split("-");

    // Fetch data from emp_attendance
    const query = `
       SELECT
         SUM(COALESCE(CAST(total_duration AS UNSIGNED), 0)) AS total_duration,
         COUNT(DISTINCT CASE WHEN checkin_status = 'Check-in' THEN date END) AS total_checkins,
         SUM(COALESCE(CAST(total_distance AS UNSIGNED), 0)) AS total_distance
        
       FROM emp_attendance
       WHERE emp_id = ? 
         AND company_id = ?
         AND YEAR(date) = ?
         AND MONTH(date) = ?
     `;
    //  SUM(COALESCE(CAST(total_leave_days AS UNSIGNED), 0)) AS remaining_leave_days
    const [data] = await sqlModel.customQuery(query, [
      emp_id,
      company_id,
      year,
      month,
    ]);

    if (data.error) {
      return res.status(500).send(data);
    }

    // Format the response
    const response = [
      {
        title: "Hour Worked",
        icon: process.env.BASE_URL, // Add icon URL or path if needed
        hour_worked: data.total_duration || "00:00:00", // Default value if null
      },
      {
        title: "Attendance",
        icon: process.env.BASE_URL, // Add icon URL or path if needed
        attendance_percentage:
          ((data.total_checkins / 30) * 100).toFixed(2) + "%", // Assuming 30 days in a month
      },
      {
        title: "Distance Covered",
        icon: process.env.BASE_URL, // Add icon URL or path if needed
        total_distance: data.total_distance || "0", // Default value if null
      },
      {
        title: "Remaining Leaves",
        icon: process.env.BASE_URL, // Add icon URL or path if needed
        remaining_leave: data.remaining_leave_days || "0", // Default value if null
      },
    ];

    if (response.length === 0) {
      return res.status(200).send({ status: false, message: "No data found" });
    }

    res.status(200).send({ status: true, data: response });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};
