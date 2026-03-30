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

/** Onboarding Routes */
router.post(
    '/onboarding/invite',
    userController.createOnboardingInvite
);

/** Resend Onboarding Invite Route */
router.post(
    '/onboarding/invite/:inviteId/resend',
    userController.resendOnboardingInvite
);

/** Get Pending Onboarding Invites Route */
router.get(
    '/onboarding/invites/pending',
    userController.getPendingOnboardingInvites
);

export default router