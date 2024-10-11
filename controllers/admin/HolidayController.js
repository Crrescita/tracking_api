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

const getCurrentDate = () => {
  const currentDate = new Date();

  const options = {
    timeZone: "Asia/Kolkata",
  };
  const year = currentDate.toLocaleString("en-US", {
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
  const month = String(currentDate.getMonth() + 1).padStart(2, "0");
  const day = String(currentDate.getDate()).padStart(2, "0");

  const formattedDate = `${year}-${month}-${day}`;

  return formattedDate;
};

// Helper function for future time (upcoming leave)
const getFutureRelativeTime = (date) => {
  const now = new Date();
  const targetDate = new Date(date);

  const diffInMs = targetDate - now;
  const diffInSeconds = Math.floor(diffInMs / 1000);
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);
  const diffInMonths = Math.floor(diffInDays / 30);
  const diffInYears = Math.floor(diffInDays / 365);

  if (diffInYears > 0) {
    return `in ${diffInYears} year${diffInYears === 1 ? "" : "s"}`;
  } else if (diffInMonths > 0) {
    return `in ${diffInMonths} month${diffInMonths === 1 ? "" : "s"}`;
  } else if (diffInDays > 0) {
    return `in ${diffInDays} day${diffInDays === 1 ? "" : "s"}`;
  } else if (diffInHours > 0) {
    return `in ${diffInHours} hour${diffInHours === 1 ? "" : "s"}`;
  } else if (diffInMinutes > 0) {
    return `in ${diffInMinutes} minute${diffInMinutes === 1 ? "" : "s"}`;
  } else {
    return "Today";
  }
};

exports.createHoliday = async (req, res, next) => {
  try {
    const id = req.params.id || "";
    const { name, date, status, company_id } = req.body;

    let slug = "";
    if (name) {
      slug = createSlug(name);
    }
    const insert = { name, date, slug, status, company_id };

    if (id) {
      const holidayRecord = await sqlModel.select(
        "company_holidays",
        ["name"],
        {
          id,
        }
      );
      if (holidayRecord.error || holidayRecord.length === 0) {
        return res
          .status(200)
          .send({ status: false, message: "holiday not found" });
      }

      insert.updated_at = getCurrentDateTime();
      const saveData = await sqlModel.update("company_holidays", insert, {
        id,
      });

      if (saveData.error) {
        return res.status(200).send(saveData);
      } else {
        return res.status(200).send({ status: true, message: "Data Updated" });
      }
    } else {
      const existingSlug = await sqlModel.select("company_holidays", ["id"], {
        slug,
        company_id,
      });

      if (existingSlug.length > 0 && (id === "" || existingSlug[0].id !== id)) {
        return res
          .status(400)
          .send({ status: false, message: "holiday already exists" });
      }
      insert.created_at = getCurrentDateTime();
      const saveData = await sqlModel.insert("company_holidays", insert);

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

exports.getHoliday = async (req, res, next) => {
  try {
    const whereClause = {};
    for (const key in req.query) {
      if (req.query.hasOwnProperty(key)) {
        whereClause[key] = req.query[key];
      }
    }

    const data = await sqlModel.select(
      "company_holidays",
      {},
      whereClause,
      "ORDER BY date ASC"
    );

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

exports.deleteHoliday = async (req, res, next) => {
  try {
    let id = req.params.id;

    const holidayRecord = await sqlModel.select("company_holidays", {}, { id });

    if (holidayRecord.error || holidayRecord.length === 0) {
      return res.status(200).send({ status: false, message: "Data not found" });
    }

    let result = await sqlModel.delete("company_holidays", { id: id });

    if (!result.error) {
      res.status(200).send({ status: true, message: "Record deleted" });
    } else {
      res.status(200).send(result);
    }
  } catch (error) {
    res.status(200).send({ status: false, error: error.message });
  }
};

exports.deleteMultipleHolidays = async (req, res, next) => {
  try {
    const ids = req.body.ids;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).send({ status: false, message: "Invalid input" });
    }

    const results = await Promise.all(
      ids.map((id) => sqlModel.delete("company_holidays", { id }))
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

// upcoming hoildays
// exports.getUpcomingHoliday = async (req, res, next) => {
//   try {
//     const whereClause = {};
//     for (const key in req.query) {
//       if (req.query.hasOwnProperty(key)) {
//         whereClause[key] = req.query[key];
//       }
//     }

//     const currentDate = getCurrentDate();

//     const query = `
//       SELECT name, date
//       FROM company_holidays
//       WHERE date >= ? AND status = 'active'
//       ORDER BY date ASC
//       LIMIT 5
//     `;

//     const data = await sqlModel.customQuery(query, [currentDate]);

//     if (data.error) {
//       return res.status(500).send(data);
//     }

//     if (data.length === 0) {
//       return res.status(200).send({
//         status: false,
//         message: "No upcoming holidays found",
//       });
//     }

//     // Calculate relative time for each holiday
//     const holidaysWithRelativeTime = data.map((holiday) => ({
//       ...holiday,
//       daysUntilHoliday: getFutureRelativeTime(holiday.date), // Add relative time
//     }));

//     res.status(200).send({ status: true, data: holidaysWithRelativeTime });
//   } catch (error) {
//     res.status(500).send({ status: false, error: error.message });
//   }
// };

exports.getUpcomingHoliday = async (req, res, next) => {
  try {
    // Build whereClause from req.query
    const whereClause = {};
    const queryParams = []; // To store query values

    for (const key in req.query) {
      if (req.query.hasOwnProperty(key)) {
        whereClause[key] = req.query[key];
      }
    }

    const currentDate = getCurrentDate();
    queryParams.push(currentDate); // Add currentDate as the first parameter

    // Start building the query
    let query = `
      SELECT name, date
      FROM company_holidays
      WHERE date >= ? AND status = 'active'
    `;

    // Add conditions from whereClause
    for (const key in whereClause) {
      query += ` AND ${key} = ?`; // Add each condition to the query
      queryParams.push(whereClause[key]); // Push the corresponding value
    }

    query += ` ORDER BY date ASC LIMIT 5`; // Finalize the query

    // Execute the query with parameters
    const data = await sqlModel.customQuery(query, queryParams);

    if (data.error) {
      return res.status(500).send(data);
    }

    if (data.length === 0) {
      return res.status(200).send({
        status: false,
        message: "No upcoming holidays found",
      });
    }

    // Calculate relative time for each holiday
    const holidaysWithRelativeTime = data.map((holiday) => ({
      ...holiday,
      daysUntilHoliday: getFutureRelativeTime(holiday.date), // Add relative time
    }));

    res.status(200).send({ status: true, data: holidaysWithRelativeTime });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};
