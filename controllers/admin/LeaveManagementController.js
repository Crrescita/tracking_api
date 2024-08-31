const sqlModel = require("../../config/db");

const createSlug = (title) => {
  return title
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w\-]+/g, "") // Remove all non-word characters
    .replace(/\-\-+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, ""); // Trim - from end of text
};

exports.createLeaveType = async (req, res, next) => {
  try {
    const id = req.params.id || "";
    const { name, status } = req.body;

    let slug = "";
    if (name) {
      slug = createSlug(name);
    }
    const insert = { name, slug, status };

    if (id) {
      const leaveTypeRecord = await sqlModel.select("leave_type", ["name"], {
        id,
      });
      if (leaveTypeRecord.error || leaveTypeRecord.length === 0) {
        return res
          .status(200)
          .send({ status: false, message: "leave Type not found" });
      }

      insert.updated_at = getCurrentDateTime();
      const saveData = await sqlModel.update("leave_type", insert, {
        id,
      });

      if (saveData.error) {
        return res.status(200).send(saveData);
      } else {
        return res.status(200).send({ status: true, message: "Data Updated" });
      }
    } else {
      const existingSlug = await sqlModel.select("leave_type", ["id"], {
        slug,
      });

      if (existingSlug.length > 0 && (id === "" || existingSlug[0].id !== id)) {
        return res
          .status(400)
          .send({ status: false, message: "Leave Type already exists" });
      }
      insert.created_at = getCurrentDateTime();
      const saveData = await sqlModel.insert("leave_type", insert);

      if (saveData.error) {
        return res.status(200).send(saveData);
      } else {
        return res.status(200).send({ status: true, message: "Data Saved" });
      }
    }
  } catch (err) {
    return res.status(500).send({ status: false, error: err.message });
  }
};

exports.getLeaveType = async (req, res, next) => {
  try {
    const whereClause = {};
    for (const key in req.query) {
      if (req.query.hasOwnProperty(key)) {
        whereClause[key] = req.query[key];
      }
    }

    const data = await sqlModel.select("leave_type", {}, whereClause);

    if (data.error) {
      return res.status(500).send(data);
    }

    if (data.length === 0) {
      return res.status(200).send({ status: false, message: "No data found" });
    }
    res.status(200).send({ status: true, data: data });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};

exports.deleteLeaveType = async (req, res, next) => {
  try {
    let id = req.params.id;

    const leaveTypeRecord = await sqlModel.select("leave_type", {}, { id });

    if (leaveTypeRecord.error || leaveTypeRecord.length === 0) {
      return res.status(200).send({ status: false, message: "Data not found" });
    }

    let result = await sqlModel.delete("leave_type", { id: id });

    if (!result.error) {
      res.status(200).send({ status: true, message: "Record deleted" });
    } else {
      res.status(200).send(result);
    }
  } catch (error) {
    res.status(200).send({ status: false, error: error.message });
  }
};

exports.deleteMultipleLeaveType = async (req, res, next) => {
  try {
    const ids = req.body.ids;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).send({ status: false, message: "Invalid input" });
    }

    const results = await Promise.all(
      ids.map((id) => sqlModel.delete("leave_type", { id }))
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
