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

    let totalDistance = 0;

    for (let i = 0; i < data.length - 1; i++) {
      const distance = haversineDistance(data[i], data[i + 1]);
      totalDistance += distance;
    }

    res.status(200).send({ status: true, totalDistance, data: data });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};

exports.getCoordinates = async (req, res, next) => {
  try {
    const { date, emp_id } = req.query;

    // Validate the date parameter
    if (!date) {
      return res
        .status(400)
        .send({ status: false, message: "Date is required" });
    }

    // Define the start and end times for the given date
    const startTime = "00:00:00";
    const endTime = "23:59:59";

    // Build the WHERE clause dynamically
    let whereClause = `date = ? AND time BETWEEN ? AND ?`;
    const values = [date, startTime, endTime];

    // Add filter for employee ID if provided
    if (emp_id) {
      whereClause += " AND emp_id = ?";
      values.push(emp_id);
    }

    // Construct the SQL query
    const coordinatesQuery = `
      SELECT * FROM emp_tracking
      WHERE ${whereClause}
    `;

    // Execute the query
    const coordinatesData = await sqlModel.customQuery(
      coordinatesQuery,
      values
    );

    if (coordinatesData.error) {
      return res
        .status(500)
        .send({ status: false, error: coordinatesData.error.message });
    }

    if (coordinatesData.length === 0) {
      return res.status(200).send({ status: false, message: "No data found" });
    }

    // Calculate total distance
    let totalDistance = 0;
    for (let i = 0; i < coordinatesData.length - 1; i++) {
      const distance = haversineDistance(
        coordinatesData[i],
        coordinatesData[i + 1]
      );
      totalDistance += distance;
    }

    res
      .status(200)
      .send({ status: true, totalDistance, data: coordinatesData });
  } catch (error) {
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
      SELECT t.latitude, t.longitude, t.date, t.time, subquery.cnt
      FROM (
          SELECT ROUND(latitude, 3) AS latitude, ROUND(longitude, 3) AS longitude, date, time, COUNT(*) AS cnt, MIN(id) AS min_id
          FROM emp_tracking
          WHERE emp_id = ? AND date = ?
          GROUP BY ROUND(latitude, 3), ROUND(longitude, 3)
      ) AS subquery
      JOIN emp_tracking AS t ON subquery.min_id = t.id
      ORDER BY t.id DESC
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

    const result = await Promise.all(
      data.map(async (item) => {
        item.image = item.image ? `${process.env.BASE_URL}${item.image}` : "";
        return item;
      })
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
      acc[item.emp_id] = {
        total_duration: item.total_duration,
        total_distance: item.total_distance,
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
          checkin_status: checkInTime ? checkin_status : "Absent",
          attendance_status: checkInTime ? "Present" : "Absent",
          timeDifference: formatDuration(timeDifferenceSeconds),
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

    // Calculate total duration and distance for all employees
    const totalDuration = processedData.reduce((sum, emp) => {
      const durationStr = emp.totalDuration;
      const durationParts = durationStr.match(/(\d+)h (\d+)m (\d+)s/);
      if (durationParts) {
        const hours = parseInt(durationParts[1], 10);
        const minutes = parseInt(durationParts[2], 10);
        const seconds = parseInt(durationParts[3], 10);
        return sum + hours * 3600 + minutes * 60 + seconds;
      }
      return sum;
    }, 0);

    const totalDistance = processedData.reduce(
      (sum, emp) => sum + (emp.totalDistance || 0),
      0
    );

    const totalFormattedDuration = formatDuration(totalDuration);

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
