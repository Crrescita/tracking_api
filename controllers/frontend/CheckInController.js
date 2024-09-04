const sqlModel = require("../../config/db");
const cron = require("node-cron");

// const getCurrentDate = () => {
//   return new Date().toISOString().slice(0, 10); // Format: YYYY-MM-DD
// };
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

const getCurrentTime = () => {
  const currentDate = new Date();

  const hour = String(currentDate.getHours()).padStart(2, "0");
  const minute = String(currentDate.getMinutes()).padStart(2, "0");
  const second = String(currentDate.getSeconds()).padStart(2, "0");

  const formattedTime = `${hour}:${minute}:${second}`;

  return formattedTime;
};

const formatDuration = (totalSeconds) => {
  if (isNaN(totalSeconds) || totalSeconds < 0) {
    return "00:00:00";
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const formattedHours = String(hours).padStart(2, "0");
  const formattedMinutes = String(minutes).padStart(2, "0");
  const formattedSeconds = String(seconds).padStart(2, "0");

  return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
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

// const haversineDistance = (coords1, coords2) => {
//   const toRad = (value) => (value * Math.PI) / 180;

//   const lat1 = parseFloat(coords1.latitude);
//   const lon1 = parseFloat(coords1.longitude);
//   const lat2 = parseFloat(coords2.latitude);
//   const lon2 = parseFloat(coords2.longitude);

//   const R = 6371; // Earth's radius in kilometers

//   const dLat = toRad(lat2 - lat1);
//   const dLon = toRad(lon2 - lon1);
//   const a =
//     Math.sin(dLat / 2) * Math.sin(dLat / 2) +
//     Math.cos(toRad(lat1)) *
//       Math.cos(toRad(lat2)) *
//       Math.sin(dLon / 2) *
//       Math.sin(dLon / 2);
//   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
//   const distanceInKm = R * c;

//   // Convert distance to meters
//   // const distanceInMeters = distanceInKm * 1000;

//   return distanceInKm;
// };

exports.getCheckIn = async (req, res, next) => {
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

    const queryDate = req.query.date || new Date().toISOString().split("T")[0];

    const query = `
  SELECT 
    ea.date, 
    IFNULL(ea.total_duration, '00:00:00') AS total_duration,
    IFNULL(MIN(c.check_in_time), '00:00:00') AS earliestCheckInTime, 
    IFNULL(MAX(c.check_out_time), '00:00:00') AS latestCheckOutTime,
    MAX(c.checkin_status) AS checkin_status
  FROM emp_attendance ea
  LEFT JOIN check_in c 
    ON ea.emp_id = c.emp_id 
    AND ea.company_id = c.company_id 
    AND DATE(c.date) = ?
  WHERE ea.emp_id = ? 
    AND ea.company_id = ?
    AND ea.date = ?
  GROUP BY ea.date;
`;

    const values = [queryDate, emp_id, company_id, queryDate];
    const data = await sqlModel.customQuery(query, values);

    if (data.error) {
      return res.status(500).send(data);
    }

    if (data.length === 0) {
      const response = [
        {
          date: queryDate,
          total_duration: "00:00:00",
          earliestCheckInTime: "00:00:00",
          latestCheckOutTime: "00:00:00",
          checkin_status: "Check-in",
        },
      ];
      return res.status(200).send({
        status: true,
        message: "No data found for this date",
        data: response,
      });
    }

    res.status(200).send({ status: true, data: data });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};

exports.checkIn = async (req, res, next) => {
  try {
    const {
      emp_id,
      company_id,
      lat_check_in,
      long_check_in,
      battery_status_at_checkIn,
    } = req.body;

    if (!company_id) {
      return res.status(400).json({
        status: false,
        message: "Company ID is required",
      });
    }
    if (!emp_id) {
      return res.status(400).json({
        status: false,
        message: "Employee ID is required",
      });
    }

    const date = getCurrentDate();
    const currentTime = getCurrentTime();

    // Check if the employee has already checked in for the day
    const existingCheckIns = await sqlModel.select(
      "check_in",
      ["id", "check_in_time"],
      {
        emp_id,
        company_id,
        date,
        checkin_status: "Check-in",
      }
    );

    if (existingCheckIns.length > 0) {
      return res.status(400).json({
        status: false,
        message: "Please Check-out before checking in again",
      });
    }

    // Retrieve company's check-in time window
    const companyData = await sqlModel.select(
      "company",
      ["check_in_time_start", "check_in_time_end"],
      { id: company_id }
    );

    if (!companyData.length) {
      return res.status(404).json({
        status: false,
        message: "Company data not found",
      });
    }

    const { check_in_time_start, check_in_time_end } = companyData[0];
    const startDateTime = new Date(`1970-01-01T${check_in_time_start}Z`);
    const endDateTime = new Date(`1970-01-01T${check_in_time_end}Z`);
    const checkInDateTime = new Date(`1970-01-01T${currentTime}Z`);

    // Determine check-in status and time difference
    let checkin_status = "On Time";
    let timeDifferenceSeconds = 0;

    if (checkInDateTime < startDateTime) {
      checkin_status = "Early";
      timeDifferenceSeconds = Math.abs(
        (startDateTime - checkInDateTime) / 1000
      );
    } else if (checkInDateTime > endDateTime) {
      checkin_status = "Late";
      timeDifferenceSeconds = Math.abs((checkInDateTime - endDateTime) / 1000);
    }

    // Check if analytics data for the employee on the same date already exists
    const existingAnalytics = await sqlModel.select("emp_attendance", ["id"], {
      emp_id,
      company_id,
      date,
    });

    if (existingAnalytics.length === 0) {
      const empAnalyticsData = {
        emp_id,
        company_id,
        date,
        checkin_status,
        time_difference: formatDuration(timeDifferenceSeconds),
      };

      // Insert analytics data
      await sqlModel.insert("emp_attendance", empAnalyticsData);
    }

    // Handle check-in image if provided
    const checkin_img = req.files?.checkin_img
      ? req.files.checkin_img[0].path
      : null;

    const newCheckInData = {
      emp_id,
      company_id,
      check_in_time: currentTime,
      lat_check_in,
      long_check_in,
      checkin_img,
      battery_status_at_checkIn,
      created_at: getCurrentDateTime(),
      checkin_status: "Check-in",
      date,
    };

    // Insert check-in data
    await sqlModel.insert("check_in", newCheckInData);

    // Retrieve the earliest check-in time for the same date
    const earliestCheckInQuery = `
      SELECT MIN(check_in_time) AS earliestCheckInTime
      FROM check_in
      WHERE emp_id = ? AND company_id = ? AND date = ?
    `;
    const earliestCheckInResult = await sqlModel.customQuery(
      earliestCheckInQuery,
      [emp_id, company_id, date]
    );

    const earliestCheckInTime =
      earliestCheckInResult[0]?.earliestCheckInTime || currentTime;

    return res.status(200).json({
      status: true,
      message: "Check-in successful",
      data: { earliestCheckInTime },
    });
  } catch (error) {
    console.error("Error during check-in:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred during check-in",
      error: error.message,
    });
  }
};

exports.checkOut = async (req, res, next) => {
  try {
    const {
      emp_id,
      company_id,
      lat_check_out,
      long_check_out,
      battery_status_at_checkout,
    } = req.body;

    if (!company_id || !emp_id) {
      return res.status(400).json({
        status: false,
        message: !company_id
          ? "Company ID is required"
          : "Employee ID is required",
      });
    }

    const date = getCurrentDate();
    const checkOutTime = getCurrentTime();
    const updateData = {
      lat_check_out,
      long_check_out,
      battery_status_at_checkout,
      check_out_time: checkOutTime,
      checkin_status: "Check-out",
      updated_at: getCurrentDateTime(),
      checkout_img: req.files?.checkout_img
        ? req.files.checkout_img[0].path
        : null,
    };

    // Fetch the latest check-in data
    const checkInData = await sqlModel.select(
      "check_in",
      ["*"],
      { emp_id, company_id, date },
      "ORDER BY created_at DESC"
    );

    if (
      checkInData.length === 0 ||
      checkInData[0].checkin_status !== "Check-in" ||
      checkInData[0].check_out_time
    ) {
      return res.status(400).json({
        status: false,
        message:
          "Cannot check out: No valid check-in record found or already checked out",
      });
    }

    const lastCheckIn = checkInData[0];
    const durationInSeconds = calculateDurationInSeconds(
      lastCheckIn.check_in_time,
      checkOutTime
    );
    updateData.duration = formatDuration(durationInSeconds);

    // Update check-in record with check-out data
    await sqlModel.update("check_in", updateData, { id: lastCheckIn.id });

    // Calculate total duration and distance
    let totalDurationInSeconds = 0;
    let totalDistance = 0;

    // const trackingData = await sqlModel.select(
    //   "emp_tracking",
    //   ["latitude", "longitude"],
    //   { emp_id, company_id, date }
    // );

    // for (let i = 0; i < trackingData.length - 1; i++) {
    //   const distance = haversineDistance(trackingData[i], trackingData[i + 1]);
    //   totalDistance += distance;
    // }

    const trackingData = await sqlModel.select("emp_tracking", ["*"], {
      emp_id,
      company_id,
      date,
    });

    // Filter out coordinates with 0.0 values for consistency
    const filteredTrackingData = trackingData.filter(
      (coord) => coord.latitude !== 0.0 && coord.longitude !== 0.0
    );

    for (let i = 0; i < filteredTrackingData.length - 1; i++) {
      const distance = haversineDistance(
        filteredTrackingData[i],
        filteredTrackingData[i + 1]
      );
      totalDistance += distance;
    }

    for (const checkIn of checkInData) {
      const checkOut = checkIn.check_out_time || checkOutTime;
      const duration = calculateDurationInSeconds(
        checkIn.check_in_time,
        checkOut
      );
      totalDurationInSeconds += duration;
    }

    const totalformattedDuration = formatDuration(totalDurationInSeconds);

    // Insert or update analytics data
    const existingAnalytics = await sqlModel.select("emp_attendance", ["*"], {
      emp_id,
      company_id,
      date,
    });
    const analyticsData = {
      total_duration: totalformattedDuration,
      total_distance: totalDistance,
      updated_at: getCurrentDateTime(),
    };

    if (existingAnalytics.length > 0) {
      await sqlModel.update("emp_attendance", analyticsData, {
        emp_id,
        company_id,
        date,
      });
    } else {
      await sqlModel.insert("emp_attendance", {
        ...analyticsData,
        emp_id,
        company_id,
        date,
        created_at: getCurrentDateTime(),
      });
    }

    return res.status(200).json({
      status: true,
      message: "Check-out successful",
      data: {
        latestCheckOutTime: checkOutTime,
        totalDuration: totalformattedDuration,
        totalDistance: totalDistance,
      },
    });
  } catch (error) {
    console.error("Error during check-out:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred during check-out",
      error: error.message,
    });
  }
};

async function autoCheckOut(companyId) {
  try {
    console.log(`Running auto check-out for company ${companyId}`);
    const currentTime = getCurrentTime();

    // Fetch employees who are currently checked in for the specific company
    const employees = await sqlModel.customQuery(
      `SELECT c.id AS checkin_id, c.emp_id, c.company_id 
       FROM check_in c 
       WHERE c.company_id = ? AND c.checkin_status = 'Check-in' AND c.check_out_time IS NULL`,
      [companyId]
    );

    for (const employee of employees) {
      // Create a mock res object to handle the response
      const res = {
        status: (statusCode) => ({
          json: (data) => {
            // console.log(`Response status: ${statusCode}`, data);
            return data;
          },
        }),
      };

      // Call the checkOut function with necessary data
      const req = {
        body: {
          emp_id: employee.emp_id,
          company_id: employee.company_id,
          lat_check_out: null, // or provide default lat/long
          long_check_out: null,
          battery_status_at_checkout: null,
        },
      };

      await exports.checkOut(req, res, null); // Pass the mock res object
    }
  } catch (error) {
    console.error("Error during auto check-out:", error);
  }
}

async function scheduleAutoCheckOuts() {
  const companies = await sqlModel.select("company", ["id", "check_out_time"]);

  // Group companies by check_out_time
  const companiesByTime = companies.reduce((acc, company) => {
    if (!acc[company.check_out_time]) {
      acc[company.check_out_time] = [];
    }
    acc[company.check_out_time].push(company.id);
    return acc;
  }, {});

  // Schedule a cron job for each unique check-out time
  for (const checkOutTime in companiesByTime) {
    const [hour, minute] = checkOutTime.split(":");

    // Validate hour and minute
    if (!hour || !minute || isNaN(hour) || isNaN(minute)) {
      // console.error(
      //   `Invalid check_out_time: ${checkOutTime} for companies: ${companiesByTime[
      //     checkOutTime
      //   ].join(", ")}`
      // );
      continue; // Skip this invalid time
    }

    cron.schedule(`${minute} ${hour} * * *`, () => {
      console.log(companiesByTime[checkOutTime]);
      const companyIds = companiesByTime[checkOutTime];
      companyIds.forEach(autoCheckOut);
    });
  }
}

// Initialize the scheduling function
scheduleAutoCheckOuts();
