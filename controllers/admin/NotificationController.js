const sqlModel = require("../../config/db");

exports.getNotification = async (req, res, next) => {
  try {
    const companyId = req.params?.id || "";
    const queryParams = req.query;
    let whereClause = {};
    if (companyId) {
      whereClause.company_id = companyId;
    }
    // Loop through the query parameters and dynamically add them to the where clause
    Object.keys(queryParams).forEach((key) => {
      if (queryParams[key]) {
        whereClause[key] = queryParams[key]; // Add query param as a condition
      }
    });

    const data = await sqlModel.select(
      "notification",
      {},
      whereClause,
      "ORDER BY timestamp DESC"
    );
    if (data.error) {
      return res.status(500).send(data);
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

exports.markAsRead = async (req, res, next) => {
  try {
    const { companyId } = req.body;

    const insert = {
      title: "Read Before",
    };
    const result = await sqlModel.update("notification", insert, {
      company_id: companyId,
    });

    return res.status(200).send({
      status: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    return res.status(500).send({ status: false, error: error.message });
  }
};

exports.clearAll = async (req, res, next) => {
  try {
    const { companyId } = req.body;

    if (!companyId) {
      return res
        .status(400)
        .send({ status: false, message: "Company ID is required" });
    }

    const updateData = { status: "read" };
    const result = await sqlModel.update("notification", updateData, {
      company_id: companyId,
      status: "unread",
    });

    if (result.affectedRows > 0) {
      return res.status(200).send({
        status: true,
        message: "All notifications marked as read",
      });
    } else {
      return res.status(200).send({
        status: true,
        message: "No unread notifications found",
      });
    }
  } catch (error) {
    return res.status(500).send({ status: false, error: error.message });
  }
};

exports.deletenotification = async (req, res, next) => {
  try {
    let id = req.params.id;
    const notificationRecord = await sqlModel.select(
      "notification",
      {},
      { id }
    );

    if (notificationRecord.error || notificationRecord.length === 0) {
      return res.status(200).send({ status: false, message: "Data not found" });
    }

    let result = await sqlModel.delete("notification", { id: id });

    if (!result.error) {
      res.status(200).send({ status: true, message: "Record deleted" });
    } else {
      res.status(200).send(result);
    }
  } catch (error) {
    res.status(200).send({ status: false, error: error.message });
  }
};

exports.deleteMultiplenotifications = async (req, res, next) => {
  try {
    const ids = req.body.ids;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).send({ status: false, message: "Invalid input" });
    }

    const results = await Promise.all(
      ids.map((id) => sqlModel.delete("notification", { id }))
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
