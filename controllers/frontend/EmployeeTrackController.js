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
    res.status(200).send({ status: false, error: error.message });
  }
};

// exports.setCoordinates = async (req, res, next) => {
//   try {
//     // Retrieve and check the authorization token
//     const token = req.headers.authorization?.split(" ")[1];

//     if (!token) {
//       return res
//         .status(200)
//         .json({ status: false, message: "Token is required" });
//     }

//     // Fetch employee details using the token
//     const [employee] = await sqlModel.select(
//       "employees",
//       ["id", "company_id"],
//       {
//         api_token: token,
//       }
//     );
//     console.log(employee, "employeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee");
//     if (!employee) {
//       return res
//         .status(200)
//         .json({ status: false, message: "Employee not found" });
//     }

//     const emp_id = employee.id;
//     const company_id = employee.company_id;
//     const todayDatae = getCurrentDate();

//     const [company] = await sqlModel.select("company", ["check_out_time"], {
//       id: company_id,
//     });

//     if (!company) {
//       return res.status(200).json({
//         status: false,
//         message: "Company details not found",
//       });
//     }

//     const checkInData = await sqlModel.select(
//       "check_in",
//       ["*"],
//       { emp_id, company_id, date: todayDatae },
//       "ORDER BY id DESC"
//     );
//     // console.log(checkInData);
//     if (
//       checkInData.length === 0 ||
//       checkInData[0].checkin_status !== "Check-in" ||
//       checkInData[0].check_out_time
//     ) {
//       console.log("check in check works");
//       return res.status(200).json({
//         status: true,
//         message: "Data submitted successfully check",
//         data: {},
//         row_id: row_id,
//         timer: timerValue,
//         // data: result,
//         // row_id: row_id,
//         // timer: timerValue,
//       });

//       // return res.status(200).json({
//       //   status: false,
//       //   message:
//       //     "Cannot check out: No valid check-in record found or already checked out",
//       // });
//     }

//     const checkOutTime = company.check_out_time;

//     // const currentTime = getCurrentTime();
//     // const cuurentOpTime = new Date(`1970-01-01T${currentTime}Z`);
//     // console.log(currentTime, checkOutTime);

//     // if (cuurentOpTime >= checkOutTime) {
//     //   console.log("comapn");
//     //   return res.status(200).json({
//     //     status: true,
//     //     message: "Data submitted successfully time",
//     //   });
//     // }

//     const currentTime = getCurrentTime();
//     const cuurentOpTime = new Date(`1970-01-01T${currentTime}Z`);

//     console.log("Current Time:", currentTime, "Check-Out Time:", checkOutTime);

//     if (typeof checkOutTime === "string") {
//       //console.log("time check working")
//       const checkOutOpTime = new Date(`1970-01-01T${checkOutTime}Z`);

//       if (cuurentOpTime >= checkOutOpTime) {
//         console.log("time check working time greater check");
//         return res.status(200).json({
//           status: true,
//           message: "Data submitted successfully within time",
//           data: {},
//           row_id: row_id,
//           timer: timerValue,
//         });
//       }
//     }

//     // Destructure the request body (remove duplicate emp_id and company_id)
//     const {
//       latitude,
//       longitude,
//       battery_status,
//       gps_status,
//       internet_status,
//       motion,
//       datetime_mobile,
//       row_id,
//       ...rest
//     } = req.body;

//     // Validate required fields
//     const requiredFields = {
//       latitude,
//       longitude,
//       battery_status,
//       gps_status,
//       internet_status,
//       motion,
//     };

//     for (const [key, value] of Object.entries(requiredFields)) {
//       if (!value) {
//         console.log("valodation check for params");
//         return res.status(200).json({
//           status: false,
//           message: `${key.replace("_", " ")} is required`,
//         });
//       }
//     }

//     // Prepare new data for insertion into emp_tracking
//     // const newCheckInData = {
//     //   company_id,
//     //   emp_id,
//     //   latitude,
//     //   longitude,
//     //   battery_status,
//     //   date: getCurrentDate(),
//     //   time: getCurrentTime(),
//     //   created_at: getCurrentDateTime(),
//     //   gps_status,
//     //   internet_status,
//     //   motion,
//     //   datetime_mobile,
//     //   row_id,
//     //   ...rest,
//     // };

//     const parseDateTime = (datetimeMobile) => {
//       let dateTimeFormatted;

//       if (!isNaN(datetimeMobile)) {
//         const dateObj = new Date(parseFloat(datetimeMobile) * 1000);
//         const date = dateObj.toISOString().split("T")[0];
//         const time = dateObj.toTimeString().split(" ")[0];

//         dateTimeFormatted = `${date} ${time}`;
//       } else {
//         dateTimeFormatted = datetimeMobile;
//       }

//       return dateTimeFormatted;
//     };

//     const datetimeFormatted = parseDateTime(datetime_mobile); // Format datetime_mobile

//     const [date, time] = datetimeFormatted.split(" "); // Split into date and time

//     const newCheckInData = {
//       company_id,
//       emp_id,
//       latitude,
//       longitude,
//       battery_status,
//       date,
//       time,
//       created_at: getCurrentDateTime(),
//       gps_status,
//       internet_status,
//       motion,
//       datetime_mobile: datetimeFormatted,
//       row_id,
//       status: "regular",
//       ...rest,
//     };

//     //console.log(newCheckInData);
//     // Insert tracking data into emp_tracking table
//     //    const result = await sqlModel.insert("emp_tracking", newCheckInData);

//     // Fetch the timer value for the employee
//     const [employeeTimer] = await sqlModel.select("employees", ["timer"], {
//       id: emp_id,
//       company_id,
//     });

//     if (!employeeTimer) {
//       return res.status(200).json({
//         status: false,
//         message: "Employee not found",
//       });
//     }

//     // Set the timer value with a default of 30000 ms if it's not found
//     const timerValue = employeeTimer.timer || 30000;

//     // Send success response with the result and timer value
//     console.log({
//       status: true,
//       message: "Data submitted successfully",
//       data: result,
//       row_id: row_id,
//       timer: timerValue,
//     });
//     return res.status(200).json({
//       status: true,
//       message: "Data submitted successfully",
//       data: result,
//       row_id: row_id,
//       timer: timerValue,
//     });
//   } catch (error) {
//     return res.status(200).json({
//       status: false,
//       message: "An error occurred during data submission",
//       error: error.message,
//     });
//   }
// };

exports.setCoordinates = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(400).json({
        status: false,
        message: "Token is required",
      });
    }

    const [employee] = await sqlModel.select(
      "employees",
      ["id", "company_id", "name"],
      { api_token: token }
    );
    console.log("employee", employee);
    if (!employee) {
      return res.status(404).json({
        status: false,
        message: "Employee not found",
      });
    }

    const { id: emp_id, company_id } = employee;

    const [employeeTimer] = await sqlModel.select("employees", ["timer"], {
      id: emp_id,
      company_id,
    });
    const timerValue = employeeTimer?.timer || 30000;

    const [company] = await sqlModel.select("company", ["check_out_time"], {
      id: company_id,
    });
    if (!company) {
      return res.status(404).json({
        status: false,
        message: "Company details not found",
      });
    }

    const todayDate = getCurrentDate();

    const [checkInRecord] = await sqlModel.select(
      "check_in",
      ["*"],
      { emp_id, company_id, date: todayDate },
      "ORDER BY id DESC"
    );

    if (
      !checkInRecord ||
      checkInRecord.checkin_status !== "Check-in" ||
      checkInRecord.check_out_time
    ) {
      console.log("no valid check-in for ", employee);
      return res.status(200).json({
        status: true,
        message: "Data submitted successfully, no valid check-in",
        data: {},
        row_id: req.body.row_id,
        timer: timerValue,
      });
    }

    const currentTime = new Date(`1970-01-01T${getCurrentTime()}Z`);
    if (typeof company.check_out_time === "string") {
      const checkOutTime = new Date(`1970-01-01T${company.check_out_time}Z`);
      if (currentTime >= checkOutTime) {
        console.log("check-out time for ", employee);
        return res.status(200).json({
          status: true,
          message: "Data submitted successfully within check-out time",
          data: {},
          row_id: req.body.row_id,
          timer: timerValue,
        });
      }
    }

    const {
      latitude,
      longitude,
      battery_status,
      gps_status,
      internet_status,
      motion,
      datetime_mobile,
      row_id,
      ...rest
    } = req.body;
    const requiredFields = {
      latitude,
      longitude,
      battery_status,
      gps_status,
      internet_status,
      motion,
    };

    for (const [key, value] of Object.entries(requiredFields)) {
      if (!value) {
        return res.status(400).json({
          status: false,
          message: `${key.replace("_", " ")} is required`,
        });
      }
    }

    // Format datetime_mobile
    const parseDateTime = (datetimeMobile) => {
      if (!isNaN(datetimeMobile)) {
        const dateObj = new Date(parseFloat(datetimeMobile) * 1000);
        const date = dateObj.toISOString().split("T")[0];
        const time = dateObj.toTimeString().split(" ")[0];
        return `${date} ${time}`;
      }
      return datetimeMobile;
    };

    const datetimeFormatted = parseDateTime(datetime_mobile);
    const [date, time] = datetimeFormatted.split(" ");

    const trackingData = {
      company_id,
      emp_id,
      latitude,
      longitude,
      battery_status,
      date,
      time,
      created_at: getCurrentDateTime(),
      gps_status,
      internet_status,
      motion,
      datetime_mobile: datetimeFormatted,
      row_id,
      status: "regular",
      ...rest,
    };

    const result = await sqlModel.insert("emp_tracking", trackingData);
    console.log("final submit ", employee, trackingData);
    return res.status(200).json({
      status: true,
      message: "Data submitted successfully",
      data: result,
      row_id: row_id,
      timer: timerValue,
    });
  } catch (error) {
    console.error("Error in setCoordinates:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred during data submission",
      error: error.message,
    });
  }
};

// exports.setAllCoordinates = async (req, res, next) => {
//   try {
//     const token = req.headers.authorization?.split(" ")[1];

//     if (!token) {
//       return res
//         .status(200)
//         .json({ status: false, message: "Token is required" });
//     }

//     // Fetch employee details using the token
//     const [employee] = await sqlModel.select(
//       "employees",
//       ["id", "company_id", "timer"],
//       {
//         api_token: token,
//       }
//     );

//     if (!employee) {
//       return res
//         .status(200)
//         .json({ status: false, message: "Employee not found" });
//     }

//     const emp_id = employee.id;
//     const company_id = employee.company_id;
//     const timerValue = employee.timer || 30000; // Use the employee's timer or default to 30,000 ms

//     const dataArray = req.body;

//     if (!Array.isArray(dataArray) || dataArray.length === 0) {
//       return res.status(200).json({
//         status: false,
//         message: "Data should be a non-empty array",
//       });
//     }

//     // Loop through the dataArray to insert each tracking record
//     for (const item of dataArray) {
//       const {
//         latitude,
//         longitude,
//         battery_status,
//         gps_status,
//         internet_status,
//         motion,
//         datetime_mobile,
//         row_id,
//         ...rest
//       } = item;

//       // Validate required fields
//       const requiredFields = {
//         latitude,
//         longitude,
//         battery_status,
//         gps_status,
//         internet_status,
//         motion,
//       };

//       for (const [key, value] of Object.entries(requiredFields)) {
//         if (!value) {
//           return res.status(200).json({
//             status: false,
//             message: `${key.replace("_", " ")} is required`,
//           });
//         }
//       }

//       const parseDateTime = (datetimeMobile) => {
//         let dateTimeFormatted;

//         if (!isNaN(datetimeMobile)) {
//           const dateObj = new Date(parseFloat(datetimeMobile) * 1000);
//           const date = dateObj.toISOString().split("T")[0];
//           const time = dateObj.toTimeString().split(" ")[0];

//           dateTimeFormatted = `${date} ${time}`;
//         } else {
//           dateTimeFormatted = datetimeMobile;
//         }

//         return dateTimeFormatted;
//       };

//       const datetimeFormatted = parseDateTime(datetime_mobile); // Format datetime_mobile

//       const [date, time] = datetimeFormatted.split(" "); // Split into date and time

//       const newCheckInData = {
//         company_id,
//         emp_id,
//         latitude,
//         longitude,
//         battery_status,
//         date,
//         time,
//         created_at: getCurrentDateTime(),
//         gps_status,
//         internet_status,
//         motion,
//         datetime_mobile: datetimeFormatted,
//         row_id,
//         status: "regular",
//         ...rest,
//       };

//       const newCheckInData = {
//         company_id,
//         emp_id,
//         latitude,
//         longitude,
//         battery_status,
//         date: getCurrentDate(),
//         time: getCurrentTime(),
//         created_at: getCurrentDateTime(),
//         gps_status,
//         internet_status,
//         motion,
//         datetime_mobile,
//         row_id,
//         ...rest,
//       };

//       await sqlModel.insert("emp_tracking", newCheckInData);
//     }

//     // Send the success response with the timer value
//     return res.status(200).json({
//       status: true,
//       message: "Data submitted successfully",
//
//       timer: timerValue,
//     });
//   } catch (error) {
//     return res.status(200).json({
//       status: false,
//       message: "An error occurred during data submission",
//       error: error.message,
//     });
//   }
// };

exports.setAllCoordinates = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(400).json({
        status: false,
        message: "Token is required",
      });
    }

    const [employee] = await sqlModel.select(
      "employees",
      ["id", "company_id", "timer"],
      { api_token: token }
    );

    if (!employee) {
      return res.status(404).json({
        status: false,
        message: "Employee not found",
      });
    }

    const emp_id = employee.id;
    const company_id = employee.company_id;
    const timerValue = employee.timer || 30000;

    const dataArray = req.body;

    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      return res.status(400).json({
        status: false,
        message: "Data should be a non-empty array",
      });
    }

    const validateFields = (fields) => {
      for (const [key, value] of Object.entries(fields)) {
        if (!value) {
          throw new Error(`${key.replace("_", " ")} is required`);
        }
      }
    };

    const parseDateTime = (datetimeMobile) => {
      if (!isNaN(datetimeMobile)) {
        const dateObj = new Date(parseFloat(datetimeMobile) * 1000);
        const date = dateObj.toISOString().split("T")[0];
        const time = dateObj.toTimeString().split(" ")[0];
        return `${date} ${time}`;
      }
      return datetimeMobile;
    };

    const insertPromises = dataArray.map(async (item) => {
      const {
        latitude,
        longitude,
        battery_status,
        gps_status,
        internet_status,
        motion,
        datetime_mobile,
        row_id,
        ...rest
      } = item;

      validateFields({
        latitude,
        longitude,
        battery_status,
        gps_status,
        internet_status,
        motion,
      });

      const datetimeFormatted = parseDateTime(datetime_mobile);
      const [date, time] = datetimeFormatted.split(" ");

      const newCheckInData = {
        company_id,
        emp_id,
        latitude,
        longitude,
        battery_status,
        date,
        time,
        created_at: getCurrentDateTime(),
        gps_status,
        internet_status,
        motion,
        datetime_mobile: datetimeFormatted,
        row_id,
        status: "regular",
        ...rest,
      };

      await sqlModel.insert("emp_tracking", newCheckInData);
    });

    await Promise.all(insertPromises);

    return res.status(200).json({
      status: true,
      message: "Data submitted successfully",
      timer: timerValue,
    });
  } catch (error) {
    console.error("Error in setAllCoordinates:", error.message);
    return res.status(500).json({
      status: false,
      message: "An error occurred during data submission",
      error: error.message,
    });
  }
};
