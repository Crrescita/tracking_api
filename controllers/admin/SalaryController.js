const sqlModel = require("../../config/db");
const generatePayslipPdf = require("../../utils/generatePayslipPdf");
const fs = require("fs");
const path = require("path");
const { uploadLocalFileToS3 } = require("../../config/s3");
const { toWords } = require("number-to-words");

function convertNumberToWords(amount) {
  const words = toWords(Math.floor(amount));
  return words.charAt(0).toUpperCase() + words.slice(1);
}


exports.getSalaryDetail = async (req, res, next) => {
  try {
    const whereClause = {};
    for (const key in req.query) {
      if (req.query.hasOwnProperty(key)) {
        whereClause[key] = req.query[key];
      }
    }
  
    const data = await sqlModel.select("emp_salary_detail", {}, whereClause);

    if (data.error) {
      return res.status(500).send(data);
    }

    if (data.length === 0) {
      return res.status(200).send({ status: false, message: "No data found" });
    }
    
    res.status(200).send({ status: true, data: data });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};

exports.insertSalaryDetail = async (req, res, next) => {
  try {
    const id = req.params.id || "";
    const { emp_id, salary, earning ,deduction,employeer_ctc} = req.body;

    const validation = validateFields({
      emp_id,
      salary,
      earning,
    });

    if (!validation.valid) {
      return res.status(400).send({
        status: false,
        message: validation.message,
        statusCode: 1,
      });
    }

    const insert = {
      company_id: req.user.id,
      emp_id,
      salary,
      earning,
      deduction,
      employeer_ctc
    };

    if (id) {
      const salaryRecord = await sqlModel.select(
        "emp_salary_detail",
        {},
        {
          emp_id: id,
        }
      );

      if (salaryRecord.length === 0) {
        insert.created_at = getCurrentDateTime();
        const saveData = await sqlModel.insert("emp_salary_detail", insert);

        if (saveData.error) {
          return res.status(200).send(saveData);
        } else {
          return res.status(200).send({ status: true, message: "Data Saved" });
        }
      } else {
        insert.updated_at = getCurrentDateTime();
        const saveData = await sqlModel.update("emp_salary_detail", insert, {
          emp_id: id,
        });

        if (saveData.error) {
          return res.status(200).send(saveData);
        } else {
          return res
            .status(200)
            .send({ status: true, message: "Data Updated" });
        }
      }
    }
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};

exports.getSalaryPayslip = async (req, res, next) => {
  try {
    const whereClause = {};
    for (const key in req.query) {
      if (req.query.hasOwnProperty(key)) {
        whereClause[key] = req.query[key];
      }
    }
  
    const data = await sqlModel.select("emp_payslip", {}, whereClause);

    if (data.error) {
      return res.status(500).send(data);
    }

    if (data.length === 0) {
      return res.status(200).send({ status: false, message: "No data found" });
    }
    
    res.status(200).send({ status: true, data: data });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};

// exports.insertSalaryPayslip = async (req, res, next) => {
//   try {
//     const { emp_id, payslip_for_month,net_pay, paid_days, salary, earning,earning_amount,deduction_amount, deduction,employeer_ctc } = req.body;

//     // Validate fields
//     const validation = validateFields({
//       payslip_for_month,
//       net_pay,
//       paid_days,
//       emp_id,
//       salary,
//       earning_amount,
//       earning,
//     });

//     if (!validation.valid) {
//       return res.status(400).send({
//         status: false,
//         message: validation.message,
//         statusCode: 1,
//       });
//     }

//     const insert = {
//       company_id: req.user.id,
//       emp_id,
//       net_pay,
//       paid_days,
//       payslip_for_month,
//       salary,
//       earning,
//       earning_amount,
//       deduction_amount,
//       deduction,
//       employeer_ctc
//     };

  
//     const existingRecord = await sqlModel.select(
//       "emp_payslip",
//       {}, 
//       {
//         emp_id,
//         payslip_for_month,
//       }
//     );

   
//     const advanceDeduction = deduction.find((item) => item.name === "Advance");
//     if (advanceDeduction && advanceDeduction.amount > 0) {
//       const adjustmentAmount = advanceDeduction.amount;

     
//       const advances = await sqlModel.customQuery(`
//         SELECT * 
//         FROM emp_advances_detail 
//         WHERE emp_id = ? 
//           AND status = 'active' 
//           AND CAST(remaining_balance AS DECIMAL(10, 2)) > 0
//       `, [emp_id]);

//       if (advances.error) {
//         return res.status(500).send({ status: false, error: advances.error });
//       }

//       if (advances.length > 0) {
//         let remainingAdjustment = adjustmentAmount;
//         const adjustmentDate = getCurrentDateTime();

       
//         for (const advance of advances) {
//           if (remainingAdjustment <= 0) break;

//           const adjustment = Math.min(remainingAdjustment, advance.remaining_balance);
//           const newBalance = advance.remaining_balance - adjustment;

          
//           const updateResult = await sqlModel.update(
//             "emp_advances_detail",
//             { remaining_balance: newBalance },
//             { id: advance.id }
//           );

//           if (updateResult.error) {
//             return res.status(500).send(updateResult);
//           }

        
//           const adjustmentData = {
//             emp_id,
//             company_id: req.user.id,
//             advance_id: advance.id,
//             adjustment_amount: adjustment.toFixed(2),
//             adjustment_date: adjustmentDate,
//             notes: `Adjusted during payslip generation for ${payslip_for_month}`,
//             created_at: adjustmentDate,
//             updated_at: adjustmentDate,
//           };

//           const insertAdjustmentResult = await sqlModel.insert("advance_adjustments", adjustmentData);

//           if (insertAdjustmentResult.error) {
//             return res.status(500).send(insertAdjustmentResult);
//           }

//           remainingAdjustment -= adjustment;
//         }

//         // Check if any adjustment amount remains unallocated
//         if (remainingAdjustment > 0) {
//           return res.status(400).send({
//             status: false,
//             message: `Advance adjustment amount (${adjustmentAmount}) exceeds total remaining balance.`,
//           });
//         }
//       } else {
//         return res.status(404).send({
//           status: false,
//           message: "No open advances found for this employee.",
//         });
//       }
//     }

//     // Insert or update payslip record
//     if (existingRecord.length > 0) {
//       insert.updated_at = getCurrentDateTime();
//       const updateData = await sqlModel.update(
//         "emp_payslip",
//         insert,
//         {
//           emp_id,
//           payslip_for_month,
//         }
//       );

//       if (updateData.error) {
//         return res.status(500).send(updateData);
//       } else {
//         return res.status(200).send({ status: true, message: "Data Updated" });
//       }
//     } else {
//       insert.created_at = getCurrentDateTime();
//       const saveData = await sqlModel.insert("emp_payslip", insert);

//       if (saveData.error) {
//         return res.status(500).send(saveData);
//       } else {
//         return res.status(200).send({ status: true, message: "Data Saved" });
//       }
//     }
//   } catch (error) {
//     res.status(500).send({ status: false, error: error.message });
//   }
// };


function formatPayslipMonth(value) {
  // expects YYYY-MM
  if (!value) return "";

  const [year, month] = value.split("-");
  const date = new Date(year, month - 1, 1);

  return date.toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

exports.insertSalaryPayslip = async (req, res, next) => {
  try {
    const { emp_id, payslip_for_month, net_pay, paid_days, salary, earning, earning_amount, deduction_amount, deduction, employeer_ctc } = req.body;

    // Validate fields
    const validation = validateFields({
      payslip_for_month,
      net_pay,
      paid_days,
      emp_id,
      salary,
      earning_amount,
      earning,
    });

    if (!validation.valid) {
      return res.status(400).send({
        status: false,
        message: validation.message,
        statusCode: 1,
      });
    }

  
    let parsedDeduction;
    try {
      parsedDeduction = typeof deduction === "string" ? JSON.parse(deduction) : deduction;
    } catch (error) {
      return res.status(400).send({ status: false, message: "Invalid JSON format for deduction", statusCode: 1 });
    }

    const insert = {
      company_id: req.user.id,
      emp_id,
      net_pay,
      paid_days,
      payslip_for_month,
      salary,
      earning: earning,
      earning_amount,
      deduction_amount,
      deduction: JSON.stringify(parsedDeduction),
      employeer_ctc: employeer_ctc,
    };

    const existingRecord = await sqlModel.select("emp_payslip", {}, { emp_id, payslip_for_month });


    const advanceDeduction = parsedDeduction.find((item) => item.name === "Advance");
    if (advanceDeduction && advanceDeduction.amount > 0) {
      const adjustmentAmount = advanceDeduction.amount;

      // Fetch active advances
      const advances = await sqlModel.customQuery(`
        SELECT * FROM emp_advances_detail 
        WHERE emp_id = ? AND status = 'active' AND CAST(remaining_balance AS DECIMAL(10, 2)) > 0
      `, [emp_id]);

      if (advances.error) {
        return res.status(500).send({ status: false, error: advances.error });
      }

      if (advances.length > 0) {
        let remainingAdjustment = adjustmentAmount;
        const adjustmentDate = getCurrentDateTime();

        for (const advance of advances) {
          if (remainingAdjustment <= 0) break;

          const adjustment = Math.min(remainingAdjustment, advance.remaining_balance);
          const newBalance = advance.remaining_balance - adjustment;


          const updateResult = await sqlModel.update("emp_advances_detail", { remaining_balance: newBalance }, { id: advance.id });

          if (updateResult.error) {
            return res.status(500).send(updateResult);
          }

          const adjustmentData = {
            emp_id,
            company_id: req.user.id,
            advance_id: advance.id,
            adjustment_amount: adjustment.toFixed(2),
            adjustment_date: adjustmentDate,
            notes: `Adjusted during payslip generation for ${payslip_for_month}`,
            created_at: adjustmentDate,
            updated_at: adjustmentDate,
          };

          const insertAdjustmentResult = await sqlModel.insert("advance_adjustments", adjustmentData);
          if (insertAdjustmentResult.error) {
            return res.status(500).send(insertAdjustmentResult);
          }

          remainingAdjustment -= adjustment;
        }

     
        if (remainingAdjustment > 0) {
          return res.status(400).send({
            status: false,
            message: `Advance adjustment amount (${adjustmentAmount}) exceeds total remaining balance.`,
          });
        }
      } else {
        return res.status(404).send({
          status: false,
          message: "No open advances found for this employee.",
        });
      }
    }

  
    insert.updated_at = getCurrentDateTime();
    insert.created_at = insert.created_at || getCurrentDateTime();

    const saveData = await sqlModel.customQuery(`
      INSERT INTO emp_payslip (company_id, emp_id, net_pay, paid_days, payslip_for_month, salary, earning, earning_amount, deduction_amount, deduction, employeer_ctc, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        net_pay = VALUES(net_pay), 
        paid_days = VALUES(paid_days), 
        salary = VALUES(salary), 
        earning = VALUES(earning), 
        earning_amount = VALUES(earning_amount), 
        deduction_amount = VALUES(deduction_amount), 
        deduction = VALUES(deduction), 
        employeer_ctc = VALUES(employeer_ctc), 
        updated_at = VALUES(updated_at)
    `, [
      insert.company_id, insert.emp_id, insert.net_pay, insert.paid_days, insert.payslip_for_month,
      insert.salary, insert.earning, insert.earning_amount, insert.deduction_amount,
      insert.deduction, insert.employeer_ctc, insert.created_at, insert.updated_at
    ]);

    if (saveData.error) {
      return res.status(500).send(saveData);
    } else {


      const employeeQuery = `
  SELECT
    e.id,
    e.name,
    e.employee_id,
    e.joining_date,
    e.branch,
    b.name AS branch_name,
    d.name AS department_name,
    de.name AS designation_name,
    evd.aadhaar,
    evd.pan,
    ebd.bank_name,
    ebd.acc_number,
    esd.salary
  FROM employees e
  LEFT JOIN emp_salary_detail esd ON e.id = esd.emp_id
  LEFT JOIN emp_verification_document evd ON e.id = evd.emp_id
  LEFT JOIN emp_bank_detail ebd ON e.id = ebd.emp_id
  LEFT JOIN branch b ON e.branch = b.id
  LEFT JOIN department d ON e.department = d.id
  LEFT JOIN designation de ON e.designation = de.id
  WHERE e.id = ?
  LIMIT 1
`;

const empResult = await sqlModel.customQuery(employeeQuery, [emp_id]);

if (!empResult || empResult.length === 0) {
  return res.status(404).send({
    status: false,
    message: "Employee not found",
  });
}

const empData = empResult[0];


        /* ---------------- PDF GENERATION ---------------- */

         const earnings = typeof earning === "string" ? JSON.parse(earning) : earning;
    const deductions = typeof deduction === "string" ? JSON.parse(deduction) : deduction;
    const employerCTC = typeof employeer_ctc === "string"
      ? JSON.parse(employeer_ctc)
      : employeer_ctc;

    const pdfPath = await generatePayslipPdf({
      logoPath:'https://telindia.s3.ap-south-1.amazonaws.com/employee-verification/36/pan/1769406182776_documentFile2026-01-26T05-43-02.771Z-payslip-header.png',
      // logoPath: path.join(__dirname, "../../public/images/abpal-logo.png"),

      company: {
        name: "A B Pal Electricals (P) Limited",
        address: "1826, Bhagirath Palace, Chandni Chowk, Delhi-110006, India",
        phone: "+91 98914 98555, +9111 43 111 333",
        email: "contact@abpal.com",
        website: "www.abpal.com"
      },

      paidDays: paid_days,
      monthlySalary: empData.salary,

   monthLabel: formatPayslipMonth(payslip_for_month),

emp: {
  name: empData.name,
  code: empData.employee_id,
  department: empData.department_name,
  designation: empData.designation_name,
  location: empData.branch_name,
  joining: new Date(empData.joining_date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }),
  pan: empData.pan,
  aadhar: empData.aadhaar,
  bank: empData.bank_name,
  account: empData.acc_number,
},


      earnings,
      deductions,
      totalEarnings: earning_amount,
      totalDeductions: deduction_amount,

      netPay: net_pay,
      netPayWords: convertNumberToWords(net_pay),

      employerCTC,
      ctcWords: convertNumberToWords(employerCTC?.totalctc || 0)
    });

    /* ---------------- UPLOAD TO S3 ---------------- */
    const keyPrefix = `payslip/${emp_id}/${payslip_for_month}`;
    const { key } = await uploadLocalFileToS3(pdfPath, keyPrefix);
    fs.unlinkSync(pdfPath);

    await sqlModel.update(
  "emp_payslip",
  {
    payslip_url: key, 
    updated_at: getCurrentDateTime()
  },
  {
    emp_id,
    payslip_for_month
  }
);

    return res.status(200).send({
      status: true,
      message: "Payslip saved, PDF generated & uploaded",
      s3_key: key
    });
    
      // return res.status(200).send({ status: true, message: "Data Saved or Updated" });
    }
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};



exports.getSalarySettings = async (req, res, next) => {
  try {
    const id = req.params?.id || '';

    const whereClause = {};
    for (const key in req.query) {
      if (req.query.hasOwnProperty(key)) {
        whereClause[key] = req.query[key];
      }
    }
    const data = await sqlModel.select("salary_setting", {},{company_id:req.user.id} );

    if (data.error) {
      return res.status(500).send(data);
    }

    if (data.length === 0) {
      return res.status(200).send({ status: false, message: "No data found" });
    }
    res.status(200).send({ status: true, data: data });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};

exports.insertSalarySettings = async (req, res, next)=>{
  try{
    const id = req.params.id || "";
    const {name , type, formula, status} = req.body

    const validation = validateFields({
      name,
      type,
      status,
    });

    if (!validation.valid) {
      return res.status(400).send({
        status: false,
        message: validation.message,
        statusCode: 1,
      });
    }

    const insert = {
      company_id: req.user.id,
      name,
      type,
      formula,
      status,
    };
    if(id){
      const records = await sqlModel.select("salary_setting", ["name"], {
        id,
      });
      if (records.error || records.length === 0) {
        return res
          .status(200)
          .send({ status: false, message: "Data not found" });
      }

      insert.updated_at = getCurrentDateTime();
      const saveData = await sqlModel.update("salary_setting", insert, { id });

      if (saveData.error) {
        return res.status(200).send(saveData);
      } else {
        return res.status(200).send({ status: true, message: "Data Updated" });
      }
    }else{
      insert.created_at = getCurrentDateTime();
      const saveData = await sqlModel.insert("salary_setting", insert);

      if (saveData.error) {
        return res.status(200).send(saveData);
      } else {
        return res.status(200).send({ status: true, message: "Data Saved" });
      }
    }

  }catch(error){
    res.status(500).send({ status: false, error: error.message });
  }
}


exports.deleteSalarySettings = async (req, res, next) => {
  try {
    let id = req.params.id;

    const SalarySettingsRecord = await sqlModel.select("salary_setting", {}, { id });

    if (SalarySettingsRecord.error || SalarySettingsRecord.length === 0) {
      return res.status(200).send({ status: false, message: "Data not found" });
    }

    let result = await sqlModel.delete("salary_setting", { id: id });

    if (!result.error) {
      res.status(200).send({ status: true, message: "Record deleted" });
    } else {
      res.status(200).send(result);
    }
  } catch (error) {
    res.status(200).send({ status: false, error: error.message });
  }
};

exports.deleteMultipleSalarySettings = async (req, res, next) => {
  try {
    const ids = req.body.ids;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).send({ status: false, message: "Invalid input" });
    }

    const results = await Promise.all(
      ids.map((id) => sqlModel.delete("salary_setting", { id }))
    );

    const errors = results.filter((result) => result.error);
    if (errors.length > 0) {
      return res.status(200).send({
        status: false,
        message: "Some records could not be deleted",
        errors,
      });
    } else {
      return res.status(200).send({ status: true, message: "Records deleted" });
    }
  } catch (error) {
    return res.status(500).send({ status: false, error: error.message });
  }
};



