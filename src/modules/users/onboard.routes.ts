import { Router } from 'express';
import * as userController from "./user.controller";

const router = Router();

/**
 * Public routes
 */

router.get(
    '/invites/verify',
    userController.verifyOnboardingInvite
);

router.post(
    '/invites/accept',
    userController.acceptOnboardingInvite
);

export default router