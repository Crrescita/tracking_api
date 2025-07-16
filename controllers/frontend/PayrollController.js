const sqlModel = require("../../config/db");


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
        payslip_for_month, 
        earning_amount, 
        paid_days,
        CASE 
          WHEN net_pay IS NOT NULL AND net_pay != '' THEN 'Paid'
          ELSE 'Unpaid'
        END AS paid_status
      FROM emp_payslip
      WHERE emp_id = ?
      ORDER BY STR_TO_DATE(payslip_for_month, '%M-%Y') DESC
    `, [employee.id]);

    return res.status(200).send({
      status: true,
      message: "Payroll fetched successfully",
      data: payrolls,
    });
  } catch (error) {
    console.error("Error fetching payroll:", error);
    return res.status(500).send({
      status: false,
      message: "Something went wrong",
    });
  }
};

