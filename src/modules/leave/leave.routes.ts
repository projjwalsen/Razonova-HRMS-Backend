import { Router } from "express";
import * as LeaveController from "./leave.controller";
import { auth, checkPermission, checkTenantApproval } from "../../core/middleware/auth";
import { createFileUpload } from "../../core/service/multer.service";

const router = Router();

router.use(auth, checkTenantApproval);

const upload = createFileUpload({
  maxSize: 12,
  allowedTypes: [
    "image/jpeg",
    "image/jpg",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ]
});

/* -------------------------------------------------------------------------- */
/*                                LEAVE TYPES                                  */
/* -------------------------------------------------------------------------- */

router.post("/type",checkPermission("LEAVE_TYPE:MANAGE"), LeaveController.upsertLeaveType);
router.get("/type",checkPermission("LEAVE:READ"), LeaveController.getLeaveTypes);

/* -------------------------------------------------------------------------- */
/*                                LEAVE POLICY                                 */
/* -------------------------------------------------------------------------- */

router.post("/policy",checkPermission("LEAVE_POLICY:MANAGE"), LeaveController.upsertLeavePolicy);
router.get("/policy",checkPermission("LEAVE_POLICY:READ"), LeaveController.getLeavePolicies);

/* -------------------------------------------------------------------------- */
/*                              APPROVAL POLICY                                */
/* -------------------------------------------------------------------------- */

router.post("/approval-policy",checkPermission("LEAVE_APPROVAL_POLICY:MANAGE"), LeaveController.upsertApprovalPolicy);
router.patch("/approval-policy",checkPermission("LEAVE_APPROVAL_POLICY:MANAGE"), LeaveController.upsertApprovalPolicy);
router.get("/approval-policy",checkPermission("LEAVE_APPROVAL_POLICY:READ"), LeaveController.getApprovalPolicies);

/* -------------------------------------------------------------------------- */
/*                             HOLIDAY CALENDAR                                */
/* -------------------------------------------------------------------------- */

router.post("/holiday-calendar",checkPermission("HOLIDAY_CALENDAR:MANAGE"), LeaveController.createHolidayCalendar);
router.get("/holiday-calendars",checkPermission("HOLIDAY_CALENDAR:READ"), LeaveController.getHolidaysCalendars);
router.delete("/holiday-calendar/:calendarId",checkPermission("HOLIDAY_CALENDAR:DELETE"), LeaveController.deleteHolidayCalendar);
router.get("/holiday-calendar/active",checkPermission("HOLIDAY_CALENDAR:READ"), LeaveController.getActiveHolidayCalendar);

router.post("/holiday",checkPermission("HOLIDAY:CREATE"), LeaveController.createHoliday);
router.delete("/holiday/:holidayId", checkPermission("HOLIDAY:DELETE"), LeaveController.deleteHoliday);

/* -------------------------------------------------------------------------- */
/*                               WORK WEEK                                     */
/* -------------------------------------------------------------------------- */

router.put("/work-week",checkPermission("WORK_WEEK:MANAGE"), LeaveController.updateWorkWeek);
router.get("/work-week", checkPermission("WORK_WEEK:READ"), LeaveController.getWorkWeek);

/* -------------------------------------------------------------------------- */
/*                               LEAVE FLOW                                    */
/* -------------------------------------------------------------------------- */

router.post(
  "/apply",
  upload.array("attachments", 5),
  checkPermission("LEAVE:APPLY"),
  LeaveController.applyLeave
);

router.post(
  "/apply-on-behalf/:userId",
  upload.array("attachments", 5),
  checkPermission("LEAVE:APPLY_ON_BEHALF"),
  LeaveController.applyLeaveOnBehalf
)

router.get("/balance/me", checkPermission("LEAVE:READ_SELF"), LeaveController.getMyLeaveBalance);

router.get("/requests", checkPermission("LEAVE:READ"), LeaveController.getLeaveRequests);
router.get("/requests/:userId", checkPermission("LEAVE:READ"), LeaveController.getLeaveRequests);

router.post("/cancel/:requestId", checkPermission("LEAVE:CANCEL"), LeaveController.cancelLeaveRequests);
router.post("/approve/:requestId", checkPermission("LEAVE:APPROVE"), LeaveController.approveLeaveRequests);
router.post("/reject/:requestId", checkPermission("LEAVE:REJECT"), LeaveController.rejectLeaveRequests);

export default router;