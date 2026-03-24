import { Request, Response } from "express";
import { prisma } from "../../../config/db/prisma";
import { featureSchema } from "../../../core/utils/zod";

/**
 * @swagger
 * /admin/subscription:
 *   post:
 *     tags:
 *       - subscription
 *     summary: Create a subscription plan (platform admin)
 *     description: Platform admin creates a new subscription plan. Features must be provided as a JSON object with feature keys and values.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Plan name (e.g., Free, Pro, Enterprise)
 *               price:
 *                 type: number
 *                 description: Plan price
 *               isFree:
 *                 type: boolean
 *                 description: Is this a free plan?
 *               maxUsers:
 *                 type: integer
 *                 description: Maximum users allowed
 *               features:
 *                 type: object
 *                 description: Features JSON. Keys are feature names, values are objects with enabled and max.
 *                 example:
 *                   EMPLOYEE:
 *                     enabled: true
 *                     max: 100
 *                   ATTENDANCE:
 *                     enabled: false
 *     responses:
 *       201:
 *         description: Subscription plan created successfully
 *       400:
 *         description: Invalid features format or creation failed
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
export const createPlatformSubscription = async (req: Request, res: Response) => {
    try {
        const {
            name, price, isFree, maxUsers, features
        } = req.body;

        const parsedFeatures = featureSchema.safeParse(features);
        if (!parsedFeatures.success) {
            return res.status(400).json({
                status: false,
                message: "Invalid features format",
            });
        }
        /* Creating plan */
        const plan = await prisma.subscriptionPlan.create({
            data: {
                name,
                price,
                isFree,
                maxUsers,
                features: parsedFeatures.data  //JSON   
            }
        });
        if(!plan){
            return res.status(400).json({
                status: false,
                message: "Failed to create subscription plan"
            });
        }
        return res.status(201).json({
            status: true,
            message: "Subscription plan created successfully",
            data: plan
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to create subscription",
            error: (error as Error).message
        });
    }
}

/**
 * @swagger
 * /admin/subscription/{id}:
 *   patch:
 *     tags:
 *       - subscription
 *     summary: Update a subscription plan (platform admin)
 *     description: Platform admin updates an existing subscription plan. Features must be provided as a JSON object with feature keys and values. Only provided keys will be updated; others remain unchanged.
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Subscription plan ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               price:
 *                 type: number
 *               isFree:
 *                 type: boolean
 *               maxUsers:
 *                 type: integer
 *               features:
 *                 type: object
 *                 description: Features JSON. Keys are feature names, values are objects with enabled and max.
 *                 example:
 *                   EMPLOYEE:
 *                     enabled: true
 *                     max: 200
 *                   ATTENDANCE:
 *                     enabled: true
 *     responses:
 *       200:
 *         description: Subscription plan updated successfully
 *       400:
 *         description: Invalid features format or update failed
 *       401:
 *         description: Unauthorized access
 *       404:
 *         description: Subscription plan not found
 *       500:
 *         description: Internal server error
 */
export const updatePlatformSubscription = async (req: Request, res: Response) => {
    try {
        const { id } = (req as any).params;
        const {
            name, price, isFree, maxUsers, features
        } = req.body;

        const existingPlan = await prisma.subscriptionPlan.findUnique({ where: { id } });
        if (!existingPlan) {
            return res.status(404).json({
                status: false,
                message: "Subscription plan not found"
            });
        }
        
        const mergedFeatures = {
            ...(typeof existingPlan.features === "object" && existingPlan.features !== null ? existingPlan.features : {}),
            ...(typeof features === "object" && features !== null ? features : {})
        };
        const parsedFeatures = featureSchema.safeParse(mergedFeatures);
        if (!parsedFeatures.success) {
            return res.status(400).json({
                status: false,
                message: "Invalid features format",
                error: parsedFeatures.error.message
            });
        }
        const plan = await prisma.subscriptionPlan.update({
            where: { id },
            data: {
                name,
                price,
                isFree,
                maxUsers,
                features: parsedFeatures.data  //JSON
            }
        });

        if (!plan) {
            return res.status(404).json({
                status: false,
                message: "Subscription plan not found"
            });
        }

        return res.status(200).json({
            status: true,
            message: "Subscription plan updated successfully",
            data: plan
        });

    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to update subscription",
            error: (error as Error).message
        });
    }
}

/**
 * @swagger
 * /admin/subscription:
 *   get:
 *     tags:
 *       - subscription
 *     summary: Get all subscription plans (platform admin)
 *     description: Retrieve all subscription plans created by platform admin.
 *     responses:
 *       200:
 *         description: Subscription plans retrieved successfully
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
export const getAllPlatformSubscriptions = async (req: Request, res: Response) => {
    try {
        const plans = await prisma.subscriptionPlan.findMany();
        return res.status(200).json({
            status: true,
            message: "Subscription plans retrieved successfully",
            data: plans
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to retrieve subscription plans",
            error: (error as Error).message
        });
    }
}

/**
 * @swagger
 * /admin/subscription/{id}:
 *   delete:
 *     tags:
 *       - subscription
 *     summary: Delete a subscription plan (platform admin)
 *     description: Platform admin deletes a subscription plan by ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Subscription plan ID
 *     responses:
 *       200:
 *         description: Subscription plan deleted successfully
 *       401:
 *         description: Unauthorized access
 *       404:
 *         description: Subscription plan not found
 *       500:
 *         description: Internal server error
 */
export const deletePlatformSubscription = async (req: Request, res: Response) => {
    try {
        const { id } = (req as any).params;
        const existingPlan = await prisma.subscriptionPlan.findUnique({ where: { id } });
        if (!existingPlan) {
            return res.status(404).json({
                status: false,
                message: "Subscription plan not found"
            });
        }
        await prisma.subscriptionPlan.delete({ where: { id } });
        return res.status(200).json({
            status: true,
            message: "Subscription plan deleted successfully"
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to delete subscription",
            error: (error as Error).message
        });
    }
}