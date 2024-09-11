const winston = require("winston");
const expressWinston = require("express-winston");
const path = require("path");
const fs = require("fs");

// Ensure that log directories exist
const ensureLogDirectoriesExist = () => {
  const adminLogDir = path.join(__dirname, "../logs/admin");
  const frontendLogDir = path.join(__dirname, "../logs/frontend");

  // Create the directories if they don't exist
  if (!fs.existsSync(adminLogDir)) {
    fs.mkdirSync(adminLogDir, { recursive: true });
  }
  if (!fs.existsSync(frontendLogDir)) {
    fs.mkdirSync(frontendLogDir, { recursive: true });
  }
};

// Function to get the current date in YYYY-MM-DD format
const getCurrentDate = () => {
  const currentDate = new Date();
  const year = currentDate.toLocaleString("en-US", {
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
  const month = String(currentDate.getMonth() + 1).padStart(2, "0");
  const day = String(currentDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

// Function to create a Winston logger for admin or frontend
const createLogger = (logType) => {
  ensureLogDirectoriesExist(); // Ensure the directories exist before logging
  return winston.createLogger({
    level: "info",
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [
      // Separate log file for each day for admin or frontend
      new winston.transports.File({
        filename: path.join(
          __dirname,
          `../logs/${logType}/${getCurrentDate()}.log`
        ),
        level: "info",
      }),
    ],
  });
};

// Middleware to capture the response body
const captureResponseBody = (req, res, next) => {
  const originalSend = res.send;

  res.send = function (body) {
    res.body = body; // Capture response body
    return originalSend.apply(this, arguments);
  };

  next();
};

// Middleware to log admin requests
const adminRequestLogger = expressWinston.logger({
  winstonInstance: createLogger("admin"),
  meta: true,
  msg: (req, res) => {
    return `ADMIN LOG: {{req.method}} {{req.url}} StatusCode: {{res.statusCode}} ResponseTime: {{res.responseTime}}ms`;
  },
  requestWhitelist: ["method", "url", "headers", "body"],
  responseWhitelist: ["statusCode", "responseTime", "headers", "body"],
  dynamicMeta: (req, res) => ({
    request: {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      body: req.body, // Log request payload (body)
    },
    response: {
      statusCode: res.statusCode,
      responseTime: res.responseTime,
      headers: res.getHeaders(), // Log response headers
      body: res.body, // Log response body
    },
  }),
  expressFormat: true,
  colorize: false,
  ignoreRoute: (req, res) => !req.originalUrl.startsWith("/admin"), // Only log admin routes
});

// Middleware to log frontend requests
const frontendRequestLogger = expressWinston.logger({
  winstonInstance: createLogger("frontend"),
  meta: true,
  msg: (req, res) => {
    return `FRONTEND LOG: {{req.method}} {{req.url}} StatusCode: {{res.statusCode}} ResponseTime: {{res.responseTime}}ms`;
  },
  requestWhitelist: ["method", "url", "headers", "body"],
  responseWhitelist: ["statusCode", "responseTime", "headers", "body"],
  dynamicMeta: (req, res) => ({
    request: {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      body: req.body, // Log request payload (body)
    },
    response: {
      statusCode: res.statusCode,
      responseTime: res.responseTime,
      headers: res.getHeaders(), // Log response headers
      body: res.body, // Log response body
    },
  }),
  expressFormat: true,
  colorize: false,
  ignoreRoute: (req, res) => !req.originalUrl.startsWith("/frontend"), // Only log frontend routes
});

// Middleware to log errors for admin
const adminErrorLogger = expressWinston.errorLogger({
  winstonInstance: winston.createLogger({
    level: "error",
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [
      new winston.transports.File({
        filename: path.join(
          __dirname,
          `../logs/admin/${getCurrentDate()}-error.log`
        ),
        level: "error",
      }),
    ],
  }),
  meta: true,
  msg: (err, req, res) => {
    return `ADMIN ERROR: {{err.message}} {{req.method}} {{req.url}} StatusCode: {{res.statusCode}} ResponseTime: {{res.responseTime}}ms`;
  },
  requestWhitelist: ["method", "url", "headers", "body"],
  responseWhitelist: ["statusCode", "responseTime", "headers", "body"],
  dynamicMeta: (err, req, res) => ({
    error: {
      message: err.message,
      stack: err.stack, // Optionally log the stack trace
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      body: req.body,
    },
    response: {
      statusCode: res.statusCode,
      responseTime: res.responseTime,
      headers: res.getHeaders(),
      body: res.body,
    },
  }),
  expressFormat: true,
  colorize: false,
  ignoreRoute: (req, res) => !req.originalUrl.startsWith("/admin"), // Only log admin routes
});

// Middleware to log errors for frontend
const frontendErrorLogger = expressWinston.errorLogger({
  winstonInstance: winston.createLogger({
    level: "error",
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [
      new winston.transports.File({
        filename: path.join(
          __dirname,
          `../logs/frontend/${getCurrentDate()}-error.log`
        ),
        level: "error",
      }),
    ],
  }),
  meta: true,
  msg: (err, req, res) => {
    return `FRONTEND ERROR: {{err.message}} {{req.method}} {{req.url}} StatusCode: {{res.statusCode}} ResponseTime: {{res.responseTime}}ms`;
  },
  requestWhitelist: ["method", "url", "headers", "body"],
  responseWhitelist: ["statusCode", "responseTime", "headers", "body"],
  dynamicMeta: (err, req, res) => ({
    error: {
      message: err.message,
      stack: err.stack, // Optionally log the stack trace
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      body: req.body,
    },
    response: {
      statusCode: res.statusCode,
      responseTime: res.responseTime,
      headers: res.getHeaders(),
      body: res.body,
    },
  }),
  expressFormat: true,
  colorize: false,
  ignoreRoute: (req, res) => !req.originalUrl.startsWith("/frontend"), // Only log frontend routes
});

module.exports = {
  captureResponseBody,
  adminRequestLogger,
  frontendRequestLogger,
  adminErrorLogger,
  frontendErrorLogger,
};
