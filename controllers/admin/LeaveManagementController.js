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

    const { totalannual_leavedays } = leaveSettingsResult[0];

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

    // Check if updating an existing leave type
    if (id) {
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

      const previousLeaveDays = leaveTypeRecord[0].total_leave_days;
      const previousStatus = leaveTypeRecord[0].status;

      const diff = total_leave_days - previousLeaveDays;

      // Ensure total leave days do not exceed the total annual leave days
      if (totalLeaveDaysInCompany + diff > totalannual_leavedays) {
        return res.status(400).send({
          status: false,
          message: "Total leave days cannot exceed available leave days",
        });
      }

      // Update the leave type
      insert.updated_at = getCurrentDateTime();
      const updateData = await sqlModel.update("leave_type", insert, { id });

      if (updateData.error) {
        return res.status(500).send({
          status: false,
          message: "Error updating leave type",
        });
      }

      // Recalculate total leave days in the company after the update
      const updatedTotalLeaveDays = totalLeaveDaysInCompany + diff;

      // Update used_leavedays and remaining_leavedays in leave_settings
      await sqlModel.customQuery(
        `UPDATE leave_settings 
         SET used_leavedays = ?,
             remaining_leavedays = totalannual_leavedays - ?
         WHERE company_id = ?`,
        [updatedTotalLeaveDays, updatedTotalLeaveDays, company_id]
      );

      return res.status(200).send({
        status: true,
        message: "Leave type updated successfully",
      });
    } else {
      // Creating a new leave type

      if (
        status == "active" &&
        totalLeaveDaysInCompany + total_leave_days > totalannual_leavedays
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
      }

      // Recalculate total leave days after insert
      const newTotalLeaveDays = totalLeaveDaysInCompany + total_leave_days;

      // Update used_leavedays and remaining_leavedays
      await sqlModel.customQuery(
        `UPDATE leave_settings 
         SET used_leavedays = ?,
             remaining_leavedays = totalannual_leavedays - ?
         WHERE company_id = ?`,
        [newTotalLeaveDays, newTotalLeaveDays, company_id]
      );

      return res.status(200).send({
        status: true,
        message: "Leave type created successfully",
      });
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
    if (error.message.includes("Foreign Key Constraint Error")) {
      res.status(400).json({ status: false, error: error.message });
    } else {
      res.status(500).json({ status: false, error: "Internal Server Error" });
    }
  }
};

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
    if (error.message.includes("Foreign Key Constraint Error")) {
      res.status(400).json({ status: false, error: error.message });
    } else {
      res.status(500).json({ status: false, error: "Internal Server Error" });
    }
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
      lre.no_of_days,
      lt.total_leave_days,
      e.name, 
      e.designation, 
      e.id AS emp_id,
      COALESCE(CONCAT(?, e.image), '') AS image 
    FROM leave_request lr
    LEFT JOIN employees e ON lr.emp_id = e.id   
    LEFT JOIN leave_type lt ON lr.leave_type = lt.id AND lt.company_id = lr.company_id 
    LEFT JOIN leave_record lre ON lt.id = lre.leave_type 
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
    const { status, admin_reason } = req.body;

    const validation = validateFields({ id, status });

    if (!validation.valid) {
      return res.status(400).send({
        status: false,
        message: validation.message,
        statusCode: 1,
      });
    }

    const insert = { status, admin_reason };

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

// leave detail

// Helper function to calculate time difference
const getRelativeTime = (date) => {
  const now = new Date();
  const targetDate = new Date(date);

  const diffInMs = now - targetDate;
  const diffInSeconds = Math.floor(diffInMs / 1000);
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);
  const diffInMonths = Math.floor(diffInDays / 30);
  const diffInYears = Math.floor(diffInDays / 365);

  if (diffInYears > 0) {
    return `${diffInYears} year${diffInYears === 1 ? "" : "s"} ago`;
  } else if (diffInMonths > 0) {
    return `${diffInMonths} month${diffInMonths === 1 ? "" : "s"} ago`;
  } else if (diffInDays > 0) {
    return `${diffInDays} day${diffInDays === 1 ? "" : "s"} ago`;
  } else if (diffInHours > 0) {
    return `${diffInHours} hour${diffInHours === 1 ? "" : "s"} ago`;
  } else if (diffInMinutes > 0) {
    return `${diffInMinutes} minute${diffInMinutes === 1 ? "" : "s"} ago`;
  } else {
    return "Today";
  }
};

// Helper function for future time (upcoming leave)
const getFutureRelativeTime = (date) => {
  const now = new Date();
  const targetDate = new Date(date);

  const diffInMs = targetDate - now;
  const diffInSeconds = Math.floor(diffInMs / 1000);
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);
  const diffInMonths = Math.floor(diffInDays / 30);
  const diffInYears = Math.floor(diffInDays / 365);

  if (diffInYears > 0) {
    return `in ${diffInYears} year${diffInYears === 1 ? "" : "s"}`;
  } else if (diffInMonths > 0) {
    return `in ${diffInMonths} month${diffInMonths === 1 ? "" : "s"}`;
  } else if (diffInDays > 0) {
    return `in ${diffInDays} day${diffInDays === 1 ? "" : "s"}`;
  } else if (diffInHours > 0) {
    return `in ${diffInHours} hour${diffInHours === 1 ? "" : "s"}`;
  } else if (diffInMinutes > 0) {
    return `in ${diffInMinutes} minute${diffInMinutes === 1 ? "" : "s"}`;
  } else {
    return "Today";
  }
};

exports.leaveDetail = async (req, res, next) => {
  try {
    const id = req.params.id || "";
    const emp_id = req.query.emp_id || "";
    const company_id = req.query.company_id || "";

    if (!emp_id || !company_id) {
      return res.status(400).json({
        status: false,
        message: "Employee ID and Company ID are required",
      });
    }

    // SQL query to get leave details
    const leaveDetailsQuery = `
      SELECT 
        lt.id AS leave_type_id,
        lt.name,
        lt.total_leave_days,
        COALESCE(lr.no_of_days, 0) AS no_of_days_taken,
        (lt.total_leave_days - COALESCE(lr.no_of_days, 0)) AS remaining_leave
      FROM 
        leave_type lt
      LEFT JOIN 
        leave_record lr ON lt.id = lr.leave_type AND lr.emp_id = ?
      WHERE 
        lt.company_id = ?
    `;

    const results = await sqlModel.customQuery(leaveDetailsQuery, [
      emp_id,
      company_id,
    ]);

    // Process results to ensure remaining_leave is not negative
    const processedResults = results.map((record) => ({
      ...record,
      remaining_leave: Math.max(record.remaining_leave, 0),
    }));

    // Fetch leave request details
    const leaveRequestQuery = `
      SELECT lr.from_date, lr.to_date, lt.name, lr.reason,lr.no_of_days, lr.created_at
      FROM leave_request lr
      LEFT JOIN leave_type lt ON lr.leave_type = lt.id
      WHERE lr.id = ?
    `;
    const leaveRequest = await sqlModel.customQuery(leaveRequestQuery, [id]);

    if (leaveRequest.length === 0) {
      return res.status(404).json({
        status: false,
        message: "Leave request not found",
      });
    }

    const { from_date, to_date, name, reason, no_of_days, created_at } =
      leaveRequest[0];

    // Calculate number of Sundays between from_date and to_date
    let startDate = new Date(from_date);
    const endDate = new Date(to_date);
    let sundayCount = 0;

    while (startDate <= endDate) {
      if (startDate.getDay() === 0) sundayCount++;
      startDate.setDate(startDate.getDate() + 1);
    }

    // Fetch company holidays within the date range
    const holidaysQuery = `
      SELECT date
      FROM company_holidays
      WHERE company_id = ? AND date BETWEEN ? AND ?
    `;
    const holidays = await sqlModel.customQuery(holidaysQuery, [
      company_id,
      from_date,
      to_date,
    ]);
    const holidayCount = holidays.length;

    // Fetch the most recent past leave from emp_attendance
    const recentLeaveQuery = `
      SELECT date 
      FROM emp_attendance 
      WHERE emp_id = ? AND checkin_status = 'Leave' AND date < CURDATE() 
      ORDER BY date DESC 
      LIMIT 1
    `;
    const recentLeave = await sqlModel.customQuery(recentLeaveQuery, [emp_id]);

    // Fetch the upcoming leave from emp_attendance
    const upcomingLeaveQuery = `
      SELECT date 
      FROM emp_attendance 
      WHERE emp_id = ? AND checkin_status = 'Leave' AND date >= CURDATE() 
      ORDER BY date ASC 
      LIMIT 1
    `;
    const upcomingLeave = await sqlModel.customQuery(upcomingLeaveQuery, [
      emp_id,
    ]);

    // Send the response
    return res.status(200).json({
      status: true,
      data: processedResults,
      leave_details: {
        from_date: from_date,
        to_date: to_date,
        number_of_sundays: sundayCount,
        number_of_holidays: holidayCount,
        leave_type: name,
        no_of_days: no_of_days,
        reason: reason,
        created_at: created_at,
        recent_leave_date: recentLeave[0].date ? recentLeave[0].date : "-",
        upcoming_leave_date: upcomingLeave[0].date
          ? upcomingLeave[0].date
          : "-",
        recent_leave: recentLeave.length
          ? getRelativeTime(recentLeave[0].date)
          : null,
        upcoming_leave: upcomingLeave.length
          ? getFutureRelativeTime(upcomingLeave[0].date)
          : null,
      },
    });
  } catch (error) {
    console.error("Error fetching leave details:", error);
    return res.status(500).json({
      status: false,
      error: error.message,
    });
  }
};

// leave record
exports.leaveRecord = async (req, res, next) => {
  try {
    const company_id = req.query.company_id || "";

    if (!company_id) {
      return res.status(400).json({
        status: false,
        message: "Company ID is required",
      });
    }

    // Fetch all employees for the company
    const employees = await sqlModel.select("employees", {}, { company_id });

    if (employees.length === 0) {
      return res.status(404).json({
        status: false,
        message: "Employees not found",
      });
    }

    const leaveData = [];

    for (const employee of employees) {
      const emp_id = employee.id;

      const recentLeaveQuery = `
        SELECT date 
        FROM emp_attendance 
        WHERE emp_id = ? AND checkin_status = 'Leave' AND date < CURDATE() 
        ORDER BY date DESC 
        LIMIT 1
      `;
      const [recentLeave] = await sqlModel.customQuery(recentLeaveQuery, [
        emp_id,
      ]);

      const upcomingLeaveQuery = `
        SELECT date 
        FROM emp_attendance 
        WHERE emp_id = ? AND checkin_status = 'Leave' AND date >= CURDATE() 
        ORDER BY date ASC 
        LIMIT 1
      `;
      const [upcomingLeave] = await sqlModel.customQuery(upcomingLeaveQuery, [
        emp_id,
      ]);

      // Add the data for this employee to the leaveData array
      leaveData.push({
        employee_id: emp_id,
        employee_name: employee.name,
        recent_leave: recentLeave ? recentLeave.date : null,
        upcoming_leave: upcomingLeave ? upcomingLeave.date : null,
      });
    }

    // Return the result
    return res.status(200).json({
      status: true,
      message: "Leave records fetched successfully",
      data: leaveData,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};
