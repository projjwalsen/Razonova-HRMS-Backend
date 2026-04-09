import { Router } from "express";
import * as ReportingController from "./reporting.controller";
import { auth, checkPermission, checkTenantApproval } from "../../core/middleware/auth";

const router = Router();

router.use(auth, checkTenantApproval);

router.patch(
    "/user/assign-manager", 
    // checkPermission("REPORTING:MANAGER_UPDATE"),
    ReportingController.assignReportingManager
)

router.get(
    "/user/:userId/hierarchy", 
    // checkPermission("REPORTING:READ"),
    ReportingController.getReportingHierarchy
)

router.get(
    "/user/reportees", 
    // checkPermission("REPORTING:READ"),
    ReportingController.getReportees
)

export default router;