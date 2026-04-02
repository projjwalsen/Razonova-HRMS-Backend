import { Router } from 'express';
import * as LeaveController from './leave.controller';
import { auth, checkTenantApproval } from '../../core/middleware/auth';
import { createFileUpload } from '../../core/service/multer.service';

const router = Router();
router.use(auth, checkTenantApproval)

const upload = createFileUpload({
    maxSize: 12, // 12MB
    allowedTypes: [ 'image/jpeg', 'image/jpg', 'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
})

/* -------------- Upsert Leave Type ---------------- */
router.post(
    '/type', 
    LeaveController.upsertLeaveType
);

/* -------------- Get Leave Types ---------------- */
router.get(
    '/type', 
    LeaveController.getLeaveTypes
);

/* -------------- Apply Leave ---------------- */
router.post(
    '/apply',
    upload.array('attachments', 5), // Allow up to 5 attachments
    LeaveController.applyLeave
);

/* -------------- Cancel Leave Request ---------------- */
router.post(
    '/cancel/:requestId', 
    LeaveController.cancelLeaveRequests
);

/* -------------- Get Leave Requests ---------------- */
router.get(
    '/requests', 
    LeaveController.getLeaveRequests
);

/* -------------- Get Leave Requests for a Specific User ---------------- */
router.get(
    '/requests/:userId', 
    LeaveController.getLeaveRequests
);

/* -------------- Approve Leave Request ---------------- */
router.post(
    '/approve/:requestId', 
    LeaveController.approveLeaveRequests
);

/* -------------- Reject Leave Request ---------------- */
router.post(
    '/reject/:requestId', 
    LeaveController.rejectLeaveRequests
);

export default router;
