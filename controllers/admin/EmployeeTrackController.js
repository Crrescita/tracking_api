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

// exports.getAttendence = async (req, res, next) => {
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
//     const query = `
//     SELECT
//       e.id,
//       e.name,
//       e.mobile,
//       e.email,
//       e.designation,
//       e.employee_id,
//       CASE
//         WHEN e.image IS NOT NULL THEN CONCAT(?, e.image)
//         ELSE e.image
//       END AS image,
//       c.date,
//       c.check_in_time,
//       c.check_out_time,
//       TIME_TO_SEC(TIMEDIFF(c.check_out_time, c.check_in_time)) AS duration_in_seconds
//     FROM employees e
//     LEFT JOIN check_in c ON e.id = c.emp_id AND c.date = ? AND e.company_id = c.company_id
//     WHERE e.company_id = ?
//   `;

//     const values = [baseUrl, date, company_id];

//     const data = await sqlModel.customQuery(query, values);

//     // Helper function to format seconds into HH:MM:SS
//     const formatDuration = (totalSeconds) => {
//       if (isNaN(totalSeconds) || totalSeconds < 0) {
//         console.error("Invalid totalSeconds value:", totalSeconds);
//         return "0h 0m 0s";
//       }
//       const hours = Math.floor(totalSeconds / 3600);
//       const minutes = Math.floor((totalSeconds % 3600) / 60);
//       const seconds = Math.floor(totalSeconds % 60);
//       return `${hours}h ${minutes}m ${seconds}s`;
//     };

//     // Helper function to calculate duration in seconds
//     const calculateDurationInSeconds = (checkInTime, checkOutTime) => {
//       if (!checkInTime || !checkOutTime) {
//         return 0; // Return 0 if either time is null or undefined
//       }
//       const checkIn = new Date(`1970-01-01T${checkInTime}Z`);
//       const checkOut = new Date(`1970-01-01T${checkOutTime}Z`);
//       return (checkOut - checkIn) / 1000; // duration in seconds
//     };

//     // Process data to include all check-ins per employee
//     const processedData = data.reduce((acc, item) => {
//       const existingEmployee = acc.find((emp) => emp.id === item.id);
//       const checkInTime = item.check_in_time;
//       const checkOutTime = item.check_out_time;

//       const durationInSeconds = calculateDurationInSeconds(
//         checkInTime,
//         checkOutTime
//       );

//       if (existingEmployee) {
//         if (checkInTime && checkOutTime) {
//           existingEmployee.checkIns.push({
//             check_in_time: checkInTime,
//             check_out_time: checkOutTime,
//             duration: formatDuration(durationInSeconds),
//           });
//         }

//         existingEmployee.totalDurationInSeconds += durationInSeconds;
//         existingEmployee.latestCheckInTime =
//           existingEmployee.latestCheckInTime || checkInTime;
//         existingEmployee.latestCheckOutTime =
//           existingEmployee.latestCheckOutTime || checkOutTime;

//         if (
//           checkInTime &&
//           new Date(`1970-01-01T${checkInTime}Z`) <
//             new Date(`1970-01-01T${existingEmployee.latestCheckInTime}Z`)
//         ) {
//           existingEmployee.latestCheckInTime = checkInTime;
//         }
//         if (
//           checkOutTime &&
//           new Date(`1970-01-01T${checkOutTime}Z`) >
//             new Date(`1970-01-01T${existingEmployee.latestCheckOutTime}Z`)
//         ) {
//           existingEmployee.latestCheckOutTime = checkOutTime;
//         }

//         existingEmployee.checkin_status = "Present";
//       } else {
//         acc.push({
//           id: item.id,
//           name: item.name,
//           mobile: item.mobile,
//           email: item.email,
//           designation: item.designation,
//           employee_id: item.employee_id,
//           image: item.image,
//           date: item.date,
//           checkIns:
//             checkInTime && checkOutTime
//               ? [
//                   {
//                     check_in_time: checkInTime,
//                     check_out_time: checkOutTime,
//                     duration: formatDuration(durationInSeconds),
//                   },
//                 ]
//               : [],
//           latestCheckInTime: checkInTime || null,
//           latestCheckOutTime: checkOutTime || null,
//           totalDuration: formatDuration(durationInSeconds),
//           totalDurationInSeconds: durationInSeconds,
//           checkin_status: checkInTime ? "Present" : "Absent",
//         });
//       }
//       return acc;
//     }, []);

//     // Compute total duration for each employee
//     processedData.forEach((employee) => {
//       employee.totalDuration = formatDuration(employee.totalDurationInSeconds);
//     });

//     // Calculate total present and absent counts, and total employee duration
//     const totalPresent = processedData.filter(
//       (emp) => emp.checkin_status === "Present"
//     ).length;
//     const totalAbsent = processedData.filter(
//       (emp) => emp.checkin_status === "Absent"
//     ).length;
//     const totalDurationInSeconds = processedData.reduce(
//       (sum, emp) => sum + emp.totalDurationInSeconds,
//       0
//     );

//     // Convert total duration to the desired format
//     const totalDuration = formatDuration(totalDurationInSeconds);

//     if (processedData.length === 0) {
//       return res.status(200).send({
//         status: false,
//         message: "No data found",
//         totalPresent,
//         totalAbsent,
//         totalDuration,
//       });
//     }

//     res.status(200).send({
//       status: true,
//       data: processedData,
//       attendenceCount: {
//         totalPresent,
//         totalAbsent,
//         totalDuration,
//       },
//     });
//   } catch (error) {
//     res.status(500).send({ status: false, error: error.message });
//   }
// };

exports.getAttendence = async (req, res, next) => {
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

    // Query to get all check-in data
    const query = `
    SELECT
      e.id,
      e.name,
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
      c.check_out_time
    FROM employees e
    LEFT JOIN check_in c ON e.id = c.emp_id AND c.date = ? AND e.company_id = c.company_id
    WHERE e.company_id = ?
  `;

    const values = [baseUrl, date, company_id];

    const data = await sqlModel.customQuery(query, values);

    // Helper function to format seconds into HH:MM:SS
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

    // Helper function to calculate duration in seconds
    const calculateDurationInSeconds = (checkInTime, checkOutTime) => {
      if (!checkInTime || !checkOutTime) {
        return 0; // Return 0 if checkInTime or checkOutTime is null or undefined
      }
      const checkIn = new Date(`1970-01-01T${checkInTime}Z`);
      const checkOut = new Date(`1970-01-01T${checkOutTime}Z`);
      const durationInSeconds = (checkOut - checkIn) / 1000; // duration in seconds
      return durationInSeconds < 0 ? 0 : durationInSeconds; // Ensure no negative durations
    };

    // Process data to include all check-ins per employee
    const processedData = data.reduce((acc, item) => {
      const existingEmployee = acc.find((emp) => emp.id === item.id);
      const checkInTime = item.check_in_time;
      const checkOutTime = item.check_out_time;

      const durationInSeconds = calculateDurationInSeconds(
        checkInTime,
        checkOutTime
      );

      if (existingEmployee) {
        if (checkInTime) {
          existingEmployee.checkIns.push({
            check_in_time: checkInTime,
            check_out_time: checkOutTime || null, // Ensure check_out_time is set to null if not present
            duration: formatDuration(durationInSeconds),
          });
        }

        existingEmployee.totalDurationInSeconds += durationInSeconds;
        existingEmployee.latestCheckInTime =
          existingEmployee.latestCheckInTime || checkInTime;

        if (checkOutTime) {
          existingEmployee.latestCheckOutTime = checkOutTime;
        } else if (existingEmployee.checkIns.length > 0) {
          existingEmployee.latestCheckOutTime = null; // Keep as null if no check-out time
        }

        existingEmployee.checkin_status = "Present";
      } else {
        acc.push({
          id: item.id,
          name: item.name,
          mobile: item.mobile,
          email: item.email,
          designation: item.designation,
          employee_id: item.employee_id,
          image: item.image,
          date: item.date,
          checkIns: checkInTime
            ? [
                {
                  check_in_time: checkInTime,
                  check_out_time: checkOutTime || null, // Ensure check_out_time is set to null if not present
                  duration: formatDuration(durationInSeconds),
                },
              ]
            : [],
          latestCheckInTime: checkInTime || null,
          latestCheckOutTime: checkOutTime || null, // Ensure latestCheckOutTime is set to null if not present
          totalDuration: formatDuration(durationInSeconds),
          totalDurationInSeconds: durationInSeconds,
          checkin_status: checkInTime ? "Present" : "Absent",
        });
      }
      return acc;
    }, []);

    // Compute total duration for each employee
    processedData.forEach((employee) => {
      employee.totalDuration = formatDuration(employee.totalDurationInSeconds);
    });

    // Calculate total present and absent counts, and total employee duration
    const totalPresent = processedData.filter(
      (emp) => emp.checkin_status === "Present"
    ).length;
    const totalAbsent = processedData.filter(
      (emp) => emp.checkin_status === "Absent"
    ).length;
    const totalDurationInSeconds = processedData.reduce(
      (sum, emp) => sum + emp.totalDurationInSeconds,
      0
    );

    // Convert total duration to the desired format
    const totalDuration = formatDuration(totalDurationInSeconds);

    if (processedData.length === 0) {
      return res.status(200).send({
        status: false,
        message: "No data found",
        totalPresent,
        totalAbsent,
        totalDuration,
      });
    }

    res.status(200).send({
      status: true,
      data: processedData,
      attendenceCount: {
        totalPresent,
        totalAbsent,
        totalDuration,
      },
    });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};
