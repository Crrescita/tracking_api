const mysql = require("mysql2");
const pool = mysql.createPool({
  host: "database-1.c3okq4gsyw7e.ap-south-1.rds.amazonaws.com",
  user: "tel",
  password: "VmUi0oLbkn*9076",
  database: "tel_db",
  // host: "localhost",
  // user: "root",
  // password: "upendra#0309@",
  // database: "location_tracker",
  //  password: "niket@123",
  // database: "location_new",
  connectionLimit: 10,
});

const promisePool = pool.promise();

const sqlModel = {
  // execute: async (sql, values) => {
  //   try {
  //     const [rows, fields] = await promisePool.execute(sql, values);
  //     return rows;
  //   } catch (error) {
  //     const errorResponse = {
  //       status: false,
  //       error: {
  //         code: error.code || "INTERNAL_SERVER_ERROR",
  //         message:
  //           error.sqlMessage ||
  //           "An error occurred while processing the request.",
  //       },
  //     };
  //     throw new Error(errorResponse.error.message);
  //   }
  // },

  execute: async (sql, values) => {
    try {
      const [rows, fields] = await promisePool.execute(sql, values);
      return rows;
    } catch (error) {
      let errorMessage = "An error occurred while processing the request.";
      if (
        error.code === "ER_NO_REFERENCED_ROW_2" ||
        error.code === "ER_ROW_IS_REFERENCED_2"
      ) {
        errorMessage =
          "Foreign Key Constraint Error: Unable to delete the record because it is referenced in another part of the system.";
      }
      const errorResponse = {
        status: false,
        error: {
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: errorMessage,
        },
      };
      console.error({
        message: errorResponse.error.message,
        stack: error.stack,
        sql,
        values,
      });
      throw new Error(errorResponse.error.message);
    }
  },

  insert: async (table, data) => {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map(() => "?").join(", ");
    const sql = `INSERT INTO ${table} (${keys.join(
      ", "
    )}) VALUES (${placeholders})`;
    try {
      const result = await sqlModel.execute(sql, values);
      const lastInsertId = result.insertId;
      return result;
    } catch (error) {
      throw error;
    }
  },
  update: async (table, setValues, whereConditions = {}) => {
    const setClause = Object.keys(setValues)
      .map((key) => `${key} = ?`)
      .join(", ");

    const whereClause = Object.keys(whereConditions)
      .map((key) => `${key} = ?`)
      .join(" AND ");

    const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
    const values = [
      ...Object.values(setValues),
      ...Object.values(whereConditions),
    ];

    try {
      const result = await sqlModel.execute(sql, values);

      return result;
    } catch (error) {
      throw error;
    }
  },

  delete: async (table, conditions) => {
    const conditionKeys = Object.keys(conditions);
    const conditionValues = conditionKeys.map((key) => conditions[key]);
    const whereClause =
      conditionKeys.length > 0
        ? " WHERE " + conditionKeys.map((key) => `${key} = ?`).join(" AND ")
        : "";
    const sql = `DELETE FROM ${table} ${whereClause}`;

    try {
      const result = await sqlModel.execute(sql, conditionValues);
      return result;
    } catch (err) {
      throw err;
    }
  },
  select: async (table, columns, conditions = {}, string = "") => {
    const columnsString = Array.isArray(columns) ? columns.join(", ") : "*";

    const conditionKeys = Object.keys(conditions);
    const conditionValues = conditionKeys.map((key) => conditions[key]);

    const whereClause =
      conditionKeys.length > 0
        ? " WHERE " + conditionKeys.map((key) => `${key} = ?`).join(" AND ")
        : "";

    const sql = `SELECT ${columnsString} FROM ${table}${whereClause} ${string}`;
    try {
      const rows = await sqlModel.execute(sql, conditionValues);
      return rows ? rows : [];
    } catch (error) {
      throw error;
    }
  },
  customQuery: async (sql, values) => {
    try {
      const rows = await sqlModel.execute(sql, values);

      return rows;
    } catch (error) {
      throw error;
    }
  },
};

module.exports = sqlModel;
