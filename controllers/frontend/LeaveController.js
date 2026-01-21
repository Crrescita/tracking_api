const sqlModel = require("../../config/db");
const sendMail = require("../../mail/nodemailer");

const admin = require("../../firebase");


exports.getLeaveSummary = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(200).send({
        status: false,
        message: "Token required",
      });
    }

    const [employee] = await sqlModel.select(
      "employees",
      ["id", "company_id"],
      { api_token: token }
    );

    if (!employee) {
      return res.status(200).send({
        status: false,
        message: "Employee not found",
      });
    }

    const query = `
      SELECT 
        lt.id AS leave_type_id,
        lt.name AS leave_type,
        lt.total_leave_days,
        IFNULL(SUM(lr.no_of_days), 0) AS used_leave_days,
        (lt.total_leave_days - IFNULL(SUM(lr.no_of_days), 0)) AS remaining_leave
      FROM leave_type lt
      LEFT JOIN leave_record lr 
        ON lr.leave_type = lt.id
       AND lr.emp_id = ?
       AND lr.company_id = ?
      WHERE lt.company_id = ?
      GROUP BY lt.id
    `;

    const data = await sqlModel.customQuery(query, [
      employee.id,
      employee.company_id,
      employee.company_id,
    ]);

    return res.status(200).send({
      status: true,
      data,
    });
  } catch (error) {
    return res.status(200).send({
      status: false,
      message: error.message,
    });
  }
};


// exports.getEmployeeLeaveRequests = async (req, res) => {
//   try {
//     const token = req.headers.authorization?.split(" ")[1];
//     const { status } = req.query; // UI status filter

//     if (!token) {
//       return res.status(200).send({
//         status: false,
//         message: "Token required",
//       });
//     }

//     const [employee] = await sqlModel.select(
//       "employees",
//       ["id", "company_id"],
//       { api_token: token }
//     );

//     if (!employee) {
//       return res.status(200).send({
//         status: false,
//         message: "Employee not found",
//       });
//     }

//     const query = `
//       SELECT
//         lr.id,
//         lr.from_date,
//         lr.to_date,
//         lr.no_of_days,
//         lr.status AS db_status,
//         lr.reason,
//         lr.created_at,
//         lt.name AS leave_type
//       FROM leave_request lr
//       JOIN leave_type lt ON lt.id = lr.leave_type
//       WHERE lr.emp_id = ?
//         AND lr.company_id = ?
//       ORDER BY lr.created_at DESC
//     `;

//     const rows = await sqlModel.customQuery(query, [
//       employee.id,
//       employee.company_id,
//     ]);

//     const today = new Date().toISOString().split("T")[0];

//     /* ---------------- MAP DB STATUS → UI STATUS ---------------- */
//     const mapped = rows.map((row) => {
//       let ui_status = row.db_status;

//       if (row.db_status == "Approve") {
//         if (today < row.from_date) {
//           ui_status = "Approved";
//         } else if (today >= row.from_date && today <= row.to_date) {
//           ui_status = "Ongoing";
//         } else {
//           ui_status = "Expired";
//         }
//       }

//       if (row.db_status == "Reject") {
//         ui_status = "Rejected";
//       }

//       return {
//         id: row.id,
//         leave_type: row.leave_type,
//         from_date: row.from_date,
//         to_date: row.to_date,
//         no_of_days: row.no_of_days,
//         status: ui_status,
//         reason: row.reason,
//         created_at: row.created_at,
//       };
//     });

//     /* ---------------- APPLY UI STATUS FILTER ---------------- */
//     const filteredData = status
//       ? mapped.filter(
//           (item) =>
//             item.status.toLowerCase() === status.toLowerCase()
//         )
//       : mapped;

//     return res.status(200).send({
//       status: true,
//       data: filteredData,
//     });
//   } catch (error) {
//     return res.status(200).send({
//       status: false,
//       message: error.message,
//     });
//   }
// };

exports.getEmployeeLeaveRequests = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const { status, page = 1, limit = 10 } = req.query;

    if (!token) {
      return res.status(200).send({
        status: false,
        message: "Token required",
      });
    }

    const [employee] = await sqlModel.select(
      "employees",
      ["id", "company_id"],
      { api_token: token }
    );

    if (!employee) {
      return res.status(200).send({
        status: false,
        message: "Employee not found",
      });
    }

    const pageNum = Math.max(parseInt(page), 1);
    const limitNum = Math.max(parseInt(limit), 1);
    const offset = (pageNum - 1) * limitNum;

    /* ---------------- FETCH ALL (FOR STATUS MAPPING) ---------------- */
    const query = `
      SELECT
        lr.id,
        lr.from_date,
        lr.to_date,
        lr.no_of_days,
        lr.status AS db_status,
        lr.reason,
        lr.created_at,
        lt.name AS leave_type
      FROM leave_request lr
      JOIN leave_type lt ON lt.id = lr.leave_type
      WHERE lr.emp_id = ?
        AND lr.company_id = ?
      ORDER BY lr.created_at DESC
    `;

    const rows = await sqlModel.customQuery(query, [
      employee.id,
      employee.company_id,
    ]);

    const today = new Date().toISOString().split("T")[0];

    /* ---------------- MAP DB STATUS → UI STATUS ---------------- */
    const mapped = rows.map((row) => {
      let ui_status = row.db_status;

      if (row.db_status === "Approve") {
        if (today < row.from_date) {
          ui_status = "Approved";
        } else if (today >= row.from_date && today <= row.to_date) {
          ui_status = "Ongoing";
        } else {
          ui_status = "Expired";
        }
      }

      if (row.db_status === "Reject") {
        ui_status = "Rejected";
      }

      if (row.db_status === "Cancelled") {
        ui_status = "Cancelled";
      }

      return {
        id: row.id,
        leave_type: row.leave_type,
        from_date: row.from_date,
        to_date: row.to_date,
        no_of_days: row.no_of_days,
        status: ui_status,
        reason: row.reason,
        created_at: row.created_at,
      };
    });

    /* ---------------- FILTER BY UI STATUS ---------------- */
    const filtered = status
      ? mapped.filter(
          (item) =>
            item.status.toLowerCase() === status.toLowerCase()
        )
      : mapped;

    /* ---------------- PAGINATION ---------------- */
    const total = filtered.length;
    const paginatedData = filtered.slice(offset, offset + limitNum);

    return res.status(200).send({
      status: true,
        pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(total / limitNum),
        has_next: offset + limitNum < total,
        has_prev: pageNum > 1,
      },
      data: paginatedData,
    
    });
  } catch (error) {
    return res.status(200).send({
      status: false,
      message: error.message,
    });
  }
};

exports.getLeaveDetail = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const leaveId = req.params.id;

    if (!token) {
      return res.status(200).send({
        status: false,
        message: "Token required",
      });
    }

    const [employee] = await sqlModel.select(
      "employees",
      ["id", "company_id"],
      { api_token: token }
    );

    if (!employee) {
      return res.status(200).send({
        status: false,
        message: "Employee not found",
      });
    }

    const query = `
      SELECT
        lr.id,
        lr.from_date,
        lr.to_date,
        lr.reason,
        lr.status AS db_status,
        lt.name AS leave_type
      FROM leave_request lr
      JOIN leave_type lt ON lt.id = lr.leave_type
      WHERE lr.id = ?
        AND lr.emp_id = ?
        AND lr.company_id = ?
    `;

    const [leave] = await sqlModel.customQuery(query, [
      leaveId,
      employee.id,
      employee.company_id,
    ]);

    if (!leave) {
      return res.status(200).send({
        status: false,
        message: "Leave request not found",
      });
    }

    /* ---------------- STATUS CALCULATION ---------------- */
    const today = new Date().toISOString().split("T")[0];
    let ui_status = leave.db_status;

    if (leave.db_status === "Approve") {
      if (today < leave.from_date) {
        ui_status = "Approved";
      } else if (today >= leave.from_date && today <= leave.to_date) {
        ui_status = "Ongoing";
      } else {
        ui_status = "Expired";
      }
    }

    if (leave.db_status === "Reject") {
      ui_status = "Rejected";
    }

    /* ---------------- CANCEL RULE ---------------- */
    const can_cancel = leave.db_status === "Pending";

    return res.status(200).send({
      status: true,
      data: {
        id: leave.id,
        leave_type: leave.leave_type,
        status: ui_status,
        remark: leave.reason,
        from_date: leave.from_date,
        to_date: leave.to_date,
        can_cancel,
      },
    });
  } catch (error) {
    return res.status(200).send({
      status: false,
      message: error.message,
    });
  }
};


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
      ["name", "total_leave_days"],
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
        message:
          "You have reached the maximum number of leave days permitted for this leave type.",
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
      const [existing] = await sqlModel.select(
        "leave_request",
        ["id", "status", "from_date"],
        { id: leaveRequestId, emp_id: employee.id }
      );

      if (!existing) {
        return res.status(200).send({ status: false, message: "Leave not found" });
      }

      if (["Approve", "Reject", "Expired"].includes(existing.status)) {
        return res.status(200).send({
          status: false,
          message: "This leave request can no longer be modified",
        });
      }

      const today = new Date().toISOString().split("T")[0];
      if (existing.from_date <= today) {
        return res.status(200).send({
          status: false,
          message: "Leave already started and cannot be modified",
        });
      }

      saveData = await sqlModel.update(
        "leave_request",
        insert,
        { id: leaveRequestId }
      );
    }
else {
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
        // leave_type: insert.leave_type,
        leave_type: leaveTypeData.name,
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
      console.log(insertNotification);
      await sqlModel.insert("notification", insertNotification);

      // admin
      //   .messaging()
      //   .send(message)
      //   .then(() => {
      //     res.status(200).send({
      //       status: true,
      //       message: "Notification sent successfully.",
      //     });
      //   })
      //   .catch((error) => {
      //     console.error("Error sending FCM notification:", error);
      //     res
      //       .status(500)
      //       .send({ status: false, message: "Notification failed" });
      //   });

      // try {
      //   await admin.messaging().send(message);
      // } catch (error) {
      //   console.error("Error sending notification:", error);
      // }
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

exports.cancelLeaveRequest = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const leaveId = req.params.id;

    if (!token) {
      return res.status(200).send({
        status: false,
        message: "Token is required",
      });
    }

    const [employee] = await sqlModel.select(
      "employees",
      ["id", "company_id", "name", "image"],
      { api_token: token }
    );

    if (!employee) {
      return res.status(200).send({
        status: false,
        message: "Employee not found",
      });
    }

    const [leave] = await sqlModel.select(
      "leave_request",
      ["id", "status", "from_date"],
      {
        id: leaveId,
        emp_id: employee.id,
        company_id: employee.company_id,
      }
    );

    if (!leave) {
      return res.status(200).send({
        status: false,
        message: "Leave request not found",
      });
    }

    /* ---------------- BLOCK INVALID CANCEL ---------------- */
    if (leave.status != "Pending") {
      return res.status(200).send({
        status: false,
        message: "Only pending leave requests can be cancelled",
      });
    }

    const today = new Date().toISOString().split("T")[0];
    if (leave.from_date <= today) {
      return res.status(200).send({
        status: false,
        message: "Leave already started and cannot be cancelled",
      });
    }

    /* ---------------- UPDATE STATUS ---------------- */
    await sqlModel.update(
      "leave_request",
      {
        status: "Cancelled",
        // cancelled_at: getCurrentDateTime(),
      },
      { id: leaveId }
    );

    /* ---------------- OPTIONAL: NOTIFICATION ---------------- */
    await sqlModel.insert("notification", {
      company_id: employee.company_id,
      title: "Leave Cancelled",
      body: `${employee.name} cancelled a leave request`,
      image: employee.image,
      status: "unread",
      timestamp: getCurrentDateTime(),
    });

    return res.status(200).send({
      status: true,
      message: "Leave request cancelled successfully",
    });
  } catch (error) {
    return res.status(200).send({
      status: false,
      error: error.message,
    });
  }
};



// exports.createLeaveRequest = async (req, res) => {
//   try {
//     const token = req.headers.authorization?.split(" ")[1];

//     if (!token) {
//       return res.status(200).send({ status: false, message: "Token is required" });
//     }

//     const [employee] = await sqlModel.select(
//       "employees",
//       ["id", "company_id", "name", "image"],
//       { api_token: token }
//     );

//     if (!employee) {
//       return res.status(200).send({ status: false, message: "Employee not found" });
//     }

//     const [company] = await sqlModel.select("company", ["email"], {
//       id: employee.company_id,
//     });

//     if (!company) {
//       return res.status(200).send({ status: false, message: "Company not found" });
//     }

//     const leaveRequestId = req.params.id;
//     const insert = { ...req.body };

//     insert.emp_id = employee.id;
//     insert.company_id = employee.company_id;
//     insert.created_at = getCurrentDateTime();
//     insert.status = "Pending"; // ✅ explicit

//     /* ---------------- LEAVE TYPE ---------------- */
//    const [leaveTypeData] = await sqlModel.select(
//   "leave_type",
//   ["total_leave_days"],
//   { id: insert.leave_type }
// );


//     if (!leaveTypeData) {
//       return res.status(200).send({ status: false, message: "Leave type not found" });
//     }

//     /* ---------------- LEAVE BALANCE (Pending + Approve) ---------------- */
//     const leaveRecordQuery = `
//       SELECT IFNULL(SUM(no_of_days), 0) AS totalUsedDays
//       FROM leave_request
//       WHERE emp_id = ?
//         AND company_id = ?
//         AND leave_type = ?
//         AND status IN ('Pending', 'Approve')
//     `;

//     const [leaveRecord] = await sqlModel.customQuery(leaveRecordQuery, [
//       employee.id,
//       employee.company_id,
//       insert.leave_type,
//     ]);

//     if (leaveRecord.totalUsedDays >= leaveTypeData.total_leave_days) {
//       return res.status(200).send({
//         status: false,
//         message: "Leave limit exceeded for this leave type",
//       });
//     }

//     /* ---------------- DATE VALIDATION ---------------- */
//     const fromDate = new Date(insert.from_date);
//     const toDate = new Date(insert.to_date);

//     if (toDate < fromDate) {
//       return res.status(200).send({
//         status: false,
//         message: "To date cannot be earlier than from date",
//       });
//     }

//     /* ---------------- OVERLAP CHECK (FIXED) ---------------- */
//     const overlapQuery = `
//       SELECT id
//       FROM leave_request
//       WHERE emp_id = ?
//         AND status != 'Reject'
//         AND NOT (to_date < ? OR from_date > ?)
//     `;

//     const overlap = await sqlModel.customQuery(overlapQuery, [
//       employee.id,
//       insert.from_date,
//       insert.to_date,
//     ]);

//     if (overlap.length > 0) {
//       return res.status(200).send({
//         status: false,
//         message: "Overlapping leave request exists",
//       });
//     }

//     /* ---------------- CALCULATE DAYS (HOLIDAY + SUNDAY EXCLUDED) ---------------- */
//     let no_of_days = 0;
//     let currentDate = new Date(fromDate);

//     const holidays = await sqlModel.customQuery(
//       `
//       SELECT date
//       FROM company_holidays
//       WHERE company_id = ?
//         AND status = 'active'
//         AND date BETWEEN ? AND ?
//     `,
//       [employee.company_id, fromDate, toDate]
//     );

//     const holidayDates = holidays.map((h) => h.date);

//     while (currentDate <= toDate) {
//       const day = currentDate.getDay();
//       const formatted = currentDate.toISOString().split("T")[0];

//       if (day !== 0 && !holidayDates.includes(formatted)) {
//         no_of_days++;
//       }
//       currentDate.setDate(currentDate.getDate() + 1);
//     }

//     insert.no_of_days = no_of_days;

//     /* ---------------- UPDATE OR INSERT ---------------- */
//     let saveData;

//     if (leaveRequestId) {
//       const [existing] = await sqlModel.select(
//         "leave_request",
//         ["id", "status", "from_date"],
//         { id: leaveRequestId, emp_id: employee.id }
//       );

//       if (!existing) {
//         return res.status(200).send({ status: false, message: "Leave not found" });
//       }

//       if (["Approve", "Reject", "Expired"].includes(existing.status)) {
//         return res.status(200).send({
//           status: false,
//           message: "This leave request can no longer be modified",
//         });
//       }

//       const today = new Date().toISOString().split("T")[0];
//       if (existing.from_date <= today) {
//         return res.status(200).send({
//           status: false,
//           message: "Leave already started and cannot be modified",
//         });
//       }

//       saveData = await sqlModel.update(
//         "leave_request",
//         insert,
//         { id: leaveRequestId }
//       );
//     } else {
//       saveData = await sqlModel.insert("leave_request", insert);

//       /* ---------------- EMAIL + NOTIFICATION ---------------- */
//       sendMail.sendLeaveRequestToCompany({
//         name: employee.name,
//         email: company.email,
//         from_date: insert.from_date,
//         to_date: insert.to_date,
//         no_of_days,
//         leave_type: leaveTypeData.name,
//         reason: insert.reason,
//       });

//       const tokens = await sqlModel.select("fcm_tokens", ["fcm_token"], {
//         user_id: employee.company_id,
//       });

//       await Promise.all(
//         tokens.map(({ fcm_token }) =>
//           admin.messaging().send({
//             notification: {
//               title: "New Leave Request",
//               body: `Leave request from ${employee.name}`,
//               image: employee.image
//                 ? `${process.env.BASE_URL}${employee.image}`
//                 : "",
//             },
//             token: fcm_token,
//           })
//         )
//       );

//       await sqlModel.insert("notification", {
//         company_id: employee.company_id,
//         title: "New",
//         body: `Leave request from ${employee.name}`,
//         image: employee.image,
//         status: "unread",
//         timestamp: getCurrentDateTime(),
//       });
//     }

//     return res.status(200).send({
//       status: true,
//       message: leaveRequestId ? "Leave updated successfully" : "Leave request submitted successfully",
//     });
//   } catch (error) {
//     return res.status(200).send({
//       status: false,
//       error: error.message,
//     });
//   }
// };
