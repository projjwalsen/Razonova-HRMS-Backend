import { Router } from "express";
import * as userController from "./user.controller";
import { auth, checkTenantApproval } from "../../core/middleware/auth";
import { createFileUpload } from "../../core/service/multer.service";

const router = Router();

const upload = createFileUpload({
  maxSize: 12,
  allowedTypes: [
    "image/jpeg",
    "image/jpg",
    "image/png",
  ]
});

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
    '/update',
    upload.single("photoUrl"),
    userController.updateMyProfile
)

router.put(
    '/family-details',
    userController.updateFamilyDetails
)

router.put(
    '/qualification-details',
    userController.updateQualificationDetails
)

router.put(
    '/experience-details',
    userController.updateExperienceDetails
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