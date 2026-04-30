import { Router } from "express";
import * as attendController from "./attend.controller";
import { auth, checkPermission, checkTenantApproval } from "../../core/middleware/auth";
import { checkSubscriptionModuleAccess } from "../../core/middleware/platform.auth";

const router = Router();


router.use(auth, checkTenantApproval);
router.use(checkSubscriptionModuleAccess("ATTENDANCE"));

router.post(
    "/config/upsert", 
    checkPermission("ATTENDANCE:CONFIGURE"),
    attendController.upsertAttendanceConfig
);

router.get(
    "/config", 
    checkPermission("ATTENDANCE:CONFIGURE"),
    attendController.getAttendanceConfig
);

/****** Check In & Out  ***/
router.post(
    "/check-in",
    checkPermission("ATTENDANCE:CHECK_IN"),
    attendController.checkIn
);

router.post(
    "/check-out", 
    checkPermission("ATTENDANCE:CHECK_OUT"),
    attendController.checkOut
);

/***** ------- Todays Attendance ------------- *****/

// Get today's attendance for the tenant
router.get(
    "/today",
    checkPermission("ATTENDANCE:READ"),
    attendController.getTodaysAttendance
)
// Get today's attendance for a specific employee
router.get(
    "/today/:userId",
    checkPermission("ATTENDANCE:READ"),
    attendController.getTodaysAttendance
)


/** ------------ Get attendance history ----------------- */
router.get(
    "/history",
    checkPermission("ATTENDANCE:READ"),
    attendController.getAttendanceHistory
)

router.get(
    "/history/:userId",
    checkPermission("ATTENDANCE:READ"),
    attendController.getAttendanceHistory
)


/**---------- Get Monthly Summary ---------------------- */
router.get(
    "/monthly",
    checkPermission("ATTENDANCE:READ"),
    attendController.getMonthSummary
)

router.get(
    "/monthly/:userId",
    checkPermission("ATTENDANCE:READ"),
    attendController.getMonthSummary
)


/** --------- OUT DUTIES ------------------ */
router.post(
  "/out-duty",
  checkPermission("ATTENDANCE:CONFIGURE"),
  attendController.markOutDuty
);

router.get(
  "/out-duty",
  checkPermission("ATTENDANCE:READ"),
attendController.getOutDuties
);

/** ----------- REGULARIZATION REQUESTS ------------------ */
router.post(
  "/regularization/policy",
  checkPermission("ATTENDANCE:CONFIGURE"),
  attendController.upsertRegularizationPolicy
);

router.get(
  "/regularization/policy",
  checkPermission("ATTENDANCE:READ"),
  attendController.getRegularizationPolicies
);
router.post(
  "/regularization/request",
  checkPermission("ATTENDANCE:REGULARIZATION_REQUEST"),
  attendController.createRegularizationRequest
);

router.get(
  "/regularization/my-requests",
  checkPermission("ATTENDANCE:REGULARIZATION_REQUEST"),
  attendController.getMyRegularizationRequests
);

router.get(
  "/regularization/pending-approvals",
  checkPermission("ATTENDANCE:CONFIGURE"),
  attendController.getPendingRegularizationApprovals
);

router.patch(
  "/regularization/:requestId/approve",
  checkPermission("ATTENDANCE:CONFIGURE"),
  attendController.approveRegularizationRequest
);

router.patch(
  "/regularization/:requestId/reject",
  checkPermission("ATTENDANCE:CONFIGURE"),
  attendController.rejectRegularizationRequest
);
export default router;