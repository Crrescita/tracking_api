const sqlModel = require("../../config/db");
const sendWhatsapp = require("../../mail/whatsappMessage");
const admin = require("../../firebase");
const cron = require("node-cron");
// const {  getCurrentDateTime } = require("../../config/until");

const generateTaskID = () => {
  const prefix = "TMS";
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${datePart}${randomPart}`;
};


const formatDate = (dateString) => {
  const date = new Date(dateString);
  
  const year = date.toLocaleString("en-US", {
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};


// exports.getAssignTask = async (req, res, next) => {
//   try {
//     const whereClause = {};
    
//     // Ensure only tasks from the logged-in user's company are retrieved
//     if (req.user?.id) {
//       whereClause.company_id = req.user.id;
//     }

//     // Add any additional query parameters to the whereClause
//     for (const key in req.query) {
//       if (req.query.hasOwnProperty(key)) {
//         whereClause[key] = req.query[key];
//       }
//     }

//     // Fetch tasks
//     const tasks = await sqlModel.select(
//       "assign_task",
//       {},
//       whereClause,
//       "ORDER BY start_date ASC"
//     );

//     if (tasks.error) {
//       return res.status(500).send(tasks);
//     }

//     if (tasks.length === 0) {
//       return res.status(200).send({ status: false, message: "No data found" });
//     }

//     let allEmpIds = [];
//     let allTaskIds = [];

//     // Extract unique employee IDs and task IDs
//     tasks.forEach((task) => {
//       if (task.emp_id) {
//         const empIds = task.emp_id.split(",").map((id) => parseInt(id.trim()));
//         allEmpIds = [...allEmpIds, ...empIds];
//       }
//       allTaskIds.push(task.id);
//     });

//     allEmpIds = [...new Set(allEmpIds)];

//     // Fetch employee details
//     const employeeQuery = `SELECT id, name, image FROM employees WHERE id IN (${allEmpIds.join(",")})`;
//     const employeeDetails = await sqlModel.customQuery(employeeQuery);

//     if (!employeeDetails || employeeDetails.error) {
//       return res.status(500).send({ status: false, message: "Error fetching employee details" });
//     }

//     // Fetch employee task statuses including comments
//     const taskStatusQuery = `SELECT task_id, emp_id, status, comment FROM assign_task_status WHERE task_id IN (${allTaskIds.join(",")})`;
//     const taskStatusDetails = await sqlModel.customQuery(taskStatusQuery);

//     if (!taskStatusDetails || taskStatusDetails.error) {
//       return res.status(500).send({ status: false, message: "Error fetching task status details" });
//     }

//     // Map employees by ID
//     const employeeMap = {};
//     employeeDetails.forEach((emp) => {
//       if (emp && emp.id) {
//         employeeMap[emp.id] = {
//           id: emp.id,
//           name: emp.name,
//           image: `${process.env.BASE_URL}${emp.image}`,
//         };
//       }
//     });

//     // Map task statuses by task_id and emp_id
//     const taskStatusMap = {};
//     taskStatusDetails.forEach((status) => {
//       if (!taskStatusMap[status.task_id]) {
//         taskStatusMap[status.task_id] = {};
//       }
//       taskStatusMap[status.task_id][status.emp_id] = {
//         status: status.status,
//         comment: status.comment || null, // Include comment in response
//       };
//     });

//     // Append employee details and task statuses (with comments) to each task
//     tasks.forEach((task) => {
//       if (task.emp_id) {
//         const empIds = task.emp_id.split(",").map((id) => parseInt(id.trim()));
//         task.employeeDetails = empIds.map((empId) => {
//           return {
//             ...(employeeMap[empId] || {}),
//             status: taskStatusMap[task.id]?.[empId]?.status || "Unknown",
//             comment: taskStatusMap[task.id]?.[empId]?.comment || null, // Include comment
//           };
//         });
//       }

//       // Determine if the task is overdue
//       if (!["Pending-Review", "Completed", "Cancelled", "On-Hold"].includes(task.status)) {
//         task.isOverdue = new Date(task.end_date) < new Date();
//       } else {
//         task.isOverdue = false;
//       }
//     });

//     res.status(200).send({ status: true, data: tasks });
//   } catch (error) {
//     res.status(500).send({ status: false, error: error.message });
//   }
// };

exports.getAssignTask = async (req, res, next) => {
  try {
    const whereClause = {};

    if (req.user?.id) {
      whereClause.company_id = req.user.id;
    }

    for (const key in req.query) {
      if (req.query.hasOwnProperty(key)) {
        whereClause[key] = req.query[key];
      }
    }

    const tasks = await sqlModel.select("assign_task", {}, whereClause, "ORDER BY start_date ASC");

    if (tasks.error) return res.status(500).send(tasks);
    if (tasks.length === 0) return res.status(200).send({ status: false, message: "No data found" });

    let allEmpIds = [];
    let allTaskIds = tasks.map(task => task.id);

    tasks.forEach(task => {
      if (task.emp_id) {
        const empIds = task.emp_id.split(",").map(id => parseInt(id.trim()));
        allEmpIds.push(...empIds);
      }
    });

    allEmpIds = [...new Set(allEmpIds)];

    // const employeeQuery = `SELECT id, name, image FROM employees WHERE id IN (${allEmpIds.join(",")})`;

    const employeeQuery = `
  SELECT 
    e.id, 
    e.name, 
    e.image,
    d.name AS designation,
    b.name AS branch,
    dept.name AS department
  FROM employees e
  LEFT JOIN designation d ON e.designation = d.id
  LEFT JOIN branch b ON e.branch = b.id
  LEFT JOIN department dept ON e.department = dept.id
  WHERE e.id IN (${allEmpIds.join(",")})
`;

    const employeeDetails = await sqlModel.customQuery(employeeQuery);

    const taskStatusQuery = `SELECT task_id, emp_id, status, comment FROM assign_task_status WHERE task_id IN (${allTaskIds.join(",")})`;
    const taskStatusDetails = await sqlModel.customQuery(taskStatusQuery);

    const employeeMap = {};
    employeeDetails.forEach(emp => {
      if (emp?.id) {
        employeeMap[emp.id] = {
          id: emp.id,
          name: emp.name,
          image: `${process.env.BASE_URL}${emp.image}`,
          designation: emp.designation,
      branch: emp.branch,
      department: emp.department,
        };
      }
    });

    const taskStatusMap = {};
    taskStatusDetails.forEach(status => {
      if (!taskStatusMap[status.task_id]) taskStatusMap[status.task_id] = {};
      taskStatusMap[status.task_id][status.emp_id] = {
        status: status.status,
        comment: status.comment || null,
      };
    });

    // Fetch all group chats for the given tasks
    const chatQuery = `SELECT * FROM task_chats WHERE is_group = 1 AND task_id IN (${allTaskIds.join(",")})`;
    const groupChats = await sqlModel.customQuery(chatQuery);

    const chatMap = {};
    groupChats.forEach(chat => {
      chatMap[chat.task_id] = chat;
    });

    const groupChatIds = groupChats.map(chat => chat.id);

    // Fetch messages for these group chats
    let groupMessages = [];
    if (groupChatIds.length) {
      const messageQuery = `
        SELECT * FROM task_messages
        WHERE chat_id IN (${groupChatIds.join(",")})
        ORDER BY sent_at ASC
      `;
      groupMessages = await sqlModel.customQuery(messageQuery);
    }

    // Fetch admin/company users who might have sent messages
    const adminIds = [...new Set(groupMessages.filter(msg => msg.sender_type == 'admin').map(msg => msg.sender_id))];

    const adminQuery = adminIds.length ? `SELECT id, name FROM company WHERE id IN (${adminIds.join(",")})` : null;
    const adminDetails = adminQuery ? await sqlModel.customQuery(adminQuery) : [];

    const adminMap = {};
    adminDetails.forEach(admin => {
      adminMap[admin.id] = { id: admin.id, name: admin.name };
    });

    const messageMap = {};
    groupMessages.forEach(msg => {
      if (!messageMap[msg.chat_id]) messageMap[msg.chat_id] = [];
      messageMap[msg.chat_id].push({
        id: msg.id,
        message: msg.message,
        repmessage: msg.reply_to_id
          ? groupMessages.find(m => m.id === msg.reply_to_id)?.message || null
          : null,
        sender: msg.sender_type == 'admin'
          ? (adminMap[msg.sender_id] || { id: msg.sender_id, name: "Admin" })
          : (employeeMap[msg.sender_id] || { id: msg.sender_id, name: "Employee" }),
        receiver: msg.receiver_type == 'admin'
          ? (adminMap[msg.receiver_id] || { id: msg.receiver_id, name: "Admin" })
          : (employeeMap[msg.receiver_id] || { id: msg.receiver_id, name: "Employee" }),
        sent_at: msg.sent_at,
      });
    });

    // Final task response build
    tasks.forEach(task => {
      const empIds = task.emp_id?.split(",").map(id => parseInt(id.trim())) || [];

      task.employeeDetails = empIds.map(empId => ({
        ...(employeeMap[empId] || {}),
        status: taskStatusMap[task.id]?.[empId]?.status || "Unknown",
        comment: taskStatusMap[task.id]?.[empId]?.comment || null,
      }));

      task.isOverdue = !["Pending-Review", "Completed", "Cancelled", "On-Hold"].includes(task.status)
        ? new Date(task.end_date) < new Date()
        : false;

      // Attach group chat if available
      if (chatMap[task.id]) {
        const chat = chatMap[task.id];
        const participants = chat.participants
          ? chat.participants.split(",").map(id => employeeMap[parseInt(id)]).filter(Boolean)
          : [];

        task.group = {
          chatId: chat.id,
          participants,
          messages: messageMap[chat.id] || [],
          lastMessage: (messageMap[chat.id] || []).slice(-1)[0] || null,
        };
      } else {
        task.group = null;
      }
    });

    res.status(200).send({ status: true, data: tasks });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};


exports.assignTask = async (req, res, next) => {
  try {
    const id = req.params.id || "";
    let insert = { ...req.body };

    const empIds = insert.emp_id.split(",").map(emp => Number(emp.trim()));

    if (id) {
      const taskRecord = await sqlModel.select("assign_task", ["task_title", "task_id", "emp_id", "status", "start_date", "end_date"], { id });

      if (taskRecord.error || taskRecord.length === 0) {
        return res.status(200).send({ status: false, message: "Task not found" });
      }

      const oldTask = taskRecord[0];
      insert.updated_at = getCurrentDateTime();
      const saveData = await sqlModel.update("assign_task", insert, { id });

      if (saveData.error) {
        return res.status(200).send(saveData);
      } else {
        const existingEmpIds = oldTask.emp_id.split(",").map(id => Number(id.trim()));
        const newEmpIds = empIds.filter(id => !existingEmpIds.includes(id));

        const updatePromises = empIds.map(async (empId) => {
          let newStatus = insert.status || oldTask.status;

          if (newEmpIds.includes(empId)) {
            newStatus = "To-Do";
          }

          // Determine if the task is overdue
          let isOverdue = false;
          if (!["Pending-Review", "Completed", "Cancelled", "On-Hold"].includes(newStatus)) {
            isOverdue = new Date(insert.end_date) < new Date();
          }

          let message = "";

          // Check if status or dates have changed before sending a WhatsApp update
          if (insert.status && insert.status !== oldTask.status) {
            message = getStatusMessage(insert.status, insert, isOverdue);
          }
          if (insert.start_date && insert.start_date !== oldTask.start_date) {
            message = `📅 Start Date updated: *${formatDate(oldTask.start_date)} → ${formatDate(insert.start_date)}*`;
          }
          if (insert.end_date && insert.end_date !== oldTask.end_date) {
            message = `⏳ End Date updated: *${formatDate(oldTask.end_date)} → ${formatDate(insert.end_date)}*`;
          }

          if (message) {
            const empDetail = await sqlModel.select("employees", ["name", "mobile"], { id: empId });

            if (empDetail && empDetail.length > 0) {
              await sendWhatsapp.taskReminderUpdate({
                emp_id: empId,
                name: empDetail[0].name,
                status: insert.status,
                task_id: oldTask.task_id,
                task_title: insert.task_title,
                start_date: formatDate(insert.start_date),
                end_date: formatDate(insert.end_date),
                message: message,
                mobile: empDetail[0].mobile,
              });
            }
          }

          await sqlModel.update("assign_task_status", { status: newStatus }, { task_id: id, emp_id: empId });

          if (newStatus === "Pending-Review") {
            await sqlModel.update("assign_task_status", { status: "Completed" }, { task_id: id, emp_id: empId });
          }

            const [existingChat] = await sqlModel.customQuery(
          `SELECT id FROM task_chats WHERE task_id = ? AND is_group = false AND FIND_IN_SET(?, participants) AND FIND_IN_SET(?, participants)`,
          [id, insert.company_id, empId]
        );
        if (!existingChat) {
          await sqlModel.insert("task_chats", {
            task_id: id,
            is_group: false,
            participants: `${insert.company_id},${empId}`,
          });
        }
        });

         const [existingGroupChat] = await sqlModel.customQuery(
        `SELECT id FROM task_chats WHERE task_id = ? AND is_group = true`,
        [id]
      );
      if (!existingGroupChat) {
        await sqlModel.insert("task_chats", {
          task_id: id,
          is_group: true,
          participants: `${id},${empIds.join(",")}`,
        });
      }

        await Promise.all(updatePromises);

        return res.status(200).send({ status: true, message: "Task Assigned, Status Updated, & WhatsApp Sent" });
      }
    } else {
      // Task creation (when no task id is provided)
      insert.task_id = generateTaskID();
      insert.created_at = getCurrentDateTime();

      const query = `SELECT id, name, mobile FROM employees WHERE id IN (${empIds.map(() => "?").join(",")})`;
      const employees = await sqlModel.customQuery(query, empIds);

      if (!employees || employees.length === 0) {
        return res.status(500).send({ status: false, message: "No employees found" });
      }

      const saveData = await sqlModel.insert("assign_task", insert);

      if (saveData.error) {
        return res.status(200).send(saveData);
      }

      const taskId = saveData.insertId || insert.task_id;

      // Insert task status for each employee
      const insertStatusPromises = employees.map(async (emp) => {
        await sqlModel.insert("assign_task_status", {
          task_id: taskId,
          emp_id: emp.id,
          status: "To-Do",
          created_at: getCurrentDateTime(),
        });

        // Send WhatsApp notification to each employee
        await sendWhatsapp.taskAssigned({
          taskId:taskId,
          task_id: insert.task_id,
          emp_id: emp.id,
          name: emp.name,
          mobile: emp.mobile,
          task_title: insert.task_title,
          start_date: formatDate(insert.start_date),
          end_date: formatDate(insert.end_date),
        });

          // Create personal chat (admin ↔ emp)
        await sqlModel.insert("task_chats", {
          task_id: taskId,
          is_group: false,
          participants: `${insert.company_id},${emp.id}`,
        });
      });

       
      // Create group chat
      await sqlModel.insert("task_chats", {
        task_id: taskId,
        is_group: true,
        participants: `${insert.company_id},${empIds.join(",")}`,
      });


      await Promise.all(insertStatusPromises);

      return res.status(200).send({ status: true, message: "Task Assigned, Data Saved & WhatsApp Sent" });
    }
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};

// Function to generate status message including overdue check
function getStatusMessage(status, data, isOverdue) {
  if (isOverdue) {
    return `⏰ Task *${data.task_title}* is overdue! Please complete it as soon as possible.`;
  }

  switch (status) {
    case "To-Do":
      return `📌 New Task Assigned: *${data.task_title}*\nStart Date: ${data.start_date}\nEnd Date: ${data.end_date}\n🔗 View Task: ${inviteLink}`;
    case "In-Progress":
      return `🛠 Task *${data.task_title}* is now In-Progress. Keep up the good work!`;
    case "Pending-Review":
      return `✅ You have completed your task *${task.task_title}*. It is now under review by the admin. No further action is needed from you at this moment.`;
    case "Completed":
      return `✅ Congratulations! Task *${data.task_title}* has been marked as Completed. 🎉`;
    case "On-Hold":
      return `⏸ Task *${data.task_title}* is On Hold. Please wait for further updates.`;
      case "Cancelled":
        return `❌ Task *${data.task_title}* has been Cancelled. No further action is required.`;    
    default:
      return `📢 Reminder: Your task *${data.task_title}* is due soon. Please complete it on time.`;
  }
}

exports.deleteAssignTask = async (req, res, next) => {
  try {
    let id = req.params.id;

    const assign_taskRecord = await sqlModel.select("assign_task", {}, { id });

    if (assign_taskRecord.error || assign_taskRecord.length === 0) {
      return res.status(200).send({ status: false, message: "Data not found" });
    }

    let result = await sqlModel.delete("assign_task", { id: id });

    if (!result.error) {
      res.status(200).send({ status: true, message: "Record deleted" });
    } else {
      res.status(200).send(result);
    }
  } catch (error) {
    res.status(200).send({ status: false, error: error.message });
  }
};

exports.deleteMultipleAssignTask = async (req, res, next) => {
  try {
    const ids = req.body.ids;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).send({ status: false, message: "Invalid input" });
    }

    const results = await Promise.all(
      ids.map((id) => sqlModel.delete("assign_task", { id }))
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


// update task status by emp

exports.updateTaskStatus = async (req, res, next) => {
  try {
    let { task_id, emp_ids, status, comment } = req.body;

    if (!task_id || !emp_ids || !status) {
      return res.status(400).send({ status: false, message: "Missing required fields" });
    }

    if (!Array.isArray(emp_ids)) {
      emp_ids = [emp_ids]; // Convert single emp_id to array
    }

    if (emp_ids.length === 0) {
      return res.status(400).send({ status: false, message: "No employees selected for the update" });
    }

    // Fetch task details
    const taskRecord = await sqlModel.select("assign_task", ["id", "status", "emp_id", "company_id", "task_title"], { id: task_id });
    if (!taskRecord.length) {
      return res.status(404).send({ status: false, message: "Task not found" });
    }

    const assignedEmployees = taskRecord[0].emp_id.split(",").map(id => Number(id.trim()));
    for (let emp_id of emp_ids) {
      if (!assignedEmployees.includes(Number(emp_id))) {
        return res.status(403).send({
          status: false,
          message: `You are not assigned to this task. Please contact your supervisor.`,
        });
      }
    }

    const allowedStatuses = ["In-Progress", "Completed"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).send({ status: false, message: `Invalid status. Allowed statuses: ${allowedStatuses.join(", ")}` });
    }

    let commentUpdated = false;
    const updatePromises = emp_ids.map(async (emp_id) => {
      let existingComments = [];

      // Fetch existing comments
      const existingRecord = await sqlModel.select("assign_task_status", ["comment"], { task_id, emp_id });

      if (existingRecord.length > 0 && existingRecord[0].comment) {
        try {
          existingComments = JSON.parse(existingRecord[0].comment);
        } catch (error) {
          existingComments = [];
        }
      }

      if (comment) {
        existingComments.push({
          text: comment.text,
          timestamp: comment.timestamp || new Date().toISOString(),
        });
        commentUpdated = true;
      }

      const updateData = {
        status,
        updated_at: getCurrentDateTime(),
        comment: existingComments.length > 0 ? JSON.stringify(existingComments) : null,
      };

      await sqlModel.update("assign_task_status", updateData, { task_id, emp_id });

      await sqlModel.insert("assign_task_status_history", {
        task_id,
        emp_id,
        status,
        comment: JSON.stringify(existingComments),
        created_at: getCurrentDateTime(),
      });

      return { emp_id, status: true, commentUpdated };
    });

    const updateResults = await Promise.all(updatePromises);

    // Fetch employee details
    const query = `SELECT id, name, company_id FROM employees WHERE id IN (${emp_ids.map(() => "?").join(",")})`;
    const employees = await sqlModel.customQuery(query, emp_ids);

    if (!employees.length) {
      return res.status(404).send({ status: false, message: "Employees not found" });
    }

    // Fetch admin FCM tokens
    const adminTokens = await sqlModel.select("fcm_tokens", ["fcm_token"], { user_id: taskRecord[0].company_id });

    if (!adminTokens.length) {
      return res.status(200).send({ status: false, message: "No FCM tokens found for the admin" });
    }

    // Prepare notification message
    const employeeNames = employees.map(emp => emp.name).join(", ");
    let notificationMessage = "";

    // Truncate comment if too long
    const MAX_COMMENT_LENGTH = 100;
    let truncatedComment = comment?.text ? comment.text.substring(0, MAX_COMMENT_LENGTH) : "";
    if (comment?.text.length > MAX_COMMENT_LENGTH) {
      truncatedComment += "..."; // Indicate comment is longer
    }

    if (commentUpdated && !status) {
      // Only comment update
      notificationMessage = `💬 *New Comment* on *${taskRecord[0].task_title}* by ${employeeNames}: "${truncatedComment}"`;
    } else if (!commentUpdated && status) {
      // Only status update
      switch (status) {
        case "In-Progress":
          notificationMessage = `🔔 *Task Update:* ${employeeNames} changed *${taskRecord[0].task_title}* to *In-Progress*.`;
          break;
        case "Completed":
          notificationMessage = `✅ *Task Completed:* ${employeeNames} marked *${taskRecord[0].task_title}* as *Completed*.`;
          break;
      }
    } else if (commentUpdated && status) {
      // Both comment and status update
      notificationMessage = `🔔 *Task Update:* ${employeeNames} updated *${taskRecord[0].task_title}*.\n💬 *Comment:* "${truncatedComment}"\n🚀 *Status:* ${status}`;
    }

    // Send FCM Notifications
    const notificationPromises = adminTokens.map(({ fcm_token }) =>
      admin.messaging().send({
        notification: {
          title: "Task Update",
          body: notificationMessage,
        },
        token: fcm_token,
      })
    );

    await Promise.all(notificationPromises);

    // Save notification in database
    await sqlModel.insert("notification", {
      company_id: taskRecord[0].company_id,
      title: "Task Update",
      body: notificationMessage,
      link: `/task-detail/${taskRecord[0].id}`,
      status: "unread",
      timestamp: getCurrentDateTime(),
    });

    // Fetch current status of all assigned employees
    const allEmployeeStatuses = await sqlModel.select("assign_task_status", ["emp_id", "status"], { task_id });
    const allEmployeesCompleted = allEmployeeStatuses.every(record => record.status === "Completed");

    if (allEmployeesCompleted) {
      await sqlModel.update("assign_task", { status: "Pending-Review" }, { id: task_id });
      return res.status(200).send({ status: true, message: "All employees completed the task. Task status updated to Pending Review." });
    }

    if (commentUpdated) {
      return res.status(200).send({ status: true, message: "Comment added successfully." });
    }

    const anyInProgress = updateResults.some(result => result.status === true && status === "In-Progress");

    if (anyInProgress) {
      await sqlModel.update("assign_task", { status: "In-Progress" }, { id: task_id });
      return res.status(200).send({ status: true, message: "Task status updated to In-Progress." });
    }

    return res.status(200).send({ status: true, message: "Task status updated successfully." });

  } catch (error) {
    return res.status(500).send({ status: false, error: error.message });
  }
};


// emp task status 
exports.empTaskStatus = async (req, res, next) => {
  try {

    const { emp_id, task_id } = req.query;

    if (!task_id) {
      return res.status(400).send({ status: false, message: "Task ID is required" });
    }

    let conditions = { task_id };
    if (emp_id) {
      conditions.emp_id = emp_id;
    }

   
    const taskStatusRecords = await sqlModel.select("assign_task_status", ["emp_id", "status", "updated_at"], conditions);

    // if (taskStatusRecords.error || taskStatusRecords.length === 0) {
    //   return res.status(404).send({ status: false, message: "No employee status found for this task" });
    // }

    return res.status(200).send({ status: true, data: taskStatusRecords });

  } catch (error) {
    return res.status(500).send({ status: false, error: error.message });
  }
};

// remeinder whats'app

exports.sendReminder = async (req, res, next) => {
  try {
    const { emp_ids, task_id, message: customMessage } = req.body;

    if (!emp_ids || !task_id) {
      return res.status(400).send({ status: false, message: "Missing required parameters" });
    }

    // Fetch the task details
    const taskQuery = `SELECT id, task_title, task_id, status, start_date, end_date FROM assign_task WHERE id = ${task_id}`;
    const taskDetails = await sqlModel.customQuery(taskQuery);

    if (!taskDetails || taskDetails.length === 0) {
      return res.status(404).send({ status: false, message: "Task not found" });
    }

    const task = taskDetails[0];

    // Determine if the task is overdue
    let isOverdue = false;
    if (!["Pending-Review", "Completed", "Cancelled", "On-Hold"].includes(task.status)) {
      isOverdue = new Date(task.end_date) < new Date();
    }

    // Fetch employee details
    const employeeQuery = `SELECT id, name, mobile FROM employees WHERE id IN (${emp_ids.join(",")})`;
    const employeeDetails = await sqlModel.customQuery(employeeQuery);

    if (!employeeDetails || employeeDetails.error) {
      return res.status(500).send({ status: false, message: "Error fetching employee details" });
    }

    // Define messages based on task status
    const statusMessages = {
      "In-Progress": `⏳ Your task *${task.task_title}* is in progress. Keep up the good work and ensure timely completion.`,
      "Pending-Review": `✅ You have completed your task *${task.task_title}*. It is now under review by the admin. No further action is needed from you at this moment.`,
      "Completed": `✅ Your task *${task.task_title}* has been marked as completed. Well done!`,
      "On-Hold": `⏸️ Your task *${task.task_title}* is currently on hold. Please wait for further updates.`,
      "Cancelled": `❌ Your task *${task.task_title}* has been cancelled. No further action is required.`,
    };

    for (const emp of employeeDetails) {

       let message;

  if (customMessage) {
    message = customMessage;
  } else if (isOverdue) {
    message = `🔴 Your task *${task.task_title}* is overdue! Please complete it as soon as possible.`;
  } else {
    message = statusMessages[task.status] || `📌 Reminder: Your task *${task.task_title}* is due soon. Please make sure to complete it on time.`;
  }


      // let message = statusMessages[task.status] || `📌 Reminder: Your task *${task.task_title}* is due soon. Please make sure to complete it on time.`;

      // if (isOverdue) {
      //   message = `🔴 Your task *${task.task_title}* is overdue! Please complete it as soon as possible.`;
      // }

      // Send WhatsApp reminder
      await sendWhatsapp.taskReminderUpdate({
        emp_id: emp.id,
        name: emp.name,
        status: task.status,
        task_id: task.task_id,
        task_no :task.id,
        task_title: task.task_title,
        start_date: formatDate(task.start_date),
        end_date: formatDate(task.end_date),
        message: message,
        mobile: emp.mobile,
      });
    }

    res.status(200).send({ status: true, message: "Reminders sent successfully" });

  } catch (error) {
    return res.status(500).send({ status: false, error: error.message });
  }
};

// send message
exports.sendTaskChatMessage = async (req, res) => {
  try {
    const {
      chat_id,
      task_id,
      sender_type,
      sender_id,
      receiver_type,
      receiver_id,
      // is_group,
      message,
      // message_type = 'text',
      reply_to_id = null
    } = req.body;

    // Validate required fields
    if (!task_id || !sender_type || !sender_id || !message) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Construct the message object
    const newMsg = {
      chat_id,
      task_id,
      sender_type,
      sender_id,
      receiver_type: receiver_type,
      receiver_id: receiver_id,
      // is_group,
      message,
      // message_type,
      reply_to_id,
      // created_at: new Date()
    };

    // Insert into DB and return inserted row
  const inserted = await sqlModel.insert("task_messages", newMsg);



   const io = req.app.get('io');
    io.to(`task-${task_id}`).emit('newTaskMessage', inserted);

    return res.status(201).json({ success: true, data: inserted });
  } catch (err) {
    console.error('Error in sendTaskChatMessage:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// emp task list 
exports.getEmployeeTask = async (req, res, next) => {
  try {
    const empId = parseInt(req.params.emp_id);
    if (!empId) return res.status(400).send({ status: false, message: "Invalid employee ID" });

    const taskQuery = `
      SELECT * FROM assign_task
      WHERE 
          emp_id LIKE '${empId},%' OR
          emp_id LIKE '%,${empId},%' OR
          emp_id LIKE '%,${empId}' OR
          emp_id = '${empId}'
        
      ORDER BY end_date ASC
    `;

    const tasks = await sqlModel.customQuery(taskQuery);

    if (tasks.error) return res.status(500).send(tasks);
    if (!tasks.length) return res.status(200).send({ status: false, message: "No data found" });

    let allEmpIds = [];
    let allTaskIds = tasks.map(task => task.id);

    tasks.forEach(task => {
      if (task.emp_id) {
        const empIds = task.emp_id.split(",").map(id => parseInt(id.trim()));
        allEmpIds.push(...empIds);
      }
    });

    allEmpIds = [...new Set(allEmpIds)];

    const employeeQuery = `SELECT id, name, image FROM employees WHERE id IN (${allEmpIds.join(",")})`;
    const employeeDetails = await sqlModel.customQuery(employeeQuery);

    // const taskStatusQuery = `SELECT task_id, emp_id, status, comment FROM assign_task_status WHERE task_id IN (${allTaskIds.join(",")})`;
    // const taskStatusDetails = await sqlModel.customQuery(taskStatusQuery);

    const employeeMap = {};
    employeeDetails.forEach(emp => {
      if (emp?.id) {
        employeeMap[emp.id] = {
          id: emp.id,
          name: emp.name,
          image: `${process.env.BASE_URL}${emp.image}`,
        };
      }
    });

    // const taskStatusMap = {};
    // taskStatusDetails.forEach(status => {
    //   if (!taskStatusMap[status.task_id]) taskStatusMap[status.task_id] = {};
    //   taskStatusMap[status.task_id][status.emp_id] = {
    //     status: status.status,
    //     comment: status.comment || null,
    //   };
    // });

    tasks.forEach(task => {
      const empIds = task.emp_id?.split(",").map(id => parseInt(id.trim())) || [];

      task.employeeDetails = empIds.map(empId => ({
        ...(employeeMap[empId] || {}),
        // status: taskStatusMap[task.id]?.[empId]?.status || "Unknown",
        // comment: taskStatusMap[task.id]?.[empId]?.comment || null,
      }));

      task.isOverdue = !["Pending-Review", "Completed", "Cancelled", "On-Hold"].includes(task.status)
        ? new Date(task.end_date) < new Date()
        : false;
    });

    res.status(200).send({ status: true, data: tasks });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};





async function runFrequencyNotifier() {
  try {
    const tasks = await sqlModel.customQuery(`
      SELECT * FROM assign_task
      WHERE frequency IS NOT NULL 
      AND status NOT IN ('Completed', 'Cancelled') 
      AND notify_start_time IS NOT NULL
    `);

    const now = new Date();

    for (const task of tasks) {
      const [value, unit] = task.frequency.split(" ");
      const freqValue = parseInt(value);
      const freqUnit = unit.toLowerCase();

      const baseTime = new Date(task.last_notified_at || task.notify_start_time);

      let nextNotify = new Date(baseTime);
      if (freqUnit.includes("day")) {
        nextNotify.setDate(nextNotify.getDate() + freqValue);
      } else if (freqUnit.includes("month")) {
        nextNotify.setMonth(nextNotify.getMonth() + freqValue);
      } else if (freqUnit.includes("hour")) {
        nextNotify.setHours(nextNotify.getHours() + freqValue);
      }

      // First-time run check
      const firstNotify = new Date(task.notify_start_time);
      if (!task.last_notified_at && now >= firstNotify && now < nextNotify) {
        nextNotify = firstNotify;
      }

      if (now >= nextNotify) {
        const empIds = task.emp_id.split(",").map(id => Number(id.trim()));
        const employees = await sqlModel.customQuery(
          `SELECT id, name, mobile FROM employees WHERE id IN (${empIds.map(() => "?").join(",")})`,
          empIds
        );

        for (const emp of employees) {
          await sendWhatsapp.taskReminderUpdate({
            emp_id: emp.id,
            name: emp.name,
            status: task.status,
            task_id: task.task_id,
            task_title: task.task_title,
            start_date: formatDate(task.start_date),
            end_date: formatDate(task.end_date),
            message: `🔁 Recurring Task Reminder: ${task.task_title}`,
            mobile: emp.mobile,
            task_no:task.id,
          });
        }

        await sqlModel.update("assign_task", {
          last_notified_at: getCurrentDateTime()
        }, { id: task.id });
      }
    }

    console.log(`[${getCurrentDateTime()}] ✅ Recurring task notifications checked.`);
  } catch (error) {
    console.error(`[${getCurrentDateTime()}] ❌ Error in frequency notifier:`, error.message);
  }
}

cron.schedule("*/15 * * * *", () => {
  runFrequencyNotifier();
});

// console.log("🔁 Recurring Task Notification Scheduler Started...");




