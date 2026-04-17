import { Router } from "express";
import * as userController from "./user.controller";
import { auth, checkTenantApproval } from "../../core/middleware/auth";

const router = Router();

router.use(auth, checkTenantApproval);

router.get(
    '/select-options',
    userController.getTenantUserForSelection
);

router.get(
    '/details/:userId',
    userController.getUserDetails
)

router.patch(
    '/update/:userId',
    userController.updateMyProfile
)

router.patch(
    '/admin/update/:userId',
    userController.adminUpdateEmployee
)


router.delete(
    '/delete/:userId',
    userController.deleteUser
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