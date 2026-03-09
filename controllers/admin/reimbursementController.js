const sqlModel = require("../../config/db");

const buildS3Url = (key) => {
  if (!key) return null;
  return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || "ap-south-1"}.amazonaws.com/${key}`;
};

exports.getReimbursementDashboard = async (req, res) => {
  try {
    const { company_id } = req.query;

    if (!company_id) {
      return res.status(200).send({
        status: false,
        message: "company_id is required",
      });
    }

    // Total reimbursements
    const total = await sqlModel.customQuery(
      `SELECT COUNT(*) AS total FROM reimbursements WHERE company_id = ?`,
      [company_id]
    );

    // Pending
    const pending = await sqlModel.customQuery(
      `SELECT COUNT(*) AS pending FROM reimbursements 
       WHERE company_id = ? AND status = 'pending'`,
      [company_id]
    );

    // Approved
    const approved = await sqlModel.customQuery(
      `SELECT COUNT(*) AS approved FROM reimbursements 
       WHERE company_id = ? AND status = 'approved'`,
      [company_id]
    );

    // Rejected
    const rejected = await sqlModel.customQuery(
      `SELECT COUNT(*) AS rejected FROM reimbursements 
       WHERE company_id = ? AND status = 'rejected'`,
      [company_id]
    );

    // Total reimbursed amount
    const totalAmount = await sqlModel.customQuery(
      `SELECT IFNULL(SUM(amount),0) AS total_amount
       FROM reimbursements
       WHERE company_id = ? AND status = 'approved'`,
      [company_id]
    );

    /* -------- Recent 5 reimbursements -------- */

    const query = `
      SELECT 
        r.id,
        r.amount,
        r.status,
        r.applied_date,
        r.created_at,
        rt.name AS reimbursement_type,
        e.name AS employee_name,
        CASE
          WHEN e.image IS NOT NULL THEN CONCAT(?, e.image)
          ELSE e.image
        END AS image,
        de.name AS designation_name,
        GROUP_CONCAT(ra.file_path) AS attachments
      FROM reimbursements r
      LEFT JOIN reimbursement_types rt 
        ON rt.id = r.reimbursement_type_id
      LEFT JOIN employees e
        ON e.id = r.emp_id
      LEFT JOIN reimbursement_attachments ra
        ON ra.reimbursement_id = r.id
      LEFT JOIN designation de 
        ON e.designation = de.id
      WHERE r.company_id = ?
      GROUP BY r.id
      ORDER BY r.created_at DESC
 
    `;

    const recent = await sqlModel.customQuery(query, [
      process.env.BASE_URL,
      company_id,
    ]);

    console.log("SQL:", query);

    const formattedRecent = recent.map(r => ({
      ...r,
      attachments: r.attachments
        ? r.attachments.split(",").map(file => buildS3Url(file))
        : [],
    }));

    return res.status(200).send({
      status: true,
      data: {
        total: total[0].total,
        pending: pending[0].pending,
        approved: approved[0].approved,
        rejected: rejected[0].rejected,
        total_amount: totalAmount[0].total_amount,
        recent_requests: formattedRecent,
      },
    });

  } catch (error) {
    console.error(error);
    return res.status(200).send({
      status: false,
      message: error.message,
    });
  }
};

exports.updateReimbursementStatus = async (req, res) => {
  try {
    const reimbursement_id = req.params.id;

    // const token = req.headers.authorization?.split(" ")[1];
    // if (!token)
    //   return res.status(200).send({
    //     status: false,
    //     message: "Token is required",
    //   });

    // const [admin] = await sqlModel.select(
    //   "employees",
    //   ["id", "company_id", "name"],
    //   { api_token: token }
    // );

    // if (!admin)
    //   return res.status(200).send({
    //     status: false,
    //     message: "Admin not found",
    //   });

    const { status } = req.body;

    if (!reimbursement_id || !status) {
      return res.status(200).send({
        status: false,
        message: "reimbursement_id and status required",
      });
    }

    if (!["approved", "rejected"].includes(status)) {
      return res.status(200).send({
        status: false,
        message: "Invalid status value",
      });
    }

    // Check reimbursement belongs to company
    const [reimbursement] = await sqlModel.select(
      "reimbursements",
      ["id", "company_id", "status"],
      { id: reimbursement_id }
    );

    if (!reimbursement)
      return res.status(200).send({
        status: false,
        message: "Reimbursement not found",
      });

    // if (reimbursement.company_id !== admin.company_id)
    //   return res.status(200).send({
    //     status: false,
    //     message: "Unauthorized access",
    //   });

    if (reimbursement.status !== "pending") {
      return res.status(200).send({
        status: false,
        message: "Only pending reimbursement can be updated",
      });
    }

    // Update status
    await sqlModel.update(
      "reimbursements",
      {
        status,
        // admin_remark: remark || null,
        updated_at: getCurrentDateTime(),
      },
      { id: reimbursement_id }
    );

    return res.status(200).send({
      status: true,
      message: `Reimbursement ${status} successfully`,
    });

  } catch (error) {

    console.error(error);

    return res.status(200).send({
      status: false,
      message: error.message,
    });

  }
};