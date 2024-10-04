const sqlModel = require("../../config/db");
const sendMail = require("../../mail/nodemailer");

const admin = require("../../firebase");

exports.createLeaveRequest = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res
        .status(200)
        .send({ status: false, message: "Token is required" });
    }

    const [employee] = await sqlModel.select(
      "employees",
      ["id", "company_id", "name", "image"],
      { api_token: token }
    );

    if (!employee) {
      return res
        .status(200)
        .send({ status: false, message: "Employee not found" });
    }

    const [company] = await sqlModel.select("company", ["email"], {
      id: employee.company_id,
    });

    if (!company) {
      return res
        .status(200)
        .send({ status: false, message: "Company not found" });
    }

    const leaveRequestId = req.params.id;
    const insert = { ...req.body };

    insert.emp_id = employee.id;
    insert.company_id = employee.company_id;
    insert.created_at = getCurrentDateTime();

    const [leaveTypeData] = await sqlModel.select(
      "leave_type",
      ["total_leave_days"],
      { id: insert.leave_type }
    );

    if (!leaveTypeData) {
      return res.status(200).send({
        status: false,
        message: "Leave type not found",
      });
    }

    const totalLeaveDays = leaveTypeData.total_leave_days;

    const leaveRecordQuery = `
    SELECT SUM(no_of_days) AS totalUsedDays
    FROM leave_record
    WHERE emp_id = ? AND company_id = ? AND leave_type = ?
  `;

    const leaveRecordValues = [
      employee.id,
      employee.company_id,
      insert.leave_type,
    ];

    const [leaveRecord] = await sqlModel.customQuery(
      leaveRecordQuery,
      leaveRecordValues
    );

    const totalUsedDays = leaveRecord?.totalUsedDays || 0;
    const availableLeaveDays = totalLeaveDays - totalUsedDays;

    // Check if the requested number of days exceeds the available leave days
    if (totalUsedDays >= totalLeaveDays) {
      return res.status(200).send({
        status: false,
        message: "All leave days for this leave type have been used.",
      });
    }

    const fromDate = new Date(insert.from_date);
    const toDate = new Date(insert.to_date);

    if (toDate < fromDate) {
      return res.status(200).send({
        status: false,
        message: "To date cannot be earlier than from date",
      });
    }

    const validation = validateFields({
      from_date: insert.from_date,
      to_date: insert.to_date,
      leave_type: insert.leave_type,
    });

    if (!validation.valid) {
      return res.status(400).send({
        status: false,
        message: validation.message,
        statusCode: 1,
      });
    }

    // Check if the employee has already requested leave for the same dates
    const overlappingLeaveQuery = `
      SELECT id
      FROM leave_request
      WHERE emp_id = ?
      AND ((from_date BETWEEN ? AND ?) OR (to_date BETWEEN ? AND ?))
    `;

    const overlappingLeaveValues = [
      employee.id,
      insert.from_date,
      insert.to_date,
      insert.from_date,
      insert.to_date,
    ];

    const existingLeaveRequests = await sqlModel.customQuery(
      overlappingLeaveQuery,
      overlappingLeaveValues
    );

    if (existingLeaveRequests.length > 0) {
      return res.status(200).send({
        status: false,
        message: "You have already requested leave for the selected dates.",
      });
    }

    // Calculate number of days excluding Sundays and holidays
    let no_of_days = 0;
    let currentDate = new Date(fromDate);

    // Get all company holidays between the date range
    const holidaysQuery = `
      SELECT date
      FROM company_holidays
      WHERE company_id = ? AND status = 'active' AND date BETWEEN ? AND ?
    `;
    const holidays = await sqlModel.customQuery(holidaysQuery, [
      employee.company_id,
      fromDate,
      toDate,
    ]);

    const holidayDates = holidays.map((holiday) => holiday.date);

    // Loop through each day and count if it's not a Sunday or holiday
    while (currentDate <= toDate) {
      const dayOfWeek = currentDate.getDay();
      const formattedDate = currentDate.toISOString().split("T")[0];

      // Count the day if it's not a Sunday and not a company holiday
      if (dayOfWeek !== 0 && !holidayDates.includes(formattedDate)) {
        no_of_days++;
      }

      currentDate.setDate(currentDate.getDate() + 1); // Move to the next day
    }

    insert.no_of_days = no_of_days; // Insert the calculated number of days

    let saveData;
    if (leaveRequestId) {
      const existingLeaveRequest = await sqlModel.select(
        "leave_request",
        ["id"],
        { id: leaveRequestId, emp_id: employee.id }
      );

      if (existingLeaveRequest.length > 0) {
        const updateCondition = { id: leaveRequestId };
        saveData = await sqlModel.update(
          "leave_request",
          insert,
          updateCondition
        );
      } else {
        return res.status(200).send({
          status: false,
          message: "Leave request not found",
        });
      }
    } else {
      saveData = await sqlModel.insert("leave_request", insert);

      // Handling CC emails
      const ccEmails = req.body.cc
        ? `${req.body.cc},${company.email}`
        : company.email;

      const emailData = {
        name: employee.name,
        email: ccEmails,
        from_date: insert.from_date,
        to_date: insert.to_date,
        no_of_days: insert.no_of_days,
        leave_type: insert.leave_type,
        reason: insert.reason,
      };

      sendMail.sendLeaveRequestToCompany(emailData);

      const tokens = await sqlModel.select("fcm_tokens", ["fcm_token"], {
        user_id: employee.company_id,
      });

      if (tokens.length === 0) {
        return res.status(200).send({
          status: false,
          message: "No FCM tokens found for the company",
        });
      }

      const messageContent = `Leave request from ${employee.name}.`;

      // Create a notification promise for each token
      const notificationPromises = tokens.map(({ fcm_token }) => {
        return admin.messaging().send({
          notification: {
            title: "New Leave Request",
            body: messageContent,
            image: employee.image
              ? `${process.env.BASE_URL}${employee.image}`
              : "",
          },
          token: fcm_token,
        });
      });

      // Execute all notification sends in parallel
      await Promise.all(notificationPromises);

      const insertNotification = {
        company_id: employee.company_id,
        title: "New",
        body: messageContent,
        image: employee.image,
        status: "unread",
        timestamp: getCurrentDateTime(),
      };

      await sqlModel.insert("notification", insertNotification);

      try {
        await admin.messaging().send(message);
      } catch (error) {
        console.error("Error sending notification:", error);
      }
    }

    if (saveData.error) {
      return res.status(200).send(saveData);
    } else {
      const msg = leaveRequestId ? "Data Updated" : "Data Saved";
      return res.status(200).send({ status: true, message: msg });
    }
  } catch (error) {
    res.status(200).send({ status: false, error: error.message });
  }
};
