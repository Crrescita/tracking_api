var express = require("express");
var router = express.Router();
const upload = require("../middleware/multerConfig");
const sqlModel = require("../config/db");
const CompanyController = require("../controllers/admin/CompanyController");
const EmployeesController = require("../controllers/admin/EmployeesController");
const UserController = require("../controllers/admin/UserController");
const CheckInController = require("../controllers/admin/CheckInController");
const EmployeeTrackController = require("../controllers/admin/EmployeeTrackController");
const TeamController = require("../controllers/admin/TeamController");

// for testing it is comment
// const verifyToken = async (req, res, next) => {
//   const authHeader = req.headers["authorization"];
//   const userType = req.headers["usertype"];

//   if (!authHeader || !authHeader.startsWith("Bearer ")) {
//     return res.status(401).json({
//       status: false,
//       message: "Unauthorized: Token not provided",
//     });
//   }

//   const token = authHeader.split(" ")[1];

//   try {
//     const authuserTable = userType === "company" ? "company" : "users";

//     const [user] = await sqlModel.select(
//       authuserTable,
//       {},
//       { api_token: token }
//     );

//     if (!user) {
//       return res.status(403).json({
//         status: false,
//         message: "Forbidden: Invalid or expired token",
//       });
//     }
//     req.user = user;
//     next();
//   } catch (error) {
//     console.error("Error querying database:", error);
//     return res.status(500).json({
//       status: false,
//       message: "Internal Server Error",
//       error: error.message,
//     });
//   }
// };

//login & regiseter
router.post("/login", UserController.login);
router.get("/get_users", UserController.get_users);
router.post("/signup", UserController.signup);
router.post("/update_details", UserController.update_details);
router.post("/update_password", UserController.update_password);

router.post("/forgetPass", UserController.forgetPass);
router.post("/resetPass", UserController.resetPass);

// router.use(verifyToken);

router
  .route("/company/:id?")
  .get(CompanyController.companyGet)
  .post(
    upload.fields([{ name: "logo", maxCount: 1 }]),
    CompanyController.companyInsert
  )
  .put(
    upload.fields([{ name: "logo", maxCount: 1 }]),
    CompanyController.companyInsert
  )
  .delete(CompanyController.deleteCompany);

router
  .route("/employees/:id?")
  .get(EmployeesController.employeesGet)
  .post(
    upload.fields([{ name: "image", maxCount: 1 }]),
    EmployeesController.employeesInsert
  )
  .put(
    upload.fields([{ name: "image", maxCount: 1 }]),
    EmployeesController.employeesInsert
  )
  .delete(EmployeesController.deleteemployee);

router.post(
  "/employees-delete-multiple",
  EmployeesController.deleteMultipleEmployees
);

// checkin
router.get("/checkInDetail", CheckInController.getCheckIn);

router.get("/checkInDetailAllDate", CheckInController.getCheckInAllDate);

// employee coordinates
router.get("/getCoordinates", EmployeeTrackController.getCoordinates);
router.get("/getCoordinatesv2", EmployeeTrackController.getCoordinatesv2);

// get login employee details
router.get(
  "/getEmpLoginDetail/:emp_id?",
  EmployeeTrackController.getEmpLoginDetail
);

// get employee live location
router.get("/getEmpLiveLocation", EmployeeTrackController.getEmpLiveLocation);

// get employees attendence
router.get("/getAttendence", EmployeeTrackController.getAttendence);

router.get(
  "/getEmployeeAttendance",
  EmployeeTrackController.getEmployeeAttendance
);

// department
router
  .route("/department/:id?")
  .get(TeamController.getDepartment)
  .post(TeamController.createDepartment)
  .put(TeamController.createDepartment)
  .delete(TeamController.deleteDepartment);

router.post(
  "/department-delete-multiple",
  TeamController.deleteMultipleDepartments
);

// designation
router
  .route("/designation/:id?")
  .get(TeamController.getDesignation)
  .post(TeamController.createDesignation)
  .put(TeamController.createDesignation)
  .delete(TeamController.deleteDesignation);

router.post(
  "/designation-delete-multiple",
  TeamController.deleteMultipleDesignation
);

/* GET users listing. */
router.get("/", function (req, res, next) {
  res.send("respond with a resource");
});

module.exports = router;
