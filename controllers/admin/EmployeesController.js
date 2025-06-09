const sqlModel = require("../../config/db");
const path = require("path");
const deleteOldFile = require("../../middleware/deleteImage");
const bcrypt = require("bcrypt");
const sendMail = require("../../mail/nodemailer");
const sendWhatsapp = require("../../mail/whatsappMessage");
const saltRounds = 10;
const crypto = require("crypto");

//employees
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

exports.employeesGet = async (req, res, next) => {
  try {
    const id = req.params?.id || "";
    const companyId = req.query?.company_id || "";
    const date = getCurrentDate();

    let whereClause = "";
    const queryParams = [];

    if (id) {
      whereClause += " AND e.id = ?";
      queryParams.push(id);
    }
    if (companyId) {
      whereClause += " AND e.company_id = ?";
      queryParams.push(companyId);
    }

    const checkInSubquery = `
      SELECT 
        emp_id,
        checkin_status,
        ROW_NUMBER() OVER (PARTITION BY emp_id ORDER BY id DESC) AS row_num
      FROM check_in
      WHERE company_id = ? AND date = ?
    `;

    const query = `
      SELECT
        e.id,
        e.company_id,
        e.name,
        e.mobile,
        e.email,
        e.status,
        e.address,
        e.dob,
        e.employee_id,
        e.joining_date,
        e.gender,
        e.branch,
        e.designation,
        e.department,
        e.state,
        e.city,
        e.zip_code,
        e.timer,
        b.name AS branch_name,
        d.name AS department_name,
        de.name AS designation_name,
        e.employee_id,
        CASE
          WHEN e.image IS NOT NULL THEN CONCAT(?, e.image)
          ELSE e.image
        END AS image,
        latest_checkin.checkin_status
      FROM employees e
      LEFT JOIN branch b ON e.branch = b.id
      LEFT JOIN department d ON e.department = d.id
      LEFT JOIN designation de ON e.designation = de.id
      LEFT JOIN (
        SELECT emp_id, checkin_status 
        FROM (${checkInSubquery}) AS ranked_checkins 
        WHERE row_num = 1
      ) AS latest_checkin ON e.id = latest_checkin.emp_id
      WHERE 1=1 ${whereClause}
    `;

    const data = await sqlModel.customQuery(query, [
      process.env.BASE_URL,
      companyId,
      date,
      ...queryParams,
    ]);

    if (data.error) {
      return res.status(200).send(data);
    }

    // const result = data.map((item) => {
    //   // delete item.password;
    //   return item;
    // });

    res.status(200).send({ status: true, data: data });
  } catch (error) {
    res.status(200).send({ status: false, error: error.message });
  }
};

const generateRandomPassword = (length = 12) => {
  return crypto.randomBytes(length).toString("base64").slice(0, length);
};

exports.employeesInsert = async (req, res, next) => {
  try {
    const id = req.params.id || "";
    const insert = { ...req.body };
    const companyId = req.query?.company_id || insert.company_id;
    let plainPassword = insert.password;
    let originalEmail = "";
    let originalPasswordHash = "";

    if (!companyId) {
      return res
        .status(200)
        .send({ status: false, message: "Company ID is required" });
    }

    // Fetch the company record
    const companyData = await sqlModel.select("company", {}, { id: companyId });

    if (companyData.error || companyData.length === 0) {
      return res
        .status(200)
        .send({ status: false, message: "Company not found" });
    }

    const company = companyData[0];

    if (!id) {
      const maxEmployees = parseInt(company.no_of_emp, 10);

      // Count of emp
      const employeeCountData = await sqlModel.select(
        "employees",
        ["COUNT(*) as count"],
        { company_id: companyId }
      );
      if (employeeCountData.error) {
        return res.status(200).send(employeeCountData);
      }

      const currentEmployeeCount = parseInt(employeeCountData[0].count, 10);

      if (currentEmployeeCount >= maxEmployees) {
        return res.status(200).send({
          status: false,
          message: "Employee limit reached for this company",
        });
      }
    }

    if (req.files) {
      if (req.files.image) {
        insert.image = req.fileFullPath.find((path) => path.includes("image"));
      }
    }

    // Only process password if it is provided
    if (insert.password) {
      insert.password = await bcrypt.hash(insert.password, saltRounds);
    } else {
      // Remove password from insert if it's not provided
      delete insert.password;
    }

    if (id) {
      // Fetch the original email and password hash
      const employeeRecord = await sqlModel.select(
        "employees",
        ["email", "password"],
        { id }
      );

      if (employeeRecord.error || employeeRecord.length === 0) {
        return res
          .status(200)
          .send({ status: false, message: "Employee not found" });
      }

      originalEmail = employeeRecord[0].email;
      originalPasswordHash = employeeRecord[0].password;

      if (req.body.email) {
        const existingemployeesWithEmail = await sqlModel.select(
          "employees",
          ["id"],
          { email: req.body.email }
        );
        if (
          existingemployeesWithEmail.length > 0 &&
          existingemployeesWithEmail[0].id != id
        ) {
          return res
            .status(200)
            .send({ status: false, message: "Email already exists" });
        }
      }

      if (req.body.mobile) {
        const existingemployeesWithMobile = await sqlModel.select(
          "employees",
          ["id"],
          { mobile: req.body.mobile,company_id: companyId }
        );
        if (
          existingemployeesWithMobile.length > 0 &&
          existingemployeesWithMobile[0].id != id
        ) {
          return res
            .status(200)
            .send({ status: false, message: "Mobile Number already exists" });
        }
      }

      if (req.body.employee_id) {
        const existingemployeesWithId = await sqlModel.select(
          "employees",
          ["id"],
          { employee_id: req.body.employee_id }
        );
        if (
          existingemployeesWithId.length > 0 &&
          existingemployeesWithId[0].id != id
        ) {
          return res
            .status(200)
            .send({ status: false, message: "Employee id already exists" });
        }
      }

      if (req.fileFullPath && req.fileFullPath.length > 0) {
        const employeesRecord = await sqlModel.select("employees", ["image"], {
          id,
        });

        if (employeesRecord.error || employeesRecord.length === 0) {
          return res
            .status(200)
            .send({ status: false, message: "Employee not found" });
        }

        const { image: oldImagePath } = employeesRecord[0];

        if (insert.image && oldImagePath) {
          deleteOldFile.deleteOldFile(oldImagePath);
        }
      }

      insert.updated_at = getCurrentDateTime();

      // Update data, excluding password if not provided
      const saveData = await sqlModel.update("employees", insert, { id });
      const msg = "Data Updated";

      if (saveData.error) {
        return res.status(200).send(saveData);
      } else {
          // const insertId = saveData.insertId || saveData.id || null;
         return res.status(200).send({
    status: true,
    message: "Data Saved",
    id: id,
    data: {
      name: req.body.name,
      email: req.body.email,
      mobile: req.body.mobile,
      employee_id: req.body.employee_id,
    },
  });

        // res.status(200).send({ status: true, message: msg });
      }

      // Check if email or password has changed and send email
      if (req.body.email || plainPassword) {
        if (
          originalEmail !== req.body.email ||
          (plainPassword &&
            !(await bcrypt.compare(plainPassword, originalPasswordHash)))
        ) {
          const emailData = {
            company: company.name,
            companyLogo: `${process.env.BASE_URL}${company.logo}`,
            name: req.body.name,
            email: req.body.email,
            password: plainPassword || originalPasswordHash, // Use existing password if not provided
          };

          sendMail.sendEmailToEmp(emailData);
        }
      }
    } else {
      const existingemployeesWithEmail = await sqlModel.select(
        "employees",
        ["id"],
        { email: req.body.email }
      );
      if (existingemployeesWithEmail.length > 0) {
        return res
          .status(200)
          .send({ status: false, message: "Email already exists" });
      }

      const existingemployeesWithMobile = await sqlModel.select(
        "employees",
        ["id"],
        { mobile: req.body.mobile ,company_id: companyId}
      );
      if (existingemployeesWithMobile.length > 0) {
        return res
          .status(200)
          .send({ status: false, message: "Mobile Number already exists" });
      }

      const existingemployeesWithId = await sqlModel.select(
        "employees",
        ["id"],
        { employee_id: req.body.employee_id }
      );
      if (existingemployeesWithId.length > 0) {
        return res
          .status(200)
          .send({ status: false, message: "Employee id already exists" });
      }

      insert.created_at = getCurrentDateTime();
      const saveData = await sqlModel.insert("employees", insert);

      const emailData = {
        company: company.name,
        companyLogo: `${process.env.BASE_URL}${company.logo}`,
        name: req.body.name,
        email: req.body.email,
        password: plainPassword,
      };

      sendMail.sendEmailToEmp(emailData);

      const msg = "Data Saved";

      if (saveData.error) {
        return res.status(200).send(saveData);
      } else {
        const insertId = saveData.insertId || saveData.id || null;
         return res.status(200).send({
    status: true,
    message: "Data Saved",
    id: insertId,
    data: {
      name: req.body.name,
      email: req.body.email,
      mobile: req.body.mobile,
      employee_id: req.body.employee_id,
    },
  });
      }
    }
  } catch (error) {
    return res.status(200).send({ status: false, error: error.message });
  }
};

exports.deleteemployee = async (req, res, next) => {
  try {
    const id = req.params.id;

    // Fetch employee's record
    const employeeRecord = await sqlModel.select("employees", ["image"], {
      id,
    });
    if (employeeRecord.error || employeeRecord.length === 0) {
      return res
        .status(200)
        .send({ status: false, message: "Employee not found" });
    }

    const { image: oldEmployeeImage } = employeeRecord[0];

    // Delete old employee image if it exists
    if (oldEmployeeImage) {
      deleteOldFile.deleteOldFile(oldEmployeeImage);
    }

    // Fetch check-in details
    const checkInRecord = await sqlModel.select(
      "check_in",
      ["checkin_img", "checkout_img"],
      { emp_id: id }
    );
    if (checkInRecord.error) {
      return res.status(200).send(checkInRecord);
    }

    // Delete check-in and check-out images if they exist
    checkInRecord.forEach((record) => {
      if (record.checkin_img) {
        deleteOldFile.deleteOldFile(record.checkin_img);
      }
      if (record.checkout_img) {
        deleteOldFile.deleteOldFile(record.checkout_img);
      }
    });

    // Delete check-in record
    const deleteCheckInResult = await sqlModel.delete("check_in", {
      emp_id: id,
    });
    if (deleteCheckInResult.error) {
      return res.status(200).send(deleteCheckInResult);
    }

    // Delete tracking record
    const deleteTrackingResult = await sqlModel.delete("emp_tracking", {
      emp_id: id,
    });
    if (deleteTrackingResult.error) {
      return res.status(200).send(deleteTrackingResult);
    }

    // Delete login  record
    const deleteLoginResult = await sqlModel.delete("emp_login_history", {
      emp_id: id,
    });
    if (deleteLoginResult.error) {
      return res.status(200).send(deleteLoginResult);
    }

    // Delete employee's record
    const deleteEmployeeResult = await sqlModel.delete("employees", { id });
    if (deleteEmployeeResult.error) {
      return res.status(200).send(deleteEmployeeResult);
    }

    res.status(200).send({
      status: true,
      message: "Employee and related records deleted successfully",
    });
  } catch (error) {
    res.status(200).send({ status: false, error: error.message });
  }
};

exports.deleteMultipleEmployees = async (req, res, next) => {
  try {
    const ids = req.body.ids;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).send({ status: false, message: "Invalid input" });
    }

    // Process each employee ID
    const results = await Promise.all(
      ids.map(async (id) => {
        // Fetch employee's record
        const employeeRecord = await sqlModel.select("employees", ["image"], {
          id,
        });
        if (employeeRecord.error || employeeRecord.length === 0) {
          return { id, status: false, message: "Employee not found" };
        }

        const { image: oldEmployeeImage } = employeeRecord[0];

        // Delete old employee image if it exists
        if (oldEmployeeImage) {
          deleteOldFile.deleteOldFile(oldEmployeeImage);
        }

        // Fetch check-in details
        const checkInRecord = await sqlModel.select(
          "check_in",
          ["checkin_img", "checkout_img"],
          { emp_id: id }
        );
        if (checkInRecord.error) {
          return {
            id,
            status: false,
            message: "Failed to fetch check-in records",
          };
        }

        // Delete check-in and check-out images if they exist
        checkInRecord.forEach((record) => {
          if (record.checkin_img) {
            deleteOldFile.deleteOldFile(record.checkin_img);
          }
          if (record.checkout_img) {
            deleteOldFile.deleteOldFile(record.checkout_img);
          }
        });

        // Delete related records
        const deleteCheckInResult = await sqlModel.delete("check_in", {
          emp_id: id,
        });
        const deleteTrackingResult = await sqlModel.delete("emp_tracking", {
          emp_id: id,
        });
        const deleteLoginResult = await sqlModel.delete("emp_login_history", {
          emp_id: id,
        });
        const deleteEmployeeResult = await sqlModel.delete("employees", { id });

        if (
          deleteCheckInResult.error ||
          deleteTrackingResult.error ||
          deleteLoginResult.error ||
          deleteEmployeeResult.error
        ) {
          return { id, status: false, message: "Error deleting records" };
        }

        return {
          id,
          status: true,
          message: "Employees Data deleted successfully",
        };
      })
    );

    // Separate results with errors and successful deletions
    const errors = results.filter((result) => !result.status);
    const successes = results.filter((result) => result.status);

    if (errors.length > 0) {
      return res.status(200).send({
        status: false,
        message: "Some records could not be deleted",
        errors,
        successes,
      });
    } else {
      return res
        .status(200)
        .send({ status: true, message: "All records deleted successfully" });
    }
  } catch (error) {
    return res.status(500).send({ status: false, error: error.message });
  }
};


exports.employeesGetByMobile = async (req, res, next) => {
  try {
    const mobile = req.query?.mobile;
    const companyId = req.query?.company_id;

    if (!mobile || !companyId) {
      return res.status(200).send({
        status: false,
        message: "Mobile number and company_id are required",
      });
    }

    const date = getCurrentDate();

    const checkInSubquery = `
      SELECT 
        emp_id,
        checkin_status,
        ROW_NUMBER() OVER (PARTITION BY emp_id ORDER BY id DESC) AS row_num
      FROM check_in
      WHERE company_id = ? AND date = ?
    `;

    const query = `
      SELECT
        e.id,
        e.company_id,
        e.name,
        e.mobile,
        e.email,
        e.status,
        e.address,
        e.dob,
        e.employee_id,
        e.joining_date,
        e.gender,
        e.branch,
        e.designation,
        e.department,
        e.state,
        e.city,
        e.zip_code,
        e.timer,
        b.name AS branch_name,
        d.name AS department_name,
        de.name AS designation_name,
        CASE
          WHEN e.image IS NOT NULL THEN CONCAT(?, e.image)
          ELSE e.image
        END AS image,
        latest_checkin.checkin_status
      FROM employees e
      LEFT JOIN branch b ON e.branch = b.id
      LEFT JOIN department d ON e.department = d.id
      LEFT JOIN designation de ON e.designation = de.id
      LEFT JOIN (
        SELECT emp_id, checkin_status 
        FROM (${checkInSubquery}) AS ranked_checkins 
        WHERE row_num = 1
      ) AS latest_checkin ON e.id = latest_checkin.emp_id
      WHERE e.mobile = ? AND e.company_id = ?
    `;

    const data = await sqlModel.customQuery(query, [
      process.env.BASE_URL,
      companyId,
      date,
      mobile,
      companyId,
    ]);

    if (data.error) {
      return res.status(200).send(data);
    }

    res.status(200).send({ status: true, data: data });
  } catch (error) {
    res.status(200).send({ status: false, error: error.message });
  }
};
