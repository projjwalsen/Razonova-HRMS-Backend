import { Request, Response } from "express";
import { SubscriptionService } from "./subscription.service";

/**
 * @swagger
 * /platform/subscription/modules/upsert:
 *   post:
 *     tags:
 *       - Subscription
 *     summary: Create or update a subscription module
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - key
 *               - name
 *             properties:
 *               key:
 *                 type: string
 *                 example: PAYROLL
 *               name:
 *                 type: string
 *                 example: Payroll Management
 *               description:
 *                 type: string
 *                 example: Payroll processing and payslip management
 *               isActive:
 *                 type: boolean
 *                 example: true
 *               monthlyPrice:
 *                 type: number
 *                 example: 199
 *               yearlyPrice:
 *                 type: number
 *                 example: 1999
 *     responses:
 *       200:
 *         description: Subscription module upserted successfully
 *       400:
 *         description: Module key is required
 *       500:
 *         description: Failed to upsert subscription module
 */
export const upsertSubcriptionModule = async (req: Request, res: Response) => {
    try {
        const {
        key,
        name,
        description,
        isActive,
        monthlyPrice,
        yearlyPrice,
        } = req.body;

        if (!key || !key.trim()) {
            return res.status(400).json({
                status: false,
                message: "Module key is required"
            });
        }

        const result = await SubscriptionService.upsertSubscriptionModule({
            key: key.trim(),
            name,
            description,
            isActive,
            monthlyPrice,
            yearlyPrice
        });

        if(!result){
            return res.status(404).json({
                status: false,
                message: "Subscription module not found",
            });
        }

        return res.status(200).json({
            status: true,
            message: "Subscription module upserted successfully",
            data: result
         });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to upsert subscription module",
            error: (error as Error).message
        });
    }
}

/**
 * @swagger
 * /platform/subscription/modules:
 *   get:
 *     tags:
 *       - Subscription
 *     summary: Get all active subscription modules
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription modules fetched successfully
 *       500:
 *         description: Failed to fetch subscription modules
 */
export const getAllSubscriptionModules = async (req: Request, res: Response) => {
    try {
        const result = await SubscriptionService.getSubscriptionModules();
        return res.status(200).json({
            status: true,
            message: "Subscription modules fetched successfully",
            data: result
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to fetch subscription modules",
            error: (error as Error).message
        });
    }
}

/**
 * @swagger
 * /platform/subscription/assign-modules:
 *   post:
 *     tags:
 *       - Subscription
 *     summary: Assign subscription modules to a tenant
 *     description: Creates a new active subscription for a tenant and assigns selected modules.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tenantId
 *               - billingCycle
 *               - startDate
 *               - endDate
 *               - modules
 *             properties:
 *               tenantId:
 *                 type: string
 *                 example: tenant_uuid
 *               billingCycle:
 *                 type: string
 *                 enum: [MONTHLY, YEARLY]
 *                 example: MONTHLY
 *               startDate:
 *                 type: string
 *                 format: date
 *                 example: 2026-04-27
 *               endDate:
 *                 type: string
 *                 format: date
 *                 example: 2026-05-26
 *               modules:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - moduleKey
 *                   properties:
 *                     moduleKey:
 *                       type: string
 *                       example: PAYROLL
 *                     isEnabled:
 *                       type: boolean
 *                       example: true
 *     responses:
 *       200:
 *         description: Modules assigned to tenant successfully
 *       400:
 *         description: Required fields missing
 *       404:
 *         description: Failed to assign modules to tenant
 *       500:
 *         description: Failed to assign modules to tenant
 */
export const assignModulesToTenant = async (req: Request, res: Response) => {
    try {
        const {
            tenantId,
            billingCycle,
            startDate,
            endDate,
            modules
        } = req.body;

        if(!tenantId || !billingCycle || !startDate || !endDate || !modules || !Array.isArray(modules) || modules.length === 0){
            return res.status(400).json({
                status: false,
                message: "tenantId, billingCycle, startDate, endDate and modules (non-empty array) are required"
            });
        }

        const result = await SubscriptionService.assignModulesToTenant({
            tenantId,
            billingCycle,
            startDate: startDate ? new Date(startDate): undefined,
            endDate: endDate ? new Date(endDate): undefined,
            modules
        });

        if(!result){
            return res.status(404).json({
                status: false,
                message: "Failed to assign modules to tenant. Please check if tenant and modules exist.",
            });
        }

        return res.status(200).json({
            status: true,
            message: "Modules assigned to tenant successfully",
            data: result
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to assign modules to tenant",
            error: (error as Error).message
        });
    }
}

/**
 * @swagger
 * /platform/subscription/update/modules/{tenantId}:
 *   patch:
 *     tags:
 *       - Subscription
 *     summary: Update enabled/disabled modules for tenant subscription
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *         description: Tenant ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - modules
 *             properties:
 *               modules:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - moduleKey
 *                     - isEnabled
 *                   properties:
 *                     moduleKey:
 *                       type: string
 *                       example: ATTENDANCE
 *                     isEnabled:
 *                       type: boolean
 *                       example: false
 *     responses:
 *       200:
 *         description: Tenant subscription modules updated successfully
 *       400:
 *         description: tenantId or modules missing
 *       404:
 *         description: Failed to update tenant subscription modules
 *       500:
 *         description: Failed to update tenant subscription modules
 */
export const updateTenantSubscriptionModules = async (req: Request, res: Response) => {
    try {
        const { tenantId } = req.params as { tenantId: string };
        const { modules } = req.body;

        if(!tenantId){
            return res.status(400).json({
                status: false,
                message: "tenantId is required in params"
            });
        }
        if(modules.length === 0 || !Array.isArray(modules)){
            return res.status(400).json({
                status: false,
                message: "modules (non-empty array) is required in body"
            });
        }

        const result = await SubscriptionService.updateTenantSubscriptionModules({tenantId, modules});

        if(!result){
            return res.status(404).json({
                status: false,
                message: "Failed to update tenant subscription modules. Please check if tenant and modules exist.",
            });
        }

        return res.status(200).json({
            status: true,
            message: "Tenant subscription modules updated successfully",
            data: result
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to update tenant subscription modules",
            error: (error as Error).message
        });
    }
}


/**
 * @swagger
 * /platform/subscription/active-subscription/{tenantId}:
 *   get:
 *     tags:
 *       - Subscription
 *     summary: Get active subscription details of a tenant
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *         description: Tenant ID
 *     responses:
 *       200:
 *         description: Tenant subscription details fetched successfully
 *       400:
 *         description: tenantId is required
 *       404:
 *         description: Tenant not found
 *       500:
 *         description: Failed to fetch tenant subscription details
 */
export const getTenantSubscriptionDetails = async (req: Request, res: Response) => {
    try {
        const { tenantId } = req.params as { tenantId: string };

        if(!tenantId){
            return res.status(400).json({
                status: false,
                message: "tenantId is required"
            });
        }

        const result = await SubscriptionService.getTenantActiveSubscriptions(tenantId);
        if(!result){
            return res.status(404).json({
                status: false,
                message: "Tenant not found",
            });
        }
        return res.status(200).json({
            status: true,
            message: "Tenant subscription details fetched successfully",
            data: result
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to fetch tenant subscription details",
            error: (error as Error).message
        });
    }
}

/**
 * @swagger
 * /platform/subscription/subscribed-tenants:
 *   get:
 *     tags:
 *       - Subscription
 *     summary: Get all subscribed tenants
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [ACTIVE, EXPIRED, CANCELLED]
 *         description: Optional subscription status filter
 *     responses:
 *       200:
 *         description: Subscribed tenants fetched successfully
 *       500:
 *         description: Failed to fetch subscribed tenants
 */
export const getSubscribedTenants = async (req: Request, res: Response) => {
  try {
    const { status } = req.query;

    const result = await SubscriptionService.getSubscribedTenants({
      status: status as any
    });

    return res.status(200).json({
      status: true,
      message: "Subscribed tenants fetched successfully",
      data: result
    });
  } catch (error: any) {
    return res.status(500).json({
      status: false,
      message: error.message || "Failed to fetch subscribed tenants"
    });
  }
};

/**
 * @swagger
 * /platform/subscription/tenant/cancel-subscription/{tenantId}/{subscriptionId}:
 *   patch:
 *     tags:
 *       - Subscription
 *     summary: Cancel tenant subscription
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *         description: Tenant ID
 *       - in: path
 *         name: subscriptionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscription ID
 *     responses:
 *       200:
 *         description: Subscription cancelled successfully
 *       400:
 *         description: tenantId and subscriptionId are required
 *       404:
 *         description: Subscription not found
 *       500:
 *         description: Failed to cancel tenant subscription
 */
export const cancelTenantSubscription = async (req: Request, res: Response) => {
    try {
        const { tenantId, subscriptionId } = req.params as { tenantId: string; subscriptionId: string };

        if(!tenantId || !subscriptionId){
            return res.status(400).json({
                status: false,
                message: "tenantId and subscriptionId are required in params"
            });
        }

        const result = await SubscriptionService.cancelSubscription({
            tenantId,
            subscriptionId
        });

        if(!result){
            return res.status(404).json({
                status: false,
                message: "Failed to cancel subscription. Please check if tenant and subscription exist.",
            });
        }

        return res.status(200).json({
            status: true,
            message: "Subscription cancelled successfully",
            data: result
        });
        
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to cancel tenant subscription",
            error: (error as Error).message
        });
    }
}