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

exports.getCheckIn = async (req, res, next) => {
  try {
    const whereClause = {};

    for (const key in req.query) {
      if (req.query.hasOwnProperty(key)) {
        whereClause[key] = req.query[key];
      }
    }

    const data = await sqlModel.select("check_in", {}, whereClause);

    if (data.error) {
      return res.status(500).send(data);
    }

    if (data.length === 0) {
      return res.status(200).send({ status: false, message: "No data found" });
    }

    const result = await Promise.all(
      data.map(async (item) => {
        item.checkin_img = item.checkin_img
          ? `${process.env.BASE_URL}${item.checkin_img}`
          : "";
        item.checkout_img = item.checkout_img
          ? `${process.env.BASE_URL}${item.checkout_img}`
          : "";
        return item;
      })
    );

    res.status(200).send({ status: true, data: result });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};

exports.checkIn = async (req, res, next) => {
  try {
    const insert = { ...req.body };
    const companyId = insert.company_id;
    const employeeId = insert.emp_id;

    if (!companyId) {
      return res
        .status(200)
        .send({ status: false, message: "Company ID is required" });
    }

    if (!employeeId) {
      return res
        .status(200)
        .send({ status: false, message: "Employee ID is required" });
    }

    if (req.files && req.files.checkin_img) {
      insert.checkin_img = req.fileFullPath.find((path) =>
        path.includes("checkin_img")
      );
    }

    const date = getCurrentDate();

    const checkInDataExist = await sqlModel.select(
      "check_in",
      {},
      { emp_id: employeeId, company_id: companyId, date }
    );

    if (checkInDataExist.length === 0) {
      const newCheckInData = {
        emp_id: employeeId,
        company_id: companyId,
        check_in_time: getCurrentTime(),
        lat_check_in: insert.lat_check_in,
        long_check_in: insert.long_check_in,
        checkin_img: insert.checkin_img,
        battery_status_at_checkIn: insert.battery_status_at_checkIn,
        created_at: getCurrentDateTime(),
        checkin_status: "Check-in",
        date,
      };

      const result = await sqlModel.insert("check_in", newCheckInData);

      return res
        .status(200)
        .send({ status: true, message: "Check-in successful", data: result });
    } else {
      return res
        .status(200)
        .send({ status: false, message: "Already checked in for today" });
    }
  } catch (error) {
    return res.status(500).send({
      status: false,
      message: "An error occurred during check-in",
      error: error.message,
    });
  }
};

exports.checkOut = async (req, res, next) => {
  try {
    const insert = { ...req.body };
    const companyId = insert.company_id;
    const employeeId = insert.emp_id;

    if (!companyId) {
      return res
        .status(200)
        .send({ status: false, message: "Company ID is required" });
    }

    if (!employeeId) {
      return res
        .status(200)
        .send({ status: false, message: "Employee ID is required" });
    }

    if (req.files && req.files.checkout_img) {
      insert.checkout_img = req.fileFullPath.find((path) =>
        path.includes("checkout_img")
      );
    }

    const date = getCurrentDate();

    const checkInDataExist = await sqlModel.select(
      "check_in",
      {},
      { emp_id: employeeId, company_id: companyId, date }
    );

    if (checkInDataExist.length > 0 && !checkInDataExist[0].check_out_time) {
      const updateData = {
        check_out_time: getCurrentTime(),
        lat_check_out: insert.lat_check_out,
        long_check_out: insert.long_check_out,
        checkout_img: insert.checkout_img,
        battery_status_at_checkout: insert.battery_status_at_checkout,
        checkin_status: "Check-out",
        updated_at: getCurrentDateTime(),
      };

      const result = await sqlModel.update("check_in", updateData, {
        emp_id: employeeId,
        company_id: companyId,
        date,
      });

      return res
        .status(200)
        .send({ status: true, message: "Check-out successful", data: result });
    } else {
      return res.status(200).send({
        status: false,
        message: "No check-in record found for today or already checked out",
      });
    }
  } catch (error) {
    return res.status(500).send({
      status: false,
      message: "An error occurred during check-out",
      error: error.message,
    });
  }
};
