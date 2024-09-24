const sqlModel = require("../../config/db");

// exports.getRecord = async (req, res, next) => {
//   try {
//     const token = req.headers.authorization?.split(" ")[1];

//     if (!token) {
//       return res
//         .status(200)
//         .send({ status: false, message: "Token is required" });
//     }

//     const [employee] = await sqlModel.select(
//       "employees",
//       ["id", "company_id"],
//       { api_token: token }
//     );

//     if (!employee) {
//       return res
//         .status(200)
//         .send({ status: false, message: "Employee not found" });
//     }

//     const { id: emp_id, company_id } = employee;

//     if (!emp_id || !company_id) {
//       return res.status(200).send({
//         status: false,
//         message: "Employee ID and company ID are required",
//       });
//     }
//     // Get the month and year from query parameters or default to current month
//     const queryDate = req.query.date || new Date().toISOString().split("T")[0];
//     const [year, month] = queryDate.split("-");

//     // Fetch data from emp_attendance
//     const query = `
//        SELECT
//          SUM(COALESCE(CAST(total_duration AS UNSIGNED), 0)) AS total_duration,
//          COUNT(DISTINCT CASE WHEN checkin_status = 'Check-in' THEN date END) AS total_checkins,
//          SUM(COALESCE(CAST(total_distance AS UNSIGNED), 0)) AS total_distance

//        FROM emp_attendance
//        WHERE emp_id = ?
//          AND company_id = ?
//          AND YEAR(date) = ?
//          AND MONTH(date) = ?
//      `;
//     //  SUM(COALESCE(CAST(total_leave_days AS UNSIGNED), 0)) AS remaining_leave_days
//     const [data] = await sqlModel.customQuery(query, [
//       emp_id,
//       company_id,
//       year,
//       month,
//     ]);

//     const leaveDetailsQuery = `
//     SELECT
//       lt.id AS leave_type_id,
//       lt.name,
//       lt.total_leave_days,
//       COALESCE(lr.no_of_days, 0) AS no_of_days_taken,
//       (lt.total_leave_days - COALESCE(lr.no_of_days, 0)) AS remaining_leave
//     FROM
//       leave_type lt
//     LEFT JOIN
//       leave_record lr ON lt.id = lr.leave_type AND lr.emp_id = ?
//     WHERE
//       lt.company_id = ?
//   `;

//   const results = await sqlModel.customQuery(leaveDetailsQuery, [
//     emp_id,
//     company_id,
//   ]);

//     if (data.error) {
//       return res.status(500).send(data);
//     }

//     // Format the response
//     const response = [
//       {
//         title: "Hour Worked",
//         icon: "https://telindia.s3.ap-south-1.amazonaws.com/icons/clock.png",
//         detail: data.total_duration || "00:00:00",
//       },
//       {
//         title: "Attendance",
//         icon: "https://telindia.s3.ap-south-1.amazonaws.com/icons/User.png",
//         detail: ((data.total_checkins / 30) * 100).toFixed(2) + "%",
//       },
//       {
//         title: "Distance Covered",
//         icon: "https://telindia.s3.ap-south-1.amazonaws.com/icons/location.png",
//         detail: data.total_distance || "0",
//       },
//       {
//         title: "Remaining Leaves",
//         icon: "https://telindia.s3.ap-south-1.amazonaws.com/icons/Date.png",
//         detail: data.remaining_leave_days || "0",
//       },
//     ];

//     if (response.length === 0) {
//       return res.status(200).send({ status: false, message: "No data found" });
//     }

//     res.status(200).send({ status: true, data: response });
//   } catch (error) {
//     res.status(200).send({ status: false, error: error.message });
//   }
// };

exports.getRecord = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res
        .status(200)
        .send({ status: false, message: "Token is required" });
    }

    const [employee] = await sqlModel.select(
      "employees",
      ["id", "company_id"],
      { api_token: token }
    );

    if (!employee) {
      return res
        .status(200)
        .send({ status: false, message: "Employee not found" });
    }

    const { id: emp_id, company_id } = employee;

    if (!emp_id || !company_id) {
      return res.status(200).send({
        status: false,
        message: "Employee ID and company ID are required",
      });
    }

    // Get the month and year from query parameters or default to current month
    const queryDate = req.query.date || new Date().toISOString().split("T")[0];
    const [year, month] = queryDate.split("-");
    console.log(queryDate);
    // Fetch attendance data from emp_attendance
    // COUNT(DISTINCT CASE WHEN checkin_status = 'Check-in' THEN date END) AS total_checkins,
    const query = `
      SELECT
        SUM(COALESCE(CAST(total_duration AS UNSIGNED), 0)) AS total_duration,
    
           COUNT(id) AS total_checkins,
        SUM(COALESCE(CAST(total_distance AS UNSIGNED), 0)) AS total_distance
      FROM emp_attendance
      WHERE emp_id = ? 
        AND company_id = ?
        AND YEAR(date) = ?
        AND MONTH(date) = ?
    `;
    const [data] = await sqlModel.customQuery(query, [
      emp_id,
      company_id,
      year,
      month,
    ]);

    if (data.error) {
      return res.status(500).send(data);
    }

    // Calculate the total days in the selected month for attendance percentage
    const daysInMonth = new Date(year, month, 0).getDate();
    const attendancePercentage =
      ((data.total_checkins / daysInMonth) * 100).toFixed(0) + "%";

    // Fetch leave details from leave_type and leave_record tables
    const leaveDetailsQuery = `
      SELECT 
        lt.id AS leave_type_id,
        lt.name,
        lt.total_leave_days,
        COALESCE(SUM(lr.no_of_days), 0) AS no_of_days_taken,
        (lt.total_leave_days - COALESCE(SUM(lr.no_of_days), 0)) AS remaining_leave
      FROM leave_type lt
      LEFT JOIN leave_record lr ON lt.id = lr.leave_type AND lr.emp_id = ?
      WHERE lt.company_id = ?
      GROUP BY lt.id, lt.name, lt.total_leave_days
    `;

    const leaveDetails = await sqlModel.customQuery(leaveDetailsQuery, [
      emp_id,
      company_id,
    ]);

    // Sum up remaining leave days across all leave types
    const totalRemainingLeave = leaveDetails.reduce(
      (sum, leave) => sum + leave.remaining_leave,
      0
    );

    // Format the response data
    const response = [
      {
        title: "Hour Worked",
        icon: "https://telindia.s3.ap-south-1.amazonaws.com/icons/clock.png",
        detail: data.total_duration || "00:00:00",
      },
      {
        title: "Attendance",
        icon: "https://telindia.s3.ap-south-1.amazonaws.com/icons/User.png",
        detail: attendancePercentage,
      },
      {
        title: "Distance Covered",
        icon: "https://telindia.s3.ap-south-1.amazonaws.com/icons/location.png",
        detail: data.total_distance || "0",
      },
      {
        title: "Remaining Leaves",
        icon: "https://telindia.s3.ap-south-1.amazonaws.com/icons/Date.png",
        detail: totalRemainingLeave || "0",
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
