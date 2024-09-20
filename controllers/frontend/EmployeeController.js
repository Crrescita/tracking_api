const sqlModel = require("../../config/db");
const path = require("path");
const deleteOldFile = require("../../middleware/deleteImage");
const bcrypt = require("bcrypt");
const sendMail = require("../../mail/nodemailer");
const saltRounds = 10;
const crypto = require("crypto");

const formatDuration = (totalSeconds) => {
  if (isNaN(totalSeconds) || totalSeconds < 0) {
    return "00:00:00";
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(2, "0")}`;
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
// get emp
exports.employeesGet = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res
        .status(200)
        .send({ status: false, message: "Token is required" });
    }

    const [employee] = await sqlModel.select(
      "employees",
      [
        "id",
        "company_id",
        "name",
        "mobile",
        "email",
        "address",
        "designation",
        "department",
        "state",
        "zip_code",
        "city",
        "dob",
        "joining_date",
        "employee_id",
        "image",
      ],
      { api_token: token }
    );

    if (!employee) {
      return res
        .status(200)
        .send({ status: false, message: "Employee not found" });
    }

    const [company] = await sqlModel.select("company", ["name"], {
      id: employee.company_id,
    });

    const companyName = company?.name || "";

    employee.image = employee.image
      ? `${process.env.BASE_URL}${employee.image}`
      : "";
    delete employee.password;
    employee.company_name = companyName;

    res.status(200).send({ status: true, data: employee });
  } catch (error) {
    res.status(200).send({ status: false, error: error.message });
  }
};
// update emp
exports.updateEmployee = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res
        .status(200)
        .send({ status: false, message: "Token is required" });
    }

    const [employee] = await sqlModel.select(
      "employees",
      {},
      { api_token: token }
    );

    if (!employee) {
      return res
        .status(200)
        .send({ status: false, message: "Employee not found" });
    }

    const id = employee.id;
    const updateData = { ...req.body };
    const companyId = employee.company_id;
    let plainPassword = updateData.password;

    // Fetch the company record to validate the company ID
    const [company] = await sqlModel.select("company", {}, { id: companyId });

    if (!company) {
      return res
        .status(200)
        .send({ status: false, message: "Company not found" });
    }

    if (req.files && req.files.image) {
      updateData.image = req.fileFullPath.find((path) =>
        path.includes("image")
      );
    }

    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, saltRounds);
    } else {
      delete updateData.password;
    }

    const originalEmail = employee.email;
    const originalPasswordHash = employee.password;

    if (req.body.email) {
      const existingEmployeeWithEmail = await sqlModel.select(
        "employees",
        ["id"],
        { email: req.body.email }
      );
      if (
        existingEmployeeWithEmail.length > 0 &&
        existingEmployeeWithEmail[0].id !== id
      ) {
        return res
          .status(200)
          .send({ status: false, message: "Email already exists" });
      }
    }

    if (req.body.employee_id) {
      const existingEmployeeWithId = await sqlModel.select(
        "employees",
        ["id"],
        { employee_id: req.body.employee_id }
      );
      if (
        existingEmployeeWithId.length > 0 &&
        existingEmployeeWithId[0].id !== id
      ) {
        return res
          .status(200)
          .send({ status: false, message: "Employee ID already exists" });
      }
    }

    if (req.fileFullPath && req.fileFullPath.length > 0) {
      const oldImagePath = employee.image;

      if (updateData.image && oldImagePath) {
        deleteOldFile.deleteOldFile(oldImagePath);
      }
    }

    updateData.updated_at = getCurrentDateTime();
    const saveData = await sqlModel.update("employees", updateData, { id });

    if (saveData.error) {
      return res.status(500).send(saveData);
    }

    if (req.body.email || plainPassword) {
      const emailChanged = originalEmail !== req.body.email;
      const passwordChanged =
        plainPassword &&
        !(await bcrypt.compare(plainPassword, originalPasswordHash));

      if (emailChanged || passwordChanged) {
        const emailData = {
          name: req.body.name,
          email: req.body.email,
          password: plainPassword || originalPasswordHash,
        };

        sendMail.sendEmailToEmp(emailData);
      }
    }

    res
      .status(200)
      .send({ status: true, message: "Profile updated successfully!" });
  } catch (error) {
    return res.status(200).send({ status: false, error: error.message });
  }
};

// emp attendance

// exports.getEmployeeAttendance = async (req, res, next) => {
//   try {
//     const token = req.headers.authorization?.split(" ")[1];

//     if (!token) {
//       return res
//         .status(400)
//         .send({ status: false, message: "Token is required" });
//     }

//     const [employee] = await sqlModel.select(
//       "employees",
//       ["id", "company_id"],
//       { api_token: token }
//     );

//     if (!employee) {
//       return res
//         .status(404)
//         .send({ status: false, message: "Employee not found" });
//     }

//     const { id: emp_id, company_id } = employee;

//     if (!emp_id || !company_id) {
//       return res.status(400).send({
//         status: false,
//         message: "Employee ID and company ID are required",
//       });
//     }

//     const dateParam = req.query.date;
//     const targetDate = dateParam ? new Date(dateParam) : new Date();
//     const year = targetDate.getFullYear();
//     const month = targetDate.getMonth() + 1;

//     const daysInMonth = new Date(year, month, 0).getDate();
//     const allDays = Array.from({ length: daysInMonth }, (_, i) => {
//       const day = String(i + 1).padStart(2, "0");
//       return `${year}-${String(month).padStart(2, "0")}-${day}`;
//     });

//     const query = `
//             SELECT
//               e.id,
//               e.name,
//               e.mobile,
//               e.email,
//               e.designation,
//               e.employee_id,
//               CASE
//                 WHEN e.image IS NOT NULL THEN CONCAT(?, e.image)
//                 ELSE e.image
//               END AS image,
//               c.date,
//               c.check_in_time,
//               c.check_out_time
//             FROM employees e
//             LEFT JOIN check_in c ON e.id = c.emp_id AND e.company_id = c.company_id
//             WHERE e.id = ? AND e.company_id = ? AND MONTH(c.date) = ? AND YEAR(c.date) = ?
//             ORDER BY c.date, c.check_in_time
//           `;

//     const values = [process.env.BASE_URL, emp_id, company_id, month, year];
//     const data = await sqlModel.customQuery(query, values);

//     if (data.error) {
//       return res.status(500).send(data);
//     }

//     const companyQuery = `
//             SELECT
//               check_in_time_start,
//               check_in_time_end
//             FROM company
//             WHERE id = ?
//           `;
//     const companyValues = [company_id];
//     const companyData = await sqlModel.customQuery(companyQuery, companyValues);

//     const { check_in_time_start, check_in_time_end } = companyData[0] || {};

//     const startDateTime = new Date(`1970-01-01T${check_in_time_start}Z`);
//     const endDateTime = new Date(`1970-01-01T${check_in_time_end}Z`);

//     const formatDuration = (totalSeconds) => {
//       if (isNaN(totalSeconds) || totalSeconds < 0) {
//         return "00:00:00";
//       }

//       const hours = Math.floor(totalSeconds / 3600);
//       const minutes = Math.floor((totalSeconds % 3600) / 60);
//       const seconds = Math.floor(totalSeconds % 60);

//       const formattedHours = String(hours).padStart(2, "0");
//       const formattedMinutes = String(minutes).padStart(2, "0");
//       const formattedSeconds = String(seconds).padStart(2, "0");

//       return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
//     };

//     const calculateDurationInSeconds = (checkInTime, checkOutTime) => {
//       if (!checkInTime || !checkOutTime) {
//         return 0;
//       }
//       const checkIn = new Date(`1970-01-01T${checkInTime}Z`);
//       const checkOut = new Date(`1970-01-01T${checkOutTime}Z`);
//       const durationInSeconds = (checkOut - checkIn) / 1000;
//       return durationInSeconds < 0 ? 0 : durationInSeconds;
//     };

//     const groupedData = allDays.reduce((acc, date) => {
//       acc[date] = {
//         date,
//         checkIns: [],
//         totalDurationInSeconds: 0,
//         earliestCheckInTime: null,
//         latestCheckOutTime: null,
//         checkin_status: "Absent",
//         attendance_status: "Absent",
//         timeDifference: "00:00:00",
//         totalDuration: "0h 0m 0s",
//       };
//       return acc;
//     }, {});

//     data.forEach((item) => {
//       if (!groupedData[item.date]) return;

//       const checkInDateTime = new Date(`1970-01-01T${item.check_in_time}Z`);
//       let checkin_status = "On Time";
//       let timeDifferenceSeconds = 0;

//       if (checkInDateTime < startDateTime) {
//         checkin_status = "Early";
//         timeDifferenceSeconds = Math.abs(
//           (startDateTime - checkInDateTime) / 1000
//         );
//       } else if (checkInDateTime > endDateTime) {
//         checkin_status = "Late";
//         timeDifferenceSeconds = Math.abs(
//           (checkInDateTime - endDateTime) / 1000
//         );
//       }

//       const durationInSeconds = calculateDurationInSeconds(
//         item.check_in_time,
//         item.check_out_time
//       );

//       groupedData[item.date].checkIns.push({
//         check_in_time: item.check_in_time,
//         check_out_time: item.check_out_time || "00:00:00",
//         duration: formatDuration(durationInSeconds),
//       });

//       groupedData[item.date].totalDurationInSeconds += durationInSeconds;

//       if (item.check_in_time) {
//         groupedData[item.date].attendance_status = "Present";
//         if (
//           !groupedData[item.date].earliestCheckInTime ||
//           item.check_in_time < groupedData[item.date].earliestCheckInTime
//         ) {
//           groupedData[item.date].earliestCheckInTime = item.check_in_time;
//         }
//       }

//       if (item.check_out_time !== null) {
//         if (
//           !groupedData[item.date].latestCheckOutTime ||
//           item.check_out_time > groupedData[item.date].latestCheckOutTime
//         ) {
//           groupedData[item.date].latestCheckOutTime = item.check_out_time;
//         }
//       } else {
//         groupedData[item.date].latestCheckOutTime = "00:00:00";
//       }

//       groupedData[item.date].checkin_status = checkin_status;
//       groupedData[item.date].timeDifference = formatDuration(
//         timeDifferenceSeconds
//       );
//     });

//     const checkInDates = Object.values(groupedData).map((dateData) => ({
//       ...dateData,
//       earliestCheckInTime: dateData.earliestCheckInTime || "00:00:00",
//       latestCheckOutTime: dateData.latestCheckOutTime || "00:00:00",
//       totalDuration: formatDuration(dateData.totalDurationInSeconds),
//     }));

//     const employeeData = {
//       id: data[0]?.id,
//       name: data[0]?.name,
//       mobile: data[0]?.mobile,
//       email: data[0]?.email,
//       designation: data[0]?.designation,
//       employee_id: data[0]?.employee_id,
//       image: data[0]?.image,
//       checkInsByDate: checkInDates,
//     };

//     res.status(200).send({
//       status: true,
//       data: employeeData,
//     });
//   } catch (error) {
//     res.status(500).send({ status: false, error: error.message });
//   }
// };

exports.getEmployeeAttendance = async (req, res, next) => {
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

    const dateParam = req.query.date;
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;

    const daysInMonth = new Date(year, month, 0).getDate();
    const allDays = Array.from({ length: daysInMonth }, (_, i) => {
      const day = String(i + 1).padStart(2, "0");
      return `${year}-${String(month).padStart(2, "0")}-${day}`;
    });

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
              c.duration
            FROM employees e
            LEFT JOIN check_in c ON e.id = c.emp_id AND e.company_id = c.company_id
            WHERE e.id = ? AND e.company_id = ? AND MONTH(c.date) = ? AND YEAR(c.date) = ?
            ORDER BY c.date, c.check_in_time
          `;

    const values = [process.env.BASE_URL, emp_id, company_id, month, year];
    const data = await sqlModel.customQuery(query, values);
    if (data.error) {
      return res.status(200).send(data);
    }

    const empAttendanceQuery = `
            SELECT date, checkin_status, time_difference, total_duration
            FROM emp_attendance 
            WHERE emp_id = ? AND company_id = ? AND MONTH(date) = ? AND YEAR(date) = ?
          `;
    const empAttendanceValues = [emp_id, company_id, month, year];
    const empAttendanceData = await sqlModel.customQuery(
      empAttendanceQuery,
      empAttendanceValues
    );

    if (empAttendanceData.error) {
      return res.status(200).send(empAttendanceData);
    }

    const groupedData = allDays.reduce((acc, date) => {
      acc[date] = {
        date,
        checkIns: [],
        // totalDurationInSeconds: 0,
        earliestCheckInTime: null,
        latestCheckOutTime: null,
        checkin_status: "Absent",
        attendance_status: "Absent",
        timeDifference: "00:00:00",
        totalDuration: "00:00:00",
      };
      return acc;
    }, {});

    empAttendanceData.forEach((attendance) => {
      if (groupedData[attendance.date]) {
        if (attendance.checkin_status === "Leave") {
          groupedData[attendance.date].attendance_status = "Leave";
        } else {
          groupedData[attendance.date].attendance_status = "Absent";
        }

        groupedData[attendance.date].checkin_status = attendance.checkin_status;
        groupedData[attendance.date].timeDifference = attendance.time_difference
          ? attendance.time_difference
          : "00:00:00";
        groupedData[attendance.date].totalDuration = attendance.total_duration
          ? attendance.total_duration
          : "00:00:00";
      }
    });

    // Process data and update groupedData
    data.forEach((item) => {
      if (!groupedData[item.date]) return;

      if (groupedData[item.date].attendance_status !== "Leave") {
        const checkInDateTime = new Date(`1970-01-01T${item.check_in_time}Z`);
        // const durationInSeconds = calculateDurationInSeconds(
        //   item.check_in_time,
        //   item.check_out_time
        // );

        groupedData[item.date].checkIns.push({
          check_in_time: item.check_in_time || "00:00:00",
          check_out_time: item.check_out_time || "00:00:00",
          duration: item.duration || "00:00:00",
        });

        // groupedData[item.date].totalDurationInSeconds += durationInSeconds;

        if (item.check_in_time) {
          groupedData[item.date].attendance_status = "Present";
          if (
            !groupedData[item.date].earliestCheckInTime ||
            item.check_in_time < groupedData[item.date].earliestCheckInTime
          ) {
            groupedData[item.date].earliestCheckInTime = item.check_in_time;
          }
        }

        if (item.check_out_time !== null) {
          if (
            !groupedData[item.date].latestCheckOutTime ||
            item.check_out_time > groupedData[item.date].latestCheckOutTime
          ) {
            groupedData[item.date].latestCheckOutTime = item.check_out_time;
          }
        } else {
          groupedData[item.date].latestCheckOutTime = "00:00:00";
        }
      }
    });

    const checkInDates = Object.values(groupedData).map((dateData) => ({
      ...dateData,
      earliestCheckInTime: dateData.earliestCheckInTime || "00:00:00",
      latestCheckOutTime: dateData.latestCheckOutTime || "00:00:00",
    }));

    const employeeData = {
      id: data[0]?.id,
      name: data[0]?.name,
      mobile: data[0]?.mobile,
      email: data[0]?.email,
      designation: data[0]?.designation,
      employee_id: data[0]?.employee_id,
      image: data[0]?.image,
      checkInsByDate: checkInDates,
    };

    res.status(200).send({
      status: true,
      data: employeeData,
    });
  } catch (error) {
    res.status(200).send({ status: false, error: error.message });
  }
};

// emp attendance by date
// exports.getEmployeeAttendanceByDate = async (req, res, next) => {
//   try {
//     const token = req.headers.authorization?.split(" ")[1];

//     if (!token) {
//       return res
//         .status(400)
//         .send({ status: false, message: "Token is required" });
//     }

//     const [employee] = await sqlModel.select(
//       "employees",
//       ["id", "company_id"],
//       { api_token: token }
//     );

//     if (!employee) {
//       return res
//         .status(404)
//         .send({ status: false, message: "Employee not found" });
//     }

//     const emp_id = employee.id;
//     const company_id = employee.company_id;
//     const requestedDate = req.query.date;

//     if (!emp_id || !company_id || !requestedDate) {
//       return res.status(400).send({
//         status: false,
//         message: "Employee ID, company ID, and date are required",
//       });
//     }

//     const query = `
//         SELECT
//           e.id,
//           e.name,
//           e.mobile,
//           e.email,
//           e.designation,
//           e.employee_id,
//           CASE
//             WHEN e.image IS NOT NULL THEN CONCAT(?, e.image)
//             ELSE e.image
//           END AS image,
//           c.date,
//           c.check_in_time,
//           c.check_out_time
//         FROM employees e
//         LEFT JOIN check_in c ON e.id = c.emp_id AND e.company_id = c.company_id
//         WHERE e.id = ? AND e.company_id = ? AND c.date = ?
//         ORDER BY c.check_in_time
//       `;

//     const values = [process.env.BASE_URL, emp_id, company_id, requestedDate];
//     const data = await sqlModel.customQuery(query, values);

//     if (data.error) {
//       return res.status(500).send(data);
//     }

//     if (data.length === 0) {
//       return res.status(200).send({
//         status: false,
//         message: "No data found for the specified date",
//       });
//     }

//     const companyQuery = `
//         SELECT
//           check_in_time_start,
//           check_in_time_end
//         FROM company
//         WHERE id = ?
//       `;

//     const companyValues = [company_id];
//     const companyData = await sqlModel.customQuery(companyQuery, companyValues);

//     const { check_in_time_start, check_in_time_end } = companyData[0] || {};

//     const startDateTime = new Date(`1970-01-01T${check_in_time_start}Z`);
//     const endDateTime = new Date(`1970-01-01T${check_in_time_end}Z`);

//     // const formatDuration = (totalSeconds) => {
//     //   if (isNaN(totalSeconds) || totalSeconds < 0) {
//     //     console.error("Invalid totalSeconds value:", totalSeconds);
//     //     return "0h 0m 0s";
//     //   }
//     //   const hours = Math.floor(totalSeconds / 3600);
//     //   const minutes = Math.floor((totalSeconds % 3600) / 60);
//     //   const seconds = Math.floor(totalSeconds % 60);
//     //   return `${hours}h ${minutes}m ${seconds}s`;
//     // };

//     const formatDuration = (totalSeconds) => {
//       if (isNaN(totalSeconds) || totalSeconds < 0) {
//         return "00:00:00";
//       }

//       const hours = Math.floor(totalSeconds / 3600);
//       const minutes = Math.floor((totalSeconds % 3600) / 60);
//       const seconds = Math.floor(totalSeconds % 60);

//       const formattedHours = String(hours).padStart(2, "0");
//       const formattedMinutes = String(minutes).padStart(2, "0");
//       const formattedSeconds = String(seconds).padStart(2, "0");

//       return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
//     };

//     const calculateDurationInSeconds = (checkInTime, checkOutTime) => {
//       if (!checkInTime || !checkOutTime) {
//         return 0; // Return 0 if checkInTime or checkOutTime is null or undefined
//       }
//       const checkIn = new Date(`1970-01-01T${checkInTime}Z`);
//       const checkOut = new Date(`1970-01-01T${checkOutTime}Z`);
//       const durationInSeconds = (checkOut - checkIn) / 1000;
//       return durationInSeconds < 0 ? 0 : durationInSeconds;
//     };

//     const groupedData = {
//       date: requestedDate,
//       checkIns: [],
//       totalDurationInSeconds: 0,
//       earliestCheckInTime: null,
//       latestCheckOutTime: null,
//       checkin_status: "Absent",
//       attendance_status: "Absent",
//       timeDifference: "0h 0m 0s",
//       totalDuration: "0h 0m 0s",
//     };

//     data.forEach((item) => {
//       const checkInDateTime = new Date(`1970-01-01T${item.check_in_time}Z`);
//       let checkin_status = "On Time";
//       let timeDifferenceSeconds = 0;

//       if (checkInDateTime < startDateTime) {
//         checkin_status = "Early";
//         timeDifferenceSeconds = Math.abs(
//           (startDateTime - checkInDateTime) / 1000
//         );
//       } else if (checkInDateTime > endDateTime) {
//         checkin_status = "Late";
//         timeDifferenceSeconds = Math.abs(
//           (checkInDateTime - endDateTime) / 1000
//         );
//       }

//       const durationInSeconds = calculateDurationInSeconds(
//         item.check_in_time,
//         item.check_out_time
//       );

//       groupedData.checkIns.push({
//         check_in_time: item.check_in_time,
//         check_out_time: item.check_out_time || null,
//         duration: formatDuration(durationInSeconds),
//       });

//       groupedData.totalDurationInSeconds += durationInSeconds;

//       if (item.check_in_time) {
//         groupedData.attendance_status = "Present";
//         if (
//           !groupedData.earliestCheckInTime ||
//           item.check_in_time < groupedData.earliestCheckInTime
//         ) {
//           groupedData.earliestCheckInTime = item.check_in_time;
//         }
//       }

//       if (item.check_out_time !== null) {
//         if (
//           !groupedData.latestCheckOutTime ||
//           item.check_out_time > groupedData.latestCheckOutTime
//         ) {
//           groupedData.latestCheckOutTime = item.check_out_time;
//         }
//       } else {
//         groupedData.latestCheckOutTime = null;
//       }

//       groupedData.checkin_status = checkin_status;
//       groupedData.timeDifference = formatDuration(timeDifferenceSeconds);
//     });

//     //    groupedData.earliestCheckInTime = groupedData.earliestCheckInTime || "00:00:00";
//     //    groupedData.latestCheckOutTime = groupedData.latestCheckOutTime || "00:00:00";

//     groupedData.totalDuration = formatDuration(
//       groupedData.totalDurationInSeconds
//     );

//     const employeeData = {
//       id: data[0].id,
//       name: data[0].name,
//       mobile: data[0].mobile,
//       email: data[0].email,
//       designation: data[0].designation,
//       employee_id: data[0].employee_id,
//       image: data[0].image,
//       checkInData: groupedData,
//     };

//     res.status(200).send({
//       status: true,
//       data: employeeData,
//     });
//   } catch (error) {
//     res.status(500).send({ status: false, error: error.message });
//   }
// };
exports.getEmployeeAttendanceByDate = async (req, res, next) => {
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

    const emp_id = employee.id;
    const company_id = employee.company_id;
    const requestedDate = req.query.date;

    if (!emp_id || !company_id || !requestedDate) {
      return res.status(200).send({
        status: false,
        message: "Employee ID, company ID, and date are required",
      });
    }

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
          c.duration
        FROM employees e
        LEFT JOIN check_in c ON e.id = c.emp_id AND e.company_id = c.company_id
        WHERE e.id = ? AND e.company_id = ? AND c.date = ?
        ORDER BY c.check_in_time
      `;

    const values = [process.env.BASE_URL, emp_id, company_id, requestedDate];
    const data = await sqlModel.customQuery(query, values);

    if (data.error) {
      return res.status(200).send(data);
    }

    const empAttendanceQuery = `
        SELECT date, checkin_status, time_difference, total_duration
        FROM emp_attendance 
        WHERE emp_id = ? AND company_id = ? AND date = ?
      `;
    const empAttendanceValues = [emp_id, company_id, requestedDate];
    const empAttendanceData = await sqlModel.customQuery(
      empAttendanceQuery,
      empAttendanceValues
    );

    if (empAttendanceData.error) {
      return res.status(500).send(empAttendanceData);
    }

    const groupedData = {
      date: requestedDate,
      checkIns: [],
      // totalDurationInSeconds: 0,
      earliestCheckInTime: null,
      latestCheckOutTime: null,
      checkin_status: "Absent",
      attendance_status: "Absent",
      timeDifference: "00:00:00",
      totalDuration: "00:00:00",
    };

    empAttendanceData.forEach((attendance) => {
      if (attendance.checkin_status === "Leave") {
        groupedData.attendance_status = "Leave";
        groupedData.checkin_status = "Leave";
      } else {
        groupedData.checkin_status = attendance.checkin_status;
        groupedData.attendance_status = "Absent";
      }

      groupedData.timeDifference = attendance.time_difference || "00:00:00";
      groupedData.totalDuration = attendance.total_duration || "00:00:00";
    });

    data.forEach((item) => {
      const checkInDateTime = new Date(`1970-01-01T${item.check_in_time}Z`);
      // const durationInSeconds = calculateDurationInSeconds(
      //   item.check_in_time,
      //   item.check_out_time
      // );

      groupedData.checkIns.push({
        check_in_time: item.check_in_time || "00:00:00",
        check_out_time: item.check_out_time || "00:00:00",
        duration: item.duration || "00:00:00",
      });

      // groupedData.totalDurationInSeconds += durationInSeconds;

      if (item.check_in_time) {
        groupedData.attendance_status = "Present";
        if (
          !groupedData.earliestCheckInTime ||
          item.check_in_time < groupedData.earliestCheckInTime
        ) {
          groupedData.earliestCheckInTime = item.check_in_time;
        }
      }

      if (item.check_out_time !== null) {
        if (
          !groupedData.latestCheckOutTime ||
          item.check_out_time > groupedData.latestCheckOutTime
        ) {
          groupedData.latestCheckOutTime = item.check_out_time;
        }
      } else {
        groupedData.latestCheckOutTime = "00:00:00";
      }
    });

    groupedData.totalDuration = formatDuration(
      groupedData.totalDurationInSeconds
    );

    const employeeData = {
      id: data[0]?.id,
      name: data[0]?.name,
      mobile: data[0]?.mobile,
      email: data[0]?.email,
      designation: data[0]?.designation,
      employee_id: data[0]?.employee_id,
      image: data[0]?.image,
      checkInData: groupedData,
    };

    res.status(200).send({
      status: true,
      data: employeeData,
    });
  } catch (error) {
    res.status(200).send({ status: false, error: error.message });
  }
};

// get emp company data
exports.getEmployeeCompany = async (req, res, next) => {
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

    const [company] = await sqlModel.select(
      "company",
      [
        "name",
        "logo",
        "email",
        "mobile",
        "address",
        "city",
        "zip_code",
        "state",
      ],
      {
        id: employee.company_id,
      }
    );

    if (!company) {
      return res
        .status(200)
        .send({ status: false, message: "Company not found" });
    }

    // Process company's logo
    company.logo = company.logo ? `${process.env.BASE_URL}${company.logo}` : "";

    // Attach the company data to the employee
    employee.company = company;

    res.status(200).send({ status: true, data: employee });
  } catch (error) {
    res.status(200).send({ status: false, error: error.message });
  }
};
