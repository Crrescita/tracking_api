const sqlModel = require("../../config/db");
const { getCurrentDateTime } = require("../../config/datetime");
const path = require("path");
const fs = require("fs");
const { uploadLocalFileToS3, deleteFileFromS3 } = require("../../config/s3");


const getCurrentDate = () => {
    const currentDate = new Date();

    const options = {
        timeZone: "Asia/Kolkata",
    };
    const year = currentDate.toLocaleString("en-US", {
        year: "numeric",
        timeZone: "Asia/Kolkata",
    });
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
    const day = String(currentDate.getDate()).padStart(2, "0");

    const formattedDate = `${year}-${month}-${day}`;

    return formattedDate;
};

function fixMulterRelativePath(relPath) {
    if (relPath.startsWith("public/")) return relPath;
    if (relPath.startsWith("images/")) return "public/" + relPath;
    return relPath;
}

function buildLocalAbsolutePath(relPath) {
    if (relPath.startsWith("public/")) {
        return path.join(process.cwd(), relPath);
    }

    return path.join(process.cwd(), "public", relPath);
}


exports.getReimbursementTypes = async (req, res) => {
    try {

        const token = req.headers.authorization?.split(" ")[1];

        if (!token)
            return res.status(200).send({
                status: false,
                message: "Token is required"
            });

        const [user] = await sqlModel.select(
            "employees",
            ["id", "company_id"],
            { api_token: token }
        );

        if (!user)
            return res.status(200).send({
                status: false,
                message: "User not found"
            });

        const types = await sqlModel.select(
            "reimbursement_types",
            ["id", "name"],
            {
                company_id: user.company_id,
                is_active: 1
            }
        );

        return res.status(200).send({
            status: true,
            message: "Reimbursement types fetched successfully",
            data: types
        });

    } catch (error) {

        console.error(error);

        return res.status(200).send({
            status: false,
            message: error.message
        });

    }
};

exports.createReimbursementType = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token)
            return res.status(200).send({ status: false, message: "Token is required" });

        const [user] = await sqlModel.select(
            "employees",
            ["id", "company_id"],
            { api_token: token }
        );

        if (!user)
            return res.status(200).send({ status: false, message: "User not found" });

        if (!req.body.name)
            return res.status(200).send({ status: false, message: "Type name required" });

        const insert = {
            company_id: user.company_id,
            name: req.body.name,
            // description: req.body.description || null,
            is_active: 1,
            created_at: getCurrentDateTime(),
            updated_at: getCurrentDateTime(),
        };

        const result = await sqlModel.insert("reimbursement_types", insert);

        if (result.error)
            return res.status(200).send(result);

        return res.status(200).send({
            status: true,
            message: "Reimbursement type created",
            type_id: result.insertId,
        });
    } catch (error) {
        console.error(error);
        return res.status(200).send({ status: false, message: error.message });
    }
};

exports.createReimbursement = async (req, res) => {
    try {

        const token = req.headers.authorization?.split(" ")[1];

        const [user] = await sqlModel.select(
            "employees",
            ["id", "company_id"],
            { api_token: token }
        );

        if (!user)
            return res.status(200).send({ status: false, message: "User not found" });

        const insert = {
            emp_id: user.id,
            company_id: user.company_id,
            reimbursement_type_id: req.body.reimbursement_type_id,
            total_amount: req.body.total_amount || 0,
            status: "pending",
            applied_date: getCurrentDate(),
            created_at: getCurrentDateTime()
        };

        const result = await sqlModel.insert("reimbursements", insert);

        return res.status(200).send({
            status: true,
            reimbursement_id: result.insertId
        });

    } catch (err) {
        return res.status(200).send({ status: false, message: err.message });
    }
}

exports.addReimbursementAttachment = async (req, res) => {
    try {

        const token = req.headers.authorization?.split(" ")[1];

        if (!token) {
            return res.status(200).send({
                status: false,
                message: "Token required"
            });
        }

        const [user] = await sqlModel.select(
            "employees",
            ["id"],
            { api_token: token }
        );

        if (!user) {
            return res.status(200).send({
                status: false,
                message: "User not found"
            });
        }

        const { reimbursement_id, reimbursement_name, amount } = req.body;

        if (!reimbursement_id || !reimbursement_name || !amount) {
            return res.status(200).send({
                status: false,
                message: "reimbursement_id, reimbursement_name and amount required"
            });
        }

        // validate file
        if (!req.file) {
            return res.status(200).send({
                status: false,
                message: "File required"
            });
        }

        // check reimbursement exists
        const [reimbursement] = await sqlModel.select(
            "reimbursements",
            ["id"],
            { id: reimbursement_id }
        );

        if (!reimbursement) {
            return res.status(200).send({
                status: false,
                message: "Reimbursement not found"
            });
        }

        const localAbsolute = req.file.path;

        const keyPrefix = `reimbursement/${reimbursement_id}`;

        let newKey = "";

        try {

            const { key } = await uploadLocalFileToS3(localAbsolute, keyPrefix);

            newKey = key;

            // insert attachment
            const result = await sqlModel.insert(
                "reimbursement_attachments",
                {
                    reimbursement_id,
                    reimbursement_name,
                    amount,
                    file_path: newKey,
                    file_type: path.extname(localAbsolute).replace(".", ""),
                    created_at: getCurrentDateTime()
                }
            );

            // update total amount
            await sqlModel.customQuery(
                `UPDATE reimbursements
         SET total_amount = total_amount + ?
         WHERE id = ?`,
                [parseFloat(amount), reimbursement_id]
            );

            // delete local uploaded file
            if (fs.existsSync(localAbsolute)) {
                fs.unlinkSync(localAbsolute);
            }

            return res.status(200).send({
                status: true,
                message: "Attachment added successfully",
                attachment_id: result.insertId,
                file_url: `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || "ap-south-1"}.amazonaws.com/${newKey}`
            });

        } catch (uploadError) {

            console.error("S3 Upload Error:", uploadError);

            if (fs.existsSync(localAbsolute)) {
                fs.unlinkSync(localAbsolute);
            }

            return res.status(200).send({
                status: false,
                message: "File upload failed"
            });
        }

    } catch (error) {

        console.error("Controller Error:", error);

        return res.status(200).send({
            status: false,
            message: error.message
        });

    }
};

exports.deleteAttachment = async (req, res) => {
    try {

        const token = req.headers.authorization?.split(" ")[1];

        if (!token)
            return res.status(200).send({ status: false, message: "Token required" });

        const [user] = await sqlModel.select(
            "employees",
            ["id"],
            { api_token: token }
        );

        if (!user)
            return res.status(200).send({ status: false, message: "User not found" });

        const attachment_id = req.params.id;

        const [attachment] = await sqlModel.select(
            "reimbursement_attachments",
            ["id", "file_path", "reimbursement_id", "amount"],
            { id: attachment_id }
        );

        if (!attachment)
            return res.status(200).send({
                status: false,
                message: "Attachment not found"
            });

        // delete S3 file
        if (attachment.file_path) {
            await deleteFileFromS3(attachment.file_path);
        }

        // delete record
        await sqlModel.delete(
            "reimbursement_attachments",
            { id: attachment_id }
        );

        // recalculate total
        const [sum] = await sqlModel.customQuery(
            `SELECT SUM(amount) as total
       FROM reimbursement_attachments
       WHERE reimbursement_id = ?`,
            [attachment.reimbursement_id]
        );

        const total = sum.total || 0;

        await sqlModel.update(
            "reimbursements",
            {
                total_amount: total,
                updated_at: getCurrentDateTime()
            },
            { id: attachment.reimbursement_id }
        );

        return res.status(200).send({
            status: true,
            message: "Attachment deleted successfully"
        });

    } catch (error) {

        console.error(error);

        return res.status(200).send({
            status: false,
            message: error.message
        });

    }
};


exports.getReimbursements = async (req, res) => {
    try {

        const token = req.headers.authorization?.split(" ")[1];

        if (!token) {
            return res.status(200).send({
                status: false,
                message: "Token required"
            });
        }

        const [user] = await sqlModel.select(
            "employees",
            ["id"],
            { api_token: token }
        );

        if (!user) {
            return res.status(200).send({
                status: false,
                message: "User not found"
            });
        }

        let month = req.query.month;
        let year = req.query.year;

        // Support format: 03-2026
        if (req.query.month_year) {
            const parts = req.query.month_year.split("-");
            month = parts[0];
            year = parts[1];
        }

        // Validation: month without year not allowed
        if (month && !year) {
            return res.status(200).send({
                status: false,
                message: "Year is required when month is provided"
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        let whereClause = `WHERE r.emp_id = ?`;
        let params = [user.id];

        if (month && year) {
            whereClause += ` AND MONTH(r.applied_date) = ? AND YEAR(r.applied_date) = ?`;
            params.push(parseInt(month), parseInt(year));
        }

        const query = `
      SELECT
        r.id,
        r.total_amount,
        r.status,
        r.applied_date,
        rt.name AS reimbursement_type
      FROM reimbursements r
      LEFT JOIN reimbursement_types rt
        ON rt.id = r.reimbursement_type_id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `;

        params.push(limit, offset);

        const reimbursements = await sqlModel.customQuery(query, params);

        // count query
        let countQuery = `
      SELECT COUNT(*) as total
      FROM reimbursements r
      ${whereClause}
    `;

        const countResult = await sqlModel.customQuery(countQuery, params.slice(0, params.length - 2));

        const totalRecords = countResult[0]?.total || 0;

        return res.status(200).send({
            status: true,
            page,
            limit,
            total_records: totalRecords,
            total_pages: Math.ceil(totalRecords / limit),
            data: reimbursements
        });

    } catch (error) {

        console.error(error);

        return res.status(200).send({
            status: false,
            message: error.message
        });

    }
};


exports.getReimbursementDetails = async (req, res) => {
    try {

        const token = req.headers.authorization?.split(" ")[1];

        if (!token)
            return res.status(200).send({
                status: false,
                message: "Token required"
            });

        if (!req.query.month || !req.query.year) {
            return res.status(200).send({
                status: false,
                message: "month and year required"
            });
        }

        const [user] = await sqlModel.select(
            "employees",
            ["id"],
            { api_token: token }
        );

        if (!user)
            return res.status(200).send({
                status: false,
                message: "User not found"
            });

        const reimbursement_id = req.params.id;

        const [reimbursement] = await sqlModel.customQuery(
            `
SELECT
r.id,
r.total_amount,
r.status,
r.applied_date,
rt.name as reimbursement_type
FROM reimbursements r
LEFT JOIN reimbursement_types rt
ON rt.id=r.reimbursement_type_id
WHERE r.id=? AND r.emp_id=?
`,
            [reimbursement_id, user.id]
        );

        if (!reimbursement)
            return res.status(200).send({
                status: false,
                message: "Reimbursement not found"
            });

        const attachments = await sqlModel.select(
            "reimbursement_attachments",
            [
                "id",
                "reimbursement_name",
                "amount",
                "file_path",
                "file_type"
            ],
            { reimbursement_id }
        );

        reimbursement.attachments = attachments.map(a => ({
            id: a.id,
            reimbursement_name: a.reimbursement_name,
            amount: a.amount,
            file_type: a.file_type,
            file_url: `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || "ap-south-1"
                }.amazonaws.com/${a.file_path}`
        }));

        return res.status(200).send({
            status: true,
            data: reimbursement
        });

    } catch (error) {

        return res.status(200).send({
            status: false,
            message: error.message
        });

    }
};

exports.deleteReimbursement = async (req, res) => {
    try {

        const token = req.headers.authorization?.split(" ")[1];

        if (!token)
            return res.status(200).send({
                status: false,
                message: "Token required"
            });

        const [user] = await sqlModel.select(
            "employees",
            ["id"],
            { api_token: token }
        );

        if (!user)
            return res.status(200).send({
                status: false,
                message: "User not found"
            });

        const reimbursement_id = req.params.id;

        const [reimbursement] = await sqlModel.select(
            "reimbursements",
            ["id"],
            { id: reimbursement_id, emp_id: user.id }
        );

        if (!reimbursement)
            return res.status(200).send({
                status: false,
                message: "Reimbursement not found"
            });

        const attachments = await sqlModel.select(
            "reimbursement_attachments",
            ["file_path"],
            { reimbursement_id }
        );

        for (const file of attachments) {
            if (file.file_path) {
                await deleteFileFromS3(file.file_path);
            }
        }

        await sqlModel.delete(
            "reimbursement_attachments",
            { reimbursement_id }
        );

        await sqlModel.delete(
            "reimbursements",
            { id: reimbursement_id }
        );

        return res.status(200).send({
            status: true,
            message: "Reimbursement deleted successfully"
        });

    } catch (error) {

        return res.status(200).send({
            status: false,
            message: error.message
        });

    }
};

exports.updateReimbursement = async (req, res) => {
    try {

        const token = req.headers.authorization?.split(" ")[1];

        if (!token) {
            return res.status(200).json({
                status: false,
                message: "Token required"
            });
        }

        const [user] = await sqlModel.select(
            "employees",
            ["id", "company_id"],
            { api_token: token }
        );

        if (!user) {
            return res.status(200).json({
                status: false,
                message: "User not found"
            });
        }

        const reimbursement_id = req.params.id;

        const { reimbursement_type_id, total_amount } = req.body;

        if (!reimbursement_type_id && !total_amount) {
            return res.status(200).json({
                status: false,
                message: "Nothing to update"
            });
        }

        // check reimbursement exists
        const [reimbursement] = await sqlModel.select(
            "reimbursements",
            ["id", "emp_id"],
            { id: reimbursement_id }
        );

        if (!reimbursement) {
            return res.status(200).json({
                status: false,
                message: "Reimbursement not found"
            });
        }

        // check ownership
        if (reimbursement.emp_id !== user.id) {
            return res.status(200).json({
                status: false,
                message: "Unauthorized reimbursement access"
            });
        }

        const updateData = {
            updated_at: getCurrentDateTime()
        };

        if (reimbursement_type_id) {
            updateData.reimbursement_type_id = reimbursement_type_id;
        }

        if (total_amount) {
            updateData.total_amount = total_amount;
        }

        await sqlModel.update(
            "reimbursements",
            updateData,
            { id: reimbursement_id }
        );

        return res.status(200).json({
            status: true,
            message: "Reimbursement updated successfully"
        });

    } catch (error) {

        console.error(error);

        return res.status(200).json({
            status: false,
            message: error.message
        });

    }
};