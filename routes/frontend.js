var express = require("express");
var router = express.Router();
const upload = require("../middleware/multerConfig");
const sqlModel = require("../config/db");
const CheckInController = require("../controllers/frontend/CheckInController");
const EmployeeTrackController = require("../controllers/frontend/EmployeeTrackController");
const UserController = require("../controllers/frontend/UserController");
const EmployeeController = require("../controllers/frontend/EmployeeController");
const PageController = require("../controllers/frontend/PagesController");
const LeaveController = require("../controllers/frontend/LeaveController");
const MyRecordController = require("../controllers/frontend/MyRecordController");
const SupportController = require("../controllers/frontend/SupportController");
const VersionController = require("../controllers/frontend/VersionController");
const FirebaseController = require("../controllers/frontend/FirebaseController");
const PayrollController = require("../controllers/frontend/PayrollController");
const RequestsController = require("../controllers/frontend/RequestController");
const TaskController = require("../controllers/frontend/TaskController");

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
  PageController.WelcomePageData
);

router.get("/getWelcomePage", PageController.getWelcomePage);

//app manage
router.post("/insert-app-version", VersionController.manageVersionInsert);

router.post("/sendNotification", FirebaseController.sendNotification);

router.post("/sendLiveLocation", FirebaseController.receiveLocationData);
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

router.get("/getCoordinates", EmployeeTrackController.getCoordinatesWithDistance);

// employee edit
router.get("/getEmployee", EmployeeController.employeesGet);

router.put(
  "/updateEmployee",
  upload.fields([{ name: "image", maxCount: 1 }]),
  EmployeeController.updateEmployee
);

// employee attendance
router.get("/getEmployeeAttendance", EmployeeController.getEmployeeAttendance);

// employee attendance by date
router.get(
  "/getEmployeeAttendanceByDate",
  EmployeeController.getEmployeeAttendanceByDate
);

//get  employee company data
router.get("/getEmployeeCompany", EmployeeController.getEmployeeCompany);

//payroll
router.get("/getPayroll", PayrollController.getPayroll);

//leave api
router
  .route("/leave/:id?")
  .post(LeaveController.createLeaveRequest)
  .put(LeaveController.createLeaveRequest);
// .delete(LeaveController.deleteDesignation);

router.get("/getLeaveSummary", LeaveController.getLeaveSummary);
router.get("/getEmployeeLeaveRequests", LeaveController.getEmployeeLeaveRequests);
router.get("/getLeaveDetail/:id", LeaveController.getLeaveDetail);
router.put("/cancelLeave/:id", LeaveController.cancelLeaveRequest);

// router.post("/leave", LeaveController.setLeaveRequest);
// router.put("/leave/:id", LeaveController.setLeaveRequest);

// my record
router.get("/myRecord", MyRecordController.getRecord);

// support
router.post(
  "/support",
  upload.fields([{ name: "image", maxCount: 1 }]),
  SupportController.createSupport
);

//app-version for user
router.post("/app-version", VersionController.manageVersion);

//set fcm token
router.post("/setFcmToken", FirebaseController.setFcmTokenAndNotify);

// logout
router.post("/logout", UserController.logout);

// account status
router.post("/account/status", UserController.toggleAccountStatus);

/* GET home page. */
router.get("/", function (req, res, next) {
  res.render("index", { title: "Express" });
});

// return coordinates
router.post("/get-coordinates" ,EmployeeTrackController.getCoordinates);

//RequestsController
  router.post("/request", upload.array("files"), RequestsController.createRequest);
  router.put("/request/:id", upload.array("files"), RequestsController.modifyRequest);
  router.patch("/request/:id",  RequestsController.updateRequestStatus);
  router.put("/request/:id/followup",  RequestsController.updateFollowupStatus);
  router.delete("/request/:id", RequestsController.deleteRequest);
  router.get("/request", RequestsController.getRequestsByEmployee); // token-based list
  router.get("/request/:id", RequestsController.getRequestDetail);
  router.delete("/deleteAttachment/:id", RequestsController.deleteAttachment);
  router.post("/shareRequest", RequestsController.shareRequest);
  router.get("/getfollowup", RequestsController.getfollowup); 
  router.get("/request-menu", RequestsController.getRequestMenuData);

  router.post("/insertVistorLog",upload.array("files"), RequestsController.insertVisitorLog);
  router.get("/getVistorLog", RequestsController.getVisitList);
  router.get("/getVistorLogDetail/:visit_id", RequestsController.getVisitDetails);
  router.put("/updateVistorLog/:visit_id",  upload.none(),    RequestsController.updateVisitLog);

  // task
  router.get("/getAlltasks", TaskController.getEmployeeTask);
  router.get("/getTaskById/:task_id", TaskController.getEmployeeTaskById);
  router.post("/updateTaskStatus", TaskController.updateTaskStatus);

  // backgroundVerificationEmp
  router.post("/backgroundVerificationEmp", upload.fields([{ name: "documentFile", maxCount: 1 }]), EmployeeController.insertBackgroundVerificationByEmp);
  router.get("/getBackgroundVerificationEmp", EmployeeController.getBackgroundVerification);

  // bank details
  router.post("/bankDetails", EmployeeController.insertBankDetail);
  router.get("/getBankDetails", EmployeeController.getBankDetail);
  
module.exports = router;
