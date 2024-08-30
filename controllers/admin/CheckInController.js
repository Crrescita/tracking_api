const sqlModel = require("../../config/db");

exports.getCheckIn = async (req, res, next) => {
  try {
    const { emp_id, company_id, date } = req.query;

    if (!emp_id || !company_id || !date) {
      return res.status(400).send({
        status: false,
        message: "Employee ID, company ID, and date are required",
      });
    }

    // Query to get all check-in data for a specific employee on a specific date
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
    WHERE e.id = ? AND e.company_id = ?
    ORDER BY c.check_in_time
  `;

    const values = [process.env.BASE_URL, date, emp_id, company_id];

    const data = await sqlModel.customQuery(query, values);

    if (data.error) {
      return res.status(500).send(data);
    }

    if (data.length === 0) {
      return res.status(200).send({ status: false, message: "No data found" });
    }

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

    // Initialize an object to hold the processed data for the specific employee
    const employeeData = {
      id: data[0].id,
      name: data[0].name,
      mobile: data[0].mobile,
      email: data[0].email,
      designation: data[0].designation,
      employee_id: data[0].employee_id,
      image: data[0].image,
      date: data[0].date,
      checkIns: [],
      latestCheckInTime: null,
      latestCheckOutTime: null,
      totalDurationInSeconds: 0,
      checkin_status: "Absent", // Default status
    };

    data.forEach((item) => {
      const durationInSeconds = calculateDurationInSeconds(
        item.check_in_time,
        item.check_out_time
      );

      if (item.check_in_time) {
        employeeData.checkIns.push({
          check_in_time: item.check_in_time,
          check_out_time: item.check_out_time || null, // Ensure check_out_time is set to null if not present
          duration: formatDuration(durationInSeconds),
        });

        employeeData.totalDurationInSeconds += durationInSeconds;
      }
    });

    // Set latestCheckInTime and latestCheckOutTime from the last entry in checkIns
    const lastCheckIn = employeeData.checkIns[employeeData.checkIns.length - 1];
    if (lastCheckIn) {
      employeeData.latestCheckInTime = lastCheckIn.check_in_time;
      employeeData.latestCheckOutTime = lastCheckIn.check_out_time || null;
      employeeData.checkin_status = lastCheckIn.check_in_time
        ? "Present"
        : "Absent";
    }

    // Format total duration
    employeeData.totalDuration = formatDuration(
      employeeData.totalDurationInSeconds
    );

    res.status(200).send({
      status: true,
      data: employeeData,
    });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};

// exports.getCheckInAllDate = async (req, res, next) => {
//   try {
//     const { emp_id, company_id } = req.query;

//     if (!emp_id || !company_id) {
//       return res.status(400).send({
//         status: false,
//         message: "Employee ID and company ID are required",
//       });
//     }

//     const query = `
//       SELECT
//         e.id,
//         e.name,
//         e.mobile,
//         e.email,
//         e.designation,
//         e.employee_id,
//         CASE
//           WHEN e.image IS NOT NULL THEN CONCAT(?, e.image)
//           ELSE e.image
//         END AS image,
//         c.date,
//         c.check_in_time,
//         c.check_out_time
//       FROM employees e
//       LEFT JOIN check_in c ON e.id = c.emp_id AND e.company_id = c.company_id
//       WHERE e.id = ? AND e.company_id = ?
//       ORDER BY c.date, c.check_in_time
//     `;

//     const values = [process.env.BASE_URL, emp_id, company_id];
//     const data = await sqlModel.customQuery(query, values);

//     if (data.error) {
//       return res.status(500).send(data);
//     }

//     if (data.length === 0) {
//       return res.status(200).send({ status: false, message: "No data found" });
//     }

//     const analyticsQuery = `
//     SELECT
//       emp_id,
//       checkin_status,
//       time_difference,
//       total_duration,
//       total_distance
//     FROM emp_analytics
//     WHERE emp_id = ? AND company_id = ? AND date = ?
//     `;

//     const analyticsValues = [emp_id, company_id, date];
//     const analyticsData = await sqlModel.customQuery(
//       analyticsQuery,
//       analyticsValues
//     );

//     const analyticsMap = analyticsData.reduce((acc, item) => {
//       acc[item.emp_id] = {
//         total_duration: item.total_duration,
//         total_distance: item.total_distance,
//         checkin_status: item.checkin_status,
//         timeDifferencev2: item.time_difference,
//       };
//       return acc;
//     }, {});

//     const companyQuery = `
//       SELECT
//         check_in_time_start,
//         check_in_time_end
//       FROM company
//       WHERE id = ?
//     `;

//     const companyValues = [company_id];
//     const companyData = await sqlModel.customQuery(companyQuery, companyValues);

//     const { check_in_time_start, check_in_time_end } = companyData[0] || {};

//     const startDateTime = new Date(`1970-01-01T${check_in_time_start}Z`);
//     const endDateTime = new Date(`1970-01-01T${check_in_time_end}Z`);

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

//     const calculateDurationInSeconds = (checkInTime, checkOutTime) => {
//       if (!checkInTime || !checkOutTime) {
//         return 0; // Return 0 if checkInTime or checkOutTime is null or undefined
//       }
//       const checkIn = new Date(`1970-01-01T${checkInTime}Z`);
//       const checkOut = new Date(`1970-01-01T${checkOutTime}Z`);
//       const durationInSeconds = (checkOut - checkIn) / 1000;
//       return durationInSeconds < 0 ? 0 : durationInSeconds;
//     };

//     const groupedData = data.reduce((acc, item) => {
//       if (!acc[item.date]) {
//         acc[item.date] = {
//           date: item.date,
//           checkIns: [],
//           totalDurationInSeconds: 0,
//           earliestCheckInTime: null,
//           latestCheckOutTime: null,
//           checkin_status: "Absent",
//           attendance_status: "Absent",
//           timeDifference: "0h 0m 0s",
//           totalDuration: "0h 0m 0s",
//         };
//       }

//       const checkInDateTime = new Date(`1970-01-01T${item.check_in_time}Z`);
//       let checkin_status = "On Time";
//       let timeDifferenceSeconds = 0;

//       if (checkInDateTime < startDateTime) {
//         checkin_status = "Early";
//         timeDifferenceSeconds = Math.abs(
//           (startDateTime - checkInDateTime) / 1000
//         );
//       } else if (checkInDateTime > endDateTime) {
//         checkin_status = "Late";
//         timeDifferenceSeconds = Math.abs(
//           (checkInDateTime - endDateTime) / 1000
//         );
//       }

//       const durationInSeconds = calculateDurationInSeconds(
//         item.check_in_time,
//         item.check_out_time
//       );

//       acc[item.date].checkIns.push({
//         check_in_time: item.check_in_time,
//         check_out_time: item.check_out_time || null,
//         duration: formatDuration(durationInSeconds),
//       });

//       acc[item.date].totalDurationInSeconds += durationInSeconds;

//       if (item.check_in_time) {
//         acc[item.date].attendance_status = "Present";
//         if (
//           !acc[item.date].earliestCheckInTime ||
//           item.check_in_time < acc[item.date].earliestCheckInTime
//         ) {
//           acc[item.date].earliestCheckInTime = item.check_in_time;
//         }
//       }

//       if (item.check_out_time !== null) {
//         if (
//           !acc[item.date].latestCheckOutTime ||
//           item.check_out_time > acc[item.date].latestCheckOutTime
//         ) {
//           acc[item.date].latestCheckOutTime = item.check_out_time;
//         }
//       } else {
//         acc[item.date].latestCheckOutTime = null;
//       }

//       acc[item.date].checkin_status = checkin_status;
//       acc[item.date].timeDifference = formatDuration(timeDifferenceSeconds);

//       return acc;
//     }, {});

//     // Convert grouped data into an array
//     const checkInDates = Object.values(groupedData).map((dateData) => ({
//       ...dateData,
//       totalDuration: formatDuration(dateData.totalDurationInSeconds),
//     }));

//     const employeeData = {
//       id: data[0].id,
//       name: data[0].name,
//       mobile: data[0].mobile,
//       email: data[0].email,
//       designation: data[0].designation,
//       employee_id: data[0].employee_id,
//       image: data[0].image,
//       checkInsByDate: checkInDates,
//     };

//     res.status(200).send({
//       status: true,
//       data: employeeData,
//     });
//   } catch (error) {
//     res.status(500).send({ status: false, error: error.message });
//   }
// };

exports.getCheckInAllDate = async (req, res, next) => {
  try {
    const { emp_id, company_id } = req.query;

    // Validate input parameters
    if (!emp_id || !company_id) {
      return res.status(400).send({
        status: false,
        message: "Employee ID and Company ID are required",
      });
    }

    const baseUrl = process.env.BASE_URL || "";

    const mainQuery = `
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
      LEFT JOIN check_in c ON e.id = c.emp_id AND e.company_id = c.company_id
      WHERE e.id = ? AND e.company_id = ?
      ORDER BY c.date, c.check_in_time
    `;

    const mainValues = [baseUrl, emp_id, company_id];
    const mainData = await sqlModel.customQuery(mainQuery, mainValues);

    if (mainData.error) {
      return res.status(500).send(mainData);
    }

    if (mainData.length === 0) {
      return res.status(200).send({ status: false, message: "No data found" });
    }

    const analyticsQuery = `
      SELECT
        emp_id,
        company_id,
        date,
        checkin_status,
        time_difference,
        total_duration,
        total_distance
      FROM emp_analytics
      WHERE emp_id = ? AND company_id = ?
    `;

    const analyticsValues = [emp_id, company_id];
    const analyticsData = await sqlModel.customQuery(
      analyticsQuery,
      analyticsValues
    );

    if (analyticsData.error) {
      return res.status(500).send(analyticsData);
    }

    const analyticsMap = analyticsData.reduce((acc, item) => {
      acc[item.date] = {
        checkin_status: item.checkin_status,
        time_difference: item.time_difference,
        total_duration: item.total_duration,
        total_distance: item.total_distance,
      };
      return acc;
    }, {});

    // Group check-in data by date
    const groupedData = mainData.reduce((acc, item) => {
      if (!acc[item.date]) {
        acc[item.date] = {
          date: item.date,
          checkIns: [],
        };
      }

      acc[item.date].checkIns.push({
        check_in_time: item.check_in_time,
        check_out_time: item.check_out_time || null,
      });

      return acc;
    }, {});

    const checkInDates = Object.values(groupedData).map((dateData) => {
      const analytics = analyticsMap[dateData.date] || {
        checkin_status: "Absent",
        time_difference: "0h 0m 0s",
        total_duration: "0h 0m 0s",
        total_distance: 0,
      };
      return {
        ...dateData,
        checkin_status: analytics.checkin_status,
        timeDifferencev2: analytics.time_difference,
        total_duration: analytics.total_duration,
        total_distance: analytics.total_distance,
      };
    });

    const employeeData = {
      id: mainData[0].id,
      name: mainData[0].name,
      mobile: mainData[0].mobile,
      email: mainData[0].email,
      designation: mainData[0].designation,
      employee_id: mainData[0].employee_id,
      image: mainData[0].image,
      checkInsByDate: checkInDates,
    };

    res.status(200).send({
      status: true,
      data: employeeData,
    });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};
