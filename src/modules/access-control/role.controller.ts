import { Request, Response } from "express";
import { prisma } from "../../config/db/prisma";
import { RolePolicy } from "../../core/policies/role.policy";

/*---------- Tenant Level Role Management 🔐----------------------- */
/* -------- Access Control  ------------------ */

/**
 * @swagger
 * /org/roles:
 *   post:
 *     tags:
 *       - Roles (Organization)
 *     summary: Create a new role in the organization
 *     description: Organization admin creates a new role for their tenant.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Role name (e.g., MANAGER, EMPLOYEE)
 *     responses:
 *       201:
 *         description: Role created successfully
 *       400:
 *         description: Tenant ID is required or invalid input
 *       500:
 *         description: Failed to create role
 */
export const createRole = async(req: Request, res: Response) => {
    try {
        const actor = (req as any).user;
        const tenantId = (req as any).user.tenantId;
        const { name } = req.body;

        if(!tenantId){
            return res.status(400).json({
                success: false,
                message: "Tenant ID is required"
            })
        }
        /* Policy check */
        const policyDecision = await RolePolicy.canCreateRole({
            actor,
            tenantId
        });
        if (!policyDecision.allowed) {
            return res.status(403).json({
                success: false,
                code: policyDecision.code,
                message: policyDecision.message || "Unauthorized to create role"
            });
        }
        /* Create role logic here */
        const role = await prisma.role.create({
            data: {
                name: name.toUpperCase(),
                type: "TENANT",
                tenantId
            }
        });
        /* Ensure MANAGER and EMPLOYEE roles are created --seeding */
        const defaultRoles = ["MANAGER", "EMPLOYEE"];
        const existingDefaultRoles = await prisma.role.findMany({
            where: {
                tenantId,
                name: { in: defaultRoles }
            }
        });
        const existingNames = existingDefaultRoles.map(r => r.name);
        const defRolesToCreate = defaultRoles.filter(name => !existingNames.includes(name));

        if(defRolesToCreate.length > 0){
            await prisma.role.createMany({
                data: defRolesToCreate.map(name => ({
                    name: name.toUpperCase(),
                    type: "TENANT",
                    tenantId
                }))
            });
        }

        return res.status(201).json({
            success: true,
            message: "Role created successfully",
            data: role
        })
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to create role"
        })
    }
};

/**
 * @swagger
 * /org/roles:
 *   get:
 *     tags:
 *       - Roles (Organization)
 *     summary: Get all roles in the organization
 *     description: Fetch all roles for the current tenant, including their permissions.
 *     responses:
 *       200:
 *         description: Roles fetched successfully
 *       400:
 *         description: Tenant ID is required
 *       404:
 *         description: No roles found for this tenant
 *       500:
 *         description: Failed to fetch roles
 */
export const getRoles = async(req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user.tenantId;

        if(!tenantId){
            return res.status(400).json({
                success: false,
                message: "Tenant ID is required"
            })
        }
        /* Fetch roles logic here */
        const roles = await prisma.role.findMany({
            where: { tenantId },
            include: {
                rolePermissions: {
                    include: {
                        permission: true
                    }
                }
            }
        });
        if(!roles.length){
            return res.status(404).json({
                success: false,
                message: "No roles found for this tenant"
            })
        }
        return res.status(200).json({
            success: true,
            message: "Roles fetched successfully",
            data: roles
        })
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: error.message || "Failed to fetch roles"
        })
    }
};

/**
 * @swagger
 * /org/roles/assign-permissions:
 *   post:
 *     tags:
 *       - Roles (Organization)
 *     summary: Assign permissions to a role
 *     description: Assign or update permissions for a specific role in the organization.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roleId
 *               - permissionIds
 *             properties:
 *               roleId:
 *                 type: string
 *                 description: Role ID
 *               permissionIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of permission IDs to assign
 *     responses:
 *       200:
 *         description: Permissions assigned to role successfully
 *       400:
 *         description: roleId & permissionIds must be a non-empty array
 *       403:
 *         description: Unauthorized to assign permissions to this role
 *       404:
 *         description: Role or permissions not found
 *       500:
 *         description: Failed to assign permissions to role
 */
export const assignPermissionsToRole = async(req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { roleId, permissionIds } = req.body;

        if(!roleId || !Array.isArray(permissionIds) || permissionIds.length === 0){
            return res.status(400).json({
                success: false,
                message: "roleId & permissionIds must be a non-empty array"
            })
        }
        /* Assign permissions to role 
           1. Validate role existence
           2. Diffing based permission update/remove/add
        */
        //1. validating role existence
        const role = await prisma.role.findUnique({
            where: { id: roleId }
        });
        if(!role){
            return res.status(404).json({
                success: false,
                message: "Role not found"
            });
        }
        // * . Detect Actor type (Platform Admin or Tenant Admin) and validate role belongs to their scope
        const isSystemUser = user.tenantId === null &&
        (Array.isArray(user.roles) && user.roles.some((r: any) => r.type === "SYSTEM"));

        const isOrgUser = user.tenantId !== null &&
        (Array.isArray(user.roles) && user.roles.some((r: any) => r.type === "TENANT"));

        if(!isSystemUser && !isOrgUser){
            return res.status(403).json({
                success: false,
                message: "Unauthorized to assign permissions to this role"
            });
        }

        /* Tenant user --> manage Tenant role */
        if(isOrgUser){
            if(role.type !== "TENANT" || role.tenantId !== user.tenantId){
                return res.status(403).json({
                    success: false,
                    message: "You can only manage role in Own Organization"
                });
            }
        }

        const permissions = await prisma.permission.findMany({
            where: { id: { in: permissionIds } }
        });

        if(permissions.length !== permissionIds.length){
            return res.status(404).json({
                success: false,
                message: "One or more permissions not found"
            });
        }
        /* Validate permission types based on role type */
        if(role.type === "TENANT"){
            const isSystemPermission = permissions.some((p: any) => p.type === "SYSTEM");
            if(isSystemPermission){
                return res.status(403).json({
                    success: false,
                    message: "Tenant role cannot have system permissions"
                });
            }
        }
        /* Validate system role permissions */
        if(role.type === "SYSTEM"){
            if(!isSystemUser){
                return res.status(403).json({
                    success: false,
                    message: "Only platform admin can manage system role permissions"
                });
            }

            const isTenantPermission = permissions.some((p: any) => p.type === "TENANT");
            if(isTenantPermission){
                return res.status(403).json({
                    success: false,
                    message: "System role cannot have tenant permissions"
                });
            }
        }

        const existing = await prisma.rolePermission.findMany({
            where: { roleId },
            select: { permissionId: true }
        });
        const existingPermissionIds = existing.map(ep => ep.permissionId);
        // finding ... difference between existing and new permissions
        const toAdd = permissionIds.filter((id: string) => !existingPermissionIds.includes(id));
        const toRemove = existingPermissionIds.filter(id => !permissionIds.includes(id));

        // ------------- $Transaction -------------------- //
        const [deleted, created] = await prisma.$transaction([
            // to remove -- old mapping
            prisma.rolePermission.deleteMany({
                where: {
                    roleId,
                    permissionId: { in: toRemove }
                }
            }),
            // to add -- new mapping
            prisma.rolePermission.createMany({
                data: toAdd.map((permissionId: string) => ({
                    roleId,
                    permissionId
                }))
            })
        ]);

        return res.status(200).json({
            success: true,
            message: "Permissions assigned to role successfully",
            data: {
                added: created,
                removed: deleted
            }
        })

    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to assign permissions to role"
        })
    }
}

/**
 * @swagger
 * /org/roles/assign-user:
 *   post:
 *     tags:
 *       - Roles (Organization)
 *     summary: Assign a role to a user
 *     description: Assign a role to a user in the organization.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - roleId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ID
 *               roleId:
 *                 type: string
 *                 description: Role ID
 *     responses:
 *       200:
 *         description: Role assigned to user successfully
 *       400:
 *         description: userId and roleId are required or failed to assign
 *       500:
 *         description: Internal server error while assigning role to user
 */
export const assignRoleToUser = async(req: Request, res: Response) => {
    try {
        const actor = (req as any).user;
        const { userId, roleId } = req.body;
        if(!userId || !roleId){
            return res.status(400).json({
                success: false,
                message: "userId and roleId are required"
            })
        }
        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true , tenantId: true}
        });
        const role = await prisma.role.findUnique({
            where: { id: roleId },
            select: { id: true, name: true, type: true, tenantId: true }
        });
        const existingAssignment = await prisma.userRole.findUnique({
            where: {
                userId_roleId: {
                    userId,
                    roleId
                }
            }
        });
        if(!targetUser || !role){
            return res.status(404).json({
                success: false,
                message: "Target user or role not found"
            })
        }
        if(existingAssignment){
            return res.status(404).json({
                success: false,
                message: "Role is already assigned to this user"
            })
        }
        /* -- Call Policy Engine to get Decision -- */
        const policyDecision = await RolePolicy.canAssignRole(actor, targetUser, role);
        if(!policyDecision.allowed){
            return res.status(403).json({
                success: false,
                code: policyDecision.code,
                message: policyDecision.message || "Unauthorized to assign this role to user"
            })
        }
        /* Assign role to user logic here */
        const userRole = await prisma.userRole.create({
            data: {
                userId,
                roleId
            }
        });
        if(!userRole){
            return res.status(400).json({
                success: false,
                message: "Failed to assign role to user"
            })
        }
        return res.status(200).json({
            success: true,
            message: "Role assigned to user successfully",
            data: userRole
        })
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: error.message || "Internal server error while assigning role to user"
        })
    }
}

/**
 * @swagger
 * /org/roles/unassign-user:
 *   post:
 *     tags:
 *       - Roles (Organization)
 *     summary: Unassign a role from a user
 *     description: Remove a role from a user in the organization.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - roleId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ID
 *               roleId:
 *                 type: string
 *                 description: Role ID
 *     responses:
 *       200:
 *         description: Role unassigned from user successfully
 *       400:
 *         description: userId and roleId are required or cannot unassign last COMPANY_ADMIN
 *       403:
 *         description: Unauthorized to perform this action
 *       404:
 *         description: Target user or role not found, or role is not assigned to this user
 *       500:
 *         description: Internal server error while unassigning role from user
 */
export const unassignRoleFromUser = async(req: Request, res: Response) => {
    try {
        const actor = (req as any).user;
        const { userId, roleId } = req.body;
        if(!userId || !roleId){
            return res.status(400).json({
                success: false,
                message: "userId and roleId are required"
            })
        }
        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true , tenantId: true}
        });

        const role = await prisma.role.findUnique({
            where: { id: roleId },
            select: { id: true, name: true, type: true, tenantId: true }
        });
        if(!targetUser || !role){
            return res.status(404).json({
                success: false,
                message: "Target user or role not found"
            })
        }
        const assignedRole = await prisma.userRole.findUnique({
            where: {
                userId_roleId: {
                    userId,
                    roleId
                }
            }
        });
        if(!assignedRole){
            return res.status(404).json({
                success: false,
                message: "Role is not assigned to this user"
            })
        }
        /* -- Call policy engine -- */
        const policyDecision = await RolePolicy.canUnassignRole(actor, targetUser, role);
        if(!policyDecision.allowed){
            return res.status(403).json({
                success: false,
                code: policyDecision.code,
                message: policyDecision.message || "Unauthorized to unassign this role from user"
            })
        }
        // Unassign role
        await prisma.userRole.delete({
            where: {
                userId_roleId: {
                    userId,
                    roleId
                }
            }
        });

        return res.status(200).json({
            success: true,
            message: "Role unassigned from user successfully"
        })

    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: error.message || "Internal server error while unassigning role from user"
        })
    }
}

/**
 * @swagger
 * /org/roles/transfer:
 *   post:
 *     tags:
 *       - Roles (Organization)
 *     summary: Transfer a role from one user to another
 *     description: Transfers a role assignment from one user to another within the same organization. Only allowed for authorized tenant actors.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fromUserId
 *               - toUserId
 *               - roleId
 *             properties:
 *               fromUserId:
 *                 type: string
 *                 description: User ID to transfer the role from
 *               toUserId:
 *                 type: string
 *                 description: User ID to transfer the role to
 *               roleId:
 *                 type: string
 *                 description: Role ID to transfer
 *     responses:
 *       200:
 *         description: Role transferred successfully
 *       400:
 *         description: fromUserId, toUserId and roleId are required or role is not assigned to fromUser
 *       403:
 *         description: Unauthorized to transfer this role
 *       404:
 *         description: Role not found
 *       500:
 *         description: Internal server error while transferring role to another user
 */
export const transferRole = async(req: Request, res: Response) => {
    try {
        const actor = (req as any).user;
        const { fromUserId, toUserId, roleId } = req.body;
        if(!fromUserId || !toUserId || !roleId){
            return res.status(400).json({
                success: false,
                message: "fromUserId, toUserId and roleId are required"
            })
        }
        const role = await prisma.role.findUnique({
            where: { id: roleId }
        });
        if(!role){
            return res.status(404).json({
                success: false,
                message: "Role not found"
            })
        }
        // Policy check for transfer role
        const policyDecision = await RolePolicy.canTransferRole(actor, fromUserId, toUserId, role);
        if(!policyDecision.allowed){
            return res.status(403).json({
                success: false,
                code: policyDecision.code,
                message: policyDecision.message || "Unauthorized to transfer this role"
            })
        }

        const existingAssignment = await prisma.userRole.findFirst({
            where: {
                userId: fromUserId,
                roleId
            }
        });
        if(!existingAssignment){
            return res.status(404).json({
                success: false,
                message: "Role is not assigned to the fromUser"
            })
        }
        /* Transfer role logic here -- transaction */
        const transferResult = await prisma.$transaction([
            // remove from old user
            prisma.userRole.delete({
                where: {
                    id: existingAssignment.id
                }
            }),
            // assign to new user
            prisma.userRole.create({
                data: {
                    userId: toUserId,
                    roleId
                }
            })
        ]);

        return res.status(200).json({
            success: true,
            message: "Role transferred successfully",
            data: transferResult
        })

    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: error.message || "Internal server error while transferring role to another user"
        })
    }
}