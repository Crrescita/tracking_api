const sqlModel = require("../../config/db");

const getCurrentDate = () => {
  const currentDate = new Date();

  const options = {
    timeZone: "Asia/Kolkata",
  };
  const year = currentDate.toLocaleString("en-US", {
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
  const month = String(currentDate.getMonth() + 1).padStart(2, "0");
  const day = String(currentDate.getDate()).padStart(2, "0");

  const formattedDate = `${year}-${month}-${day}`;

  return formattedDate;
};
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

//     // Fetch attendance data from emp_attendance
//     // COUNT(DISTINCT CASE WHEN checkin_status = 'Check-in' THEN date END) AS total_checkins,
//     const query = `
//       SELECT
//         SUM(COALESCE(CAST(total_duration AS UNSIGNED), 0)) AS total_duration,

//            COUNT(id) AS total_checkins,
//         SUM(COALESCE(CAST(total_distance AS UNSIGNED), 0)) AS total_distance
//       FROM emp_attendance
//       WHERE emp_id = ?
//         AND company_id = ?
//         AND YEAR(date) = ?
//         AND MONTH(date) = ?
//     `;
//     const [data] = await sqlModel.customQuery(query, [
//       emp_id,
//       company_id,
//       year,
//       month,
//     ]);
//     // console.log(data);
//     if (data.error) {
//       return res.status(500).send(data);
//     }

//     // Calculate the total days in the selected month for attendance percentage
//     const daysInMonth = new Date(year, month, 0).getDate();
//     const attendancePercentage =
//       ((data.total_checkins / daysInMonth) * 100).toFixed(0) + "%";

//     // Fetch leave details from leave_type and leave_record tables
//     const leaveDetailsQuery = `
//       SELECT
//         lt.id AS leave_type_id,
//         lt.name,
//         lt.total_leave_days,
//         COALESCE(SUM(lr.no_of_days), 0) AS no_of_days_taken,
//         (lt.total_leave_days - COALESCE(SUM(lr.no_of_days), 0)) AS remaining_leave
//       FROM leave_type lt
//       LEFT JOIN leave_record lr ON lt.id = lr.leave_type AND lr.emp_id = ?
//       WHERE lt.company_id = ?
//       GROUP BY lt.id, lt.name, lt.total_leave_days
//     `;

//     const leaveDetails = await sqlModel.customQuery(leaveDetailsQuery, [
//       emp_id,
//       company_id,
//     ]);

//     // Sum up remaining leave days across all leave types
//     const totalRemainingLeave = leaveDetails.reduce(
//       (sum, leave) => sum + leave.remaining_leave,
//       0
//     );
//     // console.log(leaveDetails);
//     // Format the response data
//     const response = [
//       {
//         title: "Hour Worked",
//         icon: "https://telindia.s3.ap-south-1.amazonaws.com/icons/clock.png",
//         detail: data.total_duration || "00:00:00",
//       },
//       {
//         title: "Attendance",
//         icon: "https://telindia.s3.ap-south-1.amazonaws.com/icons/User.png",
//         detail: attendancePercentage,
//       },
//       {
//         title: "Distance Covered",
//         icon: "https://telindia.s3.ap-south-1.amazonaws.com/icons/location.png",
//         detail:
//           (!isNaN(Number(data.total_distance))
//             ? Number(data.total_distance).toFixed(2)
//             : "0") + " Km",
//       },
//       {
//         title: "Remaining Leaves",
//         icon: "https://telindia.s3.ap-south-1.amazonaws.com/icons/Date.png",
//         detail: totalRemainingLeave || "0",
//       },
//     ];

//     if (response.length === 0) {
//       return res.status(200).send({ status: false, message: "No data found" });
//     }

//     res.status(200).send({ status: true, data: response });
//   } catch (error) {
//     res.status(500).send({ status: false, error: error.message });
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

    // Fetch attendance data from emp_attendance
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

    // Fetch check-in status
    const queryDates = req.query.date || getCurrentDate();
    const checkInstatusQuery = `
      SELECT
        ea.date,
        ea.total_duration,
        c.check_out_time,
        c.checkin_status,
        c.check_in_time
      FROM emp_attendance ea
      LEFT JOIN check_in c
        ON ea.emp_id = c.emp_id
        AND ea.company_id = c.company_id
        AND DATE(c.date) = ?
      WHERE ea.emp_id = ?
        AND ea.company_id = ?
        AND ea.date = ?;
    `;

    const checkdata = await sqlModel.customQuery(checkInstatusQuery, [
      queryDates,
      emp_id,
      company_id,
      queryDates,
    ]);
    // console.log(checkdata);
    // Determine check-in status
    const checkin_status =
      checkdata.length > 0
        ? checkdata[checkdata.length - 1].checkin_status || "Check-in"
        : "Check-out";

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
        detail:
          (!isNaN(Number(data.total_distance))
            ? Number(data.total_distance).toFixed(2)
            : "0") + " Km",
      },
      {
        title: "Check-in Status",
        icon: "https://trackingapi.crrescita.com/images/support/image2025-02-13T07-19-22.830Z-compressed_image_main.jpg",
        detail: checkin_status,
      },
      // {
      //   title: "Remaining Leaves",
      //   icon: "https://telindia.s3.ap-south-1.amazonaws.com/icons/Date.png",
      //   detail: totalRemainingLeave || "0",
      // },
    ];

    if (response.length === 0) {
      return res.status(200).send({ status: false, message: "No data found" });
    }

    res.status(200).send({ status: true, data: response });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};
