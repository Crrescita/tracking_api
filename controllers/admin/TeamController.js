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

exports.createDepartment = async (req, res, next) => {
  try {
    const id = req.params.id || "";
    const { name, status } = req.body;

    // Create slug
    let slug = "";
    if (name) {
      slug = createSlug(name);
    }

    const insert = { name, slug, status };

    const existingSlug = await sqlModel.select("department", ["id"], { slug });

    if (existingSlug.length > 0 && (id === "" || existingSlug[0].id !== id)) {
      return res
        .status(400)
        .send({ status: false, message: "Slug already exists" });
    }

    if (id) {
      const departmentRecord = await sqlModel.select("department", ["name"], {
        id,
      });
      if (departmentRecord.error || departmentRecord.length === 0) {
        return res
          .status(200)
          .send({ status: false, message: "Department not found" });
      }

      insert.updated_at = getCurrentDateTime();
      const saveData = await sqlModel.update("department", insert, { id });

      if (saveData.error) {
        return res.status(200).send(saveData);
      } else {
        return res.status(200).send({ status: true, message: "Data Updated" });
      }
    } else {
      insert.created_at = getCurrentDateTime();
      const saveData = await sqlModel.insert("department", insert);

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

exports.getDepartment = async (req, res, next) => {
  try {
    // const id = req.params?.id || "";
    const whereClause = {};
    for (const key in req.query) {
      if (req.query.hasOwnProperty(key)) {
        whereClause[key] = req.query[key];
      }
    }

    // const whereClause = id ? { id } : {};
    const data = await sqlModel.select("department", {}, whereClause);

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

exports.deleteDepartment = async (req, res, next) => {
  try {
    let id = req.params.id;

    const departmentRecord = await sqlModel.select("department", {}, { id });

    if (departmentRecord.error || departmentRecord.length === 0) {
      return res.status(200).send({ status: false, message: "Data not found" });
    }

    let result = await sqlModel.delete("department", { id: id });

    if (!result.error) {
      res.status(200).send({ status: true, message: "Record deleted" });
    } else {
      res.status(200).send(result);
    }
  } catch (error) {
    res.status(200).send({ status: false, error: error.message });
  }
};

exports.deleteMultipleDepartments = async (req, res, next) => {
  try {
    const ids = req.body.ids;
    console.log(ids);
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).send({ status: false, message: "Invalid input" });
    }
    console.log(ids);
    const results = await Promise.all(
      ids.map((id) => sqlModel.delete("department", { id }))
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

// designation

exports.createDesignation = async (req, res, next) => {
  try {
    const id = req.params.id || "";
    const { name, status } = req.body;

    // Create slug
    let slug = "";
    if (name) {
      slug = createSlug(name);
    }

    const insert = { name, slug, status };

    const existingSlug = await sqlModel.select("designation", ["id"], { slug });

    if (existingSlug.length > 0 && (id === "" || existingSlug[0].id !== id)) {
      return res
        .status(400)
        .send({ status: false, message: "Slug already exists" });
    }

    if (id) {
      const departmentRecord = await sqlModel.select("designation", ["name"], {
        id,
      });
      if (departmentRecord.error || departmentRecord.length === 0) {
        return res
          .status(200)
          .send({ status: false, message: "Department not found" });
      }

      insert.updated_at = getCurrentDateTime();
      const saveData = await sqlModel.update("designation", insert, { id });

      if (saveData.error) {
        return res.status(200).send(saveData);
      } else {
        return res.status(200).send({ status: true, message: "Data Updated" });
      }
    } else {
      insert.created_at = getCurrentDateTime();
      const saveData = await sqlModel.insert("designation", insert);

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

exports.getDesignation = async (req, res, next) => {
  try {
    const id = req.params?.id || "";
    const whereClause = id ? { id } : {};
    const data = await sqlModel.select("designation", {}, whereClause);

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

exports.deleteDesignation = async (req, res, next) => {
  try {
    let id = req.params.id;

    const departmentRecord = await sqlModel.select("designation", {}, { id });

    if (departmentRecord.error || departmentRecord.length === 0) {
      return res.status(200).send({ status: false, message: "Data not found" });
    }

    let result = await sqlModel.delete("designation", { id: id });

    if (!result.error) {
      res.status(200).send({ status: true, message: "Record deleted" });
    } else {
      res.status(200).send(result);
    }
  } catch (error) {
    res.status(200).send({ status: false, error: error.message });
  }
};

exports.deleteMultipleDesignation = async (req, res, next) => {
  try {
    const ids = req.body.ids;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).send({ status: false, message: "Invalid input" });
    }

    const results = await Promise.all(
      ids.map((id) => sqlModel.delete("designation", { id }))
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
