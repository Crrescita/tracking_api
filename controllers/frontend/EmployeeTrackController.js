const sqlModel = require("../../config/db");

const getCurrentDate = () => {
  return new Date().toISOString().slice(0, 10); // Format: YYYY-MM-DD
};

const getCurrentTime = () => {
  const currentDate = new Date();

  const hour = String(currentDate.getHours()).padStart(2, "0");
  const minute = String(currentDate.getMinutes()).padStart(2, "0");
  const second = String(currentDate.getSeconds()).padStart(2, "0");

  const formattedTime = `${hour}:${minute}:${second}`;

  return formattedTime;
};

exports.getCoordinates = async (req, res, next) => {
  try {
    const whereClause = {};

    for (const key in req.query) {
      if (req.query.hasOwnProperty(key)) {
        whereClause[key] = req.query[key];
      }
    }

    const data = await sqlModel.select("emp_tracking", {}, whereClause);

    if (data.error) {
      return res.status(500).send(data);
    }

    if (data.length === 0) {
      return res.status(200).send({ status: false, message: "No data found" });
    }

    const result = await Promise.all(
      data.map(async (item) => {
        item.image = item.image ? `${process.env.BASE_URL}${item.image}` : "";

        return item;
      })
    );

    res.status(200).send({ status: true, data: result });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};

exports.setCoordinates = async (req, res, next) => {
  try {
    const {
      company_id,
      emp_id,
      latitude,
      longitude,
      battery_status,
      gps_status,
      internet_status,
      motion,
datetime_mobile,
row_id,
      ...rest
    } = req.body;

    // Validate required fields
    const requiredFields = {
      company_id,
      emp_id,
      latitude,
      longitude,
      battery_status,
      gps_status,
      internet_status,
      motion,
    };

    for (const [key, value] of Object.entries(requiredFields)) {
      if (!value) {
        return res.status(400).send({
          status: false,
          message: `${key.replace("_", " ")} is required`,
        });
      }
    }

    // Prepare data for insertion
    const newCheckInData = {
      company_id,
      emp_id,
      latitude,
      longitude,
      battery_status,
      date: getCurrentDate(),
      time: getCurrentTime(),
      created_at: getCurrentDateTime(),
      gps_status,
      internet_status,
      motion,
      ...rest,
    };

    // Insert tracking data
    const result = await sqlModel.insert("emp_tracking", newCheckInData);

    const employee = await sqlModel.select("employees", ["timer"], {
      id: emp_id,
      company_id,
    });

    if (!employee.length) {
      return res.status(404).send({
        status: false,
        message: "Employee not found",
      });
    }

    const timerValue = employee[0].timer || 30000;

    return res.status(200).send({
      status: true,
      message: "Data submitted successfully",
      data: result,
      row_id:row_id,
      timer: timerValue, // Include the timer in the response
    });
  } catch (error) {
    console.error("Error during data submission:", error);
    return res.status(500).send({
      status: false,
      message: "An error occurred during data submission",
      error: error.message,
    });
  }
};

exports.setAllCoordinates = async (req, res, next) => {
  try {
    const dataArray = req.body;

    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      return res.status(400).send({
        status: false,
        message: "Data should be a non-empty array",
      });
    }

    // Extract emp_id and company_id from the first item
    const { emp_id, company_id } = dataArray[0];

    // Fetch timer value from the employees table
    const employee = await sqlModel.select("employees", ["timer"], {
      id: emp_id,
      company_id,
    });

    if (!employee.length) {
      return res.status(404).send({
        status: false,
        message: "Employee not found",
      });
    }

    const timerValue = employee[0].timer || 30000;

    // Insert data into emp_tracking table
    for (const item of dataArray) {
      const {
        company_id,
        emp_id,
        latitude,
        longitude,
        battery_status,
        gps_status,
        internet_status,
        motion,
        ...rest
      } = item;

      const requiredFields = {
        company_id,
        emp_id,
        latitude,
        longitude,
        battery_status,
        gps_status,
        internet_status,
        motion,
      };

      for (const [key, value] of Object.entries(requiredFields)) {
        if (!value) {
          return res.status(400).send({
            status: false,
            message: `${key.replace("_", " ")} is required`,
          });
        }
      }

      const newCheckInData = {
        company_id,
        emp_id,
        latitude,
        longitude,
        battery_status,
        date: getCurrentDate(),
        time: getCurrentTime(),
        created_at: getCurrentDateTime(),
        gps_status,
        internet_status,
        motion,
        ...rest,
      };

      await sqlModel.insert("emp_tracking", newCheckInData);
    }

    return res.status(200).send({
      status: true,
      message: "Data submitted successfully",
      timer: timerValue, // Include the timer value in the response
    });
  } catch (error) {
    console.error("Error during data submission:", error);
    return res.status(500).send({
      status: false,
      message: "An error occurred during data submission",
      error: error.message,
    });
  }
};
