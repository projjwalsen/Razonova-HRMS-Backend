import { Router } from "express";
import * as userController from "./user.controller";
import { auth, checkTenantApproval } from "../../core/middleware/auth";

const router = Router();

router.use(auth, checkTenantApproval);

router.get(
    '/users/select-options',
    userController.getTenantUserForSelection
);

router.get(
    '/details/:id',
    userController.getUserDetails
)


export default router