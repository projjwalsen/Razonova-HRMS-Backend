import {  Router } from "express";
import * as roleController from "./role.controller";

const router = Router();

router.post(
    "/create", 
    roleController.createRole
);
router.get(
    "/list-all", 
    roleController.getRoles
);
router.post(
    "/assign-permissions", 
    roleController.assignPermissionsToRole
);
router.post(
    "/users/:userId/roles/:roleId", 
    roleController.assignRoleToUser
);
router.delete(
    "/users/:userId/roles/:roleId", 
    roleController.unassignRoleFromUser
);

export default router;