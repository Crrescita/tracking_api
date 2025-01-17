const sqlModel = require("../../config/db");

// exports.getPayroll = async (req, res, next) => {
//     try {
//       const company_id = req.user.id;
  
//       if (!company_id) {
//         return res.status(400).send({
//           status: false,
//           message: "Company ID is required",
//         });
//       }
  
//       const { month } = req.query;
  
//       const query = `
//         SELECT
//           e.id AS id,
//           e.company_id,
//           e.name AS name,
//           e.email,
//           e.joining_date,
//           e.mobile,
//           e.employee_id,
//           b.name AS branch,
//           d.name AS department,
//           de.name AS designation,
//           CASE
//             WHEN e.image IS NOT NULL THEN CONCAT(?, e.image)
//             ELSE e.image
//           END AS image,
//           ep.payslip_for_month,
//           ep.salary as monthly_salary,
//           ep.earning,
//           ep.deduction,
//           ep.net_pay,
//           ep.paid_days,
//           ep.earning_amount,
//           ep.deduction_amount,
//           eb.bank_name,
//           eb.acc_number,
//           ev.aadhaar,
//           ev.pan,
//           es.salary,
//           ep.created_at AS payslip_created_at,
//           ep.updated_at AS payslip_updated_at
//         FROM employees e
//         LEFT JOIN branch b ON e.branch = b.id
//         LEFT JOIN department d ON e.department = d.id
//         LEFT JOIN designation de ON e.designation = de.id
//         LEFT JOIN emp_payslip ep ON e.id = ep.emp_id 
//         LEFT JOIN emp_bank_detail eb ON e.id = eb.emp_id
//         LEFT JOIN emp_salary_detail es ON e.id = es.emp_id
//         LEFT JOIN emp_verification_document ev ON e.id = ev.emp_id
//           AND (ep.payslip_for_month = ? OR ? IS NULL)
//         WHERE e.company_id = ?
//       `;
  
//       const values = [process.env.BASE_URL, month || null, month || null, company_id];
//   console.log(query)
//       const employees = await sqlModel.customQuery(query, values);
  
//       if (!employees.length) {
//         return res.status(404).send({
//           status: false,
//           message: "No employees or payroll data found for the given company ID",
//         });
//       }
  
//       return res.status(200).send({
//         status: true,
//         message: "Data fetched successfully",
//         data: employees,
//       });
//     } catch (error) {
//       res.status(500).send({ status: false, error: error.message });
//     }
//   };

exports.getPayroll = async (req, res, next) => {
    try {
      const company_id = req.user.id;
  
      if (!company_id) {
        return res.status(400).send({
          status: false,
          message: "Company ID is required",
        });
      }
  
      const { month } = req.query;
      
      // Check if the base URL is set in environment variables
      const baseUrl = process.env.BASE_URL;
      if (!baseUrl) {
        return res.status(500).send({
          status: false,
          message: "Base URL is not configured properly",
        });
      }
  
      // Define the SQL query
      let query = `
      SELECT
        e.id AS id,
        e.company_id,
        e.name AS name,
        e.email,
        e.joining_date,
        e.mobile,
        e.employee_id,
        b.name AS branch,
        d.name AS department,
        de.name AS designation,
        CASE
          WHEN e.image IS NOT NULL THEN CONCAT(?, e.image)
          ELSE e.image
        END AS image,
        ep.payslip_for_month AS payslip_for_month,
        ep.salary AS monthly_salary,
        ep.earning,
        ep.deduction,
        ep.employeer_ctc,
        ep.net_pay,
        ep.paid_days,
        ep.earning_amount,
        ep.deduction_amount,
        eb.bank_name,
        eb.acc_number,
        ev.aadhaar,
        ev.pan,
        es.salary AS emp_salary,
        ep.created_at AS payslip_created_at,
        ep.updated_at AS payslip_updated_at
      FROM employees e
      LEFT JOIN branch b ON e.branch = b.id
      LEFT JOIN department d ON e.department = d.id
      LEFT JOIN designation de ON e.designation = de.id
      LEFT JOIN emp_bank_detail eb ON e.id = eb.emp_id
      LEFT JOIN emp_salary_detail es ON e.id = es.emp_id
      LEFT JOIN emp_verification_document ev ON e.id = ev.emp_id
      LEFT JOIN emp_payslip ep ON e.id = ep.emp_id
    `;
    
    const values = [baseUrl]; // Ensure the base URL is correctly passed
    
    // Add the company_id filter first
    query += " WHERE e.company_id = ?";
    
    // Add company_id to the values for filtering
    values.push(company_id);
    
    // Conditionally add the month filter if provided
    if (month) {
      console.log(month);
      // You can use this condition to filter payroll by month
      query += " AND ep.payslip_for_month = ?";
      values.push(month); // Example: '2024-11'
    }
    
    // Execute the query
    const employees = await sqlModel.customQuery(query, values);
    
    
      if (!employees.length) {
        return res.status(404).send({
          status: false,
          message: "No employees or payroll data found for the given company ID",
        });
      }
    
      return res.status(200).send({
        status: true,
        message: "Data fetched successfully",
        data: employees,
      });
    } catch (error) {
      res.status(500).send({ status: false, error: error.message });
    }
  };


// exports.getPayroll = async (req, res, next) => {
//     try {
//       const company_id = req.user.id;
  
//       if (!company_id) {
//         return res.status(400).send({
//           status: false,
//           message: "Company ID is required",
//         });
//       }
  
//       const { month } = req.query;
  
//       const baseUrl = process.env.BASE_URL;
//       if (!baseUrl) {
//         return res.status(500).send({
//           status: false,
//           message: "Base URL is not configured properly",
//         });
//       }
  
//       // Define SQL query with a WHERE clause that always includes company_id
//       let query = `
//         SELECT
//           e.id AS id,
//           e.company_id,
//           e.name AS name,
//           e.email,
//           e.joining_date,
//           e.mobile,
//           e.employee_id,
//           b.name AS branch,
//           d.name AS department,
//           de.name AS designation,
//           CASE
//             WHEN e.image IS NOT NULL THEN CONCAT(?, e.image)
//             ELSE e.image
//           END AS image,
//           DATE_FORMAT(ep.payslip_for_month, '%Y-%m') AS payslip_for_month,
//           ep.salary AS monthly_salary,
//           ep.earning,
//           ep.deduction,
//           ep.net_pay,
//           ep.paid_days,
//           ep.earning_amount,
//           ep.deduction_amount,
//           eb.bank_name,
//           eb.acc_number,
//           ev.aadhaar,
//           ev.pan,
//           es.salary AS emp_salary,
//           ep.created_at AS payslip_created_at,
//           ep.updated_at AS payslip_updated_at
//         FROM employees e
//         LEFT JOIN branch b ON e.branch = b.id
//         LEFT JOIN department d ON e.department = d.id
//         LEFT JOIN designation de ON e.designation = de.id
//         LEFT JOIN emp_bank_detail eb ON e.id = eb.emp_id
//         LEFT JOIN emp_salary_detail es ON e.id = es.emp_id
//         LEFT JOIN emp_verification_document ev ON e.id = ev.emp_id
//         LEFT JOIN emp_payslip ep ON e.id = ep.emp_id
//         WHERE e.company_id = ?
//       `;
  
//       const values = [baseUrl, company_id];
  
//       // Add month filter if provided
//       if (month) {
//         query += " AND DATE_FORMAT(ep.payslip_for_month, '%Y-%m') = ?";
//         values.push(month);
//       }
  
//       // Log the query for debugging
//       console.log("Final SQL Query:", query);
//       console.log("Query Parameters:", values);
  
//       const employees = await sqlModel.customQuery(query, values);
  
//       if (!employees.length) {
//         return res.status(404).send({
//           status: false,
//           message: "No employees or payroll data found for the given company ID",
//         });
//       }
  
//       return res.status(200).send({
//         status: true,
//         message: "Data fetched successfully",
//         data: employees,
//       });
//     } catch (error) {
//       res.status(500).send({ status: false, error: error.message });
//     }
//   };
  
  
  
  
  
  
  
  