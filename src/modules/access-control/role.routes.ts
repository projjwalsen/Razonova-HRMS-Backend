import {  Router } from "express";
import * as roleController from "./role.controller";
import { auth, checkPermission, checkTenantApproval } from "../../core/middleware/auth";

const router = Router();

router.use(auth, checkTenantApproval);

router.post(
    "/create",
    // checkPermission("ROLE:CREATE"),
    roleController.createRole
);
router.get(
    "/list-all",
    // checkPermission("ROLE:READ"),
    roleController.getRoles
);
router.post(
    "/assign-permissions",
    // checkPermission("ROLE_PERMISSION:ASSIGN"),
    roleController.assignPermissionsToRole
);
router.post(
    "/assign-role", 
    // checkPermission("ROLE:ASSIGN"),
    roleController.assignRoleToUser
);
router.delete(
    "/unassign-role", 
    // checkPermission("ROLE:UNASSIGN"),
    roleController.unassignRoleFromUser
);

router.post(
    "/transfer-role",
    // checkPermission("ROLE:TRANSFER"),
    roleController.transferRole
)

export default router;