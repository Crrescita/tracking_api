const sqlModel = require("../../config/db");

// exports.getAssignTask = async (req, res, next) => {
//   try {
//     const whereClause = {};
//     for (const key in req.query) {
//       if (req.query.hasOwnProperty(key)) {
//         whereClause[key] = req.query[key];
//       }
//     }

//     const data = await sqlModel.select(
//       "assign_task",
//       {},
//       whereClause,
//       "ORDER BY start_date ASC"
//     );

//     if (data.error) {
//       return res.status(500).send(data);
//     }

//     if (data.length === 0) {
//       return res.status(200).send({ status: false, message: "No data found" });
//     }
//     res.status(200).send({ status: true, data: data });
//   } catch (error) {
//     res.status(500).send({ status: false, error: error.message });
//   }
// };

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

    // Step 1: Collect all unique emp_ids from the tasks
    let allEmpIds = [];
    tasks.forEach((task) => {
      if (task.emp_id) {
        const empIds = task.emp_id.split(",").map((id) => parseInt(id.trim()));
        allEmpIds = [...allEmpIds, ...empIds];
        console.log("Collected Employee IDs: ", allEmpIds);
      }
    });

    // Remove duplicate employee IDs
    allEmpIds = [...new Set(allEmpIds)];
    console.log("allEmpIds", allEmpIds);

    // Step 2: Fetch employee details one by one
    const employeeDetails = [];
    for (const empId of allEmpIds) {
      const empDetail = await sqlModel.select(
        "employees",
        {},
        { id: empId } // Fetching one employee at a time
      );

      if (empDetail.error) {
        return res.status(500).send(empDetail);
      }

      if (empDetail.length > 0) {
        employeeDetails.push(empDetail[0]); // Assuming empDetail is an array
      } else {
        console.log(`No employee found for ID: ${empId}`);
      }
    }

    // Log employee details to verify
    console.log("Employee Details Fetched: ", employeeDetails);

    // Step 3: Create a map of employee details by ID for easy lookup
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

    // Log employee map to verify
    console.log("Employee Map: ", employeeMap);

    // Step 4: Map employee details to tasks
    tasks.forEach((task) => {
      if (task.emp_id) {
        const empIds = task.emp_id.split(",").map((id) => parseInt(id.trim()));
        task.employeeDetails = empIds.map(
          (empId) => employeeMap[empId] || null
        );
      }
    });

    // Log tasks to verify employee details
    console.log("Tasks with Employee Details: ", tasks);

    // Return tasks with employee details attached
    res.status(200).send({ status: true, data: tasks });
  } catch (error) {
    console.error("Error fetching assigned tasks: ", error); // Log error for better visibility
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
