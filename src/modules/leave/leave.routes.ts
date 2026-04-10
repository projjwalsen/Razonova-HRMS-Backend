import { Router } from "express";
import * as LeaveController from "./leave.controller";
import { auth, checkTenantApproval } from "../../core/middleware/auth";
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

router.post("/type", LeaveController.upsertLeaveType);
router.get("/type", LeaveController.getLeaveTypes);

/* -------------------------------------------------------------------------- */
/*                                LEAVE POLICY                                 */
/* -------------------------------------------------------------------------- */

router.post("/policy", LeaveController.upsertLeavePolicy);
router.get("/policy", LeaveController.getLeavePolicies);

/* -------------------------------------------------------------------------- */
/*                              APPROVAL POLICY                                */
/* -------------------------------------------------------------------------- */

router.post("/approval-policy", LeaveController.upsertApprovalPolicy);
router.get("/approval-policy", LeaveController.getApprovalPolicies);

/* -------------------------------------------------------------------------- */
/*                             HOLIDAY CALENDAR                                */
/* -------------------------------------------------------------------------- */

router.post("/holiday-calendar", LeaveController.createHolidayCalendar);
router.get("/holiday-calendars", LeaveController.getHolidaysCalendars);
router.delete("/holiday-calendar/:calendarId", LeaveController.deleteHolidayCalendar);
router.get("/holiday-calendar/active", LeaveController.getActiveHolidayCalendar);

router.post("/holiday", LeaveController.createHoliday);
router.delete("/holiday/:holidayId", LeaveController.deleteHoliday);

/* -------------------------------------------------------------------------- */
/*                               WORK WEEK                                     */
/* -------------------------------------------------------------------------- */

router.put("/work-week", LeaveController.updateWorkWeek);
router.get("/work-week", LeaveController.getWorkWeek);

/* -------------------------------------------------------------------------- */
/*                               LEAVE FLOW                                    */
/* -------------------------------------------------------------------------- */

router.post(
  "/apply",
  upload.array("attachments", 5),
  LeaveController.applyLeave
);

router.post(
  "/apply-on-behalf/:userId",
  upload.array("attachments", 5),
  LeaveController.applyLeaveOnBehalf
)

router.get("/balance/me", LeaveController.getMyLeaveBalance);

router.get("/requests", LeaveController.getLeaveRequests);
router.get("/requests/:userId", LeaveController.getLeaveRequests);

router.post("/cancel/:requestId", LeaveController.cancelLeaveRequests);
router.post("/approve/:requestId", LeaveController.approveLeaveRequests);
router.post("/reject/:requestId", LeaveController.rejectLeaveRequests);

export default router;