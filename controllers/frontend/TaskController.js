// controllers/frontend/RequestsController.js
const path = require("path");
const fs = require("fs");
const sqlModel = require("../../config/db");
const { uploadLocalFileToS3 } = require("../../config/s3");
// const adminMessaging = require("../../firebase"); 
const { getCurrentDateTime } = require("../../config/datetime");

const admin = require("../../firebase");
exports.getEmployeeTask = async (req, res) => {
  try {
    /* ------------------ TOKEN ------------------ */
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(200).send({
        status: false,
        message: "Token is required",
      });
    }

    /* ------------------ USER ------------------ */
    const [user] = await sqlModel.select(
      "employees",
      ["id", "company_id", "name", "image"],
      { api_token: token }
    );

    if (!user) {
      return res.status(200).send({
        status: false,
        message: "User not found",
      });
    }

    const empId = user.id;
    const companyId = user.company_id;
    const { status } = req.query;

    /* ------------------ TASK QUERY ------------------ */
    let where = `
      (
        emp_id = ? OR
        emp_id LIKE ? OR
        emp_id LIKE ? OR
        emp_id LIKE ?
      )
    `;

    const params = [
      empId,
      `${empId},%`,
      `%,${empId},%`,
      `%,${empId}`,
    ];

    if (status && status !== "All") {
      where += " AND status = ? ";
      params.push(status);
    }

    const tasks = await sqlModel.customQuery(
      `
      SELECT *
      FROM assign_task
      WHERE ${where}
      ORDER BY end_date ASC
      `,
      params
    );

    if (!tasks.length) {
      return res.status(200).send({
        status: true,
        data: [],
      });
    }

    /* ------------------ COLLECT ALL EMP IDS ------------------ */
    let allEmpIds = [];

    tasks.forEach(task => {
      if (task.emp_id) {
        const ids = task.emp_id
          .split(",")
          .map(id => Number(id.trim()))
          .filter(id => !isNaN(id));
        allEmpIds.push(...ids);
      }
    });

    allEmpIds = [...new Set(allEmpIds)];

    /* ------------------ FETCH EMPLOYEES ------------------ */
    const placeholders = allEmpIds.map(() => "?").join(",");

    const employeeDetails = await sqlModel.customQuery(
      `
      SELECT id, name, image
      FROM employees
      WHERE id IN (${placeholders})
        AND company_id = ?
      `,
      [...allEmpIds, companyId]
    );

    /* ------------------ EMPLOYEE MAP ------------------ */
    const employeeMap = {};
    employeeDetails.forEach(emp => {
      employeeMap[emp.id] = {
        id: emp.id,
        name: emp.name,
        image: emp.image ? `${process.env.BASE_URL}${emp.image}` : null,
      };
    });

    /* ------------------ FETCH ALL STATUSES ------------------ */
    const allTaskIds = tasks.map(t => t.id);
    const allTaskStatuses = await sqlModel.select(
      "assign_task_status",
      ["task_id", "emp_id", "status"],
      {} // select all for these tasks
    );
    // Filter in JS since we don't have a complex where builder here
    const statusMap = {};
    allTaskStatuses.forEach(s => {
      if (allTaskIds.includes(s.task_id)) {
        if (!statusMap[s.task_id]) statusMap[s.task_id] = {};
        statusMap[s.task_id][s.emp_id] = s.status;
      }
    });

    /* ------------------ FINAL TASK MAP ------------------ */
    const now = new Date();

    tasks.forEach(task => {
      const empIds = task.emp_id
        ? task.emp_id
          .split(",")
          .map(id => Number(id.trim()))
          .filter(id => !isNaN(id))
        : [];

      task.assigned_employee_ids = empIds;

      task.employees = empIds
        .map(id => {
          const emp = employeeMap[id];
          if (!emp) return null;
          return {
            ...emp,
            status: statusMap[task.id]?.[id] || "To-Do",
          };
        })
        .filter(Boolean);

      task.isOverdue =
        !["Pending-Review", "Completed", "Cancelled", "On-Hold"].includes(task.status) &&
        new Date(task.end_date) < now;

      delete task.emp_id;
    });

    return res.status(200).send({
      status: true,
      data: tasks,
    });
  } catch (error) {
    console.error("getEmployeeTask error:", error);
    return res.status(500).send({
      status: false,
      message: error.message,
    });
  }
};

exports.getEmployeeTaskById = async (req, res) => {
  try {
    /* ------------------ TOKEN ------------------ */
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(200).send({
        status: false,
        message: "Token is required",
      });
    }

    /* ------------------ USER ------------------ */
    const [user] = await sqlModel.select(
      "employees",
      ["id", "company_id", "name", "image"],
      { api_token: token }
    );

    if (!user) {
      return res.status(200).send({
        status: false,
        message: "User not found",
      });
    }

    const companyId = user.company_id;
    const taskId = req.params.task_id;

    if (!taskId) {
      return res.status(400).send({
        status: false,
        message: "task_id is required",
      });
    }

    /* ------------------ TASK ------------------ */
    const [task] = await sqlModel.customQuery(
      `
      SELECT *
      FROM assign_task
      WHERE task_id = ?
        AND company_id = ?
      LIMIT 1
      `,
      [taskId, companyId]
    );

    if (!task) {
      return res.status(200).send({
        status: false,
        message: "Task not found",
      });
    }

    /* ------------------ ASSIGNED EMP IDS ------------------ */
    const empIds = task.emp_id
      ? task.emp_id
        .split(",")
        .map(id => Number(id.trim()))
        .filter(id => !isNaN(id))
      : [];

    task.assigned_employee_ids = empIds;
    task.assigned_by = 'Admin';
    /* ------------------ FETCH EMPLOYEES ------------------ */
    let employeeMap = {};

    if (empIds.length > 0) {
      const placeholders = empIds.map(() => "?").join(",");

      const employeeDetails = await sqlModel.customQuery(
        `
        SELECT id, name, image
        FROM employees
        WHERE id IN (${placeholders})
          AND company_id = ?
        `,
        [...empIds, companyId]
      );

      employeeDetails.forEach(emp => {
        employeeMap[emp.id] = {
          id: emp.id,
          name: emp.name,
          image: emp.image
            ? `${process.env.BASE_URL}${emp.image}`
            : null,
        };
      });
    }

    /* ------------------ FETCH STATUSES & COMMENTS ------------------ */
    const statuses = await sqlModel.select(
      "assign_task_status",
      ["emp_id", "status", "comment"],
      { task_id: task.id }
    );

    const statusMap = {};
    statuses.forEach(s => {
      statusMap[s.emp_id] = {
        status: s.status,
        comment: s.comment ? JSON.parse(s.comment) : [],
      };
    });

    /* ------------------ EMPLOYEES (ALWAYS ALL) ------------------ */
    task.employees = empIds
      .map(id => {
        const emp = employeeMap[id];
        if (!emp) return null;
        return {
          ...emp,
          status: statusMap[id]?.status || "To-Do",
          comments: statusMap[id]?.comment || [],
        };
      })
      .filter(Boolean);


    /* ------------------ OVERDUE ------------------ */
    task.isOverdue =
      !["Pending-Review", "Completed", "Cancelled", "On-Hold"].includes(task.status) &&
      task.end_date &&
      new Date(task.end_date) < new Date();

    delete task.emp_id;

    return res.status(200).send({
      status: true,
      data: task,
    });
  } catch (error) {
    console.error("getEmployeeTaskById error:", error);
    return res.status(500).send({
      status: false,
      message: error.message,
    });
  }
};

exports.updateTaskStatus = async (req, res) => {
  try {
    const { task_id, status, comment } = req.body;

    if (!task_id || !status) {
      return res.status(400).send({
        status: false,
        message: "task_id and status are required",
      });
    }

    /* ------------------ TOKEN ------------------ */
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).send({
        status: false,
        message: "Token is required",
      });
    }

    /* ------------------ USER ------------------ */
    const [user] = await sqlModel.select(
      "employees",
      ["id", "company_id", "name"],
      { api_token: token }
    );

    if (!user) {
      return res.status(401).send({
        status: false,
        message: "Invalid token",
      });
    }

    const empId = user.id;
    const companyId = user.company_id;

    /* ------------------ TASK ------------------ */
    const [task] = await sqlModel.select(
      "assign_task",
      ["id", "emp_id", "company_id", "task_title", "status"],
      { id: task_id, company_id: companyId }
    );
console.log("Task found:", task);
    if (!task) {
      return res.status(404).send({
        status: false,
        message: "Task not found",
      });
    }

    /* ------------------ CHECK ASSIGNMENT ------------------ */
    const assignedEmpIds = task.emp_id
      .split(",")
      .map(id => Number(id.trim()));

    if (!assignedEmpIds.includes(empId)) {
      return res.status(403).send({
        status: false,
        message: "You are not assigned to this task",
      });
    }

    /* ------------------ VALID STATUS ------------------ */
    const allowedStatuses = ["In-Progress", "Completed", "Cancelled"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).send({
        status: false,
        message: `Invalid status. Allowed: ${allowedStatuses.join(", ")}`,
      });
    }

    /* ------------------ UPSERT TASK STATUS ------------------ */
    const existingStatus = await sqlModel.select(
      "assign_task_status",
      ["id", "comment"],
      { task_id, emp_id: empId }
    );

    let existingComments = [];
    if (existingStatus.length && existingStatus[0].comment) {
      try {
        existingComments = JSON.parse(existingStatus[0].comment);
      } catch {
        existingComments = [];
      }
    }

    if (comment?.text) {
      existingComments.push({
        text: comment.text,
        timestamp: new Date().toISOString(),
      });
    }

    const commentData = existingComments.length
      ? JSON.stringify(existingComments)
      : null;

    if (existingStatus.length > 0) {
      // Update existing record
      await sqlModel.update(
        "assign_task_status",
        {
          status,
          comment: commentData,
          updated_at: getCurrentDateTime(),
        },
        { task_id, emp_id: empId }
      );
    } else {
      // Insert new record if missing
      await sqlModel.insert("assign_task_status", {
        task_id,
        emp_id: empId,
        status,
        comment: commentData,
        created_at: getCurrentDateTime(),
        updated_at: getCurrentDateTime(),
      });
    }

    /* ------------------ HISTORY ------------------ */
    await sqlModel.insert("assign_task_status_history", {
      task_id,
      emp_id: empId,
      status,
      comment: commentData,
      created_at: getCurrentDateTime(),
    });

    /* ------------------ CHECK OVERALL TASK STATUS ------------------ */
    const allStatuses = await sqlModel.select(
      "assign_task_status",
      ["status"],
      { task_id }
    );

    const statuses = allStatuses.map(r => r.status);
    const allCompleted = statuses.length > 0 && statuses.every(s => s === "Completed");
    const allCancelled = statuses.length > 0 && statuses.every(s => s === "Cancelled");

    if (allCompleted) {
      await sqlModel.update(
        "assign_task",
        { status: "Pending-Review" },
        { id: task_id }
      );
    } else if (allCancelled) {
      await sqlModel.update(
        "assign_task",
        { status: "Cancelled" },
        { id: task_id }
      );
    } else {
      // If any part of the task is in progress, mark overall as In-Progress
      // even if the current status is Completed (but others aren't)
      await sqlModel.update(
        "assign_task",
        { status: "In-Progress" },
        { id: task_id }
      );
    }

    /* ------------------ NOTIFICATION ------------------ */
    /* ------------------ NOTIFICATION ------------------ */
    const adminTokens = await sqlModel.select(
      "fcm_tokens",
      ["id", "fcm_token"],
      { user_id: companyId }
    );

    if (adminTokens.length) {
      const message =
        status === "Completed"
          ? `✅ ${user.name} completed task "${task.task_title}"`
          : status === "Cancelled"
            ? `❌ ${user.name} cancelled task "${task.task_title}"`
            : `🔔 ${user.name} started task "${task.task_title}"`;

      const sendPromises = adminTokens.map(async ({ id, fcm_token }) => {
        try {
          await admin.messaging().send({
            notification: {
              title: "Task Update",
              body: message,
            },
            token: fcm_token,
          });
        } catch (err) {
          // ✅ Handle invalid / expired token
          if (
            err.code === "messaging/registration-token-not-registered" ||
            err.code === "messaging/invalid-registration-token"
          ) {
            console.warn("Removing invalid FCM token:", fcm_token);

            // Delete invalid token from DB
            await sqlModel.delete("fcm_tokens", { id });
          } else {
            console.error("FCM send error:", err.message);
          }
        }
      });

      // IMPORTANT: wait for all, but never throw
      await Promise.allSettled(sendPromises);

      // Save notification in DB (once)
      await sqlModel.insert("notification", {
        company_id: companyId,
        title: "Task Update",
        body: message,
        link: `/task-detail/${task.id}`,
        status: "unread",
        timestamp: getCurrentDateTime(),
      });
    }

    return res.status(200).send({
      status: true,
      message: "Task updated successfully",
    });

  } catch (error) {
    console.error("updateTaskStatus error:", error);
    return res.status(500).send({
      status: false,
      message: error.message,
    });
  }
};




