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
    const { emp_id, company_id, date } = req.query;

    if (!emp_id || !company_id || !date) {
      return res.status(400).send({
        status: false,
        message: "Employee ID, company ID, and date are required",
      });
    }

    // Query to get check-in data for a specific employee
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
      c.check_out_time,
      TIME_TO_SEC(TIMEDIFF(c.check_out_time, c.check_in_time)) AS duration_in_seconds
    FROM employees e
    LEFT JOIN check_in c ON e.id = c.emp_id AND c.date = ? AND e.company_id = c.company_id
    WHERE e.id = ? AND e.company_id = ?
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
        return 0; // Return 0 if either time is null or undefined
      }
      const checkIn = new Date(`1970-01-01T${checkInTime}Z`);
      const checkOut = new Date(`1970-01-01T${checkOutTime}Z`);
      const durationInSeconds = (checkOut - checkIn) / 1000; // duration in seconds
      return durationInSeconds < 0 ? 0 : durationInSeconds; // Ensure no negative durations
    };

    // Process data to include all check-ins for the specific employee
    const processedData = data.reduce((acc, item) => {
      if (acc) {
        const durationInSeconds = calculateDurationInSeconds(
          item.check_in_time,
          item.check_out_time
        );

        if (item.check_in_time && item.check_out_time) {
          acc.checkIns.push({
            check_in_time: item.check_in_time,
            check_out_time: item.check_out_time,
            duration: formatDuration(durationInSeconds),
          });
        }

        acc.totalDurationInSeconds += durationInSeconds;
        acc.latestCheckInTime = acc.latestCheckInTime || item.check_in_time;
        acc.latestCheckOutTime = acc.latestCheckOutTime || item.check_out_time;

        if (
          item.check_in_time &&
          new Date(`1970-01-01T${item.check_in_time}Z`) <
            new Date(`1970-01-01T${acc.latestCheckInTime}Z`)
        ) {
          acc.latestCheckInTime = item.check_in_time;
        }
        if (
          item.check_out_time &&
          new Date(`1970-01-01T${item.check_out_time}Z`) >
            new Date(`1970-01-01T${acc.latestCheckOutTime}Z`)
        ) {
          acc.latestCheckOutTime = item.check_out_time;
        }
      } else {
        acc = {
          id: item.id,
          name: item.name,
          mobile: item.mobile,
          email: item.email,
          designation: item.designation,
          employee_id: item.employee_id,
          image: item.image,
          date: item.date,
          checkIns:
            item.check_in_time && item.check_out_time
              ? [
                  {
                    check_in_time: item.check_in_time,
                    check_out_time: item.check_out_time,
                    duration: formatDuration(
                      calculateDurationInSeconds(
                        item.check_in_time,
                        item.check_out_time
                      )
                    ),
                  },
                ]
              : [],
          latestCheckInTime: item.check_in_time || null,
          latestCheckOutTime: item.check_out_time || null,
          totalDuration: formatDuration(
            calculateDurationInSeconds(item.check_in_time, item.check_out_time)
          ),
          totalDurationInSeconds: calculateDurationInSeconds(
            item.check_in_time,
            item.check_out_time
          ),
          checkin_status: item.check_in_time ? "Present" : "Absent",
        };
      }
      return acc;
    }, null);

    if (!processedData) {
      return res.status(200).send({ status: false, message: "No data found" });
    }

    // Compute total duration for the employee
    processedData.totalDuration = formatDuration(
      processedData.totalDurationInSeconds
    );

    res.status(200).send({
      status: true,
      data: processedData,
    });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};
