import { Request, Response } from "express";
import { ReportingPolicy } from "../../core/policies/reporting.policy";
import { prisma } from "../../config/db/prisma";

/**
 * @swagger
 * /reporting/assign-manager:
 *   post:
 *     tags:
 *       - organization
 *     summary: Assign reporting manager to a user
 *     description: Assign or update a reporting manager for a user. Can be set to null to remove manager.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *                 description: ID of the user to assign manager to
 *               managerId:
 *                 type: string
 *                 nullable: true
 *                 description: ID of the manager user (or null to remove manager)
 *             required:
 *               - userId
 *     responses:
 *       200:
 *         description: Reporting manager assigned successfully
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
 *                     managerId:
 *                       type: string
 *       400:
 *         description: Bad request - missing userId
 *       403:
 *         description: Forbidden - insufficient permissions or policy violation
 *       500:
 *         description: Internal server error
 */
export const assignReportingManager = async (req: Request, res: Response) => {
    try {
        const actor = (req as any).user; // Assuming auth middleware sets req.user
        const { userId, managerId } = req.body;

        if(!userId){
            return res.status(400).json({
                status: false,
                message: "userId is required"
            });
        }
        /* Policy Engine: Check permissions */
        const decision = await ReportingPolicy.canAssignManager(actor, userId, managerId);
        if (!decision.allowed) {
            return res.status(403).json({
                status: false,
                code: decision.code,
                message: decision.message || "You do not have permission to assign this manager"
            });
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { managerId },
            select: { id: true, name: true, email:true ,managerId: true }
        });
        return res.status(200).json({
            status: true,
            message: "Reporting manager assigned successfully",
            data: updatedUser
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to assign reporting manager",
            error: (error as Error).message
        });
    }
}

/**
 * @swagger
 * /reporting/hierarchy/{userId}:
 *   get:
 *     tags:
 *       - organization
 *     summary: Get reporting hierarchy chain for a user
 *     description: Retrieve the complete reporting hierarchy chain (all managers up the chain) for a specific user.
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: User ID to get hierarchy for
 *     responses:
 *       200:
 *         description: Reporting hierarchy retrieved successfully
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
 *       400:
 *         description: Bad request - missing userId
 *       403:
 *         description: Forbidden - insufficient permissions
 *       500:
 *         description: Internal server error
 */
export const getReportingHierarchy = async (req: Request, res: Response) => {
    try {
        const actor = (req as any).user; // Assuming auth middleware sets req.user
        const { userId } = (req as any).params;
        if(!userId){
            return res.status(400).json({
                status: false,
                message: "userId is required"
            });
        }
        const decision = await ReportingPolicy.canReadHierarchy(actor, userId);
        if(!decision.allowed){
            return res.status(403).json({
                status: false,
                message: decision.message || "You do not have permission to view this hierarchy"
            });
        }
        const chain: any[] = [];
        let currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                managerId: true
            }
        });

        while (currentUser?.managerId) {
            const manager = await prisma.user.findUnique({
                where: { id: currentUser.managerId },
                select: {
                id: true,
                name: true,
                email: true,
                managerId: true
                }
            });

            if (!manager) break;

            chain.push(manager);
            currentUser = manager;
        }
        return res.status(200).json({
            status: true,
            message: "Reporting hierarchy retrieved successfully",
            data: chain
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to retrieve reporting hierarchy",
            error: (error as Error).message
        });
    }
}

/**
 * @swagger
 * /reporting/reportees/{userId}:
 *   get:
 *     tags:
 *       - organization
 *     summary: Get direct reportees for a user
 *     description: Retrieve all direct reportees (subordinates) for a specific user.
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: User ID (manager) to get reportees for
 *     responses:
 *       200:
 *         description: Reportees retrieved successfully
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
 *       400:
 *         description: Bad request - missing userId
 *       403:
 *         description: Forbidden - insufficient permissions
 *       500:
 *         description: Internal server error
 */
export const getReportees = async (req: Request, res: Response) => {
    try {
        const actor = (req as any).user; // Assuming auth middleware sets req.user
        const { userId } = (req as any).params;

        const decision = await ReportingPolicy.canReadHierarchy(actor, userId);
        if (!decision.allowed) {
            return res.status(403).json({
                status: false,
                message: decision.message || "You do not have permission to view reportees"
            });
        }

        const reportees = await prisma.user.findMany({
            where: { managerId: userId },
            select: {
                id: true,
                name: true,
                email: true,
                managerId: true
            },
            orderBy: { name: "asc" }
        });

        return res.status(200).json({
            status: true,
            message: "Reportees retrieved successfully",
            data: reportees
        });

    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to retrieve reportees",
            error: (error as Error).message
        });
    }
}