import { Router } from "express";
import * as permController from "./perm.controller";
import { auth, checkPermission } from "../../../core/middleware/auth";
import { isPlatformAdmin } from "../../../core/middleware/platform.auth";

const router = Router();
/* ------ Only Platform Admins 🔐 ------ */
router.use(auth);
router.post(
    "/create", 
    isPlatformAdmin,
    // checkPermission("PERMISSION:CREATE"),
    permController.createPermission
);
router.get(
    "/list",
    permController.getPermissions
);
router.put(
    "/update/:permId", 
    // checkPermission("PERMISSION:UPDATE"),
    isPlatformAdmin,
    permController.updatePermission
);
router.delete(
    "/delete/:permId",
    isPlatformAdmin,
    permController.deletePermission
);

export default router;