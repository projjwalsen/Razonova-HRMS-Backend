import { prisma } from "../../config/db/prisma"
import crypto from "crypto";
import bcrypt from "bcrypt";
import { fillTemplate } from "../utils/util";
import { RESET_PASSWORD_TEMPLATE } from "../utils/mail.template";
import { sendMail } from "../../core/service/mail.service";

export const forgotPasswordService = async (email: string) => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        throw new Error("User not found | Invalid email");
    }

    // 1. Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP

    // 2. Hash OTP
    const hashedOtp = await crypto.createHash("sha256").update(otp).digest("hex");

    const expiry = new Date(Date.now() + 7 * 60 * 1000); // OTP valid for 7 minutes

    // 3. Store hashed OTP and expiry in DB
    await prisma.user.update({
        where: {
            id: user.id
        },
        data: {
            otp: hashedOtp,
            otpExpiresAt: expiry,
            otpAttempts: 0 // reset attempts on new OTP generation
        }
    });

    // 4. Prepare mail sending
    const html = fillTemplate(RESET_PASSWORD_TEMPLATE,{
        name: user.name,
        otp,
        companyName: process.env.COMPANY_NAME || "",
        companyLogoUrl: process.env.COMPANY_LOGO_URL || "",
        email: user.email,
        requestedAt: new Date().toLocaleString()
    });

    await sendMail({
        to: { email: user.email, name: user.name },
        subject: "Reset Your Password",
        htmlContent: html
    })

    return { success: true, message: "OTP sent to email" };
}


export const verifyOtpService = async(email: string, otp: string) => {
    const user = await prisma.user.findUnique({
        where: {
            email
        }
    });

    if(!user || !user.otp || !user.otpExpiresAt){
        throw new Error("OTP expired. Please try again")
    }

    if(user.otpExpiresAt < new Date()){
        throw new Error("OTP expired. Please try again")
    }

    if ((user.otpAttempts ?? 0) >= 5) {
        throw new Error("Too many invalid OTP attempts. Please request a new OTP.");
    }

    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    if(hashedOtp !== user.otp){
        await prisma.user.update({
            where: { email },
            data: {
                otpAttempts: { increment: 1 }
            }
        });
        throw new Error("Invalid OTP. Please try again")
    }

    return { success: true, message: "OTP verified successfully" };
}


export const resetPasswordService = async(
    email: string, 
    otp: string, 
    newPassword: string
) => {
    const user = await prisma.user.findUnique({ where: { email } });
    if(!user){
        throw new Error("User not found");
    }
    await verifyOtpService(email, otp);

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
        where: { id: user.id },
        data: {
            password: hashedPassword,
            otp: null,
            otpExpiresAt: null,
            otpAttempts: 0
        }
    });

    return { success: true, message: "Password reset successfully" };
}