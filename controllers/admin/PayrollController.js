const sqlModel = require("../../config/db");


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
      
      // Check if BASE_URL is set
      const baseUrl = process.env.BASE_URL;
      if (!baseUrl) {
        return res.status(500).send({
          status: false,
          message: "Base URL is not configured properly",
        });
      }
  
      // SQL query to fetch all employees with optional payroll data
      let query = `
        SELECT
          e.id AS emp_id,
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
            ELSE NULL
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
          es.earning as emp_earning,
          es.deduction as emp_deduction,
          es.employeer_ctc as emp_employeer_ctc,
          ep.created_at AS payslip_created_at,
          ep.updated_at AS payslip_updated_at,
          CASE 
                    WHEN ep.id IS NOT NULL THEN TRUE 
                    ELSE FALSE 
                END AS payroll_finalized
        FROM employees e
        LEFT JOIN branch b ON e.branch = b.id
        LEFT JOIN department d ON e.department = d.id
        LEFT JOIN designation de ON e.designation = de.id
        LEFT JOIN emp_bank_detail eb ON e.id = eb.emp_id
        LEFT JOIN emp_salary_detail es ON e.id = es.emp_id
        LEFT JOIN emp_verification_document ev ON e.id = ev.emp_id
        LEFT JOIN emp_payslip ep ON e.id = ep.emp_id
      `;
  
      const values = [baseUrl];
  
      // Add company filter
      query += " WHERE e.company_id = ?";
      values.push(company_id);
  
      // Add month filter (optional)
      if (month) {
        query += " AND (ep.payslip_for_month = ? OR ep.payslip_for_month IS NULL)";
        values.push(month);
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
//         const company_id = req.user.id;
//         if (!company_id) {
//             return res.status(400).send({ status: false, message: "Company ID is required" });
//         }

//         const { month } = req.query;
//         const baseUrl = process.env.BASE_URL;
//         if (!baseUrl) {
//             return res.status(500).send({ status: false, message: "Base URL is not configured properly" });
//         }

//         let query = `
//             SELECT e.id AS emp_id, e.company_id, e.name, e.email, e.joining_date, e.mobile, e.employee_id,
//                    b.name AS branch, d.name AS department, de.name AS designation,
//                    CASE WHEN e.image IS NOT NULL THEN CONCAT(?, e.image) ELSE NULL END AS image,
//                    ep.payslip_for_month, ep.salary AS monthly_salary, ep.earning, ep.deduction, ep.employeer_ctc, ep.net_pay,
//                    ep.paid_days, ep.earning_amount, ep.deduction_amount, ep.created_at AS payslip_created_at,
//                    ep.updated_at AS payslip_updated_at,
//                    eb.bank_name, eb.acc_number, ev.aadhaar, ev.pan, es.salary AS emp_salary,
//                    es.earning AS emp_earning, es.deduction AS emp_deduction, es.employeer_ctc as emp_employeer_ctc,
//                    CASE WHEN ep.id IS NOT NULL THEN TRUE ELSE FALSE END AS payroll_finalized
//             FROM employees e
//             LEFT JOIN branch b ON e.branch = b.id
//             LEFT JOIN department d ON e.department = d.id
//             LEFT JOIN designation de ON e.designation = de.id
//             LEFT JOIN emp_bank_detail eb ON e.id = eb.emp_id
//             LEFT JOIN emp_salary_detail es ON e.id = es.emp_id
//             LEFT JOIN emp_verification_document ev ON e.id = ev.emp_id
//             LEFT JOIN emp_payslip ep ON e.id = ep.emp_id
//             WHERE e.company_id = ?
//         `;
        
//         const values = [baseUrl, company_id];
//         if (month) {
//             query += " AND (ep.payslip_for_month = ? OR ep.payslip_for_month IS NULL)";
//             values.push(month);
//         }

//         const employees = await sqlModel.customQuery(query, values);
//         if (!employees.length) {
//             return res.status(404).send({ status: false, message: "No employees or payroll data found" });
//         }

//         // 

//          const targetDate = new Date(month);
//     if (isNaN(targetDate)) {
//       return res.status(400).send({
//         status: false,
//         message: "Invalid date format",
//       });
//     }

//     const year = targetDate.getFullYear();
//     const targetMonth = targetDate.getMonth() + 1;
//     const daysInMonth = new Date(year, targetMonth, 0).getDate();

//     const sundays = [];
//     for (let day = 1; day <= daysInMonth; day++) {
//       const currentDate = new Date(year, month - 1, day);
//       if (currentDate.getDay() === 0) { // Sunday (0 = Sunday)
//         sundays.push(day);
//       }
//     }


//         for (let emp of employees) {
//             if (emp.payroll_finalized == 0) {
               
//                 let attendanceQuery = `
//                     SELECT DATE(date) as attendance_date
//                     FROM emp_attendance
//                     WHERE emp_id = ? AND MONTH(date) = ? AND YEAR(date) = ?
//                 `;

              

//                 const attendanceRecords = await sqlModel.customQuery(attendanceQuery, [emp.emp_id, targetMonth, year]);
   
//                 const presentDates = new Set(attendanceRecords.map(record => new Date(record.attendance_date).getDate()));
//                 let presentDays = [...presentDates].filter(day => !sundays.includes(day)).length;
//                 presentDays += sundays.filter(sunday => presentDates.has(sunday)).length;
//                 emp.paid_days = Math.min(presentDays, daysInMonth);
//                 emp.daysInMonth = daysInMonth
//             }
//         }

//         return res.status(200).send({ status: true, message: "Data fetched successfully", data: employees });
//     } catch (error) {
//         console.error("Error fetching payroll data:", error);
//         res.status(500).send({ status: false, error: error.message });
//     }
// };
  
  
  
  
  
  
  
  