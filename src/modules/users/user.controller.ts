import { Request, Response } from "express";
import { prisma } from "../../config/db/prisma";

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