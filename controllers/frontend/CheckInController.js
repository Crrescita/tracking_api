const sqlModel = require("../../config/db");
const cron = require("node-cron");

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

// const getCurrentDate = () => {
//   const currentDate = new Date();

//   // Ensure we get the correct date parts from the Asia/Kolkata timezone
//   const year = currentDate.toLocaleString("en-US", {
//     year: "numeric",
//     timeZone: "Asia/Kolkata",
//   });
//   const month = currentDate.toLocaleString("en-US", {
//     month: "2-digit",
//     timeZone: "Asia/Kolkata",
//   });
//   const day = currentDate.toLocaleString("en-US", {
//     day: "2-digit",
//     timeZone: "Asia/Kolkata",
//   });

//   const formattedDate = `${year}-${month}-${day}`;

//   return formattedDate;
// };

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
//   const distance = R * c;

//   return distance;
// };

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

  const distance = R * c; // Distance in kilometers

  return distance;
};

exports.getCheckIn = async (req, res, next) => {
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

    // const queryDate = req.query.date || new Date().toISOString().split("T")[0];
    const queryDate = req.query.date || getCurrentDate();
    // console.log(queryDate);
    const query = `
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

    const values = [queryDate, emp_id, company_id, queryDate];
    const data = await sqlModel.customQuery(query, values);

    if (data.error) {
      return res.status(200).send({
        status: false,
        message: "Internal server error",
        error: data.error,
      });
    }

    if (data.length === 0) {
      return res.status(200).send({
        status: true,
        message: "No data found for this date",
        data: {
          date: queryDate,
          total_duration: "00:00:00",
          earliestCheckInTime: "00:00:00",
          latestCheckOutTime: "00:00:00",
          checkin_status: "Check-out",
        },
      });
    }

    const lastIndex = data.length - 1;

    const response = {
      date: queryDate,
      total_duration: data[lastIndex]?.total_duration || "00:00:00",
      earliestCheckInTime: data[0]?.check_in_time || "00:00:00",
      latestCheckOutTime: data[lastIndex]?.check_out_time || "00:00:00",
      checkin_status: data[lastIndex]?.checkin_status || "Check-in",
    };

    res.status(200).send({ status: true, data: response });
  } catch (error) {
    res.status(200).send({
      status: false,
      message: "An unexpected error occurred",
      error: error.message,
    });
  }
};

const getCheckInStatusAndTimeDiff = (checkInTime, startTime, endTime) => {
  let checkin_status = "On-Time";
  let timeDifferenceSeconds = 0;

  if (checkInTime < startTime) {
    checkin_status = "Early";
    timeDifferenceSeconds = Math.abs((startTime - checkInTime) / 1000);
  } else if (checkInTime > endTime) {
    checkin_status = "Late";
    timeDifferenceSeconds = Math.abs((checkInTime - endTime) / 1000);
  }

  return { checkin_status, timeDifferenceSeconds };
};

const insertAnalyticsData = async (
  emp_id,
  company_id,
  date,
  checkin_status,
  timeDifferenceSeconds
) => {
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

    await sqlModel.insert("emp_attendance", empAnalyticsData);
  }
};

const getCompanyCheckInWindow = async (company_id) => {
  const companyData = await sqlModel.select(
    "company",
    ["check_in_time_start", "check_in_time_end"],
    { id: company_id }
  );

  if (!companyData.length) {
    throw new Error("Company data not found");
  }

  return {
    startTime: new Date(`1970-01-01T${companyData[0].check_in_time_start}Z`),
    endTime: new Date(`1970-01-01T${companyData[0].check_in_time_end}Z`),
  };
};

exports.checkIn = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res
        .status(200)
        .send({ status: false, message: "Token is required" });
    }

    // Fetch employee details using the token
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
    if (!req.body.lat_check_in) {
      req.body.lat_check_in = 0.0;
    }
    if (!req.body.long_check_in) {
      req.body.long_check_in = 0.0;
    }
    const { lat_check_in, long_check_in, battery_status_at_checkIn } = req.body;

    if (!battery_status_at_checkIn) {
      return res.status(200).json({
        status: false,
        message: "All check-in details are required",
      });
    }

    const date = getCurrentDate();
    const currentTime = getCurrentTime();

    // Check if the employee is on leave
    const leaveStatus = await sqlModel.select(
      "emp_attendance",
      ["checkin_status", "total_duration"],
      {
        emp_id,
        company_id,
        date,
      }
    );

    if (leaveStatus.length > 0 && leaveStatus[0].checkin_status === "Leave") {
      return res.status(200).json({
        status: false,
        message: "You are currently on leave and cannot check in",
      });
    }

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
      return res.status(200).json({
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
      return res.status(200).json({
        status: false,
        message: "Company data not found",
      });
    }

    const { check_in_time_start, check_in_time_end } = companyData[0];
    const startDateTime = new Date(`1970-01-01T${check_in_time_start}Z`);
    const endDateTime = new Date(`1970-01-01T${check_in_time_end}Z`);
    const checkInDateTime = new Date(`1970-01-01T${currentTime}Z`);

    // Determine check-in status and time difference
    const { checkin_status, timeDifferenceSeconds } =
      getCheckInStatusAndTimeDiff(checkInDateTime, startDateTime, endDateTime);

    // Check if analytics data for the employee on the same date already exists
    await insertAnalyticsData(
      emp_id,
      company_id,
      date,
      checkin_status,
      timeDifferenceSeconds
    );

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

    // Fix: Add default value for total_duration
    const total_duration = leaveStatus[0]?.total_duration || "00:00:00";

    return res.status(200).json({
      status: true,
      message: "Check-in successful",
      data: {
        date,
        total_duration, // Safely use total_duration
        earliestCheckInTime,
        latestCheckOutTime: "00:00:00",
        checkin_status: "Check-in",
      },
    });
  } catch (error) {
    return res.status(200).json({
      status: false,
      message: "An error occurred during check-in",
      error: error.message,
    });
  }
};

exports.checkOut = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res
        .status(200)
        .json({ status: false, message: "Token is required" });
    }

    // Fetch employee details using the token
    const [employee] = await sqlModel.select(
      "employees",
      ["id", "company_id"],
      { api_token: token }
    );

    if (!employee) {
      return res
        .status(200)
        .json({ status: false, message: "Employee not found" });
    }

    const { id: emp_id, company_id } = employee;

    const { lat_check_out, long_check_out, battery_status_at_checkout } =
      req.body;

    if (!lat_check_out || !long_check_out || !battery_status_at_checkout) {
      return res.status(200).json({
        status: false,
        message: "All check-out details are required",
      });
    }

    const date = getCurrentDate();
    const checkOutTime = getCurrentTime();

    // Fetch the latest check-in data
    const checkInData = await sqlModel.select(
      "check_in",
      ["*"],
      { emp_id, company_id, date },
      "ORDER BY id DESC"
    );

    console.log(checkInData);
    if (
      checkInData.length === 0 ||
      checkInData[0].checkin_status !== "Check-in" ||
      checkInData[0].check_out_time
    ) {
      return res.status(200).json({
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
      duration: formatDuration(durationInSeconds),
    };

    // Update check-in record with check-out data
    await sqlModel.update("check_in", updateData, { id: lastCheckIn.id });

    // Calculate total duration and distance
    const [totalDurationInSeconds, totalDistance] =
      await calculateTotalDurationAndDistance(emp_id, company_id, date);

    // Insert or update analytics data
    const existingAnalytics = await sqlModel.select("emp_attendance", ["*"], {
      emp_id,
      company_id,
      date,
    });
    const analyticsData = {
      total_duration: formatDuration(totalDurationInSeconds),
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
        date,
        earliestCheckInTime: checkInData[checkInData.length - 1]?.check_in_time,
        latestCheckOutTime: checkOutTime,
        checkin_status: "Check-out",
        total_duration: formatDuration(totalDurationInSeconds),
        // totalDistance,
      },
    });
  } catch (error) {
    return res.status(200).json({
      status: false,
      message: "An error occurred during check-out",
      error: error.message,
    });
  }
};

// Utility function to calculate total duration and distance
async function calculateTotalDurationAndDistance(emp_id, company_id, date) {
  let totalDurationInSeconds = 0;
  let totalDistance = 0;

  const checkInData = await sqlModel.select(
    "check_in",
    ["check_in_time", "check_out_time"],
    { emp_id, company_id, date }
  );

  const query = `
  SELECT 
    *, 
    ROUND(latitude, 6) AS latitude, 
    ROUND(longitude, 6) AS longitude 
  FROM emp_tracking 
  WHERE emp_id = ? 
    AND company_id = ? 
    AND date = ? 
    AND latitude != 0.0 
    AND longitude != 0.0
`;

  const trackingData = await sqlModel.customQuery(query, [
    emp_id,
    company_id,
    date,
  ]);

  // console.log(filteredTrackingData);
  for (let i = 0; i < trackingData.length - 1; i++) {
    // totalDistance += haversineDistance(
    //   filteredTrackingData[i],
    //   filteredTrackingData[i + 1]
    // );
    const distance = haversineDistance(trackingData[i], trackingData[i + 1]);
    totalDistance += distance;
  }

  for (const checkIn of checkInData) {
    const checkOut = checkIn.check_out_time || getCurrentTime();
    totalDurationInSeconds += calculateDurationInSeconds(
      checkIn.check_in_time,
      checkOut
    );
  }

  return [totalDurationInSeconds, totalDistance];
}

// Fixing autoSchedulecheckOut function for auto-check-out process
exports.autoSchedulecheckOut = async (req, res, next) => {
  try {
    console.log("checkout function runs");

    // Fetch employee details using emp_id and company_id
    const [employee] = await sqlModel.select(
      "employees",
      ["id", "company_id"],
      { id: req.body.emp_id, company_id: req.body.company_id }
    );

    console.log("checkout function runs, employee found:", employee);
    if (!employee) {
      return res
        .status(200)
        .json({ status: false, message: "Employee not found" });
    }

    const date = getCurrentDate();
    const checkOutTime = getCurrentTime();

    // Fetch the latest check-in data
    const checkInData = await sqlModel.select(
      "check_in",
      ["*"],
      { emp_id: req.body.emp_id, company_id: employee.company_id, date },
      "ORDER BY id DESC"
    );

    console.log("Check-in data:", checkInData);
    if (
      checkInData.length === 0 ||
      checkInData[0].checkin_status !== "Check-in" ||
      checkInData[0].check_out_time
    ) {
      return res.status(200).json({
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

    const updateData = {
      lat_check_out: req.body.lat_check_out,
      long_check_out: req.body.long_check_out,
      battery_status_at_checkout: req.body.battery_status_at_checkout,
      check_out_time: checkOutTime,
      checkin_status: "Check-out",
      updated_at: getCurrentDateTime(),
      checkout_img: req.files?.checkout_img
        ? req.files.checkout_img[0].path
        : null,
      duration: formatDuration(durationInSeconds),
    };

    // Update check-in record with check-out data
    await sqlModel.update("check_in", updateData, { id: lastCheckIn.id });

    // Calculate total duration and distance
    const [totalDurationInSeconds, totalDistance] =
      await calculateTotalDurationAndDistance(
        req.body.emp_id,
        employee.company_id,
        date
      );

    // Insert or update analytics data
    const existingAnalytics = await sqlModel.select("emp_attendance", ["*"], {
      emp_id: req.body.emp_id,
      company_id: employee.company_id,
      date,
    });

    const analyticsData = {
      total_duration: formatDuration(totalDurationInSeconds),
      total_distance: totalDistance,
      updated_at: getCurrentDateTime(),
    };

    if (existingAnalytics.length > 0) {
      await sqlModel.update("emp_attendance", analyticsData, {
        emp_id: req.body.emp_id,
        company_id: employee.company_id,
        date,
      });
    } else {
      await sqlModel.insert("emp_attendance", {
        ...analyticsData,
        emp_id: req.body.emp_id,
        company_id: employee.company_id,
        date,
        created_at: getCurrentDateTime(),
      });
    }

    return res.status(200).json({
      status: true,
      message: "Check-out successful",
      data: {
        date,
        earliestCheckInTime: checkInData[checkInData.length - 1]?.check_in_time,
        latestCheckOutTime: checkOutTime,
        checkin_status: "Check-out",
        total_duration: formatDuration(totalDurationInSeconds),
      },
    });
  } catch (error) {
    console.error("Error in autoSchedulecheckOut:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred during check-out",
      error: error.message,
    });
  }
};

// Fixing autoCheckOut function
async function autoCheckOut(companyId) {
  try {
    console.log(`Running auto check-out for company ${companyId}`);
    const employees = await sqlModel.customQuery(
      `SELECT c.id AS checkin_id, c.emp_id, c.company_id 
       FROM check_in c 
       WHERE c.company_id = ? AND c.checkin_status = 'Check-in' AND c.check_out_time IS NULL`,
      [companyId]
    );

    for (const employee of employees) {
      const res = {
        status: (statusCode) => ({
          json: (data) => {
            return data;
          },
        }),
      };

      const req = {
        body: {
          emp_id: employee.emp_id,
          company_id: employee.company_id,
          lat_check_out: null,
          long_check_out: null,
          battery_status_at_checkout: null,
        },
      };

      await exports.autoSchedulecheckOut(req, res, null); // Ensure this function exists and works
    }
  } catch (error) {
    console.error(
      `Error during auto check-out for company ${companyId}:`,
      error
    );
  }
}

// Fixing scheduleAutoCheckOuts function
async function scheduleAutoCheckOuts() {
  try {
    const companies = await sqlModel.select("company", [
      "id",
      "check_out_time",
    ]);

    // Group companies by their check_out_time
    const companiesByTime = companies.reduce((acc, company) => {
      if (company.check_out_time) {
        if (!acc[company.check_out_time]) {
          acc[company.check_out_time] = [];
        }
        acc[company.check_out_time].push(company.id);
      }
      return acc;
    }, {});

    // Schedule cron jobs for each unique check_out_time
    for (const checkOutTime in companiesByTime) {
      const [hour, minute] = checkOutTime.split(":");

      if (
        hour &&
        minute &&
        !isNaN(hour) &&
        !isNaN(minute) &&
        hour >= 0 &&
        hour < 24 &&
        minute >= 0 &&
        minute < 60
      ) {
        cron.schedule(`${minute} ${hour} * * *`, () => {
          const companyIds = companiesByTime[checkOutTime];
          companyIds.forEach((companyId) => autoCheckOut(companyId));
        });

        console.log(`Scheduled auto check-out for ${checkOutTime}`);
      } else {
        console.error(
          `Invalid check_out_time: ${checkOutTime} for companies: ${companiesByTime[
            checkOutTime
          ].join(", ")}`
        );
      }
    }
  } catch (error) {
    console.error("Error scheduling auto check-outs:", error);
  }
}

// Initialize the scheduling function
scheduleAutoCheckOuts();
