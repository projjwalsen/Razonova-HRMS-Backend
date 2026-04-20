import { Request, Response } from "express";
import { prisma } from "../../config/db/prisma";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { seedTenantRoles, syncDefaultRolePermissions } from "../utils/seed.roles";

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
        await seedTenantRoles(prisma, result.tenant.id);
        await syncDefaultRolePermissions(prisma, result.tenant.id);
        // 6. Assign free plan
        const freePlan = await prisma.subscriptionPlan.findFirst({
            where: { isFree: true },
        });
        // 🔹 Transaction 2: Tenant Setup / Provisioning
        await prisma.$transaction(async (tx) => {
            // 1. Create role
            const roles = await tx.role.findMany({
                where: {
                    tenantId: result.tenant.id,
                    type: "TENANT",
                    name: {
                        in: ["COMPANY_ADMIN", "EMPLOYEE"]
                    }
                },
                select: {
                    id: true,
                    name: true
                }
            })
            const adminRole = roles.find(r => r.name === "COMPANY_ADMIN");
            const empRole = roles.find(r => r.name === "EMPLOYEE");

            if(!adminRole || !empRole) {
                throw new Error("Failed to find required roles");
            }
            // --- End permission sync ---

            // 2. Create department
            const hrDepartment = await tx.department.create({
                data: {
                    name: "HR",
                    tenantId: result.tenant.id,
                },
            });

            // 3. Create designation
            const hrDesignation = await tx.designation.create({
                data: {
                    name: "HR Manager",
                    tenantId: result.tenant.id,
                    departmentId: hrDepartment.id,
                },
            });

            // 4. Update user with dept + designation
            await tx.user.update({
                where: { id: result.user.id },
                data: {
                    departmentId: hrDepartment.id,
                    designationId: hrDesignation.id,
                },
            });

            await tx.userRole.createMany({
                data: [
                    { userId: result.user.id, roleId: adminRole.id },
                    { userId: result.user.id, roleId: empRole.id }
                ],
                skipDuplicates: true
            });


            if (freePlan) {
                await tx.tenantSubscription.create({
                    data: {
                        tenantId: result.tenant.id,
                        planId: freePlan.id,
                        startDate: new Date(),
                    },
                });
            }
        });

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