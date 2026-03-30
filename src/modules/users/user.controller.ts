import { Request, Response } from "express";
import { prisma } from "../../config/db/prisma";
import { OnboardPolicy } from "../../core/policies/onboard.policy";
import crypto from "crypto";
import { fillTemplate } from "../utils/util";
import { ONBOARDING_TEMPLATE } from "../utils/mail.template";
import { sendMail } from "../../core/service/mail.service";

/**
 * @swagger
 * /users/selection:
 *   get:
 *     tags:
 *       - users
 *     summary: Get tenant users for selection
 *     description: Retrieve active users from the current tenant with optional filtering by search, department, or designation.
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by user name or email (case-insensitive)
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: string
 *         description: Filter users by department ID
 *       - in: query
 *         name: designationId
 *         schema:
 *           type: string
 *         description: Filter users by designation ID
 *     responses:
 *       200:
 *         description: Users retrieved successfully
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
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       email:
 *                         type: string
 *                       managerId:
 *                         type: string
 *                       department:
 *                         type: object
 *                       designation:
 *                         type: object
 *                       userRoles:
 *                         type: array
 *       500:
 *         description: Internal server error
 */
export const getTenantUserForSelection = async (req: Request, res: Response) => {
    try {
        const actor = (req as any).user; // Assuming auth middleware sets req.user
        const { search, departmentId, designationId } = (req as any).query;

        const users = await prisma.user.findMany({
            where: {
                tenantId: actor.tenantId,
                isActive: true,
                ...(search && {
                    OR: [
                        { name: { contains: String(search), mode: 'insensitive' } },
                        { email: { contains: String(search), mode: 'insensitive' } }
                    ]
                }),
                ...(departmentId && { departmentId }),
                ...(designationId && { designationId })
            },
            select: {
                id: true,
                name: true,
                email: true,
                managerId: true,
                department: {
                    select: { id: true, name: true }
                },
                designation: {
                    select: { id: true, name: true }
                },
                userRoles: {
                    select: {
                        role: {
                            select: { id: true, name: true }
                        }
                    }
                }
            },
            orderBy: { name: "asc" }
        });

        return res.status(200).json({
            status: true,
            message: "Tenant users retrieved for selection",
            data: users
        });

    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to retrieve tenant users for selection",
            error: error.message
        });
    }
}


/**
 * @swagger
 * /users/{userId}:
 *   get:
 *     tags:
 *       - users
 *     summary: Get user details by ID
 *     description: Retrieve detailed information about a specific user including manager, department, designation, roles, and reportee count.
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: User ID
 *     responses:
 *       200:
 *         description: User details retrieved successfully
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
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     isActive:
 *                       type: boolean
 *                     tenantId:
 *                       type: string
 *                     manager:
 *                       type: object
 *                     department:
 *                       type: object
 *                     designation:
 *                       type: object
 *                     userRoles:
 *                       type: array
 *                     _count:
 *                       type: object
 *       400:
 *         description: Bad request - missing userId
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
/* fetch user details for the organization by ID */
export const getUserDetails = async (req: Request, res: Response) => {
    try {
        const actor = (req as any).user; // Assuming auth middleware sets req.user
        const { userId } = (req as any).params;

        if(!userId){
            return res.status(400).json({
                status: false,
                message: "userId is required"
            });
        }
        const user = await prisma.user.findFirst({
            where: {
                id: userId,
                tenantId: actor.tenantId
            },
            select: {
                id: true,
                name: true,
                email: true,
                isActive: true,
                tenantId: true,
                manager: {
                    select: {
                        id: true,
                        name: true,
                        email: true                    
                    }
                },
                department: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                designation: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                userRoles: {
                    select: {
                        role: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                },
                _count: {
                    select: {
                        reportees: true
                    }
                }
            }
        });
        if(!user){
            return res.status(404).json({
                status: false,
                message: "User not found"
            });
        }
        return res.status(200).json({
            status: true,
            message: "User details retrieved successfully",
            data: user
        });

    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to retrieve user details",
            error: error.message
        });
    }
}

/*********************** Employee Onboarding Controllers **************************************/

/**
 * @swagger
 * /onboarding/invite:
 *   post:
 *     tags:
 *       - onboarding
 *     summary: Create an onboarding invite
 *     description: Create a new onboarding invite for an employee. Requires proper permissions.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - employeeCode
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               departmentId:
 *                 type: string
 *               designationId:
 *                 type: string
 *               designationName:
 *                 type: string
 *               managerId:
 *                 type: string
 *               roleId:
 *                 type: string
 *               employeeCode:
 *                 type: string
 *               joiningDate:
 *                 type: string
 *                 format: date
 *               proposedSalary:
 *                 type: number
 *     responses:
 *       201:
 *         description: Onboarding invite created successfully
 *       400:
 *         description: Bad request - missing required fields
 *       403:
 *         description: Forbidden - user does not have permission
 *       500:
 *         description: Internal server error
 */
export const createOnboardingInvite = async (req: Request, res: Response) => {
    try {
        const actor = (req as any).user; // Assuming auth middleware sets req.user
        const tenantId = actor.tenantId;

        const {
            firstName,
            lastName,
            phone,
            email,
            departmentId,
            designationId,
            designationName,
            managerId,
            roleId,
            employeeCode,
            joiningDate,
            proposedSalary
        } = req.body;

        const policyDecision = await OnboardPolicy.canInvite(actor, {
            email,
            departmentId,
            managerId,
            roleId,
            employeeCode
        });
        if (!policyDecision.allowed) {
            return res.status(403).json({
                status: false,
                message: policyDecision.message || "You do not have permission to create an onboarding invite",
                code: policyDecision.code || "FORBIDDEN"
            });
        }
        let finalDesignationId: string | null = designationId || null;
        if (!finalDesignationId) {
            if (!designationName || !String(designationName).trim()) {
                return res.status(400).json({
                    status: false,
                    message: "Either designationId or designationName is required"
                });
            }
            const existingDepartment = await prisma.designation.findFirst({
                where: {
                    tenantId,
                    name: String(designationName).trim()
                }
            });
            if (existingDepartment) {
                finalDesignationId = existingDepartment.id;
            } else {
                const newDesignation = await prisma.designation.create({
                    data: {
                        tenantId,
                        name: String(designationName).trim()
                    }
                });
                finalDesignationId = newDesignation.id;
            }
        }
        

        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Token valid for 7 days

        const invite = await prisma.onboardingInvite.create({
            data: {
                tenantId,
                email: String(email).toLowerCase(),
                token,
                status: "PENDING",
                expiresAt,

                firstName: firstName ? String(firstName).trim() : null,
                lastName: lastName ? String(lastName).trim() : null,
                phone: phone ? String(phone).trim() : null,

                departmentId: departmentId || null,
                designationId: finalDesignationId,
                managerId: managerId || null,
                roleId: roleId || null,

                employeeCode: String(employeeCode).trim() || null,
                joiningDate: joiningDate || null,
                proposedSalary: proposedSalary !== undefined && proposedSalary !== null
                ? Number(proposedSalary)
                : null
            },
            select: {
                id: true,
                email: true,
                status: true,
                token: true,
                expiresAt: true,
                firstName: true,
                lastName: true,
                phone: true,
                department: {
                    select: {
                        id: true,
                        name: true
                    }                 
                },
                designation: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                manager: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                role: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                employeeCode: true,
                joiningDate: true,
                proposedSalary: true,
                createdAt: true
            }
        });
        return res.status(201).json({
            status: true,
            message: "Onboarding invite created successfully",
            data: invite
        });

    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to create onboarding invite",
            error: error.message
        });
    }
}

/**
 * @swagger
 * /onboarding/invite/{inviteId}/resend:
 *   post:
 *     tags:
 *       - onboarding
 *     summary: Resend an onboarding invite
 *     description: Resend an onboarding invite email with a new token and expiration date.
 *     parameters:
 *       - in: path
 *         name: inviteId
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Onboarding invite resent successfully
 *       400:
 *         description: Bad request - inviteId required or invite not pending
 *       404:
 *         description: Onboarding invite not found
 *       500:
 *         description: Internal server error
 */
export const resendOnboardingInvite = async (req: Request, res: Response) => {
    try {
        const actor = (req as any).user; // Assuming auth middleware sets req.user
        const tenantId = actor.tenantId;
        const { inviteId } = (req as any).params;

        if(!inviteId){
            return res.status(400).json({
                status: false,
                message: "inviteId is required"
            });
        }
        const existingInvite = await prisma.onboardingInvite.findFirst({
            where: {
                id: inviteId,
                tenantId
            },
            select: {
                id: true,
                email: true,
                status: true,
                expiresAt: true,
                firstName: true,
            },
        });
        if(!existingInvite){
            return res.status(404).json({
                status: false,
                message: "Onboarding invite not found"
            });
        }
        if(existingInvite.status !== "PENDING"){
            return res.status(400).json({
                status: false,
                message: "Only pending invites can be resent"
            });
        }
        const newToken = crypto.randomBytes(32).toString("hex");
        const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Token valid for 7 days

        const updatedInvite = await prisma.onboardingInvite.update({
            where: { id: inviteId },
            data: {
                token: newToken,
                expiresAt: newExpiresAt
            },
            select: {
                id: true,
                email: true,
                status: true,
                expiresAt: true,
                firstName: true,
                lastName: true,
                employeeCode: true,
                joiningDate: true,
                department: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                designation: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                manager: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });

        const htmlContent = await fillTemplate(ONBOARDING_TEMPLATE, {
            companyName: process.env.COMPANY_NAME || "Our Company",
            companyLogoUrl: process.env.COMPANY_LOGO_URL || "",
            participantName: [updatedInvite.firstName, updatedInvite.lastName].filter(Boolean).join(' '),
            role:            updatedInvite.designation?.name || "",
            department:      updatedInvite.department?.name || "",
            startDate:       updatedInvite.joiningDate?.toISOString().split('T')[0] || "",
            manager:         updatedInvite.manager?.name || "",
            senderName:      actor?.name || "",
            senderTitle:     actor?.designation?.name || "",
            portalUrl:       process.env.FRONTEND_URL || "",
        });

        const sendEmailResult = await sendMail({
            to: { email: updatedInvite.email },
            subject: `Onboarding Invitation from ${process.env.COMPANY_NAME || "Our Company"}`,
            htmlContent
        });
        if (!sendEmailResult) {
            return res.status(500).json({
                status: false,
                message: "Failed to send onboarding invite email"
            });
        }

        return res.status(200).json({
            status: true,
            message: "Onboarding invite resent successfully",
            data: {
                id: updatedInvite.id,
                email: updatedInvite.email,
                status: updatedInvite.status,
                expiresAt: updatedInvite.expiresAt
            }
        });

    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to resend onboarding invite",
            error: error.message
        });
    }
}

/**
 * @swagger
 * /onboarding/invites/pending:
 *   get:
 *     tags:
 *       - onboarding
 *     summary: Get all pending onboarding invites
 *     description: Retrieve all pending onboarding invites for the current tenant with optional search filtering.
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by email, firstName, lastName, or employeeCode
 *     responses:
 *       200:
 *         description: Pending onboarding invites retrieved successfully
 *       500:
 *         description: Internal server error
 */
export const getPendingOnboardingInvites = async (req: Request, res: Response) => {
    try {
        const actor = (req as any).user; // Assuming auth middleware sets req.user
        const tenantId = actor.tenantId;

        const { search } = (req as any).query;

        const invites = await prisma.onboardingInvite.findMany({
            where: {
                tenantId,
                status: "PENDING",
                ...(search
                    ? {
                        OR: [
                            { email: { contains: String(search), mode: 'insensitive' } },
                            { firstName: { contains: String(search), mode: 'insensitive' } },
                            { lastName: { contains: String(search), mode: 'insensitive' } },
                            {employeeCode: { contains: String(search), mode: 'insensitive' } }
                        ]
                    }
                : {})
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                employeeCode: true,
                joiningDate: true,
                status: true,
                department: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                designation: {
                    select: {
                        id: true,
                        name: true
                }
                },
                manager: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
            },
            orderBy: { createdAt: "desc" }
        });

        return res.status(200).json({
            status: true,
            message: "Pending onboarding invites retrieved successfully",
            data: invites
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to retrieve pending onboarding invites",
            error: error.message
        });
    }
}