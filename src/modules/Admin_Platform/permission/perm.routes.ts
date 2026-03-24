import { Router } from "express";
import * as permController from "./perm.controller";
import { auth } from "../../../core/middleware/auth";
import { isPlatformAdmin } from "../../../core/middleware/platform.auth";

const router = Router();
/* ------ Only Platform Admins 🔐 ------ */
router.post(
    "/create", 
    auth,
    isPlatformAdmin,

    permController.createPermission
);
router.get(
    "/list",
    auth,
    permController.getPermissions
);
router.put(
    "/update/:permId", 
    auth,
    isPlatformAdmin,
    permController.updatePermission
);
router.delete(
    "/delete/:permId",
    auth,
    isPlatformAdmin,
    permController.deletePermission
);

export default router;