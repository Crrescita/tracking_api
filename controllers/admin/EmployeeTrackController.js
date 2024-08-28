const sqlModel = require("../../config/db");

const haversineDistance = (coords1, coords2) => {
  const toRad = (value) => (value * Math.PI) / 180;

  const lat1 = parseFloat(coords1.latitude);
  const lon1 = parseFloat(coords1.longitude);
  const lat2 = parseFloat(coords2.latitude);
  const lon2 = parseFloat(coords2.longitude);

  const R = 6371; // Earth's radius in kilometers

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
};

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

const calculateDurationInSeconds = (checkInTime, checkOutTime) => {
  if (!checkInTime || !checkOutTime) {
    return 0;
  }
  const checkIn = new Date(`1970-01-01T${checkInTime}Z`);
  const checkOut = new Date(`1970-01-01T${checkOutTime}Z`);
  const durationInSeconds = (checkOut - checkIn) / 1000;
  return durationInSeconds < 0 ? 0 : durationInSeconds;
};

exports.getCoordinates = async (req, res, next) => {
  try {
    let query =
      "SELECT * FROM emp_tracking WHERE latitude != 0.0 AND longitude != 0.0";

    for (const key in req.query) {
      if (req.query.hasOwnProperty(key)) {
        query += ` AND ${key} = '${req.query[key]}'`;
      }
    }

    const data = await sqlModel.customQuery(query);

    if (data.error) {
      return res.status(500).send(data);
    }

    if (data.length === 0) {
      return res.status(200).send({ status: false, message: "No data found" });
    }

    let totalDistance = 0;

    // Calculate the total distance between the coordinates
    for (let i = 0; i < data.length - 1; i++) {
      const distance = haversineDistance(data[i], data[i + 1]);
      totalDistance += distance;
    }

    // Send the response
    res.status(200).send({ status: true, totalDistance, data: data });
  } catch (error) {
    console.error("Error in getCoordinates:", error);
    res.status(500).send({ status: false, error: error.message });
  }
};

exports.getCoordinatesv2 = async (req, res, next) => {
  try {
    const whereClause = {};

    for (const key in req.query) {
      if (req.query.hasOwnProperty(key)) {
        whereClause[key] = req.query[key];
      }
    }

    const query = `
      SELECT t.latitude, t.longitude, t.date, t.time,t.battery_status, subquery.cnt, subquery.min_time, subquery.max_time
      FROM (
          SELECT ROUND(latitude, 3) AS latitude, ROUND(longitude, 3) AS longitude, date,
                 MIN(time) AS min_time, MAX(time) AS max_time, COUNT(*) AS cnt, MIN(id) AS min_id
          FROM emp_tracking
          WHERE emp_id = ? AND date = ? AND latitude != 0 AND longitude != 0
        
          GROUP BY ROUND(latitude, 3), ROUND(longitude, 3), date
      ) AS subquery
      JOIN emp_tracking AS t ON subquery.min_id = t.id
      ORDER BY subquery.min_time, subquery.max_time
    `;

    const emp_id = whereClause.emp_id || "";
    const date = whereClause.date || "";

    // Execute the custom query
    const data = await sqlModel.customQuery(query, [emp_id, date]);

    if (data.error) {
      return res.status(500).send(data);
    }

    if (data.length === 0) {
      return res.status(200).send({ status: false, message: "No data found" });
    }

    // Calculate the time difference for each group and sort by time
    const result = data.map((item) => {
      const minTime = new Date(`${item.date} ${item.min_time}`);
      const maxTime = new Date(`${item.date} ${item.max_time}`);
      const timeDifference = maxTime - minTime; // Time difference in milliseconds

      // Convert milliseconds to hours, minutes, seconds
      const hours = Math.floor(timeDifference / 3600000);
      const minutes = Math.floor((timeDifference % 3600000) / 60000);
      const seconds = Math.floor((timeDifference % 60000) / 1000);

      item.time_difference = `${hours}h ${minutes}m ${seconds}s`;

      // Assuming `item.image` is included in the data
      item.image = item.image ? `${process.env.BASE_URL}${item.image}` : "";

      return item;
    });

    // Sort the result by min_time to ensure proper sequence
    result.sort(
      (a, b) =>
        new Date(`${a.date} ${a.min_time}`) -
        new Date(`${b.date} ${b.min_time}`)
    );

    res.status(200).send({ status: true, data: result });
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
    const checkInQuery = `
    SELECT
      e.id,
      e.name,
      e.mobile,
      e.email,
      e.designation,
      e.department,
      e.employee_id,
      CASE
        WHEN e.image IS NOT NULL THEN CONCAT(?, e.image)
        ELSE e.image
      END AS image,
      c.date,
      c.check_in_time,
      c.check_out_time,
      c.duration
    FROM employees e
    LEFT JOIN check_in c ON e.id = c.emp_id AND c.date = ? AND e.company_id = c.company_id
    WHERE e.company_id = ?
    `;

    const checkInValues = [baseUrl, date, company_id];
    const checkInData = await sqlModel.customQuery(checkInQuery, checkInValues);

    const analyticsQuery = `
    SELECT
      emp_id,
      checkin_status,
      time_difference,
      total_duration,
      total_distance
    FROM emp_analytics
    WHERE company_id = ? AND date = ?
    `;

    const analyticsValues = [company_id, date];
    const analyticsData = await sqlModel.customQuery(
      analyticsQuery,
      analyticsValues
    );

    const companyQuery = `
    SELECT
      check_in_time_start,
      check_in_time_end
    FROM company
    WHERE id = ?
    `;

    const companyValues = [company_id];
    const companyData = await sqlModel.customQuery(companyQuery, companyValues);

    const { check_in_time_start, check_in_time_end } = companyData[0] || {};

    const startDateTime = new Date(`1970-01-01T${check_in_time_start}Z`);
    const endDateTime = new Date(`1970-01-01T${check_in_time_end}Z`);

    const analyticsMap = analyticsData.reduce((acc, item) => {
      console.log(item.checkin_status);
      acc[item.emp_id] = {
        total_duration: item.total_duration,
        total_distance: item.total_distance,
        checkin_status: item.checkin_status,
        timeDifferencev2: item.time_difference,
      };
      return acc;
    }, {});

    const processedData = checkInData.reduce((acc, item) => {
      const existingEmployee = acc.find((emp) => emp.id === item.id);
      const checkInTime = item.check_in_time;
      const checkOutTime = item.check_out_time;

      const checkInDateTime = new Date(`1970-01-01T${checkInTime}Z`);

      let checkin_status = "On Time";
      let timeDifferenceSeconds = 0;

      if (checkInDateTime < startDateTime) {
        checkin_status = "Early";
        timeDifferenceSeconds = Math.abs(
          (startDateTime - checkInDateTime) / 1000
        );
      } else if (checkInDateTime > endDateTime) {
        checkin_status = "Late";
        timeDifferenceSeconds = Math.abs(
          (checkInDateTime - endDateTime) / 1000
        );
      }

      if (existingEmployee) {
        if (checkInTime) {
          existingEmployee.checkIns.push({
            check_in_time: checkInTime,
            check_out_time: checkOutTime || null,
            duration: item.duration || 0,
          });
        }

        existingEmployee.latestCheckInTime =
          existingEmployee.latestCheckInTime || checkInTime;

        if (checkOutTime) {
          existingEmployee.latestCheckOutTime = checkOutTime;
        } else if (existingEmployee.checkIns.length > 0) {
          existingEmployee.latestCheckOutTime = null;
        }

        existingEmployee.checkin_status = checkin_status;
        existingEmployee.timeDifference = formatDuration(timeDifferenceSeconds);
        existingEmployee.attendance_status = "Present";
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
          checkIns: checkInTime
            ? [
                {
                  check_in_time: checkInTime,
                  check_out_time: checkOutTime || null,
                  duration: item.duration || 0,
                },
              ]
            : [],
          latestCheckInTime: checkInTime || null,
          latestCheckOutTime: checkOutTime || null,
          totalDuration: analyticsMap[item.id]?.total_duration || "0h 0m 0s",
          totalDistance: analyticsMap[item.id]?.total_distance || 0,
          checkin_statusv2: analyticsMap[item.id]?.checkin_status || 0,
          checkin_status: checkInTime ? checkin_status : "Absent",
          attendance_status: checkInTime ? "Present" : "Absent",
          timeDifference: formatDuration(timeDifferenceSeconds),
          timeDifferencev2: analyticsMap[item.id]?.timeDifferencev2 || 0,
        });
      }
      return acc;
    }, []);

    const totalPresent = processedData.filter(
      (emp) => emp.attendance_status === "Present"
    ).length;
    const totalAbsent = processedData.filter(
      (emp) => emp.attendance_status === "Absent"
    ).length;

    // Calculate total duration in seconds for all employees
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
        totalDuration: totalFormattedDuration,
        totalDistance,
      });
    }

    res.status(200).send({
      status: true,
      data: processedData,
      attendenceCount: {
        totalPresent,
        totalAbsent,
        totalDuration: totalFormattedDuration,
        totalDistance,
      },
    });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};

exports.getEmployeeAttendance = async (req, res, next) => {
  try {
    const company_id = req.query.company_id;

    if (!company_id) {
      return res
        .status(400)
        .send({ status: false, message: "Company ID is required" });
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
      { company_id: company_id }
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

    const employeeAttendanceData = [];

    for (const employee of employees) {
      const { id: emp_id } = employee;

      // Query to get last check_in_time and check_out_time for each date
      const query = `
        SELECT 
          c.date,
          MIN(c.check_in_time) AS last_check_in_time,
          MAX(c.check_out_time) AS last_check_out_time,
          ea.checkin_status,
          ea.time_difference AS timeDifference,
          ea.total_duration AS totalDuration
        FROM check_in c
        LEFT JOIN emp_analytics ea
        ON c.emp_id = ea.emp_id AND c.company_id = ea.company_id AND c.date = ea.date
        WHERE c.emp_id = ? AND c.company_id = ? AND MONTH(c.date) = ? AND YEAR(c.date) = ?
        GROUP BY c.date, ea.checkin_status, ea.time_difference, ea.total_duration
        ORDER BY c.date
      `;

      const values = [emp_id, company_id, month, year];
      const data = await sqlModel.customQuery(query, values);

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

      data.forEach((item) => {
        if (!groupedData[item.date]) return;

        groupedData[item.date].checkin_status = item.checkin_status || "-";
        groupedData[item.date].attendance_status = "Present";
        groupedData[item.date].timeDifference =
          item.timeDifference || "00:00:00";
        groupedData[item.date].totalDuration = item.totalDuration || "00:00:00";
        groupedData[item.date].last_check_in_time =
          item.last_check_in_time || "00:00:00";
        groupedData[item.date].last_check_out_time =
          item.last_check_out_time || "00:00:00";
      });

      const checkInDates = Object.values(groupedData);

      const employeeData = {
        id: employee.id,
        name: employee.name,
        mobile: employee.mobile,
        email: employee.email,
        designation: employee.designation,
        employee_id: employee.employee_id,
        image: employee.image,
        attendance: checkInDates,
      };

      employeeAttendanceData.push(employeeData);
    }

    res.status(200).send({
      status: true,
      data: employeeAttendanceData,
      daysInMonth: daysInMonth,
    });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};
