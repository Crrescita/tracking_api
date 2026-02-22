const sqlModel = require("../../config/db");
const path = require("path");
const deleteOldFile = require("../../middleware/deleteImage");
const bcrypt = require("bcrypt");
const sendMail = require("../../mail/nodemailer");
const saltRounds = 10;
const { uploadLocalFileToS3 } = require("../../config/s3");
const fs = require("fs");
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
    const dateParam = req.query.date; // e.g., "2024-08-22" or "2024-08"
    const dateRegexYYYYMMDD = /^\d{4}-\d{2}-\d{2}$/; // Matches YYYY-MM-DD
    const dateRegexYYYYMM = /^\d{4}-\d{2}$/; // Matches YYYY-MM

    if (
      !dateParam ||
      (!dateRegexYYYYMMDD.test(dateParam) && !dateRegexYYYYMM.test(dateParam))
    ) {
      return res.status(200).send({
        status: false,
        message: "Invalid date format. Use YYYY-MM-DD or YYYY-MM.",
      });
    }

    // const dateParam = req.query.date;
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;

    let query;
    let values;

    let daysInMonth;
    let allDays;

    if (dateParam && dateParam.length === 10) {
      // Specific date format (YYYY-MM-DD)
      query = `
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
      values = [process.env.BASE_URL, emp_id, company_id, dateParam];
    } else if (dateParam && dateParam.length === 7) {
      // Month and year format (YYYY-MM)
      daysInMonth = new Date(year, month, 0).getDate();
      allDays = Array.from({ length: daysInMonth }, (_, i) => {
        const day = String(i + 1).padStart(2, "0");
        return `${year}-${String(month).padStart(2, "0")}-${day}`;
      });

      query = `
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
      values = [process.env.BASE_URL, emp_id, company_id, month, year];
    } else {
      return res
        .status(200)
        .send({ status: false, message: "Invalid date format" });
    }

    const data = await sqlModel.customQuery(query, values);

    if (data.error) {
      return res.status(200).send(data);
    }

    const empAttendanceQuery = `
      SELECT date, checkin_status, time_difference, total_duration
      FROM emp_attendance
      WHERE emp_id = ? AND company_id = ?
      ${
        dateParam && dateParam.length === 10
          ? "AND date = ?"
          : "AND MONTH(date) = ? AND YEAR(date) = ?"
      }
    `;
    const empAttendanceValues =
      dateParam && dateParam.length === 10
        ? [emp_id, company_id, dateParam]
        : [emp_id, company_id, month, year];

    const empAttendanceData = await sqlModel.customQuery(
      empAttendanceQuery,
      empAttendanceValues
    );

    if (empAttendanceData.error) {
      return res.status(200).send(empAttendanceData);
    }

    const groupedData =
      dateParam && dateParam.length === 10
        ? {
            [dateParam]: {
              date: dateParam,
              checkIns: [],
              earliestCheckInTime: null,
              latestCheckOutTime: null,
              checkin_status: "Absent",
              attendance_status: "Absent",
              timeDifference: "00:00:00",
              totalDuration: "00:00:00",
            },
          }
        : allDays.reduce((acc, date) => {
            acc[date] = {
              date,
              checkIns: [],
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
      const attendanceDate = attendance.date || dateParam;
      if (groupedData[attendanceDate]) {
        groupedData[attendanceDate].checkin_status = attendance.checkin_status;
        groupedData[attendanceDate].timeDifference =
          attendance.time_difference || "00:00:00";
        groupedData[attendanceDate].totalDuration =
          attendance.total_duration || "00:00:00";
        groupedData[attendanceDate].attendance_status =
          attendance.checkin_status === "Leave" ? "Leave" : "Absent";
      }
    });

    data.forEach((item) => {
      const itemDate = item.date || dateParam;
      if (groupedData[itemDate]) {
        groupedData[itemDate].checkIns.push({
          check_in_time: item.check_in_time || "00:00:00",
          check_out_time: item.check_out_time || "00:00:00",
          duration: item.duration || "00:00:00",
        });

        if (item.check_in_time) {
          groupedData[itemDate].attendance_status = "Present";
          if (
            !groupedData[itemDate].earliestCheckInTime ||
            item.check_in_time < groupedData[itemDate].earliestCheckInTime
          ) {
            groupedData[itemDate].earliestCheckInTime = item.check_in_time;
          }
        }

        if (item.check_out_time !== null) {
          if (
            !groupedData[itemDate].latestCheckOutTime ||
            item.check_out_time > groupedData[itemDate].latestCheckOutTime
          ) {
            groupedData[itemDate].latestCheckOutTime = item.check_out_time;
          }
        } else {
          groupedData[itemDate].latestCheckOutTime = "00:00:00";
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
      earliestCheckInTime: "00:00:00",
      latestCheckOutTime: "00:00:00",
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
      checkInDate: groupedData,
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
    // company.logo = company.logo ? `${process.env.BASE_URL}${company.logo}` : "";
    company.logo =
      "https://telindia.s3.ap-south-1.amazonaws.com/icons/amico.png";

    // Attach the company data to the employee
    employee.company = company;

    res.status(200).send({ status: true, data: employee });
  } catch (error) {
    res.status(200).send({ status: false, error: error.message });
  }
};



exports.insertBackgroundVerificationByEmp = async (req, res) => {
  try {
    /* ------------------ TOKEN ------------------ */
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).send({
        status: false,
        message: "Token is required",
      });
    }

    /* ------------------ EMPLOYEE ------------------ */
    const [employee] = await sqlModel.select(
      "employees",
      ["id", "company_id"],
      { api_token: token }
    );

    if (!employee) {
      return res.status(401).send({
        status: false,
        message: "Invalid token",
      });
    }

    const emp_id = employee.id;
    const company_id = employee.company_id;

    const { documentNo, documentType } = req.body;

    if (!documentType || !documentNo) {
      return res.status(400).send({
        status: false,
        message: "Document type and document number are required",
      });
    }

    /* ------------------ DOCUMENT TYPE ------------------ */
    const sanitizedDocumentName =
      documentType.toLowerCase().replace(/\s+/g, "_");

    const sanitizedDocumentType = `${sanitizedDocumentName}_file`;

    const backFile = req.files?.documentFile2?.[0] || null;
console.log("Back file:", backFile); // Debug log for back file presence
// Backside mandatory except PAN
if (sanitizedDocumentName !== "pan" && !backFile) {
  return res.status(400).send({
    status: false,
    message: "Back side image is required for this document type",
  });
}

    /* ------------------ VALIDATION ------------------ */
    const validDocumentTypes = {
      aadhaar_file: /^\d{12}$/,
      pan_file: /^[A-Z]{5}\d{4}[A-Z]{1}$/,
      driving_license_file: /^[A-Z0-9]{15}$/,
      voter_id_file: /^[A-Z]{3}\d{7}$/,
      uan_file: /^\d{12}$/,
    };

    if (
      !validDocumentTypes[sanitizedDocumentType] ||
      !validDocumentTypes[sanitizedDocumentType].test(documentNo)
    ) {
      return res.status(400).send({
        status: false,
        message: `Invalid ${documentType} number format`,
      });
    }

    /* ------------------ FILE UPLOAD (S3) ------------------ */
    let uploadedKey = null;

    if (req.fileFullPath && req.fileFullPath.length > 0) {
      const relPath = req.fileFullPath[0];
      const projectRoot = path.resolve(__dirname, "..", "..");
      const localAbs = path.join(projectRoot, "public", relPath);

      const keyPrefix = `employee-verification/${emp_id}/${sanitizedDocumentName}`;

      const { key } = await uploadLocalFileToS3(localAbs, keyPrefix);
      uploadedKey = key;

      fs.unlinkSync(localAbs);
    }


   let uploadedBackKey = null;

// const backFile = req.files?.documentFile2?.[0] || null;

if (backFile) {

  // IMPORTANT: Use multer file path directly
  const localAbs = backFile.path;  

  const keyPrefix = `employee-verification/${emp_id}/${sanitizedDocumentName}/back`;

  const { key } = await uploadLocalFileToS3(localAbs, keyPrefix);
  uploadedBackKey = key;

  fs.unlinkSync(localAbs);
}


    /* ------------------ EXISTING RECORD ------------------ */
    // const existingRecord = await sqlModel.select(
    //   "emp_verification_document",
    //   ["id", sanitizedDocumentType],
    //   { emp_id }
    // );

    const backColumnName = `${sanitizedDocumentType}_back`;

const existingRecord = await sqlModel.select(
  "emp_verification_document",
  ["id", sanitizedDocumentType, backColumnName],
  { emp_id }
);

    const dataToSave = {
      emp_id,
      company_id,
      [sanitizedDocumentName]: documentNo,
      updated_at: getCurrentDateTime(),
    };

    if (uploadedKey) {
      dataToSave[sanitizedDocumentType] = uploadedKey;
    }

    if (uploadedBackKey) {
  dataToSave[backColumnName] = uploadedBackKey;
}

    /* ------------------ UPDATE / INSERT ------------------ */
    if (existingRecord.length > 0) {
      // delete old S3 file if replaced
      if (uploadedKey && existingRecord[0][sanitizedDocumentType]) {
        try {
          await deleteOldFile.deleteOldFile(existingRecord[0][sanitizedDocumentType]);
        } catch (e) {
          console.warn("Old file delete failed:", e.message);
        }
      }

      // delete old back file if replaced
if (uploadedBackKey && existingRecord[0][backColumnName]) {
  try {
    await deleteOldFile.deleteOldFile(existingRecord[0][backColumnName]);
  } catch (e) {
    console.warn("Old back file delete failed:", e.message);
  }
}

      await sqlModel.update(
        "emp_verification_document",
        dataToSave,
        { emp_id }
      );

      return res.status(200).send({
        status: true,
        message: "Background verification document updated successfully",
      });
    } else {
      dataToSave.created_at = getCurrentDateTime();

      await sqlModel.insert(
        "emp_verification_document",
        dataToSave
      );

      return res.status(200).send({
        status: true,
        message: "Background verification document submitted successfully",
      });
    }
  } catch (error) {
    console.error("insertBackgroundVerificationByEmp error:", error);
    return res.status(500).send({
      status: false,
      message: "An error occurred",
      error: error.message,
    });
  }
};


const buildPublicUrl = (filePath) => {
  if (!filePath) return "";


  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    return filePath;
  }

  if (filePath.startsWith("employee-verification/")) {
    return buildS3Url(filePath);
  }

  return `${process.env.BASE_URL}${filePath}`;
};


const buildS3Url = (key) => {
  if (!key) return null;
  return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || "ap-south-1"}.amazonaws.com/${key}`;
};
exports.getBackgroundVerification = async (req, res) => {
  try {
    /* ------------------ TOKEN ------------------ */
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).send({
        status: false,
        message: "Token is required",
      });
    }

    /* ------------------ EMPLOYEE ------------------ */
    const [employee] = await sqlModel.select(
      "employees",
      ["id", "company_id"],
      { api_token: token }
    );

    if (!employee) {
      return res.status(401).send({
        status: false,
        message: "Invalid token",
      });
    }

    const emp_id = employee.id;

    /* ------------------ FETCH DATA ------------------ */
    const records = await sqlModel.select(
      "emp_verification_document",
      {},
      { emp_id }
    );

    if (!records || records.length === 0) {
      return res.status(200).send({
        status: false,
        message: "No background verification data found",
      });
    }

    /* ------------------ FORMAT RESPONSE ------------------ */
    const result = records.map(item => ({
      ...item,

      aadhaar_file: buildPublicUrl(item.aadhaar_file),
      aadhaar_file_back: buildPublicUrl(item.aadhaar_file_back),
      pan_file: buildPublicUrl(item.pan_file),
      pan_file_back: buildPublicUrl(item.pan_file_back),
      driving_license_file: buildPublicUrl(item.driving_license_file),
      driving_license_file_back: buildPublicUrl(item.driving_license_file_back),
      // voter_id_file: buildPublicUrl(item.voter_id_file),
      voter_file: buildPublicUrl(item.voter_file),
      voter_file_back: buildPublicUrl(item.voter_file_back),
      uan_file: buildPublicUrl(item.uan_file),
      uan_file_back: buildPublicUrl(item.uan_file_back),
    }));

    return res.status(200).send({
      status: true,
      data: result[0],
    });

  } catch (error) {
    console.error("getBackgroundVerification error:", error);
    return res.status(500).send({
      status: false,
      message: error.message,
    });
  }
};



exports.getBankDetail = async (req, res) => {
  try {
    /* ------------------ TOKEN ------------------ */
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).send({
        status: false,
        message: "Token is required",
      });
    }

    /* ------------------ EMPLOYEE ------------------ */
    const [employee] = await sqlModel.select(
      "employees",
      ["id", "company_id"],
      { api_token: token }
    );

    if (!employee) {
      return res.status(401).send({
        status: false,
        message: "Invalid token",
      });
    }

    /* ------------------ FETCH BANK DETAIL ------------------ */
    const data = await sqlModel.select(
      "emp_bank_detail",
      {},
      { emp_id: employee.id }
    );

    if (!data || data.length === 0) {
      return res.status(200).send({
        status: false,
        message: "No bank details found",
      });
    }

    return res.status(200).send({
      status: true,
      data: data[0], // single record per employee
    });

  } catch (error) {
    console.error("getBankDetail error:", error);
    return res.status(500).send({
      status: false,
      message: error.message,
    });
  }
};


exports.insertBankDetail = async (req, res) => {
  try {
    /* ------------------ TOKEN ------------------ */
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).send({
        status: false,
        message: "Token is required",
      });
    }

    /* ------------------ EMPLOYEE ------------------ */
    const [employee] = await sqlModel.select(
      "employees",
      ["id", "company_id"],
      { api_token: token }
    );

    if (!employee) {
      return res.status(401).send({
        status: false,
        message: "Invalid token",
      });
    }

    const emp_id = employee.id;
    const company_id = employee.company_id;

    const {
      acc_holder_name,
      acc_number,
      bank_name,
      ifsc_code,
    } = req.body;

    /* ------------------ VALIDATION ------------------ */
    const validation = validateFields({
      acc_holder_name,
      acc_number,
      bank_name,
      ifsc_code,
    });

    if (!validation.valid) {
      return res.status(400).send({
        status: false,
        message: validation.message,
      });
    }

    const dataToSave = {
      emp_id,
      company_id,
      acc_holder_name,
      acc_number,
      bank_name,
      ifsc_code,
    };

    /* ------------------ CHECK EXISTING ------------------ */
    const existingRecord = await sqlModel.select(
      "emp_bank_detail",
      ["id"],
      { emp_id }
    );

    if (existingRecord.length > 0) {
      // UPDATE
      dataToSave.updated_at = getCurrentDateTime();

      await sqlModel.update(
        "emp_bank_detail",
        dataToSave,
        { emp_id }
      );

      return res.status(200).send({
        status: true,
        message: "Bank details updated successfully",
      });
    } else {
      // INSERT
      dataToSave.created_at = getCurrentDateTime();

      await sqlModel.insert(
        "emp_bank_detail",
        dataToSave
      );

      return res.status(200).send({
        status: true,
        message: "Bank details saved successfully",
      });
    }

  } catch (error) {
    console.error("insertBankDetail error:", error);
    return res.status(500).send({
      status: false,
      message: error.message,
    });
  }
};

