const sqlModel = require("../../config/db");

// exports.getCheckIn = async (req, res, next) => {
//   try {
//     const whereClause = {};
//     for (const key in req.query) {
//       if (req.query.hasOwnProperty(key)) {
//         whereClause[key] = req.query[key];
//       }
//     }

//     const data = await sqlModel.select("check_in", {}, whereClause);

//     if (data.error) {
//       return res.status(500).send(data);
//     }

//     if (data.length === 0) {
//       return res.status(200).send({ status: false, message: "No data found" });
//     }

//     const result = await Promise.all(
//       data.map(async (item) => {
//         item.checkin_img = item.checkin_img
//           ? `${process.env.BASE_URL}${item.checkin_img}`
//           : "";
//         item.checkout_img = item.checkout_img
//           ? `${process.env.BASE_URL}${item.checkout_img}`
//           : "";
//         return item;
//       })
//     );

//     res.status(200).send({ status: true, data: result });
//   } catch (error) {
//     res.status(500).send({ status: false, error: error.message });
//   }
// };

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
        return 0; // Return 0 if either time is null or undefined
      }
      const checkIn = new Date(`1970-01-01T${checkInTime}Z`);
      const checkOut = new Date(`1970-01-01T${checkOutTime}Z`);
      const durationInSeconds = (checkOut - checkIn) / 1000; // duration in seconds
      return durationInSeconds < 0 ? 0 : durationInSeconds; // Ensure no negative durations
    };

    const result = await Promise.all(
      data.map(async (item) => {
        item.checkin_img = item.checkin_img
          ? `${process.env.BASE_URL}${item.checkin_img}`
          : "";
        item.checkout_img = item.checkout_img
          ? `${process.env.BASE_URL}${item.checkout_img}`
          : "";

        // Calculate duration
        const durationInSeconds = calculateDurationInSeconds(
          item.check_in_time,
          item.check_out_time
        );
        item.duration = formatDuration(durationInSeconds);

        return item;
      })
    );

    res.status(200).send({ status: true, data: result });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};
