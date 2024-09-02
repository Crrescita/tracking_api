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

    // Define the base URL for image concatenation
    const baseUrl = process.env.BASE_URL || "";

    // Query to fetch employee details and their check-in data
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

    // Handle query errors
    if (mainData.error) {
      return res.status(500).send(mainData);
    }

    // Handle case when no data is found
    if (mainData.length === 0) {
      return res.status(200).send({ status: false, message: "No data found" });
    }

    // Query to fetch all analytics data for the employee and company
    const analyticsQuery = `
      SELECT
        emp_id,
        company_id,
        date,
        checkin_status,
        time_difference,
        total_duration,
        total_distance
      FROM emp_attendance
      WHERE emp_id = ? AND company_id = ?
    `;

    const analyticsValues = [emp_id, company_id];
    const analyticsData = await sqlModel.customQuery(
      analyticsQuery,
      analyticsValues
    );

    // Handle analytics query errors
    if (analyticsData.error) {
      return res.status(500).send(analyticsData);
    }

    // Create a map of date to analytics data for quick lookup
    const analyticsMap = analyticsData.reduce((acc, item) => {
      acc[item.date] = {
        checkin_status: item.checkin_status,
        time_difference: item.time_difference,
        total_duration: item.total_duration,
        total_distance: item.total_distance,
      };
      return acc;
    }, {});

    // Group check-in data by date and calculate earliest and latest times
    const groupedData = mainData.reduce((acc, item) => {
      if (!acc[item.date]) {
        acc[item.date] = {
          date: item.date,
          checkIns: [],
          earliestCheckInTime: item.check_in_time,
          latestCheckOutTime: item.check_out_time || null,
        };
      } else {
        acc[item.date].checkIns.push({
          check_in_time: item.check_in_time,
          check_out_time: item.check_out_time || null,
        });

        // Update earliestCheckInTime
        if (item.check_in_time < acc[item.date].earliestCheckInTime) {
          acc[item.date].earliestCheckInTime = item.check_in_time;
        }

        // Update latestCheckOutTime
        if (
          item.check_out_time &&
          (!acc[item.date].latestCheckOutTime ||
            item.check_out_time > acc[item.date].latestCheckOutTime)
        ) {
          acc[item.date].latestCheckOutTime = item.check_out_time;
        }
      }

      return acc;
    }, {});

    // Combine check-in data with analytics data
    const checkInDates = Object.values(groupedData).map((dateData) => {
      const analytics = analyticsMap[dateData.date] || {
        checkin_status: "-",
        time_difference: "0h 0m 0s",
        total_duration: "0h 0m 0s",
        total_distance: 0,
      };

      // Determine attendance_status
      const attendance_status =
        dateData.checkIns.length > 0 ? "Present" : "Absent";

      return {
        ...dateData,
        checkin_status: analytics.checkin_status,
        timeDifferencev2: analytics.time_difference,
        total_duration: analytics.total_duration,
        total_distance: analytics.total_distance,
        attendance_status,
      };
    });

    // Construct the final employee data object
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

    // Send the response
    res.status(200).send({
      status: true,
      data: employeeData,
    });
  } catch (error) {
    // Handle unexpected errors
    res.status(500).send({ status: false, error: error.message });
  }
};
