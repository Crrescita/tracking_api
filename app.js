const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const logger = require("morgan");
const frontendRouter = require("./routes/frontend");
const adminRouter = require("./routes/admin");
const {
  adminRequestLogger,
  frontendRequestLogger,
  adminErrorLogger,
  frontendErrorLogger,
} = require("./middleware/logRequests");

const app = express();

// CORS configuration
const corsOptions = {
  origin: [
    "http://localhost:4200",
    "http://localhost:3000/",
    "http://localhost:6000/",
    "http://localhost:60912",
    "https://emptracking.crrescita.com/",
    "https://emptracking.crrescita.com",
  ],
};

app.use(cors(corsOptions));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*"); // * means any origin , if you want to restrict the origin simply add domain URL
  res.header(
    "Access-Control-Allow-Headers",
    "Origin,X-Request-With,Content-Type,Accept,Authorization"
  ); // * means all header, if you want to restrict header than passed the header name only

  if (req.method === "OPTIONS") {
    res.header("Access-Control-Allow-Methods", "PUT,POST,GET,PATCH,DELETE");
    return res.status(200).json({});
  }
  next();
});

// Middleware to parse JSON bodies and cookies
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use("/logs", express.static(path.join(__dirname, "logs")));

// Use Morgan for logging access requests
app.use(logger("dev"));

// Use logging middleware for each route
app.use("/admin", adminRequestLogger);
app.use("/frontend", frontendRequestLogger);

// Routes
app.use("/frontend", frontendRouter);
app.use("/admin", adminRouter);

// Middleware for error logging
app.use("/admin", adminErrorLogger);
app.use("/frontend", frontendErrorLogger);

// Middleware for handling 404 errors
app.use(function (req, res, next) {
  next(createError(404));
});

// Error handler
app.use(function (err, req, res, next) {
  // Log the error with the appropriate logger based on the route
  if (req.originalUrl.startsWith("/admin")) {
    adminErrorLogger.winstonInstance.error(err.message, {
      request: {
        method: req.method,
        url: req.originalUrl,
        headers: req.headers,
        body: req.body,
      },
      response: {
        statusCode: res.statusCode || 500,
        responseTime: res.responseTime || "N/A",
        headers: res.getHeaders ? res.getHeaders() : {},
        body: res.body || {},
      },
    });
  } else if (req.originalUrl.startsWith("/frontend")) {
    frontendErrorLogger.winstonInstance.error(err.message, {
      request: {
        method: req.method,
        url: req.originalUrl,
        headers: req.headers,
        body: req.body,
      },
      response: {
        statusCode: res.statusCode || 500,
        responseTime: res.responseTime || "N/A",
        headers: res.getHeaders ? res.getHeaders() : {},
        body: res.body || {},
      },
    });
  }

  // Send JSON error response
  res.status(err.status || 500).json({
    status: false,
    message: err.message,
    error: req.app.get("env") == "development" ? err : {},
  });
});

// Handle uncaught exceptions
process.on("uncaughtException", function (err) {
  if (err) {
    console.log("Caught exception: " + err.stack);
    process.exit(1);
  }
});

module.exports = app;
