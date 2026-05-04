import { Request, Response } from "express";
import { prisma } from "../../config/db/prisma";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { seedTenantRoles, syncDefaultRolePermissions } from "../utils/seed.roles";
import { forgotPasswordService, resetPasswordService, verifyOtpService } from "./auth.service";
import { provisionTenantAfterSignup } from "./provision.service";

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags:
 *       - auth
 *     summary: Login user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        /* Find user by email */
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ status: false, message: "Invalid email" });
        }
        /* Check password */
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ status: false, message: "Invalid password" });
        }
        const userRole = await prisma.userRole.findMany({
            where: { userId: user.id },
            include: { role: true },
        });
        const roles = userRole.map((ur) => ur.role.name);
        const roleType = userRole.some(ur => ur.role.type === "SYSTEM") ? "SYSTEM" : "TENANT";
        const token = jwt.sign(
            {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                tenantId: user.tenantId,
                roles,
            },
            process.env.JWT_SECRET || "your_jwt_secret",
            { expiresIn: "4h" }
        )
        return res.status(200).json({
            status: true,
            message: "Login successful",
            data: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                tenantId: user.tenantId,
                roles,
                roleType,
                token
            }
        })
    } catch (error: any) {
        res.status(500).json({ 
            status: false, 
            message: "An error occurred while logging in",
            error: (error as Error).message
        });
    }
}

/**
 * @swagger
 * /auth/signup:
 *   post:
 *     tags:
 *       - auth
 *     summary: Signup Company Admin and create organization
 *     description: Register a new company and create the company admin user. Sets up default roles, departments, and assigns free plan.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *               - confirmPassword
 *               - companyName
 *             properties:
 *               name:
 *                 type: string
 *                 description: Admin user's full name
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Admin user's email address
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 description: Admin user's password
 *               confirmPassword:
 *                 type: string
 *                 format: password
 *                 description: Password confirmation (must match password)
 *               phone:
 *                 type: string
 *                 description: Admin user's phone number (optional)
 *               companyName:
 *                 type: string
 *                 description: Company/Organization name
 *     responses:
 *       201:
 *         description: Company and admin user registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     tenant:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         status:
 *                           type: string
 *                           enum: [PENDING, ACTIVE, INACTIVE]
 *                         isSystem:
 *                           type: boolean
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         email:
 *                           type: string
 *                         phone:
 *                           type: string
 *                         tenantId:
 *                           type: string
 *                     token:
 *                       type: string
 *                       description: JWT token (valid for 7 hours)
 *       400:
 *         description: Bad request - validation failed or user already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   enum: 
 *                     - Company name is required
 *                     - Passwords do not match
 *                     - User with this email already exists
 *                     - User with this phone number already exists
 *       500:
 *         description: Internal server error
 */
export const signup = async (req: Request, res: Response) => {
    try {
        const { name, email, password, confirmPassword, phone, companyName } = req.body;
        /* 1. Verify Inputs */
        if (!companyName) {
            return res.status(400).json({ status: false, message: "Company name is required" });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ status: false, message: "Passwords do not match" });
        }
        /* 2. Check if user already exists by email */
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ status: false, message: "User with this email already exists" });
        }
        if (phone) {
            const existingPhone = await prisma.user.findUnique({ where: { phone } });
            if (existingPhone) {
                return res.status(400).json({ status: false, message: "User with this phone number already exists" });
            }
        }
        /* 3. Hash password */
        const hashedPassword = await bcrypt.hash(password, 10);

        /* Transaction - All this in 1 atomic operation 
         if fails ❌ -- rollback 
        */
        const result = await prisma.$transaction(async (tx) => {
            const tenant = await tx.tenant.create({
                data: {
                name: companyName,
                status: "PENDING",
                isSystem: false,
                }
            });

            const user = await tx.user.create({
                data: {
                name,
                email,
                password: hashedPassword,
                phone,
                tenantId: tenant.id,
                }
            });

            return { tenant, user };
        });
        
       
        // 6. Provision default roles, permissions, and assign free trial subscription
        try {
            await provisionTenantAfterSignup(
                result.tenant.id, 
                result.user.id, 
                companyName
            );
        } catch (error) {
            console.error("Provisioning failed, can retry later:", error);
        }

        /* Generate SignIn token */
        const token = jwt.sign(
            {
                id: result.user.id,
                name: result.user.name,
                email: result.user.email,
                tenantId: result.user.tenantId,
                roles: ["COMPANY_ADMIN", "EMPLOYEE"],
            },
            process.env.JWT_SECRET || "your_jwt_secret",
            { expiresIn: "7h" }
        )

        res.status(201).json({ 
            status: true, 
            message: "Company registered Successfully", 
            data: {
                tenant: result.tenant,
                user: result.user,
                token
            } 
        });
    } catch (error: any) {
        res.status(500).json({ 
            status: false, 
            message: "An error occurred while signing up",
            error: (error as Error).message
        });
    }
}
/* ---------------- OAuth in later uses -------------- */
/* ----------- have to add in Login / Siggnup in future --------------- */


/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     tags:
 *       - auth
 *     summary: Send password reset OTP
 *     description: Sends an OTP to the user's email for password reset.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Internal server error
 */


export const forgotPassword = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;

        const result = await forgotPasswordService(email);
        if(!result.success){
            return res.status(400).json({
                status: false,
                message: result.message
            });
        }
        return res.status(200).json({
            status: true,
            message: result.message
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: error.message || "An error occurred while processing forgot password request"
        });
    }
}

/**
 * @swagger
 * /auth/verify-otp:
 *   post:
 *     tags:
 *       - auth
 *     summary: Verify password reset OTP
 *     description: Verifies the OTP sent to the user's email.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               otp:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *       400:
 *         description: Invalid OTP or missing fields
 *       500:
 *         description: Internal server error
 */

export const verifyOtp = async (req: Request, res: Response) => {
    try {
        const { email, otp } = req.body;

        if(!email || !otp){
            return res.status(400).json({
                status: false,
                message: "Email and OTP are required"
            });
        }

        const result = await verifyOtpService(email, otp);
        if(!result.success){
            return res.status(400).json({
                status: false,
                message: result.message
            });
        }

        return res.status(200).json({
            status: true,
            message: result.message
        });

    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: error.message || "An error occurred while verifying OTP"
        })
    }
}

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     tags:
 *       - auth
 *     summary: Reset password using OTP
 *     description: Resets the user's password after OTP verification.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *               - newPassword
 *               - confirmPassword
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               otp:
 *                 type: string
 *                 example: "123456"
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *               confirmPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Validation failed or OTP invalid
 *       500:
 *         description: Internal server error
 */

export const resetPassword = async (req: Request, res: Response) => {
    try {
        const { email, otp, newPassword, confirmPassword } = req.body;

        if(newPassword !== confirmPassword){
            return res.status(400).json({
                status: false,
                message: "Passwords do not match"
            });
        }

        const result = await resetPasswordService(email, otp, newPassword);
        if(!result.success){
            return res.status(400).json({
                status: false,
                message: result.message
            });
        }

        return res.status(200).json({
            status: true,
            message: result.message
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: error.message || "An error occurred while resetting password"
        });
    }
}