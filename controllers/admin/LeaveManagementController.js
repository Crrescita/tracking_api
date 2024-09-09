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

    // Fetch current leave settings for the company
    const leaveSettingsResult = await sqlModel.select(
      "leave_settings",
      ["remaining_leavedays", "used_leavedays", "totalannual_leavedays"],
      { company_id }
    );

    if (leaveSettingsResult.error || leaveSettingsResult.length === 0) {
      return res.status(400).send({
        status: false,
        message: "Company not found or no leave settings available",
      });
    }

    const { remaining_leavedays, used_leavedays, totalannual_leavedays } =
      leaveSettingsResult[0];
    const availableLeaveDays = totalannual_leavedays - used_leavedays;

    // Ensure total_leave_days does not exceed totalannual_leavedays
    if (total_leave_days > totalannual_leavedays) {
      return res.status(400).send({
        status: false,
        message: "Total leave days cannot exceed the total annual leave days",
      });
    }

    // Calculate the total leave days in the leave_type table for the company
    const totalLeaveDaysQuery = await sqlModel.customQuery(
      `SELECT SUM(total_leave_days) AS totalLeaveDays 
         FROM leave_type 
         WHERE company_id = ?`,
      [company_id]
    );

    if (totalLeaveDaysQuery.error) {
      return res.status(500).send({
        status: false,
        message: "Error calculating total leave days",
      });
    }

    const totalLeaveDaysInCompany = totalLeaveDaysQuery[0]?.totalLeaveDays || 0;

    if (id) {
      // Updating an existing leave type
      const leaveTypeRecord = await sqlModel.select(
        "leave_type",
        ["total_leave_days", "status"],
        { id }
      );

      if (leaveTypeRecord.error || leaveTypeRecord.length === 0) {
        return res.status(404).send({
          status: false,
          message: "Leave Type not found",
        });
      }

      const previousLeaveDays = leaveTypeRecord[0].total_leave_days || 0;
      const previousStatus = leaveTypeRecord[0].status;

      insert.updated_at = getCurrentDateTime();
      const updateData = await sqlModel.update("leave_type", insert, { id });

      if (updateData.error) {
        return res.status(500).send({
          status: false,
          message: "Error updating leave type",
        });
      }

      const diff = total_leave_days - previousLeaveDays;

      if (status !== previousStatus) {
        // Handle status change
        if (status === "inactive") {
          // Increase remaining leave days and decrease used leave days if status changes to inactive
          await sqlModel.customQuery(
            `UPDATE leave_settings 
               SET remaining_leavedays = LEAST(GREATEST(remaining_leavedays + ?, 0), totalannual_leavedays), 
                   used_leavedays = LEAST(GREATEST(used_leavedays - ?, 0), totalannual_leavedays) 
               WHERE company_id = ?`,
            [previousLeaveDays, previousLeaveDays, company_id]
          );
        } else if (status === "active") {
          // Check if we have enough leave days before activating
          if (total_leave_days > availableLeaveDays) {
            return res.status(400).send({
              status: false,
              message:
                "Cannot activate leave type; insufficient remaining leave days",
            });
          }
          await sqlModel.customQuery(
            `UPDATE leave_settings 
               SET remaining_leavedays = LEAST(GREATEST(remaining_leavedays - ?, 0), totalannual_leavedays), 
                   used_leavedays = LEAST(GREATEST(used_leavedays + ?, 0), totalannual_leavedays) 
               WHERE company_id = ?`,
            [total_leave_days, total_leave_days, company_id]
          );
        }
      } else {
        // Adjust remaining leave days and used leave days based on the change in total_leave_days
        if (diff !== 0) {
          if (remaining_leavedays - diff < 0) {
            return res.status(400).send({
              status: false,
              message: "Insufficient remaining leave days for this update",
            });
          }
          await sqlModel.customQuery(
            `UPDATE leave_settings 
               SET remaining_leavedays = LEAST(GREATEST(remaining_leavedays - ?, 0), totalannual_leavedays), 
                   used_leavedays = LEAST(GREATEST(used_leavedays + ?, 0), totalannual_leavedays) 
               WHERE company_id = ?`,
            [diff, diff, company_id]
          );
        }
      }

      return res.status(200).send({
        status: true,
        message: "Data Updated",
      });
    } else {
      // Creating a new leave type
      const existingSlug = await sqlModel.select("leave_type", ["id"], {
        slug,
      });

      if (existingSlug.length > 0) {
        return res.status(400).send({
          status: false,
          message: "Leave Type already exists",
        });
      }

      if (
        status === "active" &&
        total_leave_days + totalLeaveDaysInCompany > totalannual_leavedays
      ) {
        return res.status(400).send({
          status: false,
          message: "Total leave days cannot exceed available leave days",
        });
      }

      insert.created_at = getCurrentDateTime();
      const saveData = await sqlModel.insert("leave_type", insert);

      if (saveData.error) {
        return res.status(500).send({
          status: false,
          message: "Error saving leave type",
        });
      } else {
        if (status === "active") {
          if (remaining_leavedays - total_leave_days < 0) {
            return res.status(400).send({
              status: false,
              message: "Insufficient remaining leave days for this leave type",
            });
          }
          await sqlModel.customQuery(
            `UPDATE leave_settings 
               SET remaining_leavedays = LEAST(GREATEST(remaining_leavedays - ?, 0), totalannual_leavedays), 
                   used_leavedays = LEAST(GREATEST(used_leavedays + ?, 0), totalannual_leavedays) 
               WHERE company_id = ?`,
            [total_leave_days, total_leave_days, company_id]
          );
        }

        return res.status(200).send({
          status: true,
          message: "Data Saved",
        });
      }
    }
  } catch (err) {
    console.error("Unhandled error: ", err);
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
//     const id = req.params.id;

//     const leaveTypeRecord = await sqlModel.select(
//       "leave_type",
//       ["total_leave_days", "company_id"],
//       { id }
//     );

//     if (leaveTypeRecord.error || leaveTypeRecord.length === 0) {
//       return res.status(404).send({ status: false, message: "Data not found" });
//     }

//     const { total_leave_days, company_id } = leaveTypeRecord[0];

//     // Delete the leave type
//     const result = await sqlModel.delete("leave_type", { id });

//     if (!result.error) {
//       // Update remaining_leavedays in leave_settings
//       await sqlModel.customQuery(
//         `UPDATE leave_settings SET remaining_leavedays = remaining_leavedays + ? WHERE company_id = ?`,
//         [total_leave_days, company_id]
//       );

//       res.status(200).send({ status: true, message: "Record deleted" });
//     } else {
//       res.status(200).send(result);
//     }
//   } catch (error) {
//     res.status(500).send({ status: false, error: error.message });
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

//     // Fetch the total_leave_days for all leave types to be deleted
//     const leaveTypeRecords = await sqlModel.select(
//       "leave_type",
//       ["total_leave_days", "company_id"],
//       { id: ids }
//     );

//     if (leaveTypeRecords.error) {
//       return res
//         .status(500)
//         .send({ status: false, error: leaveTypeRecords.error.message });
//     }

//     const companyId =
//       leaveTypeRecords.length > 0 ? leaveTypeRecords[0].company_id : null;
//     const totalLeaveDaysToBeAdded = leaveTypeRecords.reduce(
//       (sum, record) => sum + (record.total_leave_days || 0),
//       0
//     );

//     // Delete multiple leave types
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
//     }

//     // Update remaining_leavedays in leave_settings
//     if (companyId) {
//       await sqlModel.customQuery(
//         `UPDATE leave_settings SET remaining_leavedays = remaining_leavedays + ? WHERE company_id = ?`,
//         [totalLeaveDaysToBeAdded, companyId]
//       );
//     }

//     return res.status(200).send({ status: true, message: "Records deleted" });
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
      lr.leave_type AS leaveType_id, 
      lr.from_date, 
      lr.to_date, 
      lr.status, 
      lr.reason, 
      lr.created_at, 
      lr.id, 
      lt.name AS leave_type, 
      e.name, 
      e.designation, 
      COALESCE(CONCAT(?, e.image), '') AS image 
    FROM leave_request lr
    LEFT JOIN employees e ON lr.emp_id = e.id 
    LEFT JOIN leave_type lt ON lr.leave_type = lt.id AND lt.company_id = lr.company_id 
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
      return res.status(200).send({
        status: false,
        message: "Leave not found",
      });
    }

    insert.updated_at = getCurrentDateTime();

    const saveData = await sqlModel.update("leave_request", insert, { id });

    if (saveData.error) {
      return res.status(200).send(saveData);
    }

    if (status == "Approved") {
      const fromDate = new Date(leaveRecord[0].from_date);
      const toDate = new Date(leaveRecord[0].to_date);
      const empId = leaveRecord[0].emp_id;
      const companyId = leaveRecord[0].company_id;
      const leaveType = leaveRecord[0].leave_type;

      const holidays = await sqlModel.select("company_holidays", ["date"], {
        company_id: companyId,
      });
      const holidayDates = holidays.map((holiday) => holiday.date);

      let currentDate = new Date(fromDate);
      let noOfDays = 0;

      while (currentDate <= toDate) {
        const dayOfWeek = currentDate.getDay();
        const formattedDate = currentDate.toISOString().split("T")[0];

        // Exclude Sundays and holidays
        if (dayOfWeek !== 0 && !holidayDates.includes(formattedDate)) {
          noOfDays++;
          const checkInData = {
            emp_id: empId,
            company_id: companyId,
            date: formattedDate,
            checkin_status: "Leave",
            created_at: getCurrentDateTime(),
          };

          await sqlModel.insert("emp_attendance", checkInData);
        }

        // Move to the next day
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Check if leave record already exists
      const existingLeaveRecord = await sqlModel.select(
        "leave_record",
        ["id", "no_of_days"],
        {
          emp_id: empId,
          company_id: companyId,
          leave_type: leaveType,
        }
      );

      if (existingLeaveRecord.length > 0) {
        const updatedDays =
          parseInt(existingLeaveRecord[0].no_of_days) + noOfDays;
        await sqlModel.update(
          "leave_record",
          {
            no_of_days: updatedDays.toString(),
            updated_at: getCurrentDateTime(),
          },
          { id: existingLeaveRecord[0].id }
        );
      } else {
        const leaveRecordData = {
          emp_id: empId,
          company_id: companyId,
          leave_type: leaveType,
          no_of_days: noOfDays.toString(),
          created_at: getCurrentDateTime(),
        };

        await sqlModel.insert("leave_record", leaveRecordData);
      }
    }

    return res.status(200).send({ status: true, message: "Data Updated" });
  } catch (error) {
    return res.status(500).send({ status: false, error: error.message });
  }
};

// leave setting
// exports.createLeaveSetting = async (req, res, next) => {
//   try {
//     const {
//       company_id,
//       totalannual_leavedays,
//       carry_forword_status,
//       carry_forword_leaves,
//     } = req.body;

//     const insert = {
//       company_id,
//       totalannual_leavedays,
//       carry_forword_status,
//       carry_forword_leaves,
//     };

//     insert.remaining_leavedays = totalannual_leavedays;

//     // Calculate total used leave days from leave_type for the company
//     const usedLeaveDaysQuery = await sqlModel.customQuery(
//       `SELECT SUM(total_leave_days) AS used_leavedays
//          FROM leave_type
//          WHERE company_id = ?`,
//       [company_id]
//     );

//     if (usedLeaveDaysQuery.error) {
//       return res.status(500).send({
//         status: false,
//         message: "Error calculating used leave days",
//       });
//     }

//     const usedLeaveDays = usedLeaveDaysQuery[0]?.used_leavedays || 0;
//     insert.used_leavedays = usedLeaveDays;

//     const existingRecord = await sqlModel.select("leave_settings", ["id"], {
//       company_id,
//     });

//     if (existingRecord.error) {
//       return res.status(500).send({
//         status: false,
//         message: "Error checking for existing record",
//       });
//     }

//     if (existingRecord.length > 0) {
//       const leaveSettingId = existingRecord[0].id;
//       insert.updated_at = getCurrentDateTime();

//       const updateData = await sqlModel.update("leave_settings", insert, {
//         id: leaveSettingId,
//       });

//       if (updateData.error) {
//         return res.status(500).send(updateData);
//       } else {
//         return res.status(200).send({ status: true, message: "Data Updated" });
//       }
//     } else {
//       insert.created_at = getCurrentDateTime();

//       const saveData = await sqlModel.insert("leave_settings", insert);

//       if (saveData.error) {
//         return res.status(500).send(saveData);
//       } else {
//         return res.status(200).send({ status: true, message: "Data Saved" });
//       }
//     }
//   } catch (err) {
//     return res.status(500).send({ status: false, error: err.message });
//   }
// };

// exports.createLeaveSetting = async (req, res, next) => {
//   try {
//     const {
//       company_id,
//       totalannual_leavedays,
//       carry_forword_status,
//       carry_forword_leaves,
//     } = req.body;

//     const insert = {
//       company_id,
//       totalannual_leavedays,
//       carry_forword_status,
//       carry_forword_leaves,
//     };

//     // Calculate total used leave days from leave_type for the company
//     const usedLeaveDaysQuery = await sqlModel.customQuery(
//       `SELECT SUM(total_leave_days) AS used_leavedays
//              FROM leave_type
//              WHERE company_id = ?`,
//       [company_id]
//     );

//     if (usedLeaveDaysQuery.error) {
//       return res.status(500).send({
//         status: false,
//         message: "Error calculating used leave days",
//       });
//     }

//     const usedLeaveDays = usedLeaveDaysQuery[0]?.used_leavedays || 0;
//     insert.used_leavedays = usedLeaveDays;

//     // Ensure that totalannual_leavedays is not less than used_leavedays
//     if (totalannual_leavedays < usedLeaveDays) {
//       return res.status(400).send({
//         status: false,
//         message: "Total annual leave days cannot be less than used leave days",
//       });
//     }

//     const existingRecord = await sqlModel.select(
//       "leave_settings",
//       ["id", "remaining_leavedays", "totalannual_leavedays"],
//       {
//         company_id,
//       }
//     );

//     if (existingRecord.error) {
//       return res.status(500).send({
//         status: false,
//         message: "Error checking for existing record",
//       });
//     }

//     if (existingRecord.length > 0) {
//       const leaveSettingId = existingRecord[0].id;
//       const previousRemainingLeaveDays = existingRecord[0].remaining_leavedays;

//       // Correctly adjust remaining_leavedays
//       const totalRemainingLeaveDays = totalannual_leavedays - usedLeaveDays;
//       insert.remaining_leavedays = totalRemainingLeaveDays;

//       insert.updated_at = getCurrentDateTime();

//       const updateData = await sqlModel.update("leave_settings", insert, {
//         id: leaveSettingId,
//       });

//       if (updateData.error) {
//         return res.status(500).send(updateData);
//       } else {
//         return res.status(200).send({ status: true, message: "Data Updated" });
//       }
//     } else {
//       // Initialize remaining_leavedays to totalannual_leavedays minus used_leavedays if creating a new record
//       insert.remaining_leavedays = totalannual_leavedays - usedLeaveDays;
//       insert.created_at = getCurrentDateTime();

//       const saveData = await sqlModel.insert("leave_settings", insert);

//       if (saveData.error) {
//         return res.status(500).send(saveData);
//       } else {
//         return res.status(200).send({ status: true, message: "Data Saved" });
//       }
//     }
//   } catch (err) {
//     return res.status(500).send({ status: false, error: err.message });
//   }
// };

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

    // Calculate total used leave days from leave_type for the company
    const usedLeaveDaysQuery = await sqlModel.customQuery(
      `SELECT SUM(total_leave_days) AS used_leavedays 
               FROM leave_type 
               WHERE company_id = ?`,
      [company_id]
    );

    if (usedLeaveDaysQuery.error) {
      return res.status(500).send({
        status: false,
        message: "Error calculating used leave days",
      });
    }

    const usedLeaveDays = usedLeaveDaysQuery[0]?.used_leavedays || 0;
    insert.used_leavedays = usedLeaveDays;

    // Ensure that totalannual_leavedays is not less than used_leavedays
    if (totalannual_leavedays < usedLeaveDays) {
      return res.status(400).send({
        status: false,
        message: "Total annual leave days cannot be less than used leave days",
      });
    }

    const existingRecord = await sqlModel.select(
      "leave_settings",
      ["id", "remaining_leavedays", "totalannual_leavedays"],
      {
        company_id,
      }
    );

    if (existingRecord.error) {
      return res.status(500).send({
        status: false,
        message: "Error checking for existing record",
      });
    }

    if (existingRecord.length > 0) {
      const leaveSettingId = existingRecord[0].id;

      // Correctly adjust remaining_leavedays
      const totalRemainingLeaveDays = totalannual_leavedays - usedLeaveDays;
      insert.remaining_leavedays = totalRemainingLeaveDays;

      insert.updated_at = getCurrentDateTime();

      const updateData = await sqlModel.update("leave_settings", insert, {
        id: leaveSettingId,
      });

      if (updateData.error) {
        return res.status(500).send(updateData);
      } else {
        return res.status(200).send({ status: true, message: "Data Updated" });
      }
    } else {
      // Initialize remaining_leavedays to totalannual_leavedays minus used_leavedays if creating a new record
      insert.remaining_leavedays = totalannual_leavedays - usedLeaveDays;
      insert.created_at = getCurrentDateTime();

      const saveData = await sqlModel.insert("leave_settings", insert);

      if (saveData.error) {
        return res.status(500).send(saveData);
      } else {
        return res.status(200).send({ status: true, message: "Data Saved" });
      }
    }
  } catch (err) {
    return res.status(500).send({ status: false, error: err.message });
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
