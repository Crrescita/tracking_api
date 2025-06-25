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
const BankController = require("../controllers/admin/BankController");
const BackgroundVerificationController = require("../controllers/admin/BackgroundVerificationController");
const SalaryController = require("../controllers/admin/SalaryController");
const AdvanceController = require("../controllers/admin/AdvanceController");
const PayrollController = require("../controllers/admin/PayrollController")
const SupportController = require("../controllers/admin/SupportController");
// const WhatsappController = require("../controllers/admin/WhatsappController");

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

// update task status by emp
router.post("/updateTaskStatus" , AssignTaskController.updateTaskStatus);
router.get("/empTaskStatus" , AssignTaskController.empTaskStatus)
router.post("/sendTaskmessage" ,AssignTaskController.sendTaskChatMessage);

router
  .get("/empAssignTask/:id?", AssignTaskController.getAssignTask)

router
  .get("/employeesDetails/:id?",EmployeesController.employeesGet)
 
router.get("/task-list/:emp_id", AssignTaskController.getEmployeeTask)

router
  .route("/department/:id?")
  .get(TeamController.getDepartment)

router
  .route("/designation/:id?")
  .get(TeamController.getDesignation)

router
  .route("/branch/:id?")
  .get(TeamController.getBranch)

router.get("/employeesBy-mobile", EmployeesController.employeesGetByMobile);

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

  // emp background verification

router
  .route("/backgroundVerificationEmp")
  .get(BackgroundVerificationController.getBackgroundVerification)
  .post(
    upload.fields([{ name: "documentFile", maxCount: 1 }]),
    BackgroundVerificationController.insertBackgroundVerificationByEmp
  );

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


  router
  .route("/backgroundVerification")
  .get(BackgroundVerificationController.getBackgroundVerification)
  .post(
    upload.fields([{ name: "documentFile", maxCount: 1 }]),
    BackgroundVerificationController.insertBackgroundVerification
  );


router.post(
  "/employees-delete-multiple",
  EmployeesController.deleteMultipleEmployees
);

// emp bank detail
router
  .route("/bankDetail/:id?")
  .get(BankController.getBankDetail)
  .post(BankController.insertBankDetail)
  .put(BankController.insertBankDetail);

// salary setting
router
   .route("/salarySettings/:id?")
   .get(SalaryController.getSalarySettings)
   .post(SalaryController.insertSalarySettings)
   .put(SalaryController.insertSalarySettings)
   .delete(SalaryController.deleteSalarySettings)
  
router.post(
    "/salarySetting-delete-multiple",
    SalaryController.deleteMultipleSalarySettings
  );

// emp salary detail
router
  .route("/salaryDetail/:id?")
  .get(SalaryController.getSalaryDetail)
  .post(SalaryController.insertSalaryDetail)
  .put(SalaryController.insertSalaryDetail);
  

// emp salary payslip 
router
  .route("/salaryPayslip/:id?")
  .get(SalaryController.getSalaryPayslip)
  .post(SalaryController.insertSalaryPayslip)
  .put(SalaryController.insertSalaryPayslip);

// emp payroll 
router.route("/payroll")
.get(PayrollController.getPayroll);



// checkin
router.get("/checkInDetail", CheckInController.getCheckIn);

router.get("/checkInDetailAllDate", CheckInController.getCheckInAllDate);

// check in/out
router.get("/checkInOut", CheckInController.getCheckInOut);

// employee coordinates
router.get("/getCoordinates", EmployeeTrackController.getCoordinates);
router.get("/getCoordinatesv2", EmployeeTrackController.getCoordinatesv2);

// attendance
router.get("/getEmployeeAttendance", EmployeeAttendanceController.getEmployeeAttendance);

router.route("/markAsPresent").post( EmployeeAttendanceController.markAsPresent);

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

// emp attendace of preset day for salary
router.get('/getEmployeePresentDay',EmployeeAttendanceController.getEmployeePresentDay)

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

// branch
router
  .route("/branch/:id?")
  .get(TeamController.getBranch)
  .post(TeamController.createBranch)
  .put(TeamController.createBranch)
  .delete(TeamController.deleteBranch);

router.post("/branch-delete-multiple", TeamController.deleteMultipleBranch);

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

// leave policy
router.post("/leavePolicy", LeaveManagmentController.leavePolicy);
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

//request live location
router.post("/requestLiveLocation", FirebaseController.sendCustomNotification);

//notifivation
router.post("/sendGlobalInfoToTopic", FirebaseController.sendGlobalInfoToTopic);

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
// emp task


router.post("/sendReminder" ,AssignTaskController.sendReminder);
// advance
router.get("/advance/:emp_id?" , AdvanceController.getAdvance)
router.post("/addAdvance" , AdvanceController.addAdvance)
router.put("/updateAdvance/:id?" , AdvanceController.updateAdvance)
router.delete("/deleteAdvance/:id?" , AdvanceController.deleteAdvance)

// open advance
router.get("/getOpenAdvances/:emp_id?" , AdvanceController.getOpenAdvances )

// applyAdjustment
router.get("/getAdjustment/:emp_id?" , AdvanceController.getAdjustment)
router.post("/applyAdjustment" , AdvanceController.applyAdjustment)
router.put("/editAdjustment/:id?" ,  AdvanceController.editAdjustment)

// admin support 
router.post("/createSupport" ,SupportController.createSupport )

// tempory api for set address
router.post("/setCheckAddress", CheckInController.setCheckAddress);
router.get(
  "/getEmployeeReport",
  EmployeeAttendanceController.getEmployeeReport
);

router.post("/send-whatsapp-bulk" , WhatsappController.whatsappBulk);

router.post("/upload-bank-details" , BankController.importBankDetail);

// logs
router.get("/logs", LogController.getLogs);
/* GET users listing. */
router.get("/", function (req, res, next) {
  res.send("respond with a resource");
});

module.exports = router;
