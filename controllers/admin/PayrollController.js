const sqlModel = require("../../config/db");

async function calculatePresentDays(emp_id, year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();

  // Collect all Sundays
  const sundays = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    if (date.getDay() === 0) sundays.push(d);
  }

  const attendanceQuery = `
    SELECT DATE(date) AS attendance_date
    FROM emp_attendance
    WHERE emp_id = ?
      AND MONTH(date) = ?
      AND YEAR(date) = ?
  `;

  const records = await sqlModel.customQuery(attendanceQuery, [
    emp_id,
    month,
    year,
  ]);

  const presentDates = new Set(
    records.map(r => new Date(r.attendance_date).getDate())
  );

  // Count non-Sunday present days
  let presentDays = [...presentDates].filter(
    d => !sundays.includes(d)
  ).length;

  const attendedSundays = sundays.filter(d => presentDates.has(d));
  const missingSundays = sundays.filter(d => !presentDates.has(d));

  if (presentDays > 0) {
    presentDays += attendedSundays.length + missingSundays.length;
  }

  return Math.min(presentDays, daysInMonth);
}

exports.getPayroll = async (req, res) => {
  try {
    const company_id = req.user.id;
    const { month } = req.query;

    if (!company_id) {
      return res.status(400).send({
        status: false,
        message: "Company ID is required",
      });
    }

    if (!month) {
      return res.status(400).send({
        status: false,
        message: "Month is required in YYYY-MM format",
      });
    }

    const baseUrl = process.env.BASE_URL;
    if (!baseUrl) {
      return res.status(500).send({
        status: false,
        message: "Base URL is not configured properly",
      });
    }

    /* ----------- SQL QUERY ----------- */
    const query = `
      SELECT
        e.id AS emp_id,
        e.company_id,
        e.name,
        e.email,
        e.joining_date,
        e.mobile,
        e.employee_id,
        b.name AS branch,
        d.name AS department,
        de.name AS designation,
        CASE
          WHEN e.image IS NOT NULL AND e.image != '' THEN CONCAT(?, e.image)
          ELSE NULL
        END AS image,

        ep.payslip_for_month,
        ep.salary AS monthly_salary,
        ep.earning,
        ep.deduction,
        ep.employeer_ctc,
        ep.net_pay,
        ep.paid_days,
        ep.earning_amount,
        ep.deduction_amount,
        ep.created_at AS payslip_created_at,
        ep.updated_at AS payslip_updated_at,

        CASE 
          WHEN ep.id IS NOT NULL THEN TRUE 
          ELSE FALSE 
        END AS payroll_finalized,

        eb.bank_name,
        eb.acc_number,
        ev.aadhaar,
        ev.pan,

        es.salary AS emp_salary,
        es.earning AS emp_earning,
        es.deduction AS emp_deduction,
        es.employeer_ctc AS emp_employeer_ctc

      FROM employees e
      LEFT JOIN branch b ON e.branch = b.id
      LEFT JOIN department d ON e.department = d.id
      LEFT JOIN designation de ON e.designation = de.id
      LEFT JOIN emp_bank_detail eb ON e.id = eb.emp_id
      LEFT JOIN emp_salary_detail es ON e.id = es.emp_id
      LEFT JOIN emp_verification_document ev ON e.id = ev.emp_id
      LEFT JOIN emp_payslip ep 
        ON e.id = ep.emp_id
       AND ep.payslip_for_month = ?
      WHERE e.company_id = ?
      ORDER BY e.updated_at DESC
    `;

    const employees = await sqlModel.customQuery(query, [
      baseUrl,
      month,
      company_id,
    ]);

    if (!employees.length) {
      return res.status(404).send({
        status: false,
        message: "No employees or payroll data found",
      });
    }

    /* ----------- DYNAMIC PAID DAYS LOGIC ----------- */
    const [year, monthNum] = month.split("-").map(Number);

    const finalData = [];

    for (const emp of employees) {
      let paidDays = emp.paid_days;

      // If payroll not finalized → calculate from attendance
      if (!emp.payroll_finalized) {
        paidDays = await calculatePresentDays(
          emp.emp_id,
          year,
          monthNum
        );
      }
console.log("Calculated paid days for emp_id", emp.emp_id, ":", paidDays);
      finalData.push({
        ...emp,
        paid_days: paidDays,
      });
    }

    return res.status(200).send({
      status: true,
      message: "Payroll data fetched successfully",
      data: finalData,
    });

  } catch (error) {
    console.error("Error fetching payroll:", error);
    res.status(500).send({
      status: false,
      error: error.message,
    });
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
      
//       // Check if BASE_URL is set
//       const baseUrl = process.env.BASE_URL;
//       if (!baseUrl) {
//         return res.status(500).send({
//           status: false,
//           message: "Base URL is not configured properly",
//         });
//       }
  
//       // SQL query to fetch all employees with optional payroll data
//       // let query = `
//       //   SELECT
//       //     e.id AS emp_id,
//       //     e.company_id,
//       //     e.name AS name,
//       //     e.email,
//       //     e.joining_date,
//       //     e.mobile,
//       //     e.employee_id,
//       //     b.name AS branch,
//       //     d.name AS department,
//       //     de.name AS designation,
//       //     CASE
//       //       WHEN e.image IS NOT NULL THEN CONCAT(?, e.image)
//       //       ELSE NULL
//       //     END AS image,
//       //     ep.payslip_for_month AS payslip_for_month,
//       //     ep.salary AS monthly_salary,
//       //     ep.earning,
//       //     ep.deduction,
//       //     ep.employeer_ctc,
//       //     ep.net_pay,
//       //     ep.paid_days,
//       //     ep.earning_amount,
//       //     ep.deduction_amount,
//       //     eb.bank_name,
//       //     eb.acc_number,
//       //     ev.aadhaar,
//       //     ev.pan,
//       //     es.salary AS emp_salary,
//       //     es.earning as emp_earning,
//       //     es.deduction as emp_deduction,
//       //     es.employeer_ctc as emp_employeer_ctc,
//       //     ep.created_at AS payslip_created_at,
//       //     ep.updated_at AS payslip_updated_at,
//       //     CASE 
//       //               WHEN ep.id IS NOT NULL THEN TRUE 
//       //               ELSE FALSE 
//       //           END AS payroll_finalized
//       //   FROM employees e
//       //   LEFT JOIN branch b ON e.branch = b.id
//       //   LEFT JOIN department d ON e.department = d.id
//       //   LEFT JOIN designation de ON e.designation = de.id
//       //   LEFT JOIN emp_bank_detail eb ON e.id = eb.emp_id
//       //   LEFT JOIN emp_salary_detail es ON e.id = es.emp_id
//       //   LEFT JOIN emp_verification_document ev ON e.id = ev.emp_id
//       //   LEFT JOIN emp_payslip ep ON e.id = ep.emp_id
//       // `;
  
//       // const values = [baseUrl];
  
//       // // Add company filter
//       // query += " WHERE e.company_id = ?";
//       // values.push(company_id);
  
//       // // Add month filter (optional)
//       // if (month) {
//       //   query += " AND (ep.payslip_for_month = ? OR ep.payslip_for_month IS NULL)";
//       //   values.push(month);
//       // }

//       let query = `
//   SELECT
//     e.id AS emp_id,
//     e.company_id,
//     e.name,
//     e.email,
//     e.joining_date,
//     e.mobile,
//     e.employee_id,
//     b.name AS branch,
//     d.name AS department,
//     de.name AS designation,
//     CASE
//       WHEN e.image IS NOT NULL AND e.image != '' THEN CONCAT(?, e.image)
//       ELSE NULL
//     END AS image,

//     ep.payslip_for_month,
//     ep.salary AS monthly_salary,
//     ep.earning,
//     ep.deduction,
//     ep.employeer_ctc,
//     ep.net_pay,
//     ep.paid_days,
//     ep.earning_amount,
//     ep.deduction_amount,
//     ep.created_at AS payslip_created_at,
//     ep.updated_at AS payslip_updated_at,

//     CASE 
//       WHEN ep.id IS NOT NULL THEN TRUE 
//       ELSE FALSE 
//     END AS payroll_finalized,

//     eb.bank_name,
//     eb.acc_number,
//     ev.aadhaar,
//     ev.pan,

//     es.salary AS emp_salary,
//     es.earning AS emp_earning,
//     es.deduction AS emp_deduction,
//     es.employeer_ctc AS emp_employeer_ctc

//   FROM employees e
//   LEFT JOIN branch b ON e.branch = b.id
//   LEFT JOIN department d ON e.department = d.id
//   LEFT JOIN designation de ON e.designation = de.id
//   LEFT JOIN emp_bank_detail eb ON e.id = eb.emp_id
//   LEFT JOIN emp_salary_detail es ON e.id = es.emp_id
//   LEFT JOIN emp_verification_document ev ON e.id = ev.emp_id
//   LEFT JOIN emp_payslip ep 
//     ON e.id = ep.emp_id
//     ${month ? "AND ep.payslip_for_month = ?" : ""}
//   WHERE e.company_id = ?
//   ORDER BY e.updated_at DESC
// `;

// const values = [baseUrl];
// if (month) values.push(month);
// values.push(company_id);

  
//       // Execute the query
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
// };
  

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
  
  
  
  
  
  
  
  