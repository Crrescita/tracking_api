const sqlModel = require("../../config/db");
const path = require("path");
const deleteOldFile = require("../../middleware/deleteImage");
const bcrypt = require("bcrypt");
const sendMail = require("../../mail/nodemailer");
const saltRounds = 10;
const crypto = require("crypto");

//employees

exports.employeesGet = async (req, res, next) => {
  try {
    const id = req.params?.id || "";
    const companyId = req.query?.company_id || "";

    let whereClause = {};
    if (id) {
      whereClause.id = id;
    }
    if (companyId) {
      whereClause.company_id = companyId;
    }

    const data = await sqlModel.select("employees", {}, whereClause);

    if (data.error) {
      return res.status(200).send(data);
    }

    const result = await Promise.all(
      data.map(async (item) => {
        item.image = item.image ? `${process.env.BASE_URL}${item.image}` : "";
        delete item.password;
        return item;
      })
    );

    res.status(200).send({ status: true, data: result });
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
        res.status(200).send({ status: true, message: msg });
      }

      // Check if email or password has changed and send email
      if (req.body.email || plainPassword) {
        if (
          originalEmail !== req.body.email ||
          (plainPassword &&
            !(await bcrypt.compare(plainPassword, originalPasswordHash)))
        ) {
          const emailData = {
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
        name: req.body.name,
        email: req.body.email,
        password: plainPassword,
      };

      sendMail.sendEmailToEmp(emailData);

      const msg = "Data Saved";

      if (saveData.error) {
        return res.status(200).send(saveData);
      } else {
        return res.status(200).send({ status: true, message: msg });
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
