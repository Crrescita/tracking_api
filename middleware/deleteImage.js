const path = require("path");
const fs = require("fs");

function deleteOldFile(filePath) {
  const parentDirectory = path.resolve(__dirname, "../public");
  const fullFilePath = path.join(parentDirectory, filePath);

  if (fs.existsSync(fullFilePath)) {
    fs.unlinkSync(fullFilePath);
  }
}

module.exports = {
  deleteOldFile,
};
