import { Router } from "express";
import * as resignationController from "./resignation.controller";
import { auth, checkPermission, checkTenantApproval } from "../../core/middleware/auth";

const router = Router();
router.use(auth, checkTenantApproval)

router.post("/policy",checkPermission("RESIGNATION:MANAGE") ,resignationController.upsertResignationApprovalPolicy);
router.get("/policy",checkPermission("RESIGNATION:READ") ,resignationController.getResignationApprovalPolicies);

router.post("/request", checkPermission("RESIGNATION:SUBMIT"),resignationController.submitResignation);
router.get("/my",checkPermission("RESIGNATION:VIEW") ,resignationController.getMyResignations);
router.get("/pending-approvals", checkPermission("RESIGNATION:READ"), resignationController.getPendingResignationApprovals);

router.patch("/:requestId/approve",checkPermission("RESIGNATION:MANAGE"),resignationController.approveResignation);
router.patch("/:requestId/reject",checkPermission("RESIGNATION:MANAGE"),resignationController.rejectResignation);
router.patch("/:requestId/withdraw", checkPermission("RESIGNATION:MANAGE"), resignationController.withdrawResignation);
router.patch("/:requestId/complete", checkPermission("RESIGNATION:MANAGE"), resignationController.completeResignation);

export default router;