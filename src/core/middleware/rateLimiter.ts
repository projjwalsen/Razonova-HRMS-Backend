import { NextFunction, Request, Response } from "express";
import { prisma } from "../../config/db/prisma";

export const otpRateLimiter = async(req: Request, res: Response, next: NextFunction) => {
    try {
        const { email } = req.body;

        if (!email || typeof email !== "string") {
            return res.status(400).json({
                status: false,
                message: "Email is required"
            });
        }

        const user = await prisma.user.findUnique({
            where: { email }
        });

        // Do not reveal whether user exists or not
        if (!user) {
            return next();
        }

        const now = new Date();

        if (user.otpBlockedUntil && user.otpBlockedUntil > now) {
            return res.status(429).json({
                status: false,
                message: `Too many OTP requests. Please try again later.`
            });
        }

        const windowMinutes = 15;
        const maxRequests = 6;
        const blockMinutes = 15;

        const windowStart = user.otpRequestWindowAt;
        const windowExpired =
            !windowStart ||
            now.getTime() - windowStart.getTime() > windowMinutes * 60 * 1000;

        if (windowExpired) {
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    otpRequestCount: 1,
                    otpRequestWindowAt: now,
                    otpBlockedUntil: null
                }
            });

            return next();
        }

        const nextRequestCount = (user.otpRequestCount ?? 0) + 1;

        if (nextRequestCount > maxRequests) {
            const blockedUntil = new Date(
                now.getTime() + blockMinutes * 60 * 1000
            );

            await prisma.user.update({
                where: { id: user.id },
                data: {
                    otpBlockedUntil: blockedUntil
                }
            });

            return res.status(429).json({
                status: false,
                message: `Too many OTP requests. Please try again after ${blockMinutes} minute(s).`
            });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                otpRequestCount: nextRequestCount
            }
        });

        return next();
    } catch (error) {
        return res.status(500).json({
            status: false,
            message: "Failed to validate OTP request rate limit"
        });
    }
}