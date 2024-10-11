const sqlModel = require("../../config/db");
const path = require("path");
const deleteOldFile = require("../../middleware/deleteImage");
const bcrypt = require("bcrypt");
const saltRounds = 10;
const sendMail = require("../../mail/nodemailer");

//company
exports.companyGet = async (req, res, next) => {
  try {
    const id = req.params?.id || "";
    const whereClause = id ? { id } : {};
    const data = await sqlModel.select("company", {}, whereClause);

    if (data.error) {
      return res.status(500).send(data);
    }

    const result = await Promise.all(
      data.map(async (item) => {
        item.logo = item.logo ? `${process.env.BASE_URL}${item.logo}` : "";
        delete item.password;
        // item.password = encrypt(item.password);
        return item;
      })
    );

    res.status(200).send({ status: true, data: result });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};

const createSlug = (title) => {
  return title
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w\-]+/g, "") // Remove all non-word characters
    .replace(/\-\-+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, ""); // Trim - from end of text
};

exports.companyInsert = async (req, res, next) => {
  try {
    const id = req.params.id || "";
    const insert = { ...req.body };
    let plainPassword = insert.password;
    let originalEmail = "";
    let originalPasswordHash = "";
    console.log(insert);
    if (req.files) {
      if (req.files.logo) {
        insert.logo = req.fileFullPath.find((path) => path.includes("logo"));
      }
    }

    if (insert.password) {
      insert.password = await bcrypt.hash(insert.password, saltRounds);
    } else {
      delete insert.password;
    }

    if (id) {
      // Fetch the original email and password hash
      const companyRecord = await sqlModel.select(
        "company",
        ["email", "password"],
        { id }
      );

      if (companyRecord.error || companyRecord.length === 0) {
        return res
          .status(200)
          .send({ status: false, message: "Company not found" });
      }

      originalEmail = companyRecord[0].email;
      originalPasswordHash = companyRecord[0].password;

      if (req.body.name) {
        const newSlug = createSlug(req.body.name);
        const existingCompanyWithSlug = await sqlModel.select(
          "company",
          ["id"],
          { slug: newSlug }
        );

        if (
          existingCompanyWithSlug.length > 0 &&
          existingCompanyWithSlug[0].id != id
        ) {
          return res
            .status(200)
            .send({ status: false, message: "Slug or Name already exists" });
        }

        insert.slug = newSlug;
      }

      if (req.body.email) {
        const existingCompanyWithEmail = await sqlModel.select(
          "company",
          ["id"],
          { email: req.body.email }
        );
        if (
          existingCompanyWithEmail.length > 0 &&
          existingCompanyWithEmail[0].id != id
        ) {
          return res
            .status(200)
            .send({ status: false, message: "Email already exists" });
        }
      }

      if (req.body.cin_id) {
        const existingCompanyWithCIN = await sqlModel.select(
          "company",
          ["id"],
          {
            cin_id: req.body.cin_id,
          }
        );
        if (
          existingCompanyWithCIN.length > 0 &&
          existingCompanyWithCIN[0].id != id
        ) {
          return res
            .status(200)
            .send({ status: false, message: "CIN ID already exists" });
        }
      }

      if (req.fileFullPath && req.fileFullPath.length > 0) {
        const companyRecord = await sqlModel.select("company", ["logo"], {
          id,
        });

        if (companyRecord.error || companyRecord.length === 0) {
          return res
            .status(200)
            .send({ status: false, message: "Company not found" });
        }

        const { logo: oldImagePath } = companyRecord[0];

        if (insert.logo && oldImagePath) {
          deleteOldFile.deleteOldFile(oldImagePath);
        }
      }

      insert.updated_at = getCurrentDateTime();
      const saveData = await sqlModel.update("company", insert, { id });
      const msg = "Data Updated";

      if (req.body.password) {
        if (req.body.email || plainPassword) {
          if (
            originalEmail !== req.body.email ||
            !(await bcrypt.compare(plainPassword, originalPasswordHash))
          ) {
            const emailData = {
              name: req.body.name,
              email: req.body.email,
              password: plainPassword,
            };

            sendMail.sendEmailToCompany(emailData);
          }
        }
      }

      if (saveData.error) {
        return res.status(200).send(saveData);
      } else {
        res.status(200).send({ status: true, message: msg });
      }

      // Check if email or password has changed and send email
    } else {
      if (req.body.name) {
        insert.slug = createSlug(req.body.name);
      }

      const existingCompanyWithSlug = await sqlModel.select("company", ["id"], {
        slug: insert.slug,
      });
      if (existingCompanyWithSlug.length > 0) {
        return res
          .status(200)
          .send({ status: false, message: "Slug or Name already exists" });
      }

      const existingCompanyWithEmail = await sqlModel.select(
        "company",
        ["id"],
        { email: req.body.email }
      );
      if (existingCompanyWithEmail.length > 0) {
        return res
          .status(200)
          .send({ status: false, message: "Email already exists" });
      }

      const existingCompanyWithCIN = await sqlModel.select("company", ["id"], {
        cin_id: req.body.cin_id,
      });
      if (existingCompanyWithCIN.length > 0) {
        return res
          .status(200)
          .send({ status: false, message: "CIN ID already exists" });
      }

      insert.created_at = getCurrentDateTime();
      const saveData = await sqlModel.insert("company", insert);
      const emailData = {
        name: req.body.name,
        email: req.body.email,
        password: plainPassword,
      };

      sendMail.sendEmailToCompany(emailData);
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

exports.deleteCompany = async (req, res, next) => {
  try {
    const id = req.params.id;

    // Fetch company record
    const companyRecord = await sqlModel.select("company", ["logo"], { id });
    if (companyRecord.error || companyRecord.length === 0) {
      return res
        .status(200)
        .send({ status: false, message: "Company not found" });
    }

    const { logo: oldCompanyLogo } = companyRecord[0];

    // Fetch employee records associated with the company
    const employeeRecords = await sqlModel.select(
      "employees",
      ["id", "image"],
      { company_id: id }
    );
    if (employeeRecords.error) {
      return res.status(200).send(employeeRecords);
    }

    // Delete employee images if they exist
    employeeRecords.forEach((employee) => {
      if (employee.image) {
        deleteOldFile.deleteOldFile(employee.image);
      }
    });

    // Delete employee records
    const deleteEmployeeResult = await sqlModel.delete("employees", {
      company_id: id,
    });
    if (deleteEmployeeResult.error) {
      return res.status(200).send(deleteEmployeeResult);
    }

    // Delete company logo if it exists
    if (oldCompanyLogo) {
      deleteOldFile.deleteOldFile(oldCompanyLogo);
    }

    // Delete company record
    const deleteCompanyResult = await sqlModel.delete("company", { id });
    if (deleteCompanyResult.error) {
      return res.status(200).send(deleteCompanyResult);
    }

    res.status(200).send({
      status: true,
      message: "Company and related employees deleted successfully",
    });
  } catch (error) {
    res.status(200).send({ status: false, error: error.message });
  }
};

// exports.deleteCompany = async (req, res, next) => {
//   try {
//     let id = req.params.id;

//     const companyRecord = await sqlModel.select("company", ["logo"], { id });

//     if (companyRecord.error || companyRecord.length === 0) {
//       return res
//         .status(200)
//         .send({ status: false, message: "Company not found" });
//     }

//     const { logo: oldImagePath } = companyRecord[0];

//     if (oldImagePath) {
//       deleteOldFile.deleteOldFile(oldImagePath);
//     }

//     let result = await sqlModel.delete("company", { id: id });

//     if (!result.error) {
//       res.status(200).send({ status: true, message: "Record deleted" });
//     } else {
//       res.status(200).send(result);
//     }
//   } catch (error) {
//     res.status(200).send({ status: false, error: error.message });
//   }
// };
