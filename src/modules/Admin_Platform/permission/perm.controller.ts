import { Request, Response } from "express";
import { prisma } from "../../../config/db/prisma";

/*---------- Platform Level Admin Access 🔐----------------------- */

/**
 * @swagger
 * /admin/permissions:
 *   post:
 *     tags:
 *       - Permissions (Platform)
 *     summary: Create a new permission (platform admin)
 *     description: Platform admin creates a new permission for a specific module and action.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - module
 *               - action
 *             properties:
 *               name:
 *                 type: string
 *                 description: Permission name (e.g., View Users)
 *               module:
 *                 type: string
 *                 description: Module name (e.g., USER, ATTENDANCE)
 *               action:
 *                 type: string
 *                 description: Action name (e.g., READ, WRITE)
 *     responses:
 *       201:
 *         description: Permission created successfully
 *       400:
 *         description: Name, module, and action are required
 *       500:
 *         description: Failed to create permission
 */
export const createPermission = async (req: Request, res: Response) => {
    try {
        const { name, module, action } = req.body;
        if (!name || !module || !action) {
            return res.status(400).json({
                status: false,
                message: "Name, module, and action are required"
            });
        }
        const permissions = await prisma.permission.create({
            data: {
                name,
                module: module.toUpperCase(),
                action: action.toUpperCase()
            }
        });
        return res.status(201).json({
            status: true,
            message: "Permission created successfully",
            data: permissions
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to create permission",
            error: (error as Error).message
        });
    }
}

/**
 * @swagger
 * /admin/permissions/list:
 *   get:
 *     tags:
 *       - Permissions (Platform)
 *     summary: Get all permissions (platform admin)
 *     description: Platform admin fetches all permissions, grouped by module.
 *     responses:
 *       200:
 *         description: Permissions fetched successfully
 *       500:
 *         description: Failed to fetch permissions
 */
export const getPermissions = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        let scopeFilter = {};

        if(user.roleType === "SYSTEM"){
            scopeFilter = { type: "SYSTEM" };
        }else if(user.roleType === "TENANT"){
            scopeFilter = { type: "TENANT" };
        }else{
            return res.status(403).json({
                status: false,
                message: "Invalid role type"
            });
        }
        const permissions = await prisma.permission.findMany({
            where: scopeFilter
        });
        /* Grouping permissions */
        const grouped = permissions.reduce((acc: any, permission: any) => {
            /* if not have the module create it  */
            if(!acc[permission.module]) acc[permission.module] = [];
            /* add the permission to the module */
            acc[permission.module].push(permission);
            return acc;
        }, {});

        return res.status(200).json({
            status: true,
            message: "Permissions fetched successfully",
            data: grouped
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to fetch permissions",
            error: (error as Error).message
        });
    }
}

/**
 * @swagger
 * /admin/permissions/{permId}:
 *   put:
 *     tags:
 *       - Permissions (Platform)
 *     summary: Update an existing permission (platform admin)
 *     description: Platform admin updates an existing permission for a specific module and action.
 *     parameters:
 *       - in: path
 *         name: permId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Permission name (e.g., View Users)
 *               module:
 *                 type: string
 *                 description: Module name (e.g., USER, ATTENDANCE)
 *               action:
 *                 type: string
 *                 description: Action name (e.g., READ, WRITE)
 *     responses:
 *       200:
 *         description: Permission updated successfully
 *       400:
 *         description: At least one of Name, module, or action is required
 *       500:
 *         description: Failed to update permission

 */
export const updatePermission = async (req: Request, res: Response) => {
    try {
        const { permId } = (req as any).params;
        const { name, module, action } = req.body;
        if (!name && !module && !action) {
            return res.status(400).json({
                status: false,
                message: "At least one of Name, module, or action is required"
            });
        }
        const updateData: any = {};
        if (name) updateData.name = name;
        if (module) updateData.module = module.toUpperCase();
        if (action) updateData.action = action.toUpperCase();

        const permissions = await prisma.permission.update({
            where: {
                id: permId
            },
            data: updateData
        });
        return res.status(200).json({
            status: true,
            message: "Permission updated successfully",
            data: permissions
        });

    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to update permission",
            error: (error as Error).message
        });
    }
}

/**
 * @swagger
 * /admin/permissions/{permId}:
 *   delete:
 *     tags:
 *       - Permissions (Platform)
 *     summary: Delete a permission (platform admin)
 *     description: Platform admin deletes a permission by ID.
 *     parameters:
 *       - in: path
 *         name: permId
 *         required: true
 *         schema:
 *           type: string
 *         description: Permission ID
 *     responses:
 *       200:
 *         description: Permission deleted successfully
 *       500:
 *         description: Failed to delete permission
 */
export const deletePermission = async (req: Request, res: Response) => {
    try {
        const { permId } = (req as any).params;
        await prisma.permission.delete({
            where: {
                id: permId
            }
        });
        return res.status(200).json({
            status: true,
            message: "Permission deleted successfully"
        });

    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to delete permission",
            error: (error as Error).message
        });
    }
}