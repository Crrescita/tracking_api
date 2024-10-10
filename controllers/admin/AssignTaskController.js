const sqlModel = require("../../config/db");

const generateTaskID = () => {
  const prefix = "TMS";
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${datePart}${randomPart}`;
};

exports.getAssignTask = async (req, res, next) => {
  try {
    const whereClause = {};
    for (const key in req.query) {
      if (req.query.hasOwnProperty(key)) {
        whereClause[key] = req.query[key];
      }
    }

    const tasks = await sqlModel.select(
      "assign_task",
      {},
      whereClause,
      "ORDER BY start_date ASC"
    );

    if (tasks.error) {
      return res.status(500).send(tasks);
    }

    if (tasks.length === 0) {
      return res.status(200).send({ status: false, message: "No data found" });
    }

    let allEmpIds = [];
    tasks.forEach((task) => {
      if (task.emp_id) {
        const empIds = task.emp_id.split(",").map((id) => parseInt(id.trim()));
        allEmpIds = [...allEmpIds, ...empIds];
      }
    });

    allEmpIds = [...new Set(allEmpIds)];

    const employeeDetails = [];
    for (const empId of allEmpIds) {
      const empDetail = await sqlModel.select("employees", {}, { id: empId });

      if (empDetail.error) {
        return res.status(500).send(empDetail);
      }

      if (empDetail.length > 0) {
        employeeDetails.push(empDetail[0]);
      }
    }

    const employeeMap = {};
    employeeDetails.forEach((emp) => {
      if (emp && emp.id) {
        employeeMap[emp.id] = {
          id: emp.id,
          name: emp.name,
          image: `${process.env.BASE_URL}${emp.image}`,
        };
      }
    });

    tasks.forEach((task) => {
      if (task.emp_id) {
        const empIds = task.emp_id.split(",").map((id) => parseInt(id.trim()));
        task.employeeDetails = empIds.map(
          (empId) => employeeMap[empId] || null
        );
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
    const insert = { ...req.body };

    if (id) {
      const taskRecord = await sqlModel.select("assign_task", ["task_title"], {
        id,
      });
      if (taskRecord.error || taskRecord.length === 0) {
        return res
          .status(200)
          .send({ status: false, message: "Task not found" });
      }

      insert.updated_at = getCurrentDateTime();
      const saveData = await sqlModel.update("assign_task", insert, { id });

      if (saveData.error) {
        return res.status(200).send(saveData);
      } else {
        return res.status(200).send({ status: true, message: "Data Updated" });
      }
    } else {
      insert.task_id = generateTaskID();
      insert.created_at = getCurrentDateTime();
      const saveData = await sqlModel.insert("assign_task", insert);

      if (saveData.error) {
        return res.status(200).send(saveData);
      } else {
        return res.status(200).send({ status: true, message: "Data Saved" });
      }
    }
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};

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
