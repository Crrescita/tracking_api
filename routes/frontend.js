var express = require("express");
var router = express.Router();
const upload = require("../middleware/multerConfig");
const sqlModel = require("../config/db");
const CheckInController = require("../controllers/frontend/CheckInController");
const EmployeeTrackController = require("../controllers/frontend/EmployeeTrackController");
const UserController = require("../controllers/frontend/UserController");
const employeeController = require("../controllers/frontend/employeeController");
const pageController = require("../controllers/frontend/pageController");

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      status: false,
      message: "Unauthorized: Token not provided",
    });
  }

  const token = authHeader.split(" ")[1]; // Extract token after "Bearer "

  try {
    const [user] = await sqlModel.select("employees", {}, { api_token: token });

    if (!user) {
      return res.status(403).json({
        status: false,
        message: "Forbidden: Invalid or expired token",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Error querying database:", error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

//login
router.post("/login", UserController.login);

// forgot password
router.post("/forgotPassword", UserController.forgetPassword);

// validate code password
router.post("/validateResetCode", UserController.validateResetCode);

// reset password
router.post("/resetPassword", UserController.resetPassword);

// welcome page
router.post(
  "/setWelcomePageData",
  upload.fields([{ name: "image", maxCount: 1 }]),
  pageController.WelcomePageData
);

router.get("/getWelcomePage", pageController.getWelcomePage);

router.use(verifyToken);

//change Password
router.post("/changePassword", UserController.changePassword);

// checkin
router.get("/checkInDetail", CheckInController.getCheckIn);

router.post("/checkIn", CheckInController.checkIn);
router.post("/checkOut", CheckInController.checkOut);

// employee coordinates
router.post("/setCoordinates", EmployeeTrackController.setCoordinates);
router.post("/setAllCoordinates", EmployeeTrackController.setAllCoordinates);

router.get("/getCoordinates", EmployeeTrackController.getCoordinates);

// employee edit
router.get("/getEmployee", employeeController.employeesGet);

router.put(
  "/updateEmployee",
  upload.fields([{ name: "image", maxCount: 1 }]),
  employeeController.updateEmployee
);

// employee attendance
router.get("/getEmployeeAttendance", employeeController.getEmployeeAttendance);

// employee attendance by date
router.get(
  "/getEmployeeAttendanceByDate",
  employeeController.getEmployeeAttendanceByDate
);

//get  employee company data
router.get("/getEmployeeCompany", employeeController.getEmployeeCompany);

/* GET home page. */
router.get("/", function (req, res, next) {
  res.render("index", { title: "Express" });
});

module.exports = router;
