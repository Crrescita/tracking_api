const sqlModel = require("../../config/db");

const formatDuration = (totalSeconds) => {
  if (isNaN(totalSeconds) || totalSeconds < 0) {
    console.error("Invalid totalSeconds value:", totalSeconds);
    return "0h 0m 0s";
  }
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${hours}h ${minutes}m ${seconds}s`;
};

exports.getEmpLoginDetail = async (req, res, next) => {
  try {
    const emp_id = req.query?.emp_id || "";
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

exports.getAttendance = async (req, res, next) => {
  try {
    const { company_id, date } = req.query;

    if (!company_id || !date) {
      return res.status(400).send({
        status: false,
        message: "Company ID and date are required",
      });
    }

    const baseUrl =
      process.env.BASE_URL || "https://trackingapi.crrescita.com/";

    // Query to get all employees and their attendance data for the given date
    const query = `
    SELECT
      e.id,
      e.name,
      e.mobile,
      e.email,
      d.name AS department,
      de.name AS designation,
      e.employee_id,
      CASE
        WHEN e.image IS NOT NULL THEN CONCAT(?, e.image)
        ELSE e.image
      END AS image,
      a.checkin_status,
      a.time_difference,
      a.total_duration,
      a.total_distance,
      c.date,
      c.check_in_time,
      c.check_out_time,
      c.duration
    FROM employees e
    LEFT JOIN department d ON e.department = d.id
    LEFT JOIN designation de ON e.designation = de.id
    LEFT JOIN emp_attendance a ON e.id = a.emp_id AND a.date = ?
    LEFT JOIN check_in c ON e.id = c.emp_id AND c.date = ? AND e.company_id = c.company_id
    WHERE e.company_id = ?
`;

    const values = [baseUrl, date, date, company_id];
    const data = await sqlModel.customQuery(query, values);

    // Process the data
    const processedData = data.reduce((acc, item) => {
      const existingEmployee = acc.find((emp) => emp.id === item.id);

      // Set attendance status based on checkin_status or absence of attendance data
      let attendance_status = "Absent";
      if (item.checkin_status === "Leave") {
        attendance_status = "Leave";
      } else if (item.check_in_time || item.checkin_status) {
        attendance_status = "Present";
      }

      if (existingEmployee) {
        if (item.check_in_time) {
          existingEmployee.checkIns.push({
            check_in_time: item.check_in_time,
            check_out_time: item.check_out_time || null,
            duration: item.duration || 0,
          });
        }

        existingEmployee.latestCheckInTime =
          existingEmployee.latestCheckInTime || item.check_in_time;

        if (item.check_out_time) {
          existingEmployee.latestCheckOutTime = item.check_out_time;
        } else if (existingEmployee.checkIns.length > 0) {
          existingEmployee.latestCheckOutTime = null;
        }

        existingEmployee.checkin_status = item.checkin_status || "Absent";
        existingEmployee.timeDifference = item.time_difference || "-";
        existingEmployee.attendance_status = attendance_status;
      } else {
        acc.push({
          id: item.id,
          name: item.name,
          mobile: item.mobile,
          email: item.email,
          designation: item.designation,
          department: item.department,
          employee_id: item.employee_id,
          image: item.image,
          date: item.date,
          checkIns: item.check_in_time
            ? [
                {
                  check_in_time: item.check_in_time,
                  check_out_time: item.check_out_time || null,
                  duration: item.duration || 0,
                },
              ]
            : [],
          latestCheckInTime: item.check_in_time || null,
          latestCheckOutTime: item.check_out_time || null,
          totalDuration: item.total_duration || "0h 0m 0s",
          totalDistance: item.total_distance || 0,
          checkin_status: item.checkin_status || "Absent",
          attendance_status: attendance_status,
          timeDifference: item.time_difference || "-",
        });
      }
      return acc;
    }, []);

    // Calculate totals for present, absent, leave
    const totalPresent = processedData.filter(
      (emp) => emp.attendance_status === "Present"
    ).length;
    const totalAbsent = processedData.filter(
      (emp) => emp.attendance_status === "Absent"
    ).length;
    const totalLeave = processedData.filter(
      (emp) => emp.attendance_status === "Leave"
    ).length;

    const totalDurationInSeconds = processedData.reduce((sum, emp) => {
      // Ensure total_duration is treated as a string
      const durationStr = emp.totalDuration.toString();
      const durationParts = durationStr.match(/(\d+):(\d+):(\d+)/);
      if (durationParts) {
        const hours = parseInt(durationParts[1], 10);
        const minutes = parseInt(durationParts[2], 10);
        const seconds = parseInt(durationParts[3], 10);
        return sum + hours * 3600 + minutes * 60 + seconds;
      }
      return sum;
    }, 0);

    const totalFormattedDuration = formatDuration(totalDurationInSeconds);

    const totalDistance = processedData.reduce(
      (sum, emp) => sum + (emp.totalDistance || 0),
      0
    );

    if (processedData.length === 0) {
      return res.status(200).send({
        status: false,
        message: "No data found",
        totalPresent,
        totalAbsent,
        totalLeave,
        totalDuration: totalFormattedDuration,
        totalDistance,
      });
    }

    res.status(200).send({
      status: true,
      data: processedData,
      attendanceCount: {
        totalPresent,
        totalAbsent,
        totalLeave,
        totalDuration: totalFormattedDuration,
        totalDistance,
      },
    });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};

// exports.getAttendance = async (req, res, next) => {
//   try {
//     const { company_id, date } = req.query;

//     if (!company_id || !date) {
//       return res.status(400).send({
//         status: false,
//         message: "Company ID and date are required",
//       });
//     }

//     const baseUrl =
//       process.env.BASE_URL || "https://trackingapi.crrescita.com/";

//     // Query to get all check-in data
//     const checkInQuery = `
//       SELECT
//         e.id,
//         e.name,
//         e.mobile,
//         e.email,
//         e.designation,
//         e.department,
//         e.employee_id,
//         CASE
//           WHEN e.image IS NOT NULL THEN CONCAT(?, e.image)
//           ELSE e.image
//         END AS image,
//         c.date,
//         c.check_in_time,
//         c.check_out_time,
//         c.duration
//       FROM employees e
//       LEFT JOIN check_in c ON e.id = c.emp_id AND c.date = ? AND e.company_id = c.company_id
//       WHERE e.company_id = ?
//       `;

//     const checkInValues = [baseUrl, date, company_id];
//     const checkInData = await sqlModel.customQuery(checkInQuery, checkInValues);

//     const analyticsQuery = `
//       SELECT
//         emp_id,
//         checkin_status,
//         time_difference,
//         total_duration,
//         total_distance
//       FROM emp_attendance
//       WHERE company_id = ? AND date = ?
//       `;

//     const analyticsValues = [company_id, date];
//     const analyticsData = await sqlModel.customQuery(
//       analyticsQuery,
//       analyticsValues
//     );

//     // const companyQuery = `
//     // SELECT
//     //   check_in_time_start,
//     //   check_in_time_end
//     // FROM company
//     // WHERE id = ?
//     // `;

//     // const companyValues = [company_id];
//     // const companyData = await sqlModel.customQuery(companyQuery, companyValues);

//     // const { check_in_time_start, check_in_time_end } = companyData[0] || {};

//     // const startDateTime = new Date(`1970-01-01T${check_in_time_start}Z`);
//     // const endDateTime = new Date(`1970-01-01T${check_in_time_end}Z`);

//     const analyticsMap = analyticsData.reduce((acc, item) => {
//       acc[item.emp_id] = {
//         total_duration: item.total_duration,
//         total_distance: item.total_distance,
//         checkin_status: item.checkin_status,
//         timeDifferencev2: item.time_difference,
//       };
//       return acc;
//     }, {});

//     const processedData = checkInData.reduce((acc, item) => {
//       const existingEmployee = acc.find((emp) => emp.id === item.id);
//       const checkInTime = item.check_in_time;
//       const checkOutTime = item.check_out_time;

//       // const checkInDateTime = new Date(`1970-01-01T${checkInTime}Z`);

//       // let checkin_status = "On Time";
//       // let timeDifferenceSeconds = 0;

//       // if (checkInDateTime < startDateTime) {
//       //   checkin_status = "Early";
//       //   timeDifferenceSeconds = Math.abs(
//       //     (startDateTime - checkInDateTime) / 1000
//       //   );
//       // } else if (checkInDateTime > endDateTime) {
//       //   checkin_status = "Late";
//       //   timeDifferenceSeconds = Math.abs(
//       //     (checkInDateTime - endDateTime) / 1000
//       //   );
//       // }

//       if (existingEmployee) {
//         if (checkInTime) {
//           existingEmployee.checkIns.push({
//             check_in_time: checkInTime,
//             check_out_time: checkOutTime || null,
//             duration: item.duration || 0,
//           });
//         }

//         existingEmployee.latestCheckInTime =
//           existingEmployee.latestCheckInTime || checkInTime;

//         if (checkOutTime) {
//           existingEmployee.latestCheckOutTime = checkOutTime;
//         } else if (existingEmployee.checkIns.length > 0) {
//           existingEmployee.latestCheckOutTime = null;
//         }

//         existingEmployee.checkin_status = checkin_status;
//         existingEmployee.timeDifference = formatDuration(timeDifferenceSeconds);
//         existingEmployee.attendance_status = "Present";
//       } else {
//         acc.push({
//           id: item.id,
//           name: item.name,
//           mobile: item.mobile,
//           email: item.email,
//           designation: item.designation,
//           department: item.department,
//           employee_id: item.employee_id,
//           image: item.image,
//           date: item.date,
//           checkIns: checkInTime
//             ? [
//                 {
//                   check_in_time: checkInTime,
//                   check_out_time: checkOutTime || null,
//                   duration: item.duration || 0,
//                 },
//               ]
//             : [],
//           latestCheckInTime: checkInTime || null,
//           latestCheckOutTime: checkOutTime || null,
//           totalDuration: analyticsMap[item.id]?.total_duration || "0h 0m 0s",
//           totalDistance: analyticsMap[item.id]?.total_distance || 0,
//           checkin_statusv2: analyticsMap[item.id]?.checkin_status || "Absent",
//           // checkin_status: checkInTime ? checkin_status : "Absent",
//           attendance_status: checkInTime ? "Present" : "Absent",
//           // timeDifference: formatDuration(timeDifferenceSeconds),
//           timeDifferencev2: analyticsMap[item.id]?.timeDifferencev2 || "-",
//         });
//       }
//       return acc;
//     }, []);

//     const totalPresent = processedData.filter(
//       (emp) => emp.attendance_status === "Present"
//     ).length;
//     const totalAbsent = processedData.filter(
//       (emp) => emp.attendance_status === "Absent"
//     ).length;

//     // Calculate total duration in seconds for all employees
//     const totalDurationInSeconds = processedData.reduce((sum, emp) => {
//       // Ensure total_duration is treated as a string
//       const durationStr = emp.totalDuration.toString();
//       const durationParts = durationStr.match(/(\d+):(\d+):(\d+)/);
//       if (durationParts) {
//         const hours = parseInt(durationParts[1], 10);
//         const minutes = parseInt(durationParts[2], 10);
//         const seconds = parseInt(durationParts[3], 10);
//         return sum + hours * 3600 + minutes * 60 + seconds;
//       }
//       return sum;
//     }, 0);

//     const totalFormattedDuration = formatDuration(totalDurationInSeconds);

//     const totalDistance = processedData.reduce(
//       (sum, emp) => sum + (emp.totalDistance || 0),
//       0
//     );

//     if (processedData.length === 0) {
//       return res.status(200).send({
//         status: false,
//         message: "No data found",
//         totalPresent,
//         totalAbsent,
//         totalDuration: totalFormattedDuration,
//         totalDistance,
//       });
//     }

//     res.status(200).send({
//       status: true,
//       data: processedData,
//       attendenceCount: {
//         totalPresent,
//         totalAbsent,
//         totalDuration: totalFormattedDuration,
//         totalDistance,
//       },
//     });
//   } catch (error) {
//     res.status(500).send({ status: false, error: error.message });
//   }
// };

// exports.getEmployeeMonthlyAttendance = async (req, res, next) => {
//   try {
//     const company_id = req.query.company_id;

//     if (!company_id) {
//       return res
//         .status(400)
//         .send({ status: false, message: "Company ID is required" });
//     }

//     const employees = await sqlModel.select(
//       "employees",
//       [
//         "id",
//         "company_id",
//         "name",
//         "mobile",
//         "email",
//         "designation",
//         "employee_id",
//         "image",
//       ],
//       { company_id: company_id }
//     );

//     if (!employees.length) {
//       return res.status(404).send({
//         status: false,
//         message: "No employees found for the given company ID",
//       });
//     }

//     const dateParam = req.query.date;
//     const targetDate = dateParam ? new Date(dateParam) : new Date();
//     const year = targetDate.getFullYear();
//     const month = targetDate.getMonth() + 1;

//     const daysInMonth = new Date(year, month, 0).getDate();
//     const allDays = Array.from({ length: daysInMonth }, (_, i) => {
//       const day = String(i + 1).padStart(2, "0");
//       return `${year}-${String(month).padStart(2, "0")}-${day}`;
//     });

//     const dateDayInMonth = Array.from({ length: daysInMonth }, (_, i) => {
//       const date = new Date(year, month - 1, i + 1);
//       const dayOfWeek = date.toLocaleString("en-US", {
//         weekday: "short",
//       });
//       return {
//         date: String(i + 1).padStart(2, "0"),
//         day: dayOfWeek,
//       };
//     });

//     const employeeAttendanceData = [];

//     for (const employee of employees) {
//       const { id: emp_id } = employee;

//     //   Query to get last check_in_time and check_out_time for each date
//         const query = `
//             SELECT
//               c.date,
//               MIN(c.check_in_time) AS last_check_in_time,
//               MAX(c.check_out_time) AS last_check_out_time,
//               ea.checkin_status,
//               ea.time_difference AS timeDifference,
//               ea.total_duration AS totalDuration
//             FROM check_in c
//             LEFT JOIN emp_attendance ea
//             ON c.emp_id = ea.emp_id AND c.company_id = ea.company_id AND c.date = ea.date
//             WHERE c.emp_id = ? AND c.company_id = ? AND MONTH(c.date) = ? AND YEAR(c.date) = ?
//             GROUP BY c.date, ea.checkin_status, ea.time_difference, ea.total_duration
//             ORDER BY c.date
//           `;

//       const values = [emp_id, company_id, month, year];
//       const data = await sqlModel.customQuery(query, values);

//       const groupedData = allDays.reduce((acc, date) => {
//         acc[date] = {
//           date,
//           checkin_status: "Absent",
//           attendance_status: "Absent",
//           timeDifference: "00:00:00",
//           totalDuration: "00:00:00",
//           last_check_in_time: "00:00:00",
//           last_check_out_time: "00:00:00",
//         };
//         return acc;
//       }, {});

//       data.forEach((item) => {
//         if (!groupedData[item.date]) return;

//         groupedData[item.date].checkin_status = item.checkin_status || "-";
//         groupedData[item.date].attendance_status = "Present";
//         groupedData[item.date].timeDifference =
//           item.timeDifference || "00:00:00";
//         groupedData[item.date].totalDuration = item.totalDuration || "00:00:00";
//         groupedData[item.date].last_check_in_time =
//           item.last_check_in_time || "00:00:00";
//         groupedData[item.date].last_check_out_time =
//           item.last_check_out_time || "00:00:00";
//       });

//       const checkInDates = Object.values(groupedData);

//       const employeeData = {
//         id: employee.id,
//         name: employee.name,
//         mobile: employee.mobile,
//         email: employee.email,
//         designation: employee.designation,
//         employee_id: employee.employee_id,
//         image: employee.image,
//         attendance: checkInDates,
//       };

//       employeeAttendanceData.push(employeeData);
//     }

//     res.status(200).send({
//       status: true,
//       data: employeeAttendanceData,
//       daysInMonth: dateDayInMonth,
//     });
//   } catch (error) {
//     res.status(500).send({ status: false, error: error.message });
//   }
// };

exports.getEmployeeMonthlyAttendance = async (req, res, next) => {
  try {
    const company_id = req.query.company_id;

    if (!company_id) {
      return res.status(400).send({
        status: false,
        message: "Company ID is required",
      });
    }

    const employees = await sqlModel.select(
      "employees",
      [
        "id",
        "company_id",
        "name",
        "mobile",
        "email",
        "designation",
        "employee_id",
        "image",
      ],
      { company_id }
    );

    if (!employees.length) {
      return res.status(404).send({
        status: false,
        message: "No employees found for the given company ID",
      });
    }

    const dateParam = req.query.date;
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;

    const daysInMonth = new Date(year, month, 0).getDate();
    const allDays = Array.from({ length: daysInMonth }, (_, i) => {
      const day = String(i + 1).padStart(2, "0");
      return `${year}-${String(month).padStart(2, "0")}-${day}`;
    });

    const dateDayInMonth = Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(year, month - 1, i + 1);
      const dayOfWeek = date.toLocaleString("en-US", {
        weekday: "short",
      });
      return {
        date: String(i + 1).padStart(2, "0"),
        day: dayOfWeek,
      };
    });

    const employeeAttendanceData = [];

    for (const employee of employees) {
      const { id: emp_id } = employee;

      // Initialize groupedData with default values
      const groupedData = allDays.reduce((acc, date) => {
        acc[date] = {
          date,
          checkin_status: "Absent",
          attendance_status: "Absent",
          timeDifference: "00:00:00",
          totalDuration: "00:00:00",
          last_check_in_time: "00:00:00",
          last_check_out_time: "00:00:00",
        };
        return acc;
      }, {});

      // Query to get data from emp_attendance
      const empAttendanceQuery = `
          SELECT
            date,
            checkin_status,
            time_difference AS timeDifference,
            total_duration AS totalDuration
          FROM emp_attendance
          WHERE emp_id = ? AND company_id = ? AND MONTH(date) = ? AND YEAR(date) = ?
        `;
      const empAttendanceValues = [emp_id, company_id, month, year];
      const empAttendanceRecords = await sqlModel.customQuery(
        empAttendanceQuery,
        empAttendanceValues
      );

      // Update groupedData with emp_attendance data
      empAttendanceRecords.forEach((item) => {
        if (groupedData[item.date]) {
          if (item.checkin_status === "Leave") {
            groupedData[item.date].attendance_status = "Leave";
          } else {
            groupedData[item.date].attendance_status = "Present";
          }

          groupedData[item.date].checkin_status = item.checkin_status || "-";
          groupedData[item.date].timeDifference =
            item.timeDifference || "00:00:00";
          groupedData[item.date].totalDuration =
            item.totalDuration || "00:00:00";
        }
      });

      // Query to get data from check_in for dates with attendance data
      const checkInDates = Object.keys(groupedData).filter(
        (date) => groupedData[date].attendance_status === "Present"
      );
      if (checkInDates.length > 0) {
        const checkInQuery = `
            SELECT
              c.date,
              MIN(c.check_in_time) AS last_check_in_time,
              MAX(c.check_out_time) AS last_check_out_time
            FROM check_in c
            WHERE c.emp_id = ? AND c.company_id = ? AND MONTH(c.date) = ? AND YEAR(c.date) = ? 
            GROUP BY c.date
            ORDER BY c.date
          `;
        const checkInValues = [emp_id, company_id, month, year];
        const checkInRecords = await sqlModel.customQuery(
          checkInQuery,
          checkInValues
        );

        // Update groupedData with check_in data
        checkInRecords.forEach((item) => {
          if (
            groupedData[item.date] &&
            groupedData[item.date].attendance_status == "Present"
          ) {
            groupedData[item.date].last_check_in_time =
              item.last_check_in_time || "00:00:00";
            groupedData[item.date].last_check_out_time =
              item.last_check_out_time || "00:00:00";
          }
        });
      }

      const checkInDatesArray = Object.values(groupedData);

      const employeeData = {
        id: employee.id,
        name: employee.name,
        mobile: employee.mobile,
        email: employee.email,
        designation: employee.designation,
        employee_id: employee.employee_id,
        image: employee.image,
        attendance: checkInDatesArray,
      };

      employeeAttendanceData.push(employeeData);
    }

    res.status(200).send({
      status: true,
      data: employeeAttendanceData,
      daysInMonth: dateDayInMonth,
    });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};
