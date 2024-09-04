const sqlModel = require("../../config/db");

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

exports.createLeaveType = async (req, res, next) => {
  try {
    const id = req.params.id || "";
    const { name, company_id, total_leave_days, status } = req.body;

    let slug = "";
    if (name) {
      slug = createSlug(name);
    }
    const insert = { name, company_id, slug, total_leave_days, status };

    let previousLeaveDays = 0;

    if (id) {
      const leaveTypeRecord = await sqlModel.select(
        "leave_type",
        ["name", "total_leave_days"],
        { id }
      );
      if (leaveTypeRecord.error || leaveTypeRecord.length === 0) {
        return res
          .status(200)
          .send({ status: false, message: "Leave Type not found" });
      }

      previousLeaveDays = leaveTypeRecord[0].total_leave_days || 0;

      insert.updated_at = getCurrentDateTime();
      const saveData = await sqlModel.update("leave_type", insert, { id });

      if (saveData.error) {
        return res.status(200).send(saveData);
      } else {
        const diff = total_leave_days - previousLeaveDays;
        await sqlModel.customQuery(
          `UPDATE leave_settings SET remaining_leavedays = remaining_leavedays - ? WHERE company_id = ?`,
          [diff, company_id]
        );

        return res.status(200).send({ status: true, message: "Data Updated" });
      }
    } else {
      const existingSlug = await sqlModel.select("leave_type", ["id"], {
        slug,
      });

      if (existingSlug.length > 0) {
        return res
          .status(400)
          .send({ status: false, message: "Leave Type already exists" });
      }
      insert.created_at = getCurrentDateTime();
      const saveData = await sqlModel.insert("leave_type", insert);

      if (saveData.error) {
        return res.status(200).send(saveData);
      } else {
        await sqlModel.customQuery(
          `UPDATE leave_settings SET remaining_leavedays = remaining_leavedays - ? WHERE company_id = ?`,
          [total_leave_days, company_id]
        );

        return res.status(200).send({ status: true, message: "Data Saved" });
      }
    }
  } catch (err) {
    return res.status(500).send({ status: false, error: err.message });
  }
};

exports.getLeaveType = async (req, res, next) => {
  try {
    const whereClause = {};
    for (const key in req.query) {
      if (req.query.hasOwnProperty(key)) {
        whereClause[key] = req.query[key];
      }
    }

    const data = await sqlModel.select("leave_type", {}, whereClause);

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

// exports.deleteLeaveType = async (req, res, next) => {
//   try {
//     let id = req.params.id;

//     const leaveTypeRecord = await sqlModel.select("leave_type", {}, { id });

//     if (leaveTypeRecord.error || leaveTypeRecord.length === 0) {
//       return res.status(200).send({ status: false, message: "Data not found" });
//     }

//     let result = await sqlModel.delete("leave_type", { id: id });

//     if (!result.error) {
//       res.status(200).send({ status: true, message: "Record deleted" });
//     } else {
//       res.status(200).send(result);
//     }
//   } catch (error) {
//     res.status(200).send({ status: false, error: error.message });
//   }
// };

exports.deleteLeaveType = async (req, res, next) => {
  try {
    const id = req.params.id;

    const leaveTypeRecord = await sqlModel.select(
      "leave_type",
      ["total_leave_days", "company_id"],
      { id }
    );

    if (leaveTypeRecord.error || leaveTypeRecord.length === 0) {
      return res.status(404).send({ status: false, message: "Data not found" });
    }

    const { total_leave_days, company_id } = leaveTypeRecord[0];

    // Delete the leave type
    const result = await sqlModel.delete("leave_type", { id });
    console.log(total_leave_days);
    if (!result.error) {
      // Update remaining_leavedays in leave_settings
      await sqlModel.customQuery(
        `UPDATE leave_settings SET remaining_leavedays = remaining_leavedays + ? WHERE company_id = ?`,
        [total_leave_days, company_id]
      );

      res.status(200).send({ status: true, message: "Record deleted" });
    } else {
      res.status(200).send(result);
    }
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};

// exports.deleteMultipleLeaveType = async (req, res, next) => {
//   try {
//     const ids = req.body.ids;

//     if (!ids || !Array.isArray(ids) || ids.length === 0) {
//       return res.status(400).send({ status: false, message: "Invalid input" });
//     }

//     const results = await Promise.all(
//       ids.map((id) => sqlModel.delete("leave_type", { id }))
//     );

//     const errors = results.filter((result) => result.error);
//     if (errors.length > 0) {
//       return res.status(200).send({
//         status: false,
//         message: "Some records could not be deleted",
//         errors,
//       });
//     } else {
//       return res.status(200).send({ status: true, message: "Records deleted" });
//     }
//   } catch (error) {
//     return res.status(500).send({ status: false, error: error.message });
//   }
// };

exports.deleteMultipleLeaveType = async (req, res, next) => {
  try {
    const ids = req.body.ids;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).send({ status: false, message: "Invalid input" });
    }

    // Fetch the total_leave_days for all leave types to be deleted
    const leaveTypeRecords = await sqlModel.select(
      "leave_type",
      ["total_leave_days", "company_id"],
      { id: ids }
    );

    if (leaveTypeRecords.error) {
      return res
        .status(500)
        .send({ status: false, error: leaveTypeRecords.error.message });
    }

    const companyId =
      leaveTypeRecords.length > 0 ? leaveTypeRecords[0].company_id : null;
    const totalLeaveDaysToBeAdded = leaveTypeRecords.reduce(
      (sum, record) => sum + (record.total_leave_days || 0),
      0
    );

    // Delete multiple leave types
    const results = await Promise.all(
      ids.map((id) => sqlModel.delete("leave_type", { id }))
    );

    const errors = results.filter((result) => result.error);
    if (errors.length > 0) {
      return res.status(200).send({
        status: false,
        message: "Some records could not be deleted",
        errors,
      });
    }

    // Update remaining_leavedays in leave_settings
    if (companyId) {
      await sqlModel.customQuery(
        `UPDATE leave_settings SET remaining_leavedays = remaining_leavedays + ? WHERE company_id = ?`,
        [totalLeaveDaysToBeAdded, companyId]
      );
    }

    return res.status(200).send({ status: true, message: "Records deleted" });
  } catch (error) {
    return res.status(500).send({ status: false, error: error.message });
  }
};

// leave request
exports.getLeaveRequest = async (req, res, next) => {
  try {
    const { company_id } = req.query;

    if (!company_id) {
      return res.status(400).send({
        status: false,
        message: "Company ID is required",
      });
    }

    const currentDate = new Date().toISOString().split("T")[0];

    const updateExpiredQuery = `
        UPDATE leave_request 
        SET status = 'Expired' 
        WHERE company_id = ? 
        AND status = 'Pending' 
        AND from_date <= ?
      `;
    await sqlModel.customQuery(updateExpiredQuery, [company_id, currentDate]);

    const query = `
        SELECT 
          lr.leave_type, 
          lr.from_date, 
          lr.to_date, 
          lr.status, 
          lr.reason, 
          lr.created_at, 
          lr.id, 
          e.name, 
          e.designation, 
          CASE 
            WHEN e.image IS NOT NULL THEN CONCAT(?, e.image) 
          END AS image
        FROM leave_request lr 
        LEFT JOIN employees e 
        ON lr.emp_id = e.id 
        AND lr.company_id = e.company_id 
        WHERE lr.company_id = ? 
        AND lr.status = 'Pending'
      `;

    const values = [process.env.BASE_URL, company_id];
    const data = await sqlModel.customQuery(query, values);

    if (data.error) {
      return res.status(500).send(data);
    }

    if (data.length === 0) {
      return res.status(200).send({ status: false, message: "No data found" });
    }

    res.status(200).send({ status: true, data: data });
  } catch (error) {
    return res.status(500).send({ status: false, error: error.message });
  }
};

exports.createLeaveRequest = async (req, res, next) => {
  try {
    const id = req.params.id || "";
    const insert = { ...req.body };

    if (id) {
      const leaveRecord = await sqlModel.select("leave_request", ["id"], {
        id,
      });
      if (leaveRecord.error || leaveRecord.length === 0) {
        return res
          .status(200)
          .send({ status: false, message: "leave not found" });
      }

      insert.updated_at = getCurrentDateTime();
      const saveData = await sqlModel.update("leave_request", insert, {
        id,
      });

      if (saveData.error) {
        return res.status(200).send(saveData);
      } else {
        return res.status(200).send({ status: true, message: "Data Updated" });
      }
    } else {
      // const existingSlug = await sqlModel.select("leave_request", ["id"], {
      //   emp_id,
      //   company_id,
      // });

      // if (existingSlug.length > 0 && (id === "" || existingSlug[0].id !== id)) {
      //   return res
      //     .status(400)
      //     .send({ status: false, message: "Leave already exists" });
      // }
      insert.created_at = getCurrentDateTime();
      const saveData = await sqlModel.insert("leave_request", insert);

      if (saveData.error) {
        return res.status(200).send(saveData);
      } else {
        return res.status(200).send({ status: true, message: "Data Saved" });
      }
    }
  } catch (err) {
    return res.status(500).send({ status: false, error: err.message });
  }
};

exports.updateLeaveRequestStatus = async (req, res, next) => {
  try {
    const id = req.params.id || "";
    const { status } = req.body;

    const validation = validateFields({ id, status });

    if (!validation.valid) {
      return res.status(400).send({
        status: false,
        message: validation.message,
        statusCode: 1,
      });
    }

    const insert = { status };

    const leaveRecord = await sqlModel.select("leave_request", ["*"], { id });

    if (leaveRecord.error || leaveRecord.length === 0) {
      return res
        .status(200)
        .send({ status: false, message: "Leave not found" });
    }

    insert.updated_at = getCurrentDateTime();

    const saveData = await sqlModel.update("leave_request", insert, { id });

    if (saveData.error) {
      return res.status(200).send(saveData);
    }

    if (status === "Approved") {
      const fromDate = new Date(leaveRecord[0].from_date);
      const toDate = new Date(leaveRecord[0].to_date);
      const empId = leaveRecord[0].emp_id;
      const companyId = leaveRecord[0].company_id;

      const holidays = await sqlModel.select("company_holidays", ["date"], {
        company_id: companyId,
      });
      const holidayDates = holidays.map((holiday) => holiday.date);

      let currentDate = new Date(fromDate);

      while (currentDate <= toDate) {
        const dayOfWeek = currentDate.getDay();
        const formattedDate = currentDate.toISOString().split("T")[0];

        // Exclude Sundays and holidays
        if (dayOfWeek !== 0 && !holidayDates.includes(formattedDate)) {
          const checkInData = {
            emp_id: empId,
            company_id: companyId,
            date: formattedDate,
            checkin_status: "Leave",
            created_at: getCurrentDateTime(),
          };

          //   await sqlModel.insert("check_in", checkInData);
          await sqlModel.insert("emp_attendance", checkInData);
        }

        // Move to the next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    return res.status(200).send({ status: true, message: "Data Updated" });
  } catch (error) {
    return res.status(500).send({ status: false, error: error.message });
  }
};

// leave setting
exports.createLeaveSetting = async (req, res, next) => {
  try {
    const {
      company_id,
      totalannual_leavedays,
      carry_forword_status,
      carry_forword_leaves,
    } = req.body;

    const insert = {
      company_id,
      totalannual_leavedays,
      carry_forword_status,
      carry_forword_leaves,
    };

    insert.remaining_leavedays = totalannual_leavedays;

    const existingRecord = await sqlModel.select("leave_settings", ["id"], {
      company_id,
    });

    if (existingRecord.error) {
      return res
        .status(500)
        .send({ status: false, message: "Error checking for existing record" });
    }

    if (existingRecord.length > 0) {
      const leaveTypeId = existingRecord[0].id;
      insert.updated_at = getCurrentDateTime();

      const updateData = await sqlModel.update("leave_settings", insert, {
        id: leaveTypeId,
      });

      if (updateData.error) {
        return res.status(500).send(updateData);
      } else {
        return res.status(200).send({ status: true, message: "Data Updated" });
      }
    } else {
      insert.created_at = getCurrentDateTime();

      const saveData = await sqlModel.insert("leave_settings", insert);

      if (saveData.error) {
        return res.status(500).send(saveData);
      } else {
        return res.status(200).send({ status: true, message: "Data Saved" });
      }
    }
  } catch (err) {
    return res.status(500).send({ status: false, error: error.message });
  }
};

exports.getLeaveSetting = async (req, res, next) => {
  try {
    const whereClause = {};
    for (const key in req.query) {
      if (req.query.hasOwnProperty(key)) {
        whereClause[key] = req.query[key];
      }
    }

    const data = await sqlModel.select("leave_settings", {}, whereClause);

    if (data.error) {
      return res.status(500).send(data);
    }

    if (data.length === 0) {
      return res.status(200).send({ status: false, message: "No data found" });
    }
    res.status(200).send({ status: true, data: data });
  } catch (error) {
    return res.status(500).send({ status: false, error: error.message });
  }
};
