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

const getPreviousDate = () => {
  const currentDate = new Date();

  // Subtract one day from the current date
  currentDate.setDate(currentDate.getDate() - 1);

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
       b.name AS branch,
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
      c.checkin_status AS latestCheckInStatus,
      c.check_out_time,
      c.duration   
    FROM employees e
     LEFT JOIN branch b ON e.branch = b.id
    LEFT JOIN department d ON e.department = d.id
    LEFT JOIN designation de ON e.designation = de.id
    LEFT JOIN emp_attendance a ON e.id = a.emp_id AND a.date = ?
    LEFT JOIN check_in c ON e.id = c.emp_id AND c.date = ? AND e.company_id = c.company_id
    WHERE e.company_id = ?
   
`;
    // ORDER BY c.check_in_time DESC

    const values = [baseUrl, date, date, company_id];
    const data = await sqlModel.customQuery(query, values);
    // console.log(data);
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
        if (item.latestCheckInStatus) {
          existingEmployee.latestCheckInStatus = item.latestCheckInStatus;
        } else if (existingEmployee.checkIns.length > 0) {
          existingEmployee.latestCheckInStatus = null;
        }

        existingEmployee.checkin_status = item.checkin_status || "Absent";
        existingEmployee.timeDifference = item.time_difference || "-";
        existingEmployee.attendance_status = attendance_status;
        // existingEmployee.last_battery_status = last_battery_status;
      } else {
        acc.push({
          id: item.id,
          name: item.name,
          mobile: item.mobile,
          email: item.email,
          branch: item.branch,
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
          latestCheckInStatus: item.latestCheckInStatus || null,
          totalDuration: item.total_duration || "0h 0m 0s",
          totalDistance: item.total_distance || 0,
          checkin_status: item.checkin_status || "Absent",
          attendance_status: attendance_status,
          timeDifference: item.time_difference || "-",
          // last_battery_status: item.last_battery_status,
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
    const totalOnTime = processedData.filter(
      (emp) => emp.checkin_status === "On-Time"
    ).length;
    const totalEarly = processedData.filter(
      (emp) => emp.checkin_status === "Early"
    ).length;
    const totalLate = processedData.filter(
      (emp) => emp.checkin_status === "Late"
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
        totalOnTime,
        totalEarly,
        totalLate,
      });
    }

    processedData.sort((a, b) => {
      const toSeconds = (time) => {
        if (!time) return 0;
        const [hours, minutes, seconds] = time.split(":").map(Number);
        return hours * 3600 + minutes * 60 + seconds;
      };

      const timeA = toSeconds(a.latestCheckInTime);
      const timeB = toSeconds(b.latestCheckInTime);

      return timeB - timeA;
    });

    res.status(200).send({
      status: true,
      data: processedData,
      attendanceCount: {
        totalPresent,
        totalAbsent,
        totalLeave,
        totalDuration: totalFormattedDuration,
        totalDistance,
        totalOnTime,
        totalEarly,
        totalLate,
      },
    });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};

exports.getEmployeeMonthlyAttendance = async (req, res, next) => {
  try {
    const company_id = req.query.company_id;

    if (!company_id) {
      return res.status(400).send({
        status: false,
        message: "Company ID is required",
      });
    }

    const query = `
        SELECT
          e.id,
          e.company_id,
          e.name,
          e.email,
          e.mobile,
          e.employee_id,
          b.name AS branch,
          d.name AS department,
          de.name AS designation,
          CASE
            WHEN e.image IS NOT NULL THEN CONCAT(?, e.image)
            ELSE e.image
          END AS image
        FROM employees e
         LEFT JOIN branch b ON e.branch = b.id
        LEFT JOIN department d ON e.department = d.id
        LEFT JOIN designation de ON e.designation = de.id
        WHERE e.company_id = ?
      `;

    const values = [process.env.BASE_URL, company_id];
    const employees = await sqlModel.customQuery(query, values);

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

    // Fetch holidays from the company_holidays table
    const holidayQuery = `
      SELECT date, name
      FROM company_holidays
      WHERE status = 'active' AND company_id = ? AND MONTH(date) = ? AND YEAR(date) = ?
    `;
    const holidayRecords = await sqlModel.customQuery(holidayQuery, [
      company_id,
      month,
      year,
    ]);

    const holidays = holidayRecords.reduce((acc, holiday) => {
      acc[holiday.date] = holiday.name;
      return acc;
    }, {});

    const employeeAttendanceData = [];

    for (const employee of employees) {
      const { id: emp_id } = employee;

      // Initialize groupedData with default values, mark Sundays as "Holiday"
      const groupedData = allDays.reduce((acc, date) => {
        const dayOfWeek = new Date(date).toLocaleString("en-US", {
          weekday: "long",
        });
        const day = new Date(date).getDay(); // 0 = Sunday
        acc[date] = {
          date,
          day: dayOfWeek,
          checkin_status: "Absent",
          attendance_status: day == 0 ? "Holiday" : "Absent", // Mark Sundays as "Holiday"
          timeDifference: "00:00:00",
          totalDuration: "00:00:00",
          totalDistance: "0",
          last_check_in_time: "00:00:00",
          last_check_out_time: "00:00:00",
          min_lat_check_in: "0",
          min_long_check_in: "0",
          max_lat_check_out: "0",
          max_long_check_out: "0",
        };

        // Check if the date is a holiday
        if (holidays[date]) {
          acc[date].attendance_status = "Holiday";
          acc[date].holiday_name = holidays[date];
        }

        return acc;
      }, {});

      // Initialize counters for totals
      let totalPresent = 0;
      let totalAbsent = 0;
      let totalLeave = 0;
      let totalHolidays = 0;
      let totalOntime = 0;
      let totalEarly = 0;
      let totalLate = 0;

      let totalCheckInMinutes = 0;
      let totalCheckOutMinutes = 0;
      let totalWorkSeconds = 0;
      let checkInCount = 0;
      let checkOutCount = 0;

      // Query to get data from emp_attendance
      const empAttendanceQuery = `
        SELECT
          date,
          checkin_status,
          time_difference AS timeDifference,
          total_duration AS totalDuration,
          total_distance AS totalDistance
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
            totalLeave++;
          } else {
            groupedData[item.date].attendance_status = "Present";
            totalPresent++;
          }

          if (item.checkin_status === "On-Time") {
            totalOntime++;
          }

          if (item.checkin_status === "Early") {
            totalEarly++;
          }
          if (item.checkin_status === "Late") {
            totalLate++;
          }

          groupedData[item.date].checkin_status = item.checkin_status || "-";
          groupedData[item.date].timeDifference =
            item.timeDifference || "00:00:00";
          groupedData[item.date].totalDuration =
            item.totalDuration || "00:00:00";
          groupedData[item.date].totalDistance = item.totalDistance || "0";
        }
      });

      // Count holidays marked in groupedData
      totalHolidays = Object.values(groupedData).filter(
        (day) => day.attendance_status === "Holiday"
      ).length;

      // Count remaining absent days
      totalAbsent = daysInMonth - (totalPresent + totalLeave + totalHolidays);

      // Query to get data from check_in for dates with attendance data
      const checkInDates = Object.keys(groupedData).filter(
        (date) => groupedData[date].attendance_status === "Present"
      );

      if (checkInDates.length > 0) {
        const checkInQuery = `
          SELECT
            c.date,
            GROUP_CONCAT(c.check_in_time ORDER BY c.check_in_time) AS check_in_times,
            GROUP_CONCAT(c.check_out_time ORDER BY c.check_out_time) AS check_out_times,
          MIN(NULLIF(c.lat_check_in, 0)) AS min_lat_check_in,
  MIN(NULLIF(c.long_check_in, 0)) AS min_long_check_in,
  MAX(NULLIF(c.lat_check_out, 0)) AS max_lat_check_out,
  MAX(NULLIF(c.long_check_out, 0)) AS max_long_check_out,
    MAX(NULLIF(c.long_check_out, 0)) AS max_long_check_out
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

        checkInRecords.forEach((item) => {
          if (
            groupedData[item.date] &&
            groupedData[item.date].attendance_status == "Present"
          ) {
            const checkInTimes = item.check_in_times
              ? item.check_in_times.split(",")
              : [];
            const checkOutTimes = item.check_out_times
              ? item.check_out_times.split(",")
              : [];

            let timeline = [];
            const maxTimes = Math.max(
              checkInTimes.length,
              checkOutTimes.length
            );

            for (let i = 0; i < maxTimes; i++) {
              if (checkInTimes[i]) {
                timeline.push({
                  action: "Check In",
                  time: checkInTimes[i],
                });
              }
              if (checkOutTimes[i]) {
                timeline.push({
                  action: "Check Out",
                  time: checkOutTimes[i],
                });
              }
            }

            groupedData[item.date].last_check_in_time = checkInTimes[0] || "-";
            groupedData[item.date].last_check_out_time =
              checkOutTimes[checkOutTimes.length - 1] || "-";
            groupedData[item.date].timeline = timeline;

            //  latitude and longitude details
            groupedData[item.date].min_lat_check_in =
              item.min_lat_check_in || "0";
            groupedData[item.date].min_long_check_in =
              item.min_long_check_in || "0";
            groupedData[item.date].max_lat_check_out =
              item.max_lat_check_out || "0";
            groupedData[item.date].max_long_check_out =
              item.max_long_check_out || "0";
          }
        });
      }

      const checkInDatesArray = Object.values(groupedData);

      // Calculate averages and total hours
      Object.values(groupedData).forEach((day) => {
        if (day.attendance_status === "Present") {
          // Handle check-in times
          if (day.last_check_in_time !== "-") {
            const [hours, minutes] = day.last_check_in_time
              .split(":")
              .map(Number);
            totalCheckInMinutes += hours * 60 + minutes;
            checkInCount++;
          }

          // Handle check-out times
          if (day.last_check_out_time !== "-") {
            const [hours, minutes] = day.last_check_out_time
              .split(":")
              .map(Number);
            totalCheckOutMinutes += hours * 60 + minutes;
            checkOutCount++;
          }

          // Handle total duration
          // if (day.totalDuration !== "00:00:00") {
          //   const [hours, minutes, seconds] = day.totalDuration
          //     .split(":")
          //     .map(Number);
          //   totalWorkSeconds += hours * 3600 + minutes * 60 + seconds;
          // }

          // dddd

          // attendance.forEach(record => {
          const timeParts = day.totalDuration.split(":");
          const hours = parseInt(timeParts[0]);
          const minutes = parseInt(timeParts[1]);
          const seconds = parseInt(timeParts[2]);

          // Convert to total seconds
          totalWorkSeconds += hours * 3600 + minutes * 60 + seconds;
          // });

          // Format to HH:MM:SS
        }
      });

      // Calculate average check-in time
      const avgCheckInTime = checkInCount
        ? new Date((totalCheckInMinutes / checkInCount) * 60 * 1000)
            .toISOString()
            .substr(11, 8)
        : "-";

      // Calculate average check-out time
      const avgCheckOutTime = checkOutCount
        ? new Date((totalCheckOutMinutes / checkOutCount) * 60 * 1000)
            .toISOString()
            .substr(11, 8)
        : "-";

      // Convert the total seconds back into HH:MM:SS format
      let totalHours = Math.floor(totalWorkSeconds / 3600);
      let totalMinutes = Math.floor((totalWorkSeconds % 3600) / 60);
      let totalSec = totalWorkSeconds % 60;
      let totalWorkHours = `${String(totalHours).padStart(2, "0")}:${String(
        totalMinutes
      ).padStart(2, "0")}:${String(totalSec).padStart(2, "0")}`;

      // Calculate total hours worked
      // const totalWorkHours = new Date(totalWorkSeconds * 1000)
      //   .toISOString()
      //   .substr(11, 8);

      const avgWorkHours = totalPresent
        ? new Date((totalWorkSeconds / totalPresent) * 1000)
            .toISOString()
            .substr(11, 8)
        : "00:00:00";

      const employeeData = {
        id: employee.id,
        name: employee.name,
        mobile: employee.mobile,
        email: employee.email,
        branch: employee.branch,
        designation: employee.designation,
        department: employee.department,
        employee_id: employee.employee_id,
        image: employee.image,
        attendance: checkInDatesArray,
        totals: {
          totalPresent,
          totalAbsent,
          totalLeave,
          totalHolidays,
          totalOntime,
          totalEarly,
          totalLate,
          avgCheckInTime,
          avgCheckOutTime,
          totalWorkHours,
          avgWorkHours,
        },
      };

      employeeAttendanceData.push(employeeData);
    }

    employeeAttendanceData.sort(
      (a, b) => b.totals.totalPresent - a.totals.totalPresent
    );

    res.status(200).send({
      status: true,
      data: employeeAttendanceData,
      daysInMonth: dateDayInMonth,
    });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};

// dashboard
// exports.getTotalAttendance = async (req, res, next) => {
//   try {
//     const { company_id } = req.query;

//     // Validate the required parameters
//     if (!company_id) {
//       return res.status(400).send({
//         status: false,
//         message: "Company ID is required",
//       });
//     }

//     const date = getCurrentDate();

//     // Query to get employee attendance data for the given date
//     const query = `
//       SELECT
//         e.id,
//         e.name,
//         a.checkin_status,
//         c.check_in_time
//       FROM employees e
//       LEFT JOIN emp_attendance a ON e.id = a.emp_id AND a.date = ?
//       LEFT JOIN check_in c ON e.id = c.emp_id AND c.date = ? AND e.company_id = c.company_id
//       WHERE e.company_id = ?
//     `;

//     const values = [date, date, company_id];
//     const data = await sqlModel.customQuery(query, values);

//     // Process the data
//     const processedData = data.reduce((acc, item) => {
//       // Set attendance status based on checkin_status or absence of attendance data
//       let attendance_status = "Absent";
//       if (item.checkin_status === "Leave") {
//         attendance_status = "Leave";
//       } else if (item.check_in_time || item.checkin_status) {
//         attendance_status = "Present";
//       }

//       // Check if employee already exists in the accumulator
//       const existingEmployee = acc.find((emp) => emp.id === item.id);
//       if (!existingEmployee) {
//         acc.push({
//           id: item.id,
//           attendance_status: attendance_status,
//         });
//       }
//       return acc;
//     }, []);

//     // Calculate total employees, present, absent, and on leave
//     const totalEmployees = processedData.length;
//     const totalPresent = processedData.filter(
//       (emp) => emp.attendance_status === "Present"
//     ).length;
//     const totalAbsent = processedData.filter(
//       (emp) => emp.attendance_status === "Absent"
//     ).length;
//     const totalLeave = processedData.filter(
//       (emp) => emp.attendance_status === "Leave"
//     ).length;

//     // Respond with totals only
//     res.status(200).send({
//       status: true,
//       attendanceCount: {
//         totalEmployees,
//         totalPresent,
//         totalAbsent,
//         totalLeave,
//       },
//     });
//   } catch (error) {
//     res.status(500).send({ status: false, error: error.message });
//   }
// };

exports.getTotalAttendance = async (req, res, next) => {
  try {
    const { company_id } = req.query;

    // Validate the required parameters
    if (!company_id) {
      return res.status(400).send({
        status: false,
        message: "Company ID is required",
      });
    }

    const currentDate = getCurrentDate(); // Function that returns the current date in your preferred format
    const previousDate = getPreviousDate(); // Function that returns the previous date

    // Function to process attendance data for a given date
    const processAttendanceData = async (date) => {
      const query = `
        SELECT
          e.id,
          e.name,
          e.status,
          a.checkin_status,
          c.check_in_time
        FROM employees e
        LEFT JOIN emp_attendance a ON e.id = a.emp_id AND a.date = ?
        LEFT JOIN check_in c ON e.id = c.emp_id AND c.date = ? AND e.company_id = c.company_id
        WHERE e.company_id = ?
      `;

      const values = [date, date, company_id];
      const data = await sqlModel.customQuery(query, values);

      // Process the data
      const processedData = data.reduce((acc, item) => {
        // Set attendance status based on checkin_status or absence of attendance data
        let attendance_status = "Absent";
        if (item.checkin_status === "Leave") {
          attendance_status = "Leave";
        } else if (item.check_in_time || item.checkin_status) {
          attendance_status = "Present";
        }

        // Check if employee already exists in the accumulator
        const existingEmployee = acc.find((emp) => emp.id === item.id);
        if (!existingEmployee) {
          acc.push({
            id: item.id,
            attendance_status: attendance_status,
            status: item.status,
          });
        }
        return acc;
      }, []);

      // Calculate totals
      const totalEmployees = processedData.length;
      const totalPresent = processedData.filter(
        (emp) => emp.attendance_status === "Present"
      ).length;
      const totalAbsent = processedData.filter(
        (emp) => emp.attendance_status === "Absent"
      ).length;
      const totalLeave = processedData.filter(
        (emp) => emp.attendance_status === "Leave"
      ).length;

      const totalActive = processedData.filter(
        (emp) => emp.status == "active"
      ).length;
      const totalInactive = processedData.filter(
        (emp) => emp.status == "inactive"
      ).length;

      return {
        totalEmployees,
        totalPresent,
        totalAbsent,
        totalLeave,
        totalActive,
        totalInactive,
      };
    };

    // Get attendance for current and previous dates
    const currentDateAttendance = await processAttendanceData(currentDate);
    const previousDateAttendance = await processAttendanceData(previousDate);

    // Respond with totals for both dates
    res.status(200).send({
      status: true,
      currentDate: {
        date: currentDate,
        attendanceCount: currentDateAttendance,
      },
      previousDate: {
        date: previousDate,
        attendanceCount: previousDateAttendance,
      },
    });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};

// Helper function to get the current week's dates (Monday to Sunday)
const getWeekDates = (currentDate, weekOffset = 0) => {
  const current = new Date(currentDate);

  const currentDayOfWeek = current.getDay();

  // Adjust the day to start from Monday (0 = Monday, ..., 6 = Sunday)
  const dayOffset = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;

  // Calculate the Monday of the current week
  const firstDayOfWeek = new Date(
    current.setDate(current.getDate() - dayOffset + weekOffset * 7)
  );

  const weekDates = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(firstDayOfWeek);
    date.setDate(firstDayOfWeek.getDate() + i); // Move to the next day

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    weekDates.push(`${year}-${month}-${day}`);
  }

  return weekDates;
};

exports.getWeeklyAttendance = async (req, res, next) => {
  try {
    const { company_id, weekOffset = 0 } = req.query;

    // Validate the required parameters
    if (!company_id) {
      return res.status(400).send({
        status: false,
        message: "Company ID is required",
      });
    }

    const currentDate = getCurrentDate(); // Function to get current date
    const weekDates = getWeekDates(currentDate, parseInt(weekOffset)); // Pass weekOffset to get the correct week dates

    // Function to process attendance data for a given date
    const processAttendanceData = async (date) => {
      const query = `
        SELECT
          e.id,
          e.name,
          a.checkin_status,
          c.check_in_time
        FROM employees e
        LEFT JOIN emp_attendance a ON e.id = a.emp_id AND a.date = ?
        LEFT JOIN check_in c ON e.id = c.emp_id AND c.date = ? AND e.company_id = c.company_id
        WHERE e.company_id = ?
      `;

      const values = [date, date, company_id];
      const data = await sqlModel.customQuery(query, values);

      // Process the data
      const processedData = data.reduce((acc, item) => {
        let attendance_status = "Absent";
        if (item.checkin_status === "Leave") {
          attendance_status = "Leave";
        } else if (item.check_in_time || item.checkin_status) {
          attendance_status = "Present";
        }

        const existingEmployee = acc.find((emp) => emp.id === item.id);
        if (!existingEmployee) {
          acc.push({
            id: item.id,
            attendance_status: attendance_status,
          });
        }
        return acc;
      }, []);

      const totalEmployees = processedData.length;
      const totalPresent = processedData.filter(
        (emp) => emp.attendance_status === "Present"
      ).length;
      const totalAbsent = processedData.filter(
        (emp) => emp.attendance_status === "Absent"
      ).length;
      const totalLeave = processedData.filter(
        (emp) => emp.attendance_status === "Leave"
      ).length;

      return {
        totalEmployees,
        totalPresent,
        totalAbsent,
        totalLeave,
      };
    };

    // Process attendance for each day of the week
    const weeklyAttendance = {};
    for (const date of weekDates) {
      weeklyAttendance[date] = await processAttendanceData(date);
    }

    // Structure the response for chart data
    const attendanceSeries = {
      present: [],
      absent: [],
      onLeave: [],
    };
    weekDates.forEach((date) => {
      const attendance = weeklyAttendance[date];
      attendanceSeries.present.push(attendance.totalPresent);
      attendanceSeries.absent.push(attendance.totalAbsent);
      attendanceSeries.onLeave.push(attendance.totalLeave);
    });

    res.status(200).send({
      status: true,
      weekDates,
      attendanceSeries,
    });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};

// report

// exports.getEmployeeReport = async (req, res, next) => {
//   try {
//     const company_id = req.query.company_id;

//     if (!company_id) {
//       return res.status(400).send({
//         status: false,
//         message: "Company ID is required",
//       });
//     }

//     const query = `
//         SELECT
//           e.id,
//           e.company_id,
//           e.name,
//           e.email,
//           e.mobile,
//           e.employee_id,
//           b.name AS branch,
//           d.name AS department,
//           de.name AS designation,
//           CASE
//             WHEN e.image IS NOT NULL THEN CONCAT(?, e.image)
//             ELSE e.image
//           END AS image
//         FROM employees e
//         LEFT JOIN branch b ON e.branch = b.id
//         LEFT JOIN department d ON e.department = d.id
//         LEFT JOIN designation de ON e.designation = de.id
//         WHERE e.company_id = ? and e.department = 17
//       `;

//     const values = [process.env.BASE_URL, company_id];
//     const employees = await sqlModel.customQuery(query, values);

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

//     // Fetch holidays
//     const holidayQuery = `
//       SELECT date, name
//       FROM company_holidays
//       WHERE status = 'active' AND company_id = ? AND MONTH(date) = ? AND YEAR(date) = ?
//     `;
//     const holidayRecords = await sqlModel.customQuery(holidayQuery, [
//       company_id,
//       month,
//       year,
//     ]);

//     const holidays = holidayRecords.reduce((acc, holiday) => {
//       acc[holiday.date] = holiday.name;
//       return acc;
//     }, {});

//     const employeeAttendanceData = [];

//     for (const employee of employees) {
//       const { id: emp_id } = employee;

//       // Initialize groupedData
//       const groupedData = allDays.reduce((acc, date) => {
//         const dayOfWeek = new Date(date).toLocaleString("en-US", {
//           weekday: "long",
//         });
//         const day = new Date(date).getDay(); // 0 = Sunday
//         acc[date] = {
//           date,
//           day: dayOfWeek,
//           checkin_status: "Absent",
//           attendance_status: day === 0 ? "Holiday" : "Absent",
//           timeDifference: "00:00:00",
//           totalDuration: "00:00:00",
//           totalDistance: "0",
//           last_check_in_time: "00:00:00",
//           last_check_out_time: "00:00:00",
//           min_lat_check_in: "0",
//           min_long_check_in: "0",
//           max_lat_check_out: "0",
//           max_long_check_out: "0",
//         };

//         // Check if the date is a holiday
//         if (holidays[date]) {
//           acc[date].attendance_status = "Holiday";
//           acc[date].holiday_name = holidays[date];
//         }

//         return acc;
//       }, {});

//       let totalPresent = 0;
//       let totalLeave = 0;

//       // Attendance query
//       const empAttendanceQuery = `
//         SELECT
//           date,
//           checkin_status,
//           time_difference AS timeDifference,
//           total_duration AS totalDuration,
//           total_distance AS totalDistance
//         FROM emp_attendance
//         WHERE emp_id = ? AND company_id = ? AND MONTH(date) = ? AND YEAR(date) = ?
//       `;
//       const empAttendanceValues = [emp_id, company_id, month, year];
//       const empAttendanceRecords = await sqlModel.customQuery(
//         empAttendanceQuery,
//         empAttendanceValues
//       );

//       empAttendanceRecords.forEach((item) => {
//         if (groupedData[item.date]) {
//           if (item.checkin_status === "Leave") {
//             groupedData[item.date].attendance_status = "Leave";
//             totalLeave++;
//           } else {
//             groupedData[item.date].attendance_status = "Present";
//             totalPresent++;
//           }

//           groupedData[item.date].checkin_status = item.checkin_status || "-";
//           groupedData[item.date].timeDifference =
//             item.timeDifference || "00:00:00";
//           groupedData[item.date].totalDuration =
//             item.totalDuration || "00:00:00";
//           groupedData[item.date].totalDistance = item.totalDistance || "0";
//         }
//       });

//       // Fetch average check-in/check-out addresses
//       const avgAddressQuery = `
//       SELECT
//         COUNT(ea.check_in_address) AS check_in_times,
//         ea.check_in_address,
//         COUNT(ea.check_out_address) AS check_out_times,
//         ea.check_out_address,
//         SEC_TO_TIME(AVG(TIME_TO_SEC(ea.check_in_time))) AS avg_check_in_time,
//         SEC_TO_TIME(AVG(TIME_TO_SEC(ea.check_out_time))) AS avg_check_out_time
//       FROM emp_attendance ea
//       WHERE ea.emp_id = ?
//         AND ea.company_id = ?
//         AND MONTH(ea.date) = ?
//         AND YEAR(ea.date) = ?
//       GROUP BY ea.check_in_address, ea.check_out_address, ea.emp_id;
//     `;

//       const avgAddressValues = [emp_id, company_id, month, year];
//       const avgAddressRecords = await sqlModel.customQuery(
//         avgAddressQuery,
//         avgAddressValues
//       );

//       // Extract average values or set default values
//       const avgCheckInAddress = avgAddressRecords[0]?.check_in_address || "N/A";
//       const avgCheckOutAddress =
//         avgAddressRecords[0]?.check_out_address || "N/A";
//       const avgCheckInTime =
//         avgAddressRecords[0]?.avg_check_in_time || "00:00:00";
//       const avgCheckOutTime =
//         avgAddressRecords[0]?.avg_check_out_time || "00:00:00";

//       const employeeData = {
//         id: employee.id,
//         name: employee.name,
//         mobile: employee.mobile,
//         email: employee.email,
//         branch: employee.branch,
//         designation: employee.designation,
//         department: employee.department,
//         employee_id: employee.employee_id,
//         image: employee.image,
//         attendance: Object.values(groupedData),
//         avgCheckInAddress,
//         avgCheckOutAddress,
//         avgCheckInTime,
//         avgCheckOutTime,
//       };

//       employeeAttendanceData.push(employeeData);

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

exports.getEmployeeReport = async (req, res, next) => {
  try {
    const company_id = req.query.company_id;

    if (!company_id) {
      return res.status(400).send({
        status: false,
        message: "Company ID is required",
      });
    }

    const query = `
        SELECT
          e.id,
          e.company_id,
          e.name,
          e.email,
          e.mobile,
          e.employee_id,
          b.name AS branch,
          d.name AS department,
          de.name AS designation,
          CASE
            WHEN e.image IS NOT NULL THEN CONCAT(?, e.image)
            ELSE e.image
          END AS image
        FROM employees e
         LEFT JOIN branch b ON e.branch = b.id
        LEFT JOIN department d ON e.department = d.id
        LEFT JOIN designation de ON e.designation = de.id
        WHERE e.company_id = ? 
      `;
    // and e.department = 17
    const values = [process.env.BASE_URL, company_id];
    const employees = await sqlModel.customQuery(query, values);

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

    // Fetch holidays from the company_holidays table
    const holidayQuery = `
      SELECT date, name
      FROM company_holidays
      WHERE status = 'active' AND company_id = ? AND MONTH(date) = ? AND YEAR(date) = ?
    `;
    const holidayRecords = await sqlModel.customQuery(holidayQuery, [
      company_id,
      month,
      year,
    ]);

    const holidays = holidayRecords.reduce((acc, holiday) => {
      acc[holiday.date] = holiday.name;
      return acc;
    }, {});

    const employeeAttendanceData = [];

    for (const employee of employees) {
      const { id: emp_id } = employee;

      // Initialize groupedData with default values, mark Sundays as "Holiday"
      const groupedData = allDays.reduce((acc, date) => {
        const dayOfWeek = new Date(date).toLocaleString("en-US", {
          weekday: "long",
        });
        const day = new Date(date).getDay(); // 0 = Sunday
        acc[date] = {
          date,
          day: dayOfWeek,
          checkin_status: "Absent",
          attendance_status: day == 0 ? "Holiday" : "Absent", // Mark Sundays as "Holiday"
          timeDifference: "00:00:00",
          totalDuration: "00:00:00",
          totalDistance: "0",
          last_check_in_time: "00:00:00",
          last_check_out_time: "00:00:00",
          min_lat_check_in: "0",
          min_long_check_in: "0",
          max_lat_check_out: "0",
          max_long_check_out: "0",
        };

        // Check if the date is a holiday
        if (holidays[date]) {
          acc[date].attendance_status = "Holiday";
          acc[date].holiday_name = holidays[date];
        }

        return acc;
      }, {});

      // Initialize counters for totals
      let totalPresent = 0;
      let totalAbsent = 0;
      let totalLeave = 0;
      let totalHolidays = 0;
      let totalOntime = 0;
      let totalEarly = 0;
      let totalLate = 0;

      let totalCheckInMinutes = 0;
      let totalCheckOutMinutes = 0;
      let totalWorkSeconds = 0;
      let checkInCount = 0;
      let checkOutCount = 0;

      // Query to get data from emp_attendance
      const empAttendanceQuery = `
        SELECT
          date,
          checkin_status,
          time_difference AS timeDifference,
          total_duration AS totalDuration,
          total_distance AS totalDistance
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
            totalLeave++;
          } else {
            groupedData[item.date].attendance_status = "Present";
            totalPresent++;
          }

          if (item.checkin_status === "On-Time") {
            totalOntime++;
          }

          if (item.checkin_status === "Early") {
            totalEarly++;
          }
          if (item.checkin_status === "Late") {
            totalLate++;
          }

          groupedData[item.date].checkin_status = item.checkin_status || "-";
          groupedData[item.date].timeDifference =
            item.timeDifference || "00:00:00";
          groupedData[item.date].totalDuration =
            item.totalDuration || "00:00:00";
          groupedData[item.date].totalDistance = item.totalDistance || "0";
        }
      });

      // Count holidays marked in groupedData
      totalHolidays = Object.values(groupedData).filter(
        (day) => day.attendance_status === "Holiday"
      ).length;

      // Count remaining absent days
      totalAbsent = daysInMonth - (totalPresent + totalLeave + totalHolidays);

      // Query to get data from check_in for dates with attendance data
      const checkInDates = Object.keys(groupedData).filter(
        (date) => groupedData[date].attendance_status === "Present"
      );

      if (checkInDates.length > 0) {
        const checkInQuery = `
          SELECT
            c.date,
            GROUP_CONCAT(c.check_in_time ORDER BY c.check_in_time) AS check_in_times,
            GROUP_CONCAT(c.check_out_time ORDER BY c.check_out_time) AS check_out_times,
          MIN(NULLIF(c.lat_check_in, 0)) AS min_lat_check_in,
  MIN(NULLIF(c.long_check_in, 0)) AS min_long_check_in,
  MAX(NULLIF(c.lat_check_out, 0)) AS max_lat_check_out,
  MAX(NULLIF(c.long_check_out, 0)) AS max_long_check_out
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

        checkInRecords.forEach((item) => {
          if (
            groupedData[item.date] &&
            groupedData[item.date].attendance_status == "Present"
          ) {
            const checkInTimes = item.check_in_times
              ? item.check_in_times.split(",")
              : [];
            const checkOutTimes = item.check_out_times
              ? item.check_out_times.split(",")
              : [];

            let timeline = [];
            const maxTimes = Math.max(
              checkInTimes.length,
              checkOutTimes.length
            );

            for (let i = 0; i < maxTimes; i++) {
              if (checkInTimes[i]) {
                timeline.push({
                  action: "Check In",
                  time: checkInTimes[i],
                });
              }
              if (checkOutTimes[i]) {
                timeline.push({
                  action: "Check Out",
                  time: checkOutTimes[i],
                });
              }
            }

            groupedData[item.date].last_check_in_time = checkInTimes[0] || "-";
            groupedData[item.date].last_check_out_time =
              checkOutTimes[checkOutTimes.length - 1] || "-";
            groupedData[item.date].timeline = timeline;

            //  latitude and longitude details
            groupedData[item.date].min_lat_check_in =
              item.min_lat_check_in || "0";
            groupedData[item.date].min_long_check_in =
              item.min_long_check_in || "0";
            groupedData[item.date].max_lat_check_out =
              item.max_lat_check_out || "0";
            groupedData[item.date].max_long_check_out =
              item.max_long_check_out || "0";
          }
        });
      }

      const checkInDatesArray = Object.values(groupedData);

      // Calculate averages and total hours
      Object.values(groupedData).forEach((day) => {
        if (day.attendance_status === "Present") {
          // Handle check-in times
          if (day.last_check_in_time !== "-") {
            const [hours, minutes] = day.last_check_in_time
              .split(":")
              .map(Number);
            totalCheckInMinutes += hours * 60 + minutes;
            checkInCount++;
          }

          // Handle check-out times
          if (day.last_check_out_time !== "-") {
            const [hours, minutes] = day.last_check_out_time
              .split(":")
              .map(Number);
            totalCheckOutMinutes += hours * 60 + minutes;
            checkOutCount++;
          }

          // Handle total duration
          // if (day.totalDuration !== "00:00:00") {
          //   const [hours, minutes, seconds] = day.totalDuration
          //     .split(":")
          //     .map(Number);
          //   totalWorkSeconds += hours * 3600 + minutes * 60 + seconds;
          // }

          // dddd

          // attendance.forEach(record => {
          const timeParts = day.totalDuration.split(":");
          const hours = parseInt(timeParts[0]);
          const minutes = parseInt(timeParts[1]);
          const seconds = parseInt(timeParts[2]);

          // Convert to total seconds
          totalWorkSeconds += hours * 3600 + minutes * 60 + seconds;
          // });

          // Format to HH:MM:SS
        }
      });

      // Calculate average check-in time
      const avgCheckInTime = checkInCount
        ? new Date((totalCheckInMinutes / checkInCount) * 60 * 1000)
            .toISOString()
            .substr(11, 8)
        : "-";

      // Calculate average check-out time
      const avgCheckOutTime = checkOutCount
        ? new Date((totalCheckOutMinutes / checkOutCount) * 60 * 1000)
            .toISOString()
            .substr(11, 8)
        : "-";

      // Convert the total seconds back into HH:MM:SS format
      let totalHours = Math.floor(totalWorkSeconds / 3600);
      let totalMinutes = Math.floor((totalWorkSeconds % 3600) / 60);
      let totalSec = totalWorkSeconds % 60;
      let totalWorkHours = `${String(totalHours).padStart(2, "0")}:${String(
        totalMinutes
      ).padStart(2, "0")}:${String(totalSec).padStart(2, "0")}`;

      // Calculate total hours worked
      // const totalWorkHours = new Date(totalWorkSeconds * 1000)
      //   .toISOString()
      //   .substr(11, 8);

      const avgWorkHours = totalPresent
        ? new Date((totalWorkSeconds / totalPresent) * 1000)
            .toISOString()
            .substr(11, 8)
        : "00:00:00";

      // Fetch average check-in/check-out addresses
      const avgAddressQuery = `
    SELECT 
  COUNT(ea.check_in_address) AS check_in_times, 
  ea.check_in_address,
  COUNT(ea.check_out_address) AS check_out_times,
  ea.check_out_address
FROM emp_attendance ea 
WHERE ea.emp_id = ? 
  AND ea.company_id = ? 
  AND MONTH(ea.date) = ? 
  AND YEAR(ea.date) = ?
GROUP BY ea.check_in_address, ea.check_out_address, ea.emp_id;

    `;
      const avgAddressValues = [emp_id, company_id, month, year];
      const avgAddressRecords = await sqlModel.customQuery(
        avgAddressQuery,
        avgAddressValues
      );

      const avgCheckInAddress = avgAddressRecords[0]?.check_in_address || "N/A";
      const avgCheckOutAddress =
        avgAddressRecords[0]?.check_out_address || "N/A";

      const mobilediffQuery = `
  SELECT 
      date,
      TIMESTAMPDIFF(MINUTE, MAX(datetime_mobile), CONCAT(DATE(date)," ",'20:00:00')) AS time_diff_in_minutes
  FROM 
      tel_new.emp_tracking 
  WHERE 
      emp_id = ? 
      AND MONTH(date) = ?
      AND YEAR(date) = ?
  GROUP BY 
      date
  HAVING 
      time_diff_in_minutes > 120
  ORDER BY 
      date;
`;

      const avgQuery = `
  SELECT 
      AVG(time_diff_in_minutes) AS avg_time_diff_in_minutes
  FROM (
      SELECT 
           GREATEST(
        TIMESTAMPDIFF(MINUTE, MAX(datetime_mobile), CONCAT(DATE(date), " ", '20:00:00')), 
        0
    ) AS time_diff_in_minutes
      FROM 
          tel_new.emp_tracking 
      WHERE 
          emp_id = ? 
          AND MONTH(date) = ?
          AND YEAR(date) = ?
      GROUP BY 
          date
    
  ) AS subquery;
`;

      const mobilediffQueryValues = [emp_id, month, year];

      // Get the records
      const mobiRecords = await sqlModel.customQuery(
        mobilediffQuery,
        mobilediffQueryValues
      );

      // Get the average
      const avgResult = await sqlModel.customQuery(
        avgQuery,
        mobilediffQueryValues
      );

      const gpsBehaviorQuery = `
  WITH status_groups AS (
    SELECT 
      c.date,
      c.emp_id,
      c.gps_status,
      c.datetime_mobile AS gps_off_time,
      ROW_NUMBER() OVER (PARTITION BY c.date ORDER BY c.datetime_mobile) 
        - ROW_NUMBER() OVER (PARTITION BY c.date, c.gps_status ORDER BY c.datetime_mobile) AS grp
    FROM tel_new.emp_tracking c
    WHERE c.emp_id = ?
      AND c.company_id = ?
      AND MONTH(c.date) = ?
      AND YEAR(c.date) = ?
  )
  SELECT 
    date,
    emp_id,
    gps_status,
    MIN(gps_off_time) AS start_time,
    MAX(gps_off_time) AS end_time,
    SEC_TO_TIME(TIMESTAMPDIFF(SECOND, MIN(gps_off_time), MAX(gps_off_time))) AS total_duration
  FROM status_groups
  GROUP BY date, emp_id, gps_status, grp
  HAVING gps_status = 0
  ORDER BY start_time
`;

      const gpsBehaviorValues = [emp_id, company_id, month, year];
      const gpsRecords = await sqlModel.customQuery(
        gpsBehaviorQuery,
        gpsBehaviorValues
      );

      const gpsavgBehaviorQuery = `
        WITH status_groups AS (
          SELECT
            c.date,
            c.emp_id,
            c.gps_status,
            c.datetime_mobile AS gps_off_time,
            ROW_NUMBER() OVER (PARTITION BY c.date ORDER BY c.datetime_mobile)
              - ROW_NUMBER() OVER (PARTITION BY c.date, c.gps_status ORDER BY c.datetime_mobile) AS grp
          FROM tel_new.emp_tracking c
          WHERE c.emp_id = ?
            AND c.company_id = ?
            AND MONTH(c.date) = ?
            AND YEAR(c.date) = ?
        )
        SELECT
          date,
          emp_id,
          gps_status,
          MIN(gps_off_time) AS start_time,
          MAX(gps_off_time) AS end_time,
          CASE
            WHEN gps_status = 1 THEN '00:00:00'
            WHEN gps_status = 0 AND TIMESTAMPDIFF(SECOND, MIN(gps_off_time), MAX(gps_off_time)) < 1800 THEN '00:00:00'
            ELSE SEC_TO_TIME(TIMESTAMPDIFF(SECOND, MIN(gps_off_time), MAX(gps_off_time)))
          END AS total_duration
        FROM status_groups
        GROUP BY date, emp_id, gps_status, grp
        ORDER BY start_time;
      `;

      const gpsAvgBehaviorValues = [emp_id, company_id, month, year];

      const gpsavgRecords = await sqlModel.customQuery(
        gpsavgBehaviorQuery,
        gpsAvgBehaviorValues
      );

      function timeToSeconds(time) {
        const [hours, minutes, seconds] = time.split(":").map(Number);
        return hours * 3600 + minutes * 60 + seconds;
      }

      function secondsToTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.round(seconds % 60);
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
          2,
          "0"
        )}:${String(secs).padStart(2, "0")}`;
      }

      // Calculate total and average durations for unique dates
      function calculateAverageDuration(records) {
        const dailyDurations = {};

        // Aggregate total duration for each unique date
        records.forEach((record) => {
          const { date, total_duration } = record;
          const durationInSeconds =
            total_duration === "00:00:00" ? 0 : timeToSeconds(total_duration);

          if (!dailyDurations[date]) {
            dailyDurations[date] = 0;
          }

          dailyDurations[date] += durationInSeconds;
        });

        // Calculate average duration for unique dates
        const uniqueDates = Object.keys(dailyDurations);
        const totalSeconds = uniqueDates.reduce(
          (sum, date) => sum + dailyDurations[date],
          0
        );

        const avgSeconds =
          uniqueDates.length > 0 ? totalSeconds / uniqueDates.length : 0;
        // console.log(uniqueDates.length);
        return secondsToTime(avgSeconds);
      }

      // Get average duration for unique dates
      const avgDurations = calculateAverageDuration(gpsavgRecords);
      // console.log(avgDurations);
      // Convert the result into an object grouped by date
      const gpsOffDataByDate = gpsRecords.reduce((acc, record) => {
        // console.log(record);
        const { date, gps_status, start_time, end_time, total_duration } =
          record;

        if (!acc[date]) {
          acc[date] = [];
        }

        acc[date].push({
          gps_status,
          start_time,
          end_time,
          total_duration,
        });

        return acc;
      }, {});

      const filteredGpsData = Object.entries(gpsOffDataByDate)
        .map(([date, records]) => {
          // Filter records to keep only those with total_duration > 30 minutes (1800 seconds)
          const filteredRecords = records.filter((record) => {
            const [hours, minutes, seconds] = record.total_duration
              .split(":")
              .map(Number);
            const durationInSeconds = hours * 3600 + minutes * 60 + seconds;
            return durationInSeconds > 1800; // Only include records > 30 minutes
          });

          // Calculate total duration for the filtered records
          const totalDurationSeconds = filteredRecords.reduce(
            (total, record) => {
              const [hours, minutes, seconds] = record.total_duration
                .split(":")
                .map(Number);
              return total + hours * 3600 + minutes * 60 + seconds;
            },
            0
          );

          // Convert total seconds to HH:MM:SS format
          const totalHours = Math.floor(totalDurationSeconds / 3600);
          const totalMinutes = Math.floor((totalDurationSeconds % 3600) / 60);
          const totalSeconds = totalDurationSeconds % 60;
          const totalDuration = `${totalHours
            .toString()
            .padStart(2, "0")}:${totalMinutes
            .toString()
            .padStart(2, "0")}:${totalSeconds.toString().padStart(2, "0")}`;

          return {
            date,
            records: filteredRecords,
            totalDurationSeconds,
            totalDuration,
          };
        })
        .filter((data) => data.records.length > 0); // Keep dates with at least one filtered record

      // Calculate the average GPS off duration
      const avgDurationSeconds =
        filteredGpsData.reduce(
          (sum, data) => sum + data.totalDurationSeconds,
          0
        ) / (filteredGpsData.length || 1);

      // Convert average seconds to HH:MM:SS
      const avgHours = Math.floor(avgDurationSeconds / 3600);
      const avgMinutes = Math.floor((avgDurationSeconds % 3600) / 60);
      const avgSeconds = Math.floor(avgDurationSeconds % 60);
      const avgDuration = `${avgHours.toString().padStart(2, "0")}:${avgMinutes
        .toString()
        .padStart(2, "0")}:${avgSeconds.toString().padStart(2, "0")}`;

      // Create final result
      const result = {
        filteredData: filteredGpsData.map(
          ({ date, records, totalDuration }) => ({
            date,
            records,
            totalDuration,
          })
        ),
        avgDuration,
        avgDurations,
        // uniqueDates: uniqueDates.length,
      };

      // console.log(result);

      // console.log(gpsOffDataByDate);

      const employeeData = {
        id: employee.id,
        name: employee.name,
        mobile: employee.mobile,
        email: employee.email,
        branch: employee.branch,
        designation: employee.designation,
        department: employee.department,
        employee_id: employee.employee_id,
        image: employee.image,
        mobiRecords: mobiRecords,
        avgResult: avgResult[0]?.avg_time_diff_in_minutes,
        // attendance: checkInDatesArray,
        result,

        totals: {
          totalPresent,
          totalAbsent,
          totalLeave,
          totalHolidays,
          totalOntime,
          totalEarly,
          totalLate,
          avgCheckInTime,
          avgCheckOutTime,
          totalWorkHours,
          avgWorkHours,
          avgCheckInAddress,
          avgCheckOutAddress,
        },
      };

      employeeAttendanceData.push(employeeData);
    }

    employeeAttendanceData.sort(
      (a, b) => b.totals.totalPresent - a.totals.totalPresent
    );

    res.status(200).send({
      status: true,
      data: employeeAttendanceData,
      daysInMonth: dateDayInMonth,
    });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};
