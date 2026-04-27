import { Router } from "express";
import { forgotPassword, login, resetPassword, signup, verifyOtp } from "./auth.controller";
import { otpRateLimiter } from "../../core/middleware/rateLimiter";

const router = Router();

router.post("/login", login);

router.post("/signup", signup);


router.post(
    "/forgot-password",
    otpRateLimiter,
    forgotPassword
)

router.post(
    "/verify-otp",
    verifyOtp
)

router.post(
    "/reset-password",
    resetPassword
)

export default router;