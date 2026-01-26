const sqlModel = require("../../config/db");

function formatPayslipMonth(value) {
  if (!value) return "";

  const [year, month] = value.split("-");
  const date = new Date(year, month - 1, 1);

  return date.toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

exports.getPayroll = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(200).send({
        status: false,
        message: "Token is required",
      });
    }

    const [employee] = await sqlModel.select(
      "employees",
      {},
      { api_token: token }
    );

    if (!employee) {
      return res.status(200).send({
        status: false,
        message: "Employee not found",
      });
    }

  
  const payrolls = await sqlModel.customQuery(`
  SELECT 
    ep.id,
    ep.payslip_for_month, 
    ep.net_pay, 
    ep.paid_days,
    ep.created_at,
    ep.payslip_url,
    CASE 
      WHEN ep.net_pay IS NOT NULL AND ep.net_pay != '' THEN 'Paid'
      ELSE 'Unpaid'
    END AS paid_status,
    ebd.bank_name,
    ebd.acc_number
  FROM emp_payslip ep
  LEFT JOIN emp_bank_detail ebd ON ep.emp_id = ebd.emp_id
  WHERE ep.emp_id = ?
  ORDER BY ep.payslip_for_month DESC
`, [employee.id]);

const formattedPayrolls = payrolls.map(p => ({
  ...p,
  payslip_for_month_label: formatPayslipMonth(p.payslip_for_month)
}));

return res.status(200).send({
  status: true,
  message: "Payroll fetched successfully",
  data: formattedPayrolls,
});

  } catch (error) {
    console.error("Error fetching payroll:", error);
    return res.status(500).send({
      status: false,
      message: "Something went wrong",
    });
  }
};


const buildS3Url = (key) => {
  if (!key) return null;
  return `https://${process.env.AWS_S3_BUCKET}.s3.${
    process.env.AWS_REGION || "ap-south-1"
  }.amazonaws.com/${key}`;
};

exports.getPayrollDetail = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const { payslip_for_month } = req.params;

    if (!token) {
      return res.status(200).send({
        status: false,
        message: "Token is required",
      });
    }

    const [employee] = await sqlModel.select(
      "employees",
      {},
      { api_token: token }
    );

    if (!employee) {
      return res.status(200).send({
        status: false,
        message: "Employee not found",
      });
    }

    const payrollDetail = await sqlModel.customQuery(`
      SELECT
        ep.payslip_for_month,
        ep.net_pay,
        ep.paid_days,
        ep.created_at,
        ep.payslip_url,
        e.name,
        e.employee_id,
        b.name AS branch_name,
        d.name AS department_name,
        de.name AS designation_name,
        evd.aadhaar,
        evd.pan,
        ebd.bank_name,
        ebd.acc_number
      FROM emp_payslip ep
      JOIN employees e ON ep.emp_id = e.id
      LEFT JOIN branch b ON e.branch = b.id
      LEFT JOIN department d ON e.department = d.id
      LEFT JOIN designation de ON e.designation = de.id
      LEFT JOIN emp_verification_document evd ON e.id = evd.emp_id
      LEFT JOIN emp_bank_detail ebd ON e.id = ebd.emp_id
      WHERE ep.emp_id = ?
        AND ep.payslip_for_month = ?
      LIMIT 1
    `, [employee.id, payslip_for_month]);

    if (!payrollDetail || payrollDetail.length === 0) {
      return res.status(404).send({
        status: false,
        message: "Payslip not found",
      });
    }

    const data = payrollDetail[0];

    return res.status(200).send({
      status: true,
      message: "Payroll detail fetched successfully",
      data: {
        ...data,
        payslip_url: buildS3Url(data.payslip_url), // 🔥 HERE
        payslip_for_month_label: formatPayslipMonth(data.payslip_for_month),
      },
    });

  } catch (error) {
    console.error("Error fetching payroll detail:", error);
    return res.status(500).send({
      status: false,
      message: "Something went wrong",
    });
  }
};


