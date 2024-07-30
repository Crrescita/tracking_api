const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const route = req.baseUrl + req.path;
    const routeName = route.split("/")[2];

    req.params.imageFolderName = routeName;

    let folder =
      req.params && req.params.imageFolderName
        ? req.params.imageFolderName
        : "images";

    const parentDirectory = path.resolve(__dirname, "..");
    const uploadPath = path.join(parentDirectory, "public/images", folder);
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true, mode: "777" });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const route = req.baseUrl + req.path;
    const routeName = route.split("/")[2];

    req.params.imageFolderName = routeName;

    let folder =
      req.params && req.params.imageFolderName
        ? req.params.imageFolderName
        : "images";

    const newFileName =
      file.fieldname +
      new Date().toISOString().replace(/:/g, "-") +
      "-" +
      file.originalname.replace(/\s/g, "");
    const fullFilePath = path.join("images", folder, newFileName); // Update the path here to match the public folder structure
    req.fileFullPath = req.fileFullPath || [];
    req.fileFullPath.push(fullFilePath);

    cb(null, newFileName);
  },
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === "image/jpeg" ||
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/png" ||
    file.mimetype === "application/pdf" ||
    file.mimetype === "video/mp4"
  ) {
    cb(null, true);
  } else {
    return cb(new Error("Only .jpg or .png files are allowed!"));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
});

// const upload = multer({ storage: storage });

module.exports = upload;

/* ==========end============= */
