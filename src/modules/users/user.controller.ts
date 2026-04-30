import { Request, Response } from "express";
import { prisma } from "../../config/db/prisma";
import bcrypt from "bcrypt";
import { OnboardPolicy } from "../../core/policies/onboard.policy";
import crypto from "crypto";
import { fillTemplate } from "../utils/util";
import { ONBOARDING_TEMPLATE } from "../utils/mail.template";
import { sendMail } from "../../core/service/mail.service";
import { EmploymentType } from "@prisma/client";
import { deleteFromS3, uploadToS3 } from "../../config/s3/s3.config";

/** Will return all the active users for the current tenant */
/**
 * @swagger
 * /users/select-options:
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
 * /users/details/{userId}:
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
                personalEmail: true,
                phone: true,
                isActive: true,
                tenantId: true,
                employeeProfile: {
                    include: {
                        familyMembers: {
                            orderBy: { createdAt: "desc" }
                        },
                        qualifications: {
                            orderBy: { createdAt: "desc" }
                        },
                        experiences: {
                            orderBy: { createdAt: "desc" }
                        }
                    }
                },
                bankAccount: true,
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

/* ----------------------- User Editable Only ----------------------------- */

/**
 * @swagger
 * /users/update:
 *   put:
 *     tags:
 *       - users
 *     summary: Update my profile
 *     description: Update the logged-in user's profile, address, personal details, profile photo, and optional bank details. Profile photo must be uploaded as multipart file using the field name photoUrl.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Rahul Sharma
 *               phone:
 *                 type: string
 *                 example: "+919876543210"
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *                 example: 1995-08-20
 *               bloodGroup:
 *                 type: string
 *                 example: O+
 *               photoUrl:
 *                 type: string
 *                 format: binary
 *                 description: Profile photo file. Use this field name with multer upload.single("photoUrl").
 *               addressLine1:
 *                 type: string
 *                 example: 12 Park Street
 *               addressLine2:
 *                 type: string
 *                 example: Flat 3B
 *               city:
 *                 type: string
 *                 example: Kolkata
 *               state:
 *                 type: string
 *                 example: West Bengal
 *               country:
 *                 type: string
 *                 example: India
 *               pinCode:
 *                 type: string
 *                 example: "700016"
 *               panNumber:
 *                 type: string
 *                 example: ABCDE1234F
 *               aadhaarNumber:
 *                 type: string
 *                 example: "123456789012"
 *               bankDetails:
 *                 type: string
 *                 description: JSON string containing bank details.
 *                 example: '{"accountHolderName":"Rahul Sharma","accountNumber":"1234567890","bankName":"HDFC Bank","ifscCode":"HDFC0001234","branchName":"Kolkata","upiId":"rahul@upi"}'
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Failed to update profile
 */
export const updateMyProfile = async (req: Request, res: Response) => {
    try {
        const actor = (req as any).user;
        const file = (req as any).file;
        const {
            name,
            phone,
            dateOfBirth,
            bloodGroup,
            addressLine1,
            addressLine2,
            city,
            state,
            country,
            pinCode,
            panNumber,
            aadhaarNumber,
            bankDetails
        } = req.body;

        const targetUser = await prisma.user.findUnique({
            where: { id: actor.id },
            include: {
                employeeProfile: true
            }
        });

        if (!targetUser) {
            return res.status(404).json({
                status: false,
                message: "User not found"
            });
        }
        let uploadedPhotoUrl: string | undefined;

        if(file){
            if(targetUser.employeeProfile?.photoUrl){
                await deleteFromS3(targetUser.employeeProfile.photoUrl)
            }

            uploadedPhotoUrl = await uploadToS3(
                {
                    buffer: file.buffer,
                    mimetype: file.mimetype,    
                },
                actor.tenantId,
                "employee-profile-photos",
            );
        }

        const parsedBankDetails = typeof bankDetails === "string" ? JSON.parse(bankDetails) : bankDetails;



        const result = await prisma.$transaction(async (tx) => {
            const updatedUser = await tx.user.update({
                where: { id: actor.id },
                data: {
                    name: name ?? undefined,
                    phone: phone ?? undefined
                }
            });

            const updatedProfile = await tx.employeeProfile.upsert({
                where: { userId: actor.id },
                update: {
                    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
                    bloodGroup: bloodGroup ?? undefined,
                    photoUrl: uploadedPhotoUrl ?? undefined,
                    addressLine1: addressLine1 ?? undefined,
                    addressLine2: addressLine2 ?? undefined,
                    city: city ?? undefined,
                    state: state ?? undefined,
                    country: country ?? undefined,
                    pinCode: pinCode ?? undefined,
                    panNumber: panNumber ?? undefined,
                    aadharNumber: aadhaarNumber ?? undefined
                },
                create: {
                    userId: actor.id,
                    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
                    bloodGroup: bloodGroup ?? null,
                    photoUrl: uploadedPhotoUrl ?? null,
                    addressLine1: addressLine1 ?? null,
                    addressLine2: addressLine2 ?? null,
                    city: city ?? null,
                    state: state ?? null,
                    country: country ?? null,
                    pinCode: pinCode ?? null,
                    panNumber: panNumber ?? null,
                    aadharNumber: aadhaarNumber ?? null
                }
            });

            let updatedBankDetails = null;
            if(parsedBankDetails){
                updatedBankDetails = await tx.employeeBankAccount.upsert({
                    where: { userId: actor.id },
                    update: {
                        accountHolderName: parsedBankDetails.accountHolderName ?? undefined,
                        accountNumber: parsedBankDetails.accountNumber ?? undefined,
                        bankName: parsedBankDetails.bankName ?? undefined,
                        ifscCode: parsedBankDetails.ifscCode ?? undefined,
                        branchName: parsedBankDetails.branchName ?? undefined,
                        upiId: parsedBankDetails.upiId ?? undefined
                    },
                    create: {
                        userId: actor.id,
                        accountHolderName: parsedBankDetails.accountHolderName ?? null,
                        accountNumber: parsedBankDetails.accountNumber ?? null,
                        bankName: parsedBankDetails.bankName ?? null,
                        ifscCode: parsedBankDetails.ifscCode ?? null,
                        branchName: parsedBankDetails.branchName ?? null,
                        upiId: parsedBankDetails.upiId ?? null
                    }
                })
            }

            return { updatedUser, updatedProfile, updatedBankDetails };
        });

        return res.status(200).json({
            status: true,
            message: "Profile updated successfully",
            data: result
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to update profile",
            error: error.message
        });
    }
};

/* ----------------------- COMPANY_ADMIN Editable Only ----------------------------- */

export const adminUpdateEmployee = async (req: Request, res: Response) => {
    try {
        const actor = (req as any).user;
        const { userId } = (req as any).params;

        const {
            name,
            phone,
            departmentId,
            designationId,
            managerId,
            isActive,
            employeeCode,
            employmentType,
            joiningDate,
            probationMonths,
            salary,
            dateOfBirth,
            addressLine1,
            addressLine2,
            city,
            state,
            country,
            pinCode,
            panNumber,
            aadhaarNumber
        } = req.body;

        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                employeeProfile: true
            }
        });

        if (!targetUser) {
            return res.status(404).json({
                status: false,
                message: "Employee not found"
            });
        }

        if (targetUser.tenantId !== actor.tenantId) {
            return res.status(403).json({
                status: false,
                message: "You cannot update employee from another tenant"
            });
        }

        if (
            employmentType !== undefined &&
            !Object.values(EmploymentType).includes(employmentType as EmploymentType)
        ) {
            return res.status(400).json({
                status: false,
                message: "Invalid employment type"
            });
        }

        const result = await prisma.$transaction(async (tx) => {
            const updatedUser = await tx.user.update({
                where: { id: userId },
                data: {
                    name: name ?? undefined,
                    phone: phone ?? undefined,
                    departmentId: departmentId ?? undefined,
                    designationId: designationId ?? undefined,
                    managerId: managerId ?? undefined,
                    isActive: typeof isActive === "boolean" ? isActive : undefined
                }
            });

            const updatedProfile = await tx.employeeProfile.upsert({
                where: { userId },
                update: {
                    employeeCode: employeeCode ?? undefined,
                    employmentType: employmentType ?? undefined,
                    joiningDate: joiningDate ? new Date(joiningDate) : undefined,
                    probationMonths:
                        probationMonths !== undefined && probationMonths !== null
                            ? Number(probationMonths)
                            : undefined,
                    salary:
                        salary !== undefined && salary !== null
                            ? Number(salary)
                            : undefined,
                    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
                    addressLine1: addressLine1 ?? undefined,
                    addressLine2: addressLine2 ?? undefined,
                    city: city ?? undefined,
                    state: state ?? undefined,
                    country: country ?? undefined,
                    pinCode: pinCode ?? undefined,
                    panNumber: panNumber ?? undefined,
                    aadharNumber: aadhaarNumber ?? undefined
                },
                create: {
                    userId,
                    employeeCode: employeeCode ?? null,
                    employmentType: employmentType ?? null,
                    joiningDate: joiningDate ? new Date(joiningDate) : null,
                    probationMonths:
                        probationMonths !== undefined && probationMonths !== null
                            ? Number(probationMonths)
                            : null,
                    salary:
                        salary !== undefined && salary !== null
                            ? Number(salary)
                            : null,
                    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
                    addressLine1: addressLine1 ?? null,
                    addressLine2: addressLine2 ?? null,
                    city: city ?? null,
                    state: state ?? null,
                    country: country ?? null,
                    pinCode: pinCode ?? null,
                    panNumber: panNumber ?? null,
                    aadharNumber: aadhaarNumber ?? null
                }
            });

            return { updatedUser, updatedProfile };
        });

        return res.status(200).json({
            status: true,
            message: "Employee updated successfully",
            data: result
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to update employee",
            error: error.message
        });
    }
};

/**
 * @swagger
 * /users/family-details:
 *   put:
 *     tags:
 *       - users
 *     summary: Update family details
 *     description: Replaces all existing family members with the provided list. Pass an empty array to clear all records.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - familyMembers
 *             properties:
 *               familyMembers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - relation
 *                     - name
 *                   properties:
 *                     relation:
 *                       type: string
 *                       example: Spouse
 *                     name:
 *                       type: string
 *                       example: Jane Doe
 *                     dateOfBirth:
 *                       type: string
 *                       format: date
 *                       example: 1990-05-15
 *                     phone:
 *                       type: string
 *                       example: "+919876543210"
 *                     email:
 *                       type: string
 *                       example: jane@example.com
 *                     occupation:
 *                       type: string
 *                       example: Teacher
 *                     isDependent:
 *                       type: boolean
 *                       example: true
 *     responses:
 *       200:
 *         description: Family details updated successfully
 *       400:
 *         description: familyMembers must be an array
 *       500:
 *         description: Failed to update family details
 */
export const updateFamilyDetails = async (req: Request, res: Response) => {
    try {
        const actor = (req as any).user;
        const { familyMembers } = req.body;

        if(!Array.isArray(familyMembers)){
            return res.status(400).json({
                status: false,
                message: "familyMembers must be an array"
            });
        }

        const profile  = await prisma.employeeProfile.upsert({
            where: { userId: actor.id },
            update: {},
            create: { userId: actor.id }
        });

        await prisma.$transaction(async(tx) => {
            await tx.employeeFamilyMember.deleteMany({
                where: { employeeProfileId: profile.id }
            });

            if(familyMembers.length > 0){
                await tx.employeeFamilyMember.createMany({
                    data: familyMembers.map((member: any) => ({
                        employeeProfileId: profile.id,
                        relation: member.relation,
                        name: member.name,
                        dateOfBirth: member.dateOfBirth ? new Date(member.dateOfBirth) : null,
                        phone: member.phone ?? null,
                        email: member.email ?? null,
                        occupation: member.occupation ?? null,
                        isDependent: member.isDependent ?? false
                    }))
                })
            }
        });

        const result = await prisma.employeeFamilyMember.findMany({
            where: { employeeProfileId: profile.id }
        });

        return res.status(200).json({
            status: true,
            message: "Family details updated successfully",
            data: result
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to update family details",
            error: error.message
        });
    }
}

/**
 * @swagger
 * /users/qualification-details:
 *   put:
 *     tags:
 *       - users
 *     summary: Update qualification details
 *     description: Replaces all existing qualifications with the provided list. Pass an empty array to clear all records.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - qualifications
 *             properties:
 *               qualifications:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - degree
 *                   properties:
 *                     degree:
 *                       type: string
 *                       example: B.Tech
 *                     institution:
 *                       type: string
 *                       example: IIT Delhi
 *                     fieldOfStudy:
 *                       type: string
 *                       example: Computer Science
 *                     startYear:
 *                       type: integer
 *                       example: 2015
 *                     endYear:
 *                       type: integer
 *                       example: 2019
 *                     grade:
 *                       type: string
 *                       example: 8.5 CGPA
 *     responses:
 *       200:
 *         description: Qualification details updated successfully
 *       400:
 *         description: qualifications must be an array
 *       500:
 *         description: Failed to update qualification details
 */
export const updateQualificationDetails = async (req: Request, res: Response) => {
    try {
        const actor = (req as any).user;
        const { qualifications } = req.body;

        if(!Array.isArray(qualifications)){
            return res.status(400).json({
                status: false,
                message: "qualifications must be an array"
            });
        }

        const profile  = await prisma.employeeProfile.upsert({
            where: { userId: actor.id },
            update: {},
            create: { userId: actor.id }
        });

        await prisma.$transaction(async(tx) => {
            await tx.employeeQualification.deleteMany({
                where: { employeeProfileId: profile.id }
            });

            if(qualifications.length > 0){
                await tx.employeeQualification.createMany({
                    data: qualifications.map((q: any) => ({
                        employeeProfileId: profile.id,
                        degree: q.degree,
                        institution: q.institution ?? null,
                        fieldOfStudy: q.fieldOfStudy ?? null,
                        startYear: q.startYear ? Number(q.startYear) : null,
                        endYear: q.endYear ? Number(q.endYear) : null,
                        grade: q.grade ?? null
                    }))
                })
            }
        });

        const result = await prisma.employeeQualification.findMany({
            where: { employeeProfileId: profile.id }
        });

        return res.status(200).json({
            status: true,
            message: "Qualification details updated successfully",
            data: result
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to update qualification details",
            error: error.message
        });
    }
}

/**
 * @swagger
 * /users/experience-details:
 *   put:
 *     tags:
 *       - users
 *     summary: Update experience details
 *     description: Replaces all existing experience records with the provided list. Pass an empty array to clear all records.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - experiences
 *             properties:
 *               experiences:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - companyName
 *                     - designation
 *                   properties:
 *                     companyName:
 *                       type: string
 *                       example: Acme Corp
 *                     designation:
 *                       type: string
 *                       example: Software Engineer
 *                     startDate:
 *                       type: string
 *                       format: date
 *                       example: 2019-06-01
 *                     endDate:
 *                       type: string
 *                       format: date
 *                       example: 2023-03-31
 *                     responsibilities:
 *                       type: string
 *                       example: Developed REST APIs and managed deployments
 *     responses:
 *       200:
 *         description: Experience details updated successfully
 *       400:
 *         description: experiences must be an array
 *       500:
 *         description: Failed to update experience details
 */
export const updateExperienceDetails = async (req: Request, res: Response) => {
    try {
        const actor = (req as any).user;
        const { experiences } = req.body;

        if(!Array.isArray(experiences)){
            return res.status(400).json({
                status: false,
                message: "experiences must be an array"
            });
        }

        const profile  = await prisma.employeeProfile.upsert({
            where: { userId: actor.id },
            update: {},
            create: { userId: actor.id }
        });

        await prisma.$transaction(async(tx) => {
            await tx.employeeExperience.deleteMany({
                where: { employeeProfileId: profile.id }
            });

            if(experiences.length > 0){
                await tx.employeeExperience.createMany({
                    data: experiences.map((exp: any) => ({
                        employeeProfileId: profile.id,
                        companyName: exp.companyName,
                        designation: exp.designation,
                        startDate: exp.startDate ? new Date(exp.startDate) : null,
                        endDate: exp.endDate ? new Date(exp.endDate) : null,
                        responsibilities: exp.responsibilities ?? null
                    }))
                })
            }
        });

        const result = await prisma.employeeExperience.findMany({
            where: { employeeProfileId: profile.id }
        });

        return res.status(200).json({
            status: true,
            message: "Experience details updated successfully",
            data: result
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to update experience details",
            error: error.message
        });
    }
}


/**
 * @swagger
 * /users/delete/{userId}:
 *   delete:
 *     tags:
 *       - users
 *     summary: Deactivate a user
 *     description: Deactivate (soft delete) a user by userId.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user to deactivate
 *     responses:
 *       200:
 *         description: Employee deactivated successfully
 *       400:
 *         description: Employee is already inactive
 *       403:
 *         description: Forbidden - cannot deactivate employee from another tenant
 *       404:
 *         description: Employee not found
 *       500:
 *         description: Failed to deactivate user
 */
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    const { userId } = (req as any).params;

    const targetUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!targetUser) {
      return res.status(404).json({
        status: false,
        message: "Employee not found"
      });
    }

    if (targetUser.tenantId !== actor.tenantId) {
      return res.status(403).json({
        status: false,
        message: "You cannot deactivate employee from another tenant"
      });
    }

    if (!targetUser.isActive) {
      return res.status(400).json({
        status: false,
        message: "Employee is already inactive"
      });
    }

    const deactivated = await prisma.user.update({
      where: { id: userId },
      data: { isActive: false }
    });
    if(!deactivated){
        return res.status(500).json({
            status: false,
            message: "Failed to deactivate user"
        });
    }
    return res.status(200).json({
      status: true,
      message: "Employee deactivated successfully"
    });
  } catch (error: any) {
    return res.status(500).json({
      status: false,
      message: "Failed to deactivate user",
      error: error.message
    });
  }
};


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
 *               sourceOfHire:
 *                 type: string
 *                 enum: [DIRECT, REFERRAL, JOB_PORTAL, LINKEDIN, CONSULTANCY, CAMPUS, WALK_IN, OTHER]
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
            employeeCode,
            joiningDate,
            employmentType,
            sourceOfHire,
            proposedSalary
        } = req.body;

        const allowedSourceOfHire = [
            "DIRECT",
            "REFERRAL",
            "JOB_PORTAL",
            "LINKEDIN",
            "CONSULTANCY",
            "CAMPUS",
            "WALK_IN",
            "OTHER"
        ];

        if (
            sourceOfHire !== undefined &&
            !allowedSourceOfHire.includes(String(sourceOfHire).toUpperCase())
        ) {
            return res.status(400).json({
                status: false,
                message: "Invalid sourceOfHire"
            });
        }

        const policyDecision = await OnboardPolicy.canInvite(actor, {
            email,
            departmentId,
            managerId: managerId || null,
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
        let finalManagerId: string | null = null;

        if (managerId) {
            const managerUser = await prisma.user.findFirst({
                where: {
                    id: String(managerId),
                    tenantId,
                    isActive: true
                }
            });

            if (!managerUser) {
                return res.status(400).json({
                    status: false,
                    message: "Manager not found in this tenant"
                });
            }

            finalManagerId = managerUser.id;
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

                sourceOfHire: sourceOfHire
                ? String(sourceOfHire).toUpperCase() as any
                : null,

                departmentId: departmentId || null,
                designationId: finalDesignationId,
                managerId: finalManagerId,

                employeeCode: employeeCode ? String(employeeCode).trim() : null,
                joiningDate: joiningDate ? new Date(joiningDate) : null,
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
                expiresAt: newExpiresAt,
                submittedAt: new Date()
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
        const managerRow = updatedInvite.manager
        ? `<div class="info-row">
            <div class="info-label">Reporting To</div>
            <div class="info-value">${updatedInvite.manager.name}</div>
            </div>`
        : "";

        const htmlContent = await fillTemplate(ONBOARDING_TEMPLATE, {
            companyName: process.env.COMPANY_NAME || "Our Company",
            companyLogoUrl: process.env.COMPANY_LOGO_URL || "",
            participantName: [updatedInvite.firstName, updatedInvite.lastName].filter(Boolean).join(' '),
            role:            updatedInvite.designation?.name || "",
            department:      updatedInvite.department?.name || "",
            startDate:       updatedInvite.joiningDate?.toISOString().split('T')[0] || "",
            managerRow:      managerRow,
            senderName:      actor?.name || "",
            senderTitle:     actor?.designation?.name || "",
            portalUrl:       `${process.env.FRONTEND_URL}/accept?token=${newToken}` || "",
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

/**
 * @swagger
 * /invites/verify:
 *   get:
 *     tags:
 *       - Onboarding
 *     summary: Verify onboarding invite token
 *     description: Public endpoint to verify whether an onboarding invite token is valid and not expired.
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Onboarding invite token
 *     responses:
 *       200:
 *         description: Invite token is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Onboarding invite token is valid
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     firstName:
 *                       type: string
 *                       nullable: true
 *                     lastName:
 *                       type: string
 *                       nullable: true
 *                     employeeCode:
 *                       type: string
 *                       nullable: true
 *                     joiningDate:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *       400:
 *         description: Token is required
 *       404:
 *         description: Invalid or expired onboarding invite token
 *       500:
 *         description: Internal server error
 */
export const verifyOnboardingInvite = async (req: Request, res: Response) => {
    try {
        const { token } = req.query;
        if(!token || typeof token !== "string"){
            return res.status(400).json({
                status: false,
                message: "Token is required"
            });
        }

        const invite = await prisma.onboardingInvite.findFirst({
            where: {
                token,
                status: "PENDING",
                expiresAt: {
                    gt: new Date()
                }
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                employeeCode: true,
                joiningDate: true,
                department:{ select: { id: true, name: true } },
                designation:{ select: { id: true, name: true } },
                manager:{ select: { id: true, name: true, email: true } },
                tenant: { select: { id: true, name: true } },
                token: true
            }
        });
        if(!invite){
            return res.status(404).json({
                status: false,
                message: "Invalid or expired onboarding invite token"
            });
        }
        return res.status(200).json({
            status: true,
            message: "Onboarding invite token is valid",
            data: invite
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to verify onboarding invite",
            error: error.message
        });
    }
}

/**
 * @swagger
 * /invites/accept:
 *   post:
 *     tags:
 *       - Onboarding
 *     summary: Accept onboarding invite
 *     description: Public endpoint for an invited employee to set password and activate account.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *               - confirmPassword
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *                 format: password
 *               confirmPassword:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Onboarding invite accepted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Onboarding invite accepted successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *       400:
 *         description: Validation failed or user already exists
 *       404:
 *         description: Invalid or expired onboarding invite token
 *       500:
 *         description: Internal server error
 */
export const acceptOnboardingInvite = async (req: Request, res: Response) => {
    try {
        const {
            token,
            password,
            confirmPassword
        } = req.body;
        if(!token || typeof token !== "string"){
            return res.status(400).json({
                status: false,
                message: "Token is required"
            });
        }

        if(!password || !confirmPassword){
            return res.status(400).json({
                status: false,
                message: "Password and confirmPassword are required"
            });
        }
        if(password !== confirmPassword){
            return res.status(400).json({
                status: false,
                message: "Password and confirmPassword do not match"
            });
        }
        const invite = await prisma.onboardingInvite.findFirst({
            where: {
                token,
                status: "PENDING",
                expiresAt: {
                    gt: new Date()
                }
            }
        });
        if(!invite){
            return res.status(404).json({
                status: false,
                message: "Invalid or expired onboarding invite token"
            });
        }

        const existingUser = await prisma.user.findUnique({
            where: { email: invite.email }
        });
        if(existingUser){
            return res.status(400).json({
                status: false,
                message: "A user with this email already exists"
            });
        }
        // hash the password
        const hashedPassword = await bcrypt.hash(password, 10);
        const employeeRole = await prisma.role.findFirst({
            where: {
                tenantId: invite.tenantId,
                name: "EMPLOYEE"
            }
        });

        const result = await prisma.$transaction(async (tx) => {
            const newUser = await tx.user.create({
                data: {
                    tenantId: invite.tenantId,
                    email: invite.email,
                    phone: invite.phone,
                    password: hashedPassword,
                    name: [invite.firstName, invite.lastName].filter(Boolean).join(' '),
                    departmentId: invite.departmentId,
                    designationId: invite.designationId,
                    managerId: invite.managerId ?? null,
                    isActive: true,
                }
            });

            if (!employeeRole && !invite.roleId) {
                throw new Error("Default EMPLOYEE role not found");
            }

            const roleIdsToAssign = new Set<string>();
            roleIdsToAssign.add(employeeRole!.id);

            if (invite.roleId && invite.roleId !== employeeRole!.id) {
                roleIdsToAssign.add(invite.roleId);
            }


            await tx.userRole.createMany({
                data: Array.from(roleIdsToAssign).map((roleId) => ({
                    userId: newUser.id,
                    roleId
                })),
                skipDuplicates: true
            });
            await tx.employeeProfile.create({
                data: {
                    userId: newUser.id,
                    employeeCode: invite.employeeCode,
                    joiningDate: invite.joiningDate || null,
                    sourceOfHire: invite.sourceOfHire,
                    salary: invite.proposedSalary ?? null
                }
            })
            await tx.onboardingInvite.update({
                where: { id: invite.id },
                data: { 
                    status: "ACCEPTED",
                    completedAt: new Date()
                }
            })
            await tx.feed.create({
                data: {
                    tenantId: invite.tenantId,
                    subjectedUserId: newUser.id,
                    departmentId: newUser.departmentId,
                    type: "EVENT",
                    content: null,
                    metadata: {
                        event: "NEW_JOINING",
                        message: `${newUser.name} joined the team`,
                        designationId: newUser.designationId,
                        departmentId: newUser.departmentId
                    }
                }
            });
            return newUser;
        });

        return res.status(200).json({
            status: true,
            message: "Onboarding invite accepted successfully",
            data: {
                id: result.id,
                email: result.email,
                name: result.name
            }
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to accept onboarding invite",
            error: error.message
        });
    }
}
