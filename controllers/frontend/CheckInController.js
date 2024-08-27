const sqlModel = require("../../config/db");

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

const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371; // Radius of the Earth in kilometers

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
};

exports.getCheckIn = async (req, res, next) => {
  try {
    const whereClause = {};

    for (const key in req.query) {
      if (req.query.hasOwnProperty(key)) {
        whereClause[key] = req.query[key];
      }
    }

    const data = await sqlModel.select("check_in", {}, whereClause);

    if (data.error) {
      return res.status(500).send(data);
    }

    if (data.length === 0) {
      return res.status(200).send({ status: false, message: "No data found" });
    }

    const result = await Promise.all(
      data.map(async (item) => {
        item.checkin_img = item.checkin_img
          ? `${process.env.BASE_URL}${item.checkin_img}`
          : "";
        item.checkout_img = item.checkout_img
          ? `${process.env.BASE_URL}${item.checkout_img}`
          : "";
        return item;
      })
    );

    res.status(200).send({ status: true, data: result });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};

// exports.checkIn = async (req, res, next) => {
//   try {
//     let {
//       emp_id,
//       company_id,
//       lat_check_in,
//       long_check_in,
//       battery_status_at_checkIn,
//     } = req.body;

//     if (!company_id) {
//       return res
//         .status(400)
//         .send({ status: false, message: "Company ID is required" });
//     }
//     if (!emp_id) {
//       return res
//         .status(400)
//         .send({ status: false, message: "Employee ID is required" });
//     }

//     const date = getCurrentDate();
//     const currentTime = getCurrentTime();

//     const existingCheckIns = await sqlModel.select(
//       "check_in",
//       ["id", "check_in_time"],
//       {
//         emp_id,
//         company_id,
//         date,
//         checkin_status: "Check-in",
//       }
//     );

//     if (existingCheckIns.length > 0) {
//       return res.status(400).send({
//         status: false,
//         message: "Please Check-out before Check In again",
//       });
//     }

//     let insert = {
//       emp_id,
//       company_id,
//       lat_check_in,
//       long_check_in,
//       battery_status_at_checkIn,
//     };

//     // emp anylits

//     const companyData = await sqlModel.select(
//       "company",
//       ["check_in_time_start", "check_in_time_end"],
//       {
//         company_id,
//       }
//     );

//     const { check_in_time_start, check_in_time_end } = companyData[0] || {};

//     const startDateTime = new Date(`1970-01-01T${check_in_time_start}Z`);
//     const endDateTime = new Date(`1970-01-01T${check_in_time_end}Z`);

//     const checkInDateTime = currentTime;

//     let checkin_status = "On Time";
//     let timeDifferenceSeconds = 0;

//     if (checkInDateTime < startDateTime) {
//       checkin_status = "Early";
//       timeDifferenceSeconds = Math.abs(
//         (startDateTime - checkInDateTime) / 1000
//       );
//     } else if (checkInDateTime > endDateTime) {
//       checkin_status = "Late";
//       timeDifferenceSeconds = Math.abs(
//         (checkInDateTime - endDateTime) / 1000
//       );
//     }

//     empAnalyticsData={
//       checkin_status
//       timeDifference = formatDuration(timeDifferenceSeconds);
//     }

//     const result = await sqlModel.insert("emp_analytics", empAnalyticsData);

//     if (req.files && req.files.checkin_img) {
//       insert.checkin_img = req.files.checkin_img[0].path;
//     } else {
//       insert.checkin_img = null;
//     }

//     const newCheckInData = {
//       emp_id,
//       company_id,
//       check_in_time: currentTime,
//       lat_check_in: insert.lat_check_in,
//       long_check_in: insert.long_check_in,
//       checkin_img: insert.checkin_img,
//       battery_status_at_checkIn: insert.battery_status_at_checkIn,
//       created_at: getCurrentDateTime(),
//       checkin_status: "Check-in",
//       date,
//     };

//     const result = await sqlModel.insert("check_in", newCheckInData);

//     // Query for the earliest check-in time for the same date
//     const earliestCheckInQuery = `
//       SELECT MIN(check_in_time) AS earliestCheckInTime
//       FROM check_in
//       WHERE emp_id = ? AND company_id = ? AND date = ?
//     `;

//     const earliestCheckInResult = await sqlModel.customQuery(
//       earliestCheckInQuery,
//       [emp_id, company_id, date]
//     );

//     const earliestCheckInTime =
//       earliestCheckInResult[0]?.earliestCheckInTime || currentTime;

//     return res.status(200).send({
//       status: true,
//       message: "Check-in successful",
//       data: { earliestCheckInTime: earliestCheckInTime },
//     });
//   } catch (error) {
//     console.error("Error during check-in:", error);
//     return res.status(500).send({
//       status: false,
//       message: "An error occurred during check-in",
//       error: error.message,
//     });
//   }
// };

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
    const existingAnalytics = await sqlModel.select("emp_analytics", ["id"], {
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
      await sqlModel.insert("emp_analytics", empAnalyticsData);
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
    let {
      emp_id,
      company_id,
      lat_check_out,
      long_check_out,
      battery_status_at_checkout,
    } = req.body;

    if (!company_id) {
      return res
        .status(400)
        .send({ status: false, message: "Company ID is required" });
    }
    if (!emp_id) {
      return res
        .status(400)
        .send({ status: false, message: "Employee ID is required" });
    }

    let updateData = {
      lat_check_out,
      long_check_out,
      battery_status_at_checkout,
    };

    if (req.files && req.files.checkout_img) {
      updateData.checkout_img = req.files.checkout_img[0].path;
    } else {
      updateData.checkout_img = null;
    }

    const date = getCurrentDate();
    const checkOutTime = getCurrentTime();

    const checkInData = await sqlModel.select(
      "check_in",
      ["*"],
      { emp_id, company_id, date },
      "ORDER BY created_at DESC"
    );

    if (checkInData.length > 0) {
      const lastCheckIn = checkInData[0];

      if (
        lastCheckIn.checkin_status === "Check-in" &&
        !lastCheckIn.check_out_time
      ) {
        const durationInSeconds = calculateDurationInSeconds(
          lastCheckIn.check_in_time,
          checkOutTime
        );

        const formattedDuration = formatDuration(durationInSeconds);

        updateData.check_out_time = checkOutTime;
        updateData.checkin_status = "Check-out";
        updateData.updated_at = getCurrentDateTime();
        updateData.duration = formattedDuration;

        const updateResult = await sqlModel.update("check_in", updateData, {
          id: lastCheckIn.id,
        });

        let totalDurationInSeconds = 0;

        for (const checkIn of checkInData) {
          let checkOut = checkIn.check_out_time;
          if (!checkOut) {
            checkOut = checkOutTime;
          }
          const durationInSeconds = calculateDurationInSeconds(
            checkIn.check_in_time,
            checkOut
          );
          totalDurationInSeconds += durationInSeconds;
        }

        const totalformattedDuration = formatDuration(totalDurationInSeconds);

        const trackingData = await sqlModel.select(
          "emp_tracking",
          ["latitude", "longitude"],
          { emp_id, company_id, date },
          "ORDER BY created_at ASC"
        );

        let totalDistance = 0;
        for (let i = 0; i < trackingData.length - 1; i++) {
          const lat1 = trackingData[i].lat;
          const lon1 = trackingData[i].lon;
          const lat2 = trackingData[i + 1].lat;
          const lon2 = trackingData[i + 1].lon;

          totalDistance += haversineDistance(lat1, lon1, lat2, lon2);
        }

        console.log(`Total distance: ${totalDistance} km`);

        const existingAnalytics = await sqlModel.select(
          "emp_analytics",
          ["*"],
          { emp_id, company_id, date }
        );

        if (existingAnalytics.length > 0) {
          await sqlModel.update(
            "emp_analytics",
            {
              total_duration: totalformattedDuration,
              total_distance: totalDistance,
              updated_at: getCurrentDateTime(),
            },
            { emp_id, company_id, date }
          );
        } else {
          await sqlModel.insert("emp_analytics", {
            emp_id,
            company_id,
            date,
            total_duration: totalformattedDuration,
            total_distance: totalDistance,
            created_at: getCurrentDateTime(),
          });
        }

        return res.status(200).send({
          status: true,
          message: "Check-out successful",
          data: {
            latestCheckOutTime: checkOutTime,
            totalDuration: totalformattedDuration,
          },
        });
      } else {
        return res.status(400).send({
          status: false,
          message:
            "Cannot check out: No valid check-in record found or already checked out",
        });
      }
    } else {
      return res.status(400).send({
        status: false,
        message: "No check-in record found for today",
      });
    }
  } catch (error) {
    console.error("Error during check-out:", error);
    return res.status(500).send({
      status: false,
      totalDistance:totalDistance
      message: "An error occurred during check-out",
      error: error.message,
    });
  }
};
