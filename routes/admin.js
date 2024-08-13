var express = require("express");
var router = express.Router();
const upload = require("../middleware/multerConfig");
const sqlModel = require("../config/db");
const CompanyController = require("../controllers/admin/CompanyController");
const employeeController = require("../controllers/admin/employeeController");
const UserController = require("../controllers/admin/UserController");
const CheckInController = require("../controllers/admin/CheckInController");
const EmployeeTrackController = require("../controllers/admin/EmployeeTrackController");
const TeamController = require("../controllers/admin/TeamController");

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const userType = req.headers["usertype"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      status: false,
      message: "Unauthorized: Token not provided",
    });
  }

  const token = authHeader.split(" ")[1]; // Extract token after "Bearer "

  try {
    const authuserTable = userType === "company" ? "company" : "users";

    const [user] = await sqlModel.select(
      authuserTable,
      {},
      { api_token: token }
    );

    if (!user) {
      return res.status(403).json({
        status: false,
        message: "Forbidden: Invalid or expired token",
      });
    }

    // Optionally attach the user to the request object for further use
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

// const verifyToken = async (req, res, next) => {
//   const authHeader = req.headers["authorization"];
//   if (authHeader && authHeader.startsWith("Bearer ")) {
//     const token = authHeader.split(" ")[1]; // Extract token after "Bearer "
//     try {
//       const user = await sqlModel.select("users", {}, { api_token: token });
//       if (user.length > 0) {
//         next();
//       } else {
//         return res.status(403).send({
//           status: false,
//           error: "",
//           message: "Forbidden: Token expired",
//         });
//       }
//     } catch (error) {
//       console.error("Error querying database:", error);
//       return res.status(500).send({ status: false, error: error });
//     }
//   } else {
//     return res
//       .status(401)
//       .json({ message: "Unauthorized: Token not provided" });
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

router.use(verifyToken);

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
  .get(employeeController.employeesGet)
  .post(
    upload.fields([{ name: "image", maxCount: 1 }]),
    employeeController.employeesInsert
  )
  .put(
    upload.fields([{ name: "image", maxCount: 1 }]),
    employeeController.employeesInsert
  )
  .delete(employeeController.deleteemployee);

router.post(
  "/employees-delete-multiple",
  employeeController.deleteMultipleEmployees
);

// checkin
router.get("/checkInDetail", CheckInController.getCheckIn);

router.get("/checkInDetailAllDate", CheckInController.getCheckInAllDate);

// employee coordinates
router.get("/getCoordinates", EmployeeTrackController.getCoordinates);

// get login employee details
router.get(
  "/getEmpLoginDetail/:emp_id?",
  EmployeeTrackController.getEmpLoginDetail
);

// get employee live location
router.get("/getEmpLiveLocation", EmployeeTrackController.getEmpLiveLocation);

// get employees attendence
router.get("/getAttendence", EmployeeTrackController.getAttendence);

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
