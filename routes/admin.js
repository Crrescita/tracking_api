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
const HolidayController = require("../controllers/admin/HolidayController");
const LeaveManagmentController = require("../controllers/admin/LeaveManagementController");
const EmployeeAttendanceController = require("../controllers/admin/EmployeeAttendanceController");
const AddressController = require("../controllers/admin/AddressController");
const FirebaseController = require("../controllers/admin/FirebaseController");
const NotificationController = require("../controllers/admin/NotificationController");
const LogController = require("../controllers/admin/LogController");
const AssignTaskController = require("../controllers/admin/AssignTaskController");
const WhatsappController = require("../controllers/admin/WhatsappController");

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const userType = req.headers["usertype"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      status: false,
      message: "Unauthorized: Token not provided",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    // Query the user_session table instead of directly querying users/company
    const [session] = await sqlModel.select(
      "user_sessions",
      {},
      { api_token: token }
    );

    if (!session) {
      return res.status(403).json({
        status: false,
        message: "Forbidden: Invalid or expired token",
      });
    }

    // Fetch the corresponding user details based on the session data
    const authuserTable = userType === "company" ? "company" : "users";

    const [user] = await sqlModel.select(
      authuserTable,
      {},
      { id: session.user_id }
    );

    if (!user) {
      return res.status(403).json({
        status: false,
        message: "Forbidden: User not found",
      });
    }

    // Attach user and session data to req for use in the next middleware
    req.user = user;
    req.session = session;

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

//login & regiseter
router.post("/login", UserController.login);
router.get("/get_users", UserController.get_users);
router.post("/signup", UserController.signup);
router.post("/update_details", UserController.updateDetails);
router.post("/update_password", UserController.update_password);

router.post("/forgetPass", UserController.forgetPass);
router.post("/resetPass", UserController.resetPass);

router.get("/webhooks", UserController.getWebhook);
router.post("/webhooks", UserController.postWebhook);

router.get("/sendMessage", WhatsappController.whatsapp);

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

// check in/out
router.get("/checkInOut", CheckInController.getCheckInOut);

// employee coordinates
router.get("/getCoordinates", EmployeeTrackController.getCoordinates);
router.get("/getCoordinatesv2", EmployeeTrackController.getCoordinatesv2);

// attendance
// get login employee details
router.get(
  "/getEmpLoginDetail/:emp_id?",
  EmployeeAttendanceController.getEmpLoginDetail
);

// get employee live location
router.get(
  "/getEmpLiveLocation",
  EmployeeAttendanceController.getEmpLiveLocation
);

// get employees attendence
router.get("/getAttendence", EmployeeAttendanceController.getAttendance);

router.get(
  "/getEmployeeMonthlyAttendance",
  EmployeeAttendanceController.getEmployeeMonthlyAttendance
);

// total attendance data
router.get(
  "/getTotalAttendance",
  EmployeeAttendanceController.getTotalAttendance
);

// weekly attendance data
router.get(
  "/getWeeklyAttendance",
  EmployeeAttendanceController.getWeeklyAttendance
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

// holidays
router
  .route("/holidays/:id?")
  .get(HolidayController.getHoliday)
  .post(HolidayController.createHoliday)
  .put(HolidayController.createHoliday)
  .delete(HolidayController.deleteHoliday);

router.post(
  "/holidays-delete-multiple",
  HolidayController.deleteMultipleHolidays
);

// upcoming hoilday
router.get("/getUpcomingHoliday", HolidayController.getUpcomingHoliday);

// leave

router
  .route("/leaveType/:id?")
  .get(LeaveManagmentController.getLeaveType)
  .post(LeaveManagmentController.createLeaveType)
  .put(LeaveManagmentController.createLeaveType)
  .delete(LeaveManagmentController.deleteLeaveType);

router.post(
  "/leaveType-delete-multiple",
  LeaveManagmentController.deleteMultipleLeaveType
);

// leave request
router
  .route("/leaveRequest/:id?")
  .get(LeaveManagmentController.getLeaveRequest)
  .post(LeaveManagmentController.createLeaveRequest)
  .put(LeaveManagmentController.createLeaveRequest)
  .delete(LeaveManagmentController.deleteLeaveType);

router.put(
  "/updateleaveRequestStatus/:id?",
  LeaveManagmentController.updateLeaveRequestStatus
);

// leave setting
router
  .route("/leaveSetting/:id?")
  .get(LeaveManagmentController.getLeaveSetting)
  .post(LeaveManagmentController.createLeaveSetting);

// leave Detail
router.get("/leaveDetail/:id?", LeaveManagmentController.leaveDetail);

// leave record
router.get("/leaveRecord", LeaveManagmentController.leaveRecord);

// address
router.route("/address").post(AddressController.createAddress);

// fcm token
router.post("/setFcmToken", FirebaseController.setFcmToken);

// get notification
router.get("/getNotification/:id", NotificationController.getNotification);

router.delete(
  "/notificationDelete/:id",
  NotificationController.deletenotification
);

router.post(
  "/notification-delete-multiple",
  NotificationController.deleteMultiplenotifications
);

router.post("/markAsRead", NotificationController.markAsRead);
router.post("/clearAll", NotificationController.clearAll);

// assign task

router
  .route("/assignTask/:id?")
  .get(AssignTaskController.getAssignTask)
  .post(AssignTaskController.assignTask)
  .put(AssignTaskController.assignTask)
  .delete(AssignTaskController.deleteAssignTask);

router.post(
  "/assignTask-delete-multiple",
  AssignTaskController.deleteMultipleAssignTask
);

// logs
router.get("/logs", LogController.getLogs);
/* GET users listing. */
router.get("/", function (req, res, next) {
  res.send("respond with a resource");
});

module.exports = router;
