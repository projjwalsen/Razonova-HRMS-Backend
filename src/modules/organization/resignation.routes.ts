import { Router } from "express";
import * as resignationController from "./resignation.controller";
import { auth, checkTenantApproval } from "../../core/middleware/auth";

const router = Router();
router.use(auth, checkTenantApproval)

router.post("/policy", resignationController.upsertResignationApprovalPolicy);
router.get("/policy", resignationController.getResignationApprovalPolicies);

router.post("/request", resignationController.submitResignation);
router.get("/my", resignationController.getMyResignations);
router.get("/pending-approvals", resignationController.getPendingResignationApprovals);

router.patch("/:requestId/approve",resignationController.approveResignation);
router.patch("/:requestId/reject",resignationController.rejectResignation);
router.patch("/:requestId/withdraw", resignationController.withdrawResignation);
router.patch("/:requestId/complete", resignationController.completeResignation);

export default router;