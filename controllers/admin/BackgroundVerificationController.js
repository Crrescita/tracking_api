const sqlModel = require("../../config/db");
const deleteOldFile = require("../../middleware/deleteImage");

exports.getBackgroundVerification = async (req, res, next) => {
  try {
    // const id = req.params?.id || "";
    const whereClause = {};
    for (const key in req.query) {
      if (req.query.hasOwnProperty(key)) {
        whereClause[key] = req.query[key];
      }
    }

    const data = await sqlModel.select(
      "emp_verification_document",
      {},
      whereClause
    );

    if (data.error) {
      return res.status(500).send(data);
    }

    if (data.length === 0) {
      return res.status(200).send({ status: false, message: "No data found" });
    }

    const result = await Promise.all(
      data.map(async (item) => {
       
        item.aadhaar_file = item.aadhaar_file
          ? `${process.env.BASE_URL}${item.aadhaar_file}`
          : "";
        item.pan_file = item.pan_file
          ? `${process.env.BASE_URL}${item.pan_file}`
          : "";
        item.driving_license_file = item.driving_license_file
          ? `${process.env.BASE_URL}${item.driving_license_file}`
          : "";
        item.voter_file = item.voter_file
          ? `${process.env.BASE_URL}${item.voter_file}`
          : "";
        item.uan_file = item.uan_file
          ? `${process.env.BASE_URL}${item.uan_file}`
          : "";
        return item;
      })
    );

    res.status(200).send({ status: true, data: result });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};

// exports.insertBackgroundVerification = async (req, res, next) => {
//   try {
//     const id = req.params.id || "";
//     const { documentNo, documentType, emp_id, company_id } = req.body;

//     if (!documentType || !documentNo) {
//       return res.status(400).send({
//         status: false,
//         message: "Invalid request. Document type and number are required.",
//       });
//     }

//     // Map to sanitize the document type to a consistent format
//     const sanitizedDocumentType = documentType
//       .toLowerCase()
//       .replace(/\s+/g, "_"); // Convert spaces to underscores

//     const validDocumentTypes = {
//       aadhaar: /^\d{9,18}$/,
//       pan: /^[A-Z]{5}\d{4}[A-Z]{1}$/,
//       driving_license: /^[A-Z0-9]{15}$/,
//       voter_id: /^[A-Z]{3}\d{7}$/,
//       uan: /^\d{12}$/,
//     };

//     // Validate the document type and number format
//     if (
//       !validDocumentTypes[sanitizedDocumentType] ||
//       !validDocumentTypes[sanitizedDocumentType].test(documentNo)
//     ) {
//       return res.status(400).send({
//         status: false,
//         message: `Invalid ${documentType} number format.`,
//       });
//     }

//     // Handle uploaded file
//     let documentFilePath = "";
//     if (req.files && req.files.documentFile && req.files.documentFile[0]) {
//       documentFilePath = req.fileFullPath.find((path) =>
//         path.includes("documentFile")
//       );
//     }

//     if (!documentFilePath) {
//       return res.status(400).send({
//         status: false,
//         message: "Document file is required.",
//       });
//     }

//     // Prepare data for insertion or update
//     const insert = {
//       emp_id: emp_id,
//       company_id: company_id,
//       [sanitizedDocumentType]: documentNo,
//       [`${sanitizedDocumentType}_file`]: documentFilePath,
//     };

//     if (id) {
//       const existingRecord = await sqlModel.select(
//         "emp_verification_documnet",
//         {},
//         id
//       );

//       if (
//         !existingRecord ||
//         existingRecord.error ||
//         existingRecord.length === 0
//       ) {
//         return res
//           .status(404)
//           .send({ status: false, message: "No record found." });
//       }

//       // Delete old file if it exists
//       if (existingRecord[0][`${sanitizedDocumentType}_file`]) {
//         deleteOldFile.deleteOldFile(
//           existingRecord[0][`${sanitizedDocumentType}_file`]
//         );
//       }

//       insert.updated_at = getCurrentDateTime();

//       // Update the record
//       await sqlModel.update("emp_verification_documnet", insert, { id });
//       return res
//         .status(200)
//         .send({ status: true, message: "Record updated successfully." });
//     } else {
//       insert.created_at = getCurrentDateTime();

//       // Insert new record
//       await sqlModel.insert("emp_verification_documnet", insert);
//       return res
//         .status(200)
//         .send({ status: true, message: "Record inserted successfully." });
//     }
//   } catch (error) {
//     return res.status(500).send({
//       status: false,
//       message: "An error occurred.",
//       error: error.message,
//     });
//   }
// };

// exports.insertBackgroundVerification = async (req, res, next) => {
//   try {
//     const id = req.params.id || "";
//     const { documentNo, documentType, emp_id, company_id } = req.body;

//     if (!documentType || !documentNo) {
//       return res.status(400).send({
//         status: false,
//         message: "Invalid request. Document type and number are required.",
//       });
//     }

//     const sanitizedDocumentType = documentType
//       .toLowerCase()
//       .replace(/\s+/g, "_") + "_file";


//     const validDocumentTypes = {
//       aadhaar_file: /^\d{9,18}$/,
//       pan_file: /^[A-Z]{5}\d{4}[A-Z]{1}$/,
//       driving_license_file: /^[A-Z0-9]{15}$/,
//       voter_id_file: /^[A-Z]{3}\d{7}$/,
//       uan_file: /^\d{12}$/,
//     };

//     if (
//       !validDocumentTypes[sanitizedDocumentType] ||
//       !validDocumentTypes[sanitizedDocumentType].test(documentNo)
//     ) {
//       return res.status(400).send({
//         status: false,
//         message: `Invalid ${documentType} number format.`,
//       });
//     }

//     let documentFilePath = "";
//     if (req.files && req.files.documentFile && req.files.documentFile[0]) {
//       documentFilePath = req.fileFullPath.find((path) =>
//         path.includes("documentFile")
//       );
//     }

//     // Prepare data for insertion or update
//     const insert = {
//       emp_id: emp_id,
//       company_id: company_id,
//       [sanitizedDocumentType]: documentNo,
//     };

//     const existingRecord = await sqlModel.select(
//       "emp_verification_documnet",
//       {},
//       { emp_id }
//     );

//     if (existingRecord || existingRecord.length !== 0) {
//       // Update file path only if a new file is uploaded
//       if (documentFilePath) {
//         // Delete old file if it exists
//         if (existingRecord[0][`${sanitizedDocumentType}`]) {
//           deleteOldFile.deleteOldFile(
//             existingRecord[0][`${sanitizedDocumentType}`]
//           );
//         }

//         insert[`${sanitizedDocumentType}`] = documentFilePath;
//       }

//       insert.updated_at = getCurrentDateTime();

//       // Update the record
//       await sqlModel.update("emp_verification_documnet", insert, { emp_id });
//       return res
//         .status(200)
//         .send({ status: true, message: "Record updated successfully." });
//     } else {
//       if (!documentFilePath) {
//         return res.status(400).send({
//           status: false,
//           message: "Document file is required for a new record.",
//         });
//       }

//       insert[`${sanitizedDocumentType}`] = documentFilePath;
//       insert.created_at = getCurrentDateTime();

//       // Insert new record
//       await sqlModel.insert("emp_verification_documnet", insert);
//       return res
//         .status(200)
//         .send({ status: true, message: "Record inserted successfully." });
//     }

//   } catch (error) {
//     return res.status(500).send({
//       status: false,
//       message: "An error occurred.",
//       error: error.message,
//     });
//   }
// };

exports.insertBackgroundVerification = async (req, res, next) => {
  try {
    const id = req.params.id || "";
    const { documentNo, documentType, emp_id, company_id } = req.body;
    if (!documentType || !documentNo) {
      return res.status(400).send({
        status: false,
        message: "Invalid request. Document type and number are required.",
      });
    }

    // Sanitize and prepare document type
    const sanitizedDocumentType =
      documentType.toLowerCase().replace(/\s+/g, "_") + "_file";

      const sanitizedDocumentName =
      documentType.toLowerCase().replace(/\s+/g, "_");

    // Validation patterns for different document types
    const validDocumentTypes = {
      aadhaar_file: /^\d{12}$/, // Aadhaar is 12 digits
      pan_file: /^[A-Z]{5}\d{4}[A-Z]{1}$/, // PAN format
      driving_license_file: /^[A-Z0-9]{15}$/, // Driving License format
      voter_id_file: /^[A-Z]{3}\d{7}$/, // Voter ID format
      uan_file: /^\d{12}$/, // UAN number format
    };

    // Validate document number format
    if (
      !validDocumentTypes[sanitizedDocumentType] ||
      !validDocumentTypes[sanitizedDocumentType].test(documentNo)
    ) {
      return res.status(400).send({
        status: false,
        message: `Invalid ${documentType} number format.`,
      });
    }

    // Handle file upload
    let documentFilePath = "";
    if (req.files && req.files.documentFile && req.files.documentFile[0]) {
      documentFilePath = req.fileFullPath.find((path) =>
        path.includes("documentFile")
      );
    }

    // Data to insert or update
    const insert = {
      emp_id,
      company_id, 
      // req.user.id,
      [sanitizedDocumentName]: documentNo,
    };


    // Check if the record already exists
    const existingRecord = await sqlModel.select(
      "emp_verification_document", // Ensure correct table name
      {},
      { emp_id }
    );

    if (existingRecord && existingRecord.length > 0) {
      // Update logic
      if (documentFilePath) {
        // Delete old file if exists
        if (existingRecord[0][sanitizedDocumentType]) {
          deleteOldFile.deleteOldFile(existingRecord[0][sanitizedDocumentType]);
        }
        insert[sanitizedDocumentType] = documentFilePath;
      }

      insert.updated_at = getCurrentDateTime();

      // Update the record
      await sqlModel.update("emp_verification_document", insert, { emp_id });
      return res
        .status(200)
        .send({ status: true, message: "Record updated successfully." });
    } else {
      // Insert logic
      if (!documentFilePath) {
        return res.status(400).send({
          status: false,
          message: "Document file is required for a new record.",
        });
      }

      insert[sanitizedDocumentType] = documentFilePath;
      insert.created_at = getCurrentDateTime();

      // Insert the new record
      await sqlModel.insert("emp_verification_document", insert);
      return res
        .status(200)
        .send({ status: true, message: "Record inserted successfully." });
    }
  } catch (error) {
    console.log(error.message)
    return res.status(500).send({
      status: false,
      message: "An error occurred.",
      error: error.message,
    });
  }
};

exports.insertBackgroundVerificationByEmp = async (req, res, next) => {
  try {
    const id = req.params.id || "";
    const { documentNo, documentType, emp_id, company_id } = req.body;
    if (!documentType || !documentNo) {
      return res.status(400).send({
        status: false,
        message: "Invalid request. Document type and number are required.",
      });
    }

    // Sanitize and prepare document type
    const sanitizedDocumentType =
      documentType.toLowerCase().replace(/\s+/g, "_") + "_file";

      const sanitizedDocumentName =
      documentType.toLowerCase().replace(/\s+/g, "_");

    // Validation patterns for different document types
    const validDocumentTypes = {
      aadhaar_file: /^\d{12}$/, // Aadhaar is 12 digits
      pan_file: /^[A-Z]{5}\d{4}[A-Z]{1}$/, // PAN format
      driving_license_file: /^[A-Z0-9]{15}$/, // Driving License format
      voter_id_file: /^[A-Z]{3}\d{7}$/, // Voter ID format
      uan_file: /^\d{12}$/, // UAN number format
    };

    // Validate document number format
    if (
      !validDocumentTypes[sanitizedDocumentType] ||
      !validDocumentTypes[sanitizedDocumentType].test(documentNo)
    ) {
      return res.status(400).send({
        status: false,
        message: `Invalid ${documentType} number format.`,
      });
    }

    // Handle file upload
    let documentFilePath = "";
    if (req.files && req.files.documentFile && req.files.documentFile[0]) {
      documentFilePath = req.fileFullPath.find((path) =>
        path.includes("documentFile")
      );
    }

    // Data to insert or update
    const insert = {
      emp_id,
      company_id : 8,
      [sanitizedDocumentName]: documentNo,
    };


    // Check if the record already exists
    const existingRecord = await sqlModel.select(
      "emp_verification_document", // Ensure correct table name
      {},
      { emp_id }
    );

    if (existingRecord && existingRecord.length > 0) {
      // Update logic
      if (documentFilePath) {
        // Delete old file if exists
        if (existingRecord[0][sanitizedDocumentType]) {
          deleteOldFile.deleteOldFile(existingRecord[0][sanitizedDocumentType]);
        }
        insert[sanitizedDocumentType] = documentFilePath;
      }

      insert.updated_at = getCurrentDateTime();

      // Update the record
      await sqlModel.update("emp_verification_document", insert, { emp_id });
      return res
        .status(200)
        .send({ status: true, message: "Record updated successfully." });
    } else {
      // Insert logic
      // if (!documentFilePath) {
      //   return res.status(400).send({
      //     status: false,
      //     message: "Document file is required for a new record.",
      //   });
      // }

      insert[sanitizedDocumentType] = documentFilePath;
      insert.created_at = getCurrentDateTime();

      // Insert the new record
      await sqlModel.insert("emp_verification_document", insert);
      return res
        .status(200)
        .send({ status: true, message: "Record inserted successfully." });
    }
  } catch (error) {
    console.log(error.message)
    return res.status(500).send({
      status: false,
      message: "An error occurred.",
      error: error.message,
    });
  }
};

