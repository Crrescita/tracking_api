const fs = require("fs");
const path = require("path");

// Helper function to get file details
const getFileDetails = (logDir, filterDate = null) => {
  const files = fs
    .readdirSync(logDir)
    .map((file) => {
      const filePath = path.join(logDir, file);
      const stats = fs.statSync(filePath);

      // Include file only if it matches the filter date or no date is specified
      if (!filterDate || file.includes(filterDate)) {
        return {
          filename: file,
          size: stats.size, // File size in bytes
          createdAt: stats.birthtime, // Creation date
          filePath: filePath, // Absolute path for download
        };
      }
      return null;
    })
    .filter(Boolean) // Filter out null entries
    .sort((a, b) => b.createdAt - a.createdAt);

  // Filter out null entries (for unmatched dates)
  return files.filter(Boolean);
};

// Function to format file size in KB or MB
const formatFileSize = (sizeInBytes) => {
  const sizeInKB = sizeInBytes / 1024;
  if (sizeInKB > 1024) {
    return `${(sizeInKB / 1024).toFixed(2)} MB`;
  }
  return `${sizeInKB.toFixed(2)} KB`;
};

// Function to get logs for a specific type
const getLogsByType = (logDir, dateFilter) => {
  const fileDetails = getFileDetails(logDir, dateFilter);
  const allFileDetails = getFileDetails(logDir);

  // Calculate the total file size
  const totalFileSize = allFileDetails.reduce(
    (total, file) => total + file.size,
    0
  );

  return {
    totalFiles: allFileDetails.length,
    totalFileSize: formatFileSize(totalFileSize), // Total size in KB/MB
    logs: fileDetails.map((file) => ({
      filename: file.filename,
      size: formatFileSize(file.size), // Size in KB or MB
      createdAt: file.createdAt,
      downloadUrl: `${process.env.BASE_URL}logs/${path.basename(logDir)}/${
        file.filename
      }`, // Assuming this is served by the backend
    })),
  };
};

exports.getLogs = async (req, res, next) => {
  try {
    const logTypeFilter = req.query.type; // e.g., 'admin' or 'frontend'
    const dateFilter = req.query.date; // YYYY-MM-DD format
    const logDirs = {
      admin: path.join(__dirname, "../../logs/admin"),
      frontend: path.join(__dirname, "../../logs/frontend"),
    };

    // Prepare responses for log types
    const responses = [];

    // Get logs for all types if no type filter is provided
    if (!logTypeFilter) {
      for (const [logType, logDir] of Object.entries(logDirs)) {
        responses.push({
          logType,
          ...getLogsByType(logDir, dateFilter),
        });
      }
    } else if (logDirs[logTypeFilter]) {
      // Get logs for the specified log type
      responses.push({
        logType: logTypeFilter,
        ...getLogsByType(logDirs[logTypeFilter], dateFilter),
      });
    } else {
      // Invalid log type filter
      return res.status(400).json({ error: "Invalid log type parameter" });
    }

    res.json(responses);
  } catch (error) {
    winstonLogger.error({
      message: "Failed to retrieve log files",
      stack: error.stack,
    });
    return res.status(500).json({ status: false, error: error.message });
  }
};
