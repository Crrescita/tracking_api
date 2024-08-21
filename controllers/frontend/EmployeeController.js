const sqlModel = require("../../config/db");
const path = require("path");
const deleteOldFile = require("../../middleware/deleteImage");
const bcrypt = require("bcrypt");
const sendMail = require("../../mail/nodemailer");
const saltRounds = 10;
const crypto = require("crypto");

// get emp
exports.employeesGet = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res
        .status(400)
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
        .status(404)
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
    res.status(500).send({ status: false, error: error.message });
  }
};
// update emp
exports.updateEmployee = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res
        .status(400)
        .send({ status: false, message: "Token is required" });
    }

    const [employee] = await sqlModel.select(
      "employees",
      {},
      { api_token: token }
    );
    console.log(employee);
    if (!employee) {
      return res
        .status(404)
        .send({ status: false, message: "Employee not found" });
    }

    const id = employee.id;
    const updateData = { ...req.body };
    const companyId = employee.company_id;
    let plainPassword = updateData.password;
    console.log(updateData);
    // Fetch the company record to validate the company ID
    const [company] = await sqlModel.select("company", {}, { id: companyId });

    if (!company) {
      return res
        .status(404)
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
          .status(400)
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
          .status(400)
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
    console.log(updateData);
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

    res.status(200).send({ status: true, message: "Data Updated" });
  } catch (error) {
    return res.status(500).send({ status: false, error: error.message });
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

//     const emp_id = employee.id;
//     const company_id = employee.company_id;

//     if (!emp_id || !company_id) {
//       return res.status(400).send({
//         status: false,
//         message: "Employee ID and company ID are required",
//       });
//     }

//     const query = `
//       SELECT
//         e.id,
//         e.name,
//         e.mobile,
//         e.email,
//         e.designation,
//         e.employee_id,
//         CASE
//           WHEN e.image IS NOT NULL THEN CONCAT(?, e.image)
//           ELSE e.image
//         END AS image,
//         c.date,
//         c.check_in_time,
//         c.check_out_time
//       FROM employees e
//       LEFT JOIN check_in c ON e.id = c.emp_id AND e.company_id = c.company_id
//       WHERE e.id = ? AND e.company_id = ?
//       ORDER BY c.date, c.check_in_time
//     `;

//     const values = [process.env.BASE_URL, emp_id, company_id];
//     const data = await sqlModel.customQuery(query, values);

//     if (data.error) {
//       return res.status(500).send(data);
//     }

//     if (data.length === 0) {
//       return res.status(200).send({ status: false, message: "No data found" });
//     }

//     const companyQuery = `
//       SELECT
//         check_in_time_start,
//         check_in_time_end
//       FROM company
//       WHERE id = ?
//     `;

//     const companyValues = [company_id];
//     const companyData = await sqlModel.customQuery(companyQuery, companyValues);

//     const { check_in_time_start, check_in_time_end } = companyData[0] || {};

//     const startDateTime = new Date(`1970-01-01T${check_in_time_start}Z`);
//     const endDateTime = new Date(`1970-01-01T${check_in_time_end}Z`);

//     const formatDuration = (totalSeconds) => {
//       if (isNaN(totalSeconds) || totalSeconds < 0) {
//         console.error("Invalid totalSeconds value:", totalSeconds);
//         return "0h 0m 0s";
//       }
//       const hours = Math.floor(totalSeconds / 3600);
//       const minutes = Math.floor((totalSeconds % 3600) / 60);
//       const seconds = Math.floor(totalSeconds % 60);
//       return `${hours}h ${minutes}m ${seconds}s`;
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

//     const groupedData = data.reduce((acc, item) => {
//       if (!acc[item.date]) {
//         acc[item.date] = {
//           date: item.date,
//           checkIns: [],
//           totalDurationInSeconds: 0,
//           earliestCheckInTime: null,
//           latestCheckOutTime: null,
//           checkin_status: "Absent",
//           attendance_status: "Absent",
//           timeDifference: "0h 0m 0s",
//           totalDuration: "0h 0m 0s",
//         };
//       }

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

//       acc[item.date].checkIns.push({
//         check_in_time: item.check_in_time,
//         check_out_time: item.check_out_time || null,
//         duration: formatDuration(durationInSeconds),
//       });

//       acc[item.date].totalDurationInSeconds += durationInSeconds;

//       if (item.check_in_time) {
//         acc[item.date].attendance_status = "Present";
//         if (
//           !acc[item.date].earliestCheckInTime ||
//           item.check_in_time < acc[item.date].earliestCheckInTime
//         ) {
//           acc[item.date].earliestCheckInTime = item.check_in_time;
//         }
//       }

//       if (item.check_out_time !== null) {
//         if (
//           !acc[item.date].latestCheckOutTime ||
//           item.check_out_time > acc[item.date].latestCheckOutTime
//         ) {
//           acc[item.date].latestCheckOutTime = item.check_out_time;
//         }
//       } else {
//         acc[item.date].latestCheckOutTime = null;
//       }

//       acc[item.date].checkin_status = checkin_status;
//       acc[item.date].timeDifference = formatDuration(timeDifferenceSeconds);

//       return acc;
//     }, {});

//     // Convert grouped data into an array
//     const checkInDates = Object.values(groupedData).map((dateData) => ({
//       ...dateData,
//       totalDuration: formatDuration(dateData.totalDurationInSeconds),
//     }));

//     const employeeData = {
//       id: data[0].id,
//       name: data[0].name,
//       mobile: data[0].mobile,
//       email: data[0].email,
//       designation: data[0].designation,
//       employee_id: data[0].employee_id,
//       image: data[0].image,
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
              c.check_out_time
            FROM employees e
            LEFT JOIN check_in c ON e.id = c.emp_id AND e.company_id = c.company_id
            WHERE e.id = ? AND e.company_id = ? AND MONTH(c.date) = ? AND YEAR(c.date) = ?
            ORDER BY c.date, c.check_in_time
          `;

    const values = [process.env.BASE_URL, emp_id, company_id, month, year];
    const data = await sqlModel.customQuery(query, values);

    if (data.error) {
      return res.status(500).send(data);
    }

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

    const groupedData = allDays.reduce((acc, date) => {
      acc[date] = {
        date,
        checkIns: [],
        totalDurationInSeconds: 0,
        earliestCheckInTime: null,
        latestCheckOutTime: null,
        checkin_status: "Absent",
        attendance_status: "Absent",
        timeDifference: "00:00:00",
        totalDuration: "0h 0m 0s",
      };
      return acc;
    }, {});

    data.forEach((item) => {
      if (!groupedData[item.date]) return;

      const checkInDateTime = new Date(`1970-01-01T${item.check_in_time}Z`);
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

      const durationInSeconds = calculateDurationInSeconds(
        item.check_in_time,
        item.check_out_time
      );

      groupedData[item.date].checkIns.push({
        check_in_time: item.check_in_time,
        check_out_time: item.check_out_time || "00:00:00",
        duration: formatDuration(durationInSeconds),
      });

      groupedData[item.date].totalDurationInSeconds += durationInSeconds;

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

      groupedData[item.date].checkin_status = checkin_status;
      groupedData[item.date].timeDifference = formatDuration(
        timeDifferenceSeconds
      );
    });

    const checkInDates = Object.values(groupedData).map((dateData) => ({
      ...dateData,
      earliestCheckInTime: dateData.earliestCheckInTime || "00:00:00",
      latestCheckOutTime: dateData.latestCheckOutTime || "00:00:00",
      totalDuration: formatDuration(dateData.totalDurationInSeconds),
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
    res.status(500).send({ status: false, error: error.message });
  }
};

// emp attendance by date
exports.getEmployeeAttendanceByDate = async (req, res, next) => {
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

    const emp_id = employee.id;
    const company_id = employee.company_id;
    const requestedDate = req.query.date;

    if (!emp_id || !company_id || !requestedDate) {
      return res.status(400).send({
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
          c.check_out_time
        FROM employees e
        LEFT JOIN check_in c ON e.id = c.emp_id AND e.company_id = c.company_id
        WHERE e.id = ? AND e.company_id = ? AND c.date = ?
        ORDER BY c.check_in_time
      `;

    const values = [process.env.BASE_URL, emp_id, company_id, requestedDate];
    const data = await sqlModel.customQuery(query, values);

    if (data.error) {
      return res.status(500).send(data);
    }

    if (data.length === 0) {
      return res.status(200).send({
        status: false,
        message: "No data found for the specified date",
      });
    }

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

    // const formatDuration = (totalSeconds) => {
    //   if (isNaN(totalSeconds) || totalSeconds < 0) {
    //     console.error("Invalid totalSeconds value:", totalSeconds);
    //     return "0h 0m 0s";
    //   }
    //   const hours = Math.floor(totalSeconds / 3600);
    //   const minutes = Math.floor((totalSeconds % 3600) / 60);
    //   const seconds = Math.floor(totalSeconds % 60);
    //   return `${hours}h ${minutes}m ${seconds}s`;
    // };

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
        return 0; // Return 0 if checkInTime or checkOutTime is null or undefined
      }
      const checkIn = new Date(`1970-01-01T${checkInTime}Z`);
      const checkOut = new Date(`1970-01-01T${checkOutTime}Z`);
      const durationInSeconds = (checkOut - checkIn) / 1000;
      return durationInSeconds < 0 ? 0 : durationInSeconds;
    };

    const groupedData = {
      date: requestedDate,
      checkIns: [],
      totalDurationInSeconds: 0,
      earliestCheckInTime: null,
      latestCheckOutTime: null,
      checkin_status: "Absent",
      attendance_status: "Absent",
      timeDifference: "0h 0m 0s",
      totalDuration: "0h 0m 0s",
    };

    data.forEach((item) => {
      const checkInDateTime = new Date(`1970-01-01T${item.check_in_time}Z`);
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

      const durationInSeconds = calculateDurationInSeconds(
        item.check_in_time,
        item.check_out_time
      );

      groupedData.checkIns.push({
        check_in_time: item.check_in_time,
        check_out_time: item.check_out_time || null,
        duration: formatDuration(durationInSeconds),
      });

      groupedData.totalDurationInSeconds += durationInSeconds;

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
        groupedData.latestCheckOutTime = null;
      }

      groupedData.checkin_status = checkin_status;
      groupedData.timeDifference = formatDuration(timeDifferenceSeconds);
    });

    //    groupedData.earliestCheckInTime = groupedData.earliestCheckInTime || "00:00:00";
    //    groupedData.latestCheckOutTime = groupedData.latestCheckOutTime || "00:00:00";

    groupedData.totalDuration = formatDuration(
      groupedData.totalDurationInSeconds
    );

    const employeeData = {
      id: data[0].id,
      name: data[0].name,
      mobile: data[0].mobile,
      email: data[0].email,
      designation: data[0].designation,
      employee_id: data[0].employee_id,
      image: data[0].image,
      checkInData: groupedData,
    };

    res.status(200).send({
      status: true,
      data: employeeData,
    });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};

// get emp company data
exports.getEmployeeCompany = async (req, res, next) => {
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
        .status(404)
        .send({ status: false, message: "Company not found" });
    }

    // Process company's logo
    company.logo = company.logo ? `${process.env.BASE_URL}${company.logo}` : "";

    // Attach the company data to the employee
    employee.company = company;

    res.status(200).send({ status: true, data: employee });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};
