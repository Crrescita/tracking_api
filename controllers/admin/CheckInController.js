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

    // Process data to include all check-ins per employee
    const processedData = data.reduce((acc, item) => {
      const existingEmployee = acc.find((emp) => emp.id === item.id);

      const durationInSeconds = calculateDurationInSeconds(
        item.check_in_time,
        item.check_out_time
      );

      if (existingEmployee) {
        if (item.check_in_time && item.check_out_time) {
          existingEmployee.checkIns.push({
            check_in_time: item.check_in_time,
            check_out_time: item.check_out_time,
            duration: formatDuration(durationInSeconds),
          });
        }

        existingEmployee.totalDurationInSeconds += durationInSeconds;
        existingEmployee.latestCheckInTime =
          existingEmployee.latestCheckInTime || item.check_in_time;
        existingEmployee.latestCheckOutTime =
          existingEmployee.latestCheckOutTime || item.check_out_time;

        if (
          item.check_in_time &&
          new Date(`1970-01-01T${item.check_in_time}Z`) <
            new Date(`1970-01-01T${existingEmployee.latestCheckInTime}Z`)
        ) {
          existingEmployee.latestCheckInTime = item.check_in_time;
        }
        if (
          item.check_out_time &&
          new Date(`1970-01-01T${item.check_out_time}Z`) >
            new Date(`1970-01-01T${existingEmployee.latestCheckOutTime}Z`)
        ) {
          existingEmployee.latestCheckOutTime = item.check_out_time;
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
          image: item.checkin_img
            ? `${process.env.BASE_URL}${item.checkin_img}`
            : "",
          date: item.date,
          checkIns:
            item.check_in_time && item.check_out_time
              ? [
                  {
                    check_in_time: item.check_in_time,
                    check_out_time: item.check_out_time,
                    duration: formatDuration(durationInSeconds),
                  },
                ]
              : [],
          latestCheckInTime: item.check_in_time || null,
          latestCheckOutTime: item.check_out_time || null,
          totalDuration: formatDuration(durationInSeconds),
          totalDurationInSeconds: durationInSeconds,
          checkin_status: item.check_in_time ? "Present" : "Absent",
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
