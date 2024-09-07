const sqlModel = require("../../config/db");

exports.getNotification = async (req, res, next) => {
  try {
    const companyId = req.params?.company_id || "";
    let whereClause = {};
    if (companyId) {
      whereClause.company_id = companyId;
    }
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
