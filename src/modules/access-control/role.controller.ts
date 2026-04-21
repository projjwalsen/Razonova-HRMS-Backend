import { Request, Response } from "express";
import { prisma } from "../../config/db/prisma";
import { RolePolicy } from "../../core/policies/role.policy";

/*---------- Tenant Level Role Management 🔐----------------------- */
/* -------- Access Control  ------------------ */

/**
 * @swagger
 * /org/role/create:
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
        const normalizedRoleName = String(name).toUpperCase();

        if(!tenantId){
            return res.status(400).json({
                success: false,
                message: "Tenant ID is required"
            })
        }

        /* Policy check */
        const policyDecision = await RolePolicy.canCreateRole({
            actor,
            tenantId,
            name: normalizedRoleName
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
                name: normalizedRoleName,
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
 * /org/role/list-all:
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
        const isSystemUser = user.tenantId === null && user.roleType === "SYSTEM";

        const isOrgUser = user.tenantId !== null && user.roleType === "TENANT";

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
            const isSystemPermission = permissions.some((p: any) => p.scope === "SYSTEM");
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

            const isTenantPermission = permissions.some((p: any) => p.scope === "TENANT");
            if(isTenantPermission){
                return res.status(403).json({
                    success: false,
                    message: "System role cannot have tenant permissions"
                });
            }
        }

        const created = await prisma.rolePermission.createMany({
            data: permissionIds.map((permissionId: string) => ({
                roleId,
                permissionId
            })),
            skipDuplicates: true
        })

        return res.status(200).json({
            success: true,
            message: "Permissions assigned to role successfully",
            data: {
                created,
                createdCount: created.count
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
            return res.status(409).json({
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
        const result = await prisma.$transaction(async (tx) => {
            const createdRoles: any[] = [];

            // For any TENANT role other than EMPLOYEE, ensure EMPLOYEE base role exists
            if (
                role.type === "TENANT" &&
                role.name !== "EMPLOYEE"
            ) {
                if (!targetUser.tenantId) {
                    throw new Error("Target user is missing tenant context");
                }

                const employeeRole = await tx.role.findFirst({
                    where: {
                        tenantId: targetUser.tenantId,
                        type: "TENANT",
                        name: "EMPLOYEE"
                    },
                    select: { id: true, name: true }
                });

                if (!employeeRole) {
                    throw new Error("EMPLOYEE base role not found for this tenant");
                }

                const existingEmployeeAssignment = await tx.userRole.findUnique({
                    where: {
                        userId_roleId: {
                            userId,
                            roleId: employeeRole.id
                        }
                    }
                });

                if (!existingEmployeeAssignment) {
                    const employeeUserRole = await tx.userRole.create({
                        data: {
                            userId,
                            roleId: employeeRole.id
                        }
                    });

                    createdRoles.push(employeeUserRole);
                }
            }

            const assignedRole = await tx.userRole.create({
                data: {
                    userId,
                    roleId: role.id
                }
            });

            createdRoles.push(assignedRole);

            return createdRoles;
        });
        return res.status(200).json({
            success: true,
            message: "Role assigned to user successfully",
            data: result
        })
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: error.message || "Internal server error while assigning role to user"
        })
    }
}

export const getAssignedRoleUsers = async(req: Request, res: Response) => {
    try {
        const actor = (req as any).user;
        const roles = await prisma.role.findMany({
            where: {
                tenantId: actor.tenantId,
            },
            select: {
                id: true,
                name: true,
                type: true,
                userRoles: {
                    select: {
                        user: true
                    }
                }
            }
        });

        const data = roles.map((role) => ({
            roleId: role.id,
            roleName: role.name,
            roleType: role.type,
            totalAssigned: role.userRoles.length,
            assignedUsers: role.userRoles.map(ur => ({
                userId: ur.user.id,
                userName: ur.user.name,
                email: ur.user.email
            }))
        }))

        return res.status(200).json({
            success: true,
            message: "Assigned role users retrieved successfully",
            data
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Internal server error while retrieving assigned role users",
            error: error.message
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
        /* -- block accidental self unassignment of COMPANY_ADMIN role -- */
        if(actor.id === userId &&
            role.type === "TENANT" &&
            role.name === "COMPANY_ADMIN"
        ){
            return res.status(400).json({
                success: false,
                message: "You cannot unassign yourself from COMPANY_ADMIN role"
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
        // Prevent removing base EMPLOYEE role from tenant users
        if (
            role.type === "TENANT" &&
            role.name === "EMPLOYEE"
        ) {
            const userTenantRoles = await prisma.userRole.findMany({
                where: {
                    userId,
                    role: {
                        type: "TENANT"
                    }
                },
                include: {
                    role: {
                        select: {
                            id: true,
                            name: true,
                            type: true
                        }
                    }
                }
            });

            const remainingTenantRoles = userTenantRoles.filter(
                (ur) => ur.roleId !== roleId
            );

            // If any tenant role remains, EMPLOYEE must stay
            if (remainingTenantRoles.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "EMPLOYEE base role cannot be removed while other tenant roles are still assigned"
                });
            }

            // Also block removing the only tenant role
            return res.status(400).json({
                success: false,
                message: "EMPLOYEE base role cannot be removed from a tenant user"
            });
        }

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
export const transferRoleToOtherUser = async(req: Request, res: Response) => {
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
        if (role.type === "TENANT" && role.name === "EMPLOYEE") {
            return res.status(400).json({
                success: false,
                message: "EMPLOYEE base role cannot be transferred"
            });
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



/* --- Get User Access --- */
/**
 * @swagger
 * /auth/my-access:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user access
 *     description: Returns user info, roles, and permissions for frontend access control.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Access fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         email:
 *                           type: string
 *                         tenantId:
 *                           type: string
 *                           nullable: true
 *                         roleType:
 *                           type: string
 *                           example: TENANT
 *                     roles:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["EMPLOYEE", "COMPANY_ADMIN"]
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["PAYROLL:READ", "LEAVE:APPLY"]
 *                     groupedPermissions:
 *                       type: object
 *                       additionalProperties:
 *                         type: array
 *                         items:
 *                           type: string
 *                       example:
 *                         PAYROLL: ["READ", "READ_SELF"]
 *                         LEAVE: ["APPLY"]
 *       401:
 *         description: Unauthorized
 */
export const getMyAccess = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;

        if (!user?.id) {
            return res.status(401).json({
                status: false,
                message: "Unauthorized"
            });
        }

        // Fetch roles + permissions
        const userRoles = await prisma.userRole.findMany({
            where: { userId: user.id },
            include: {
                role: {
                    include: {
                        rolePermissions: {
                            include: {
                                permission: true
                            }
                        }
                    }
                }
            }
        });

        // Extract role names
        const roles = userRoles.map((ur: any) => ur.role.name);

        // Extract permission keys
        const permissionKeys = userRoles.flatMap((ur: any) =>
            ur.role.rolePermissions.map((rp: any) =>
                `${rp.permission.module}:${rp.permission.action}`
            )
        );

        const uniquePermissions = [...new Set(permissionKeys)];

        // Optional: Group permissions by module (🔥 for frontend UI)
        const groupedPermissions = uniquePermissions.reduce((acc: any, key: string) => {
            const [module, action] = key.split(":");

            if (!acc[module]) acc[module] = [];
            acc[module].push(action);

            return acc;
        }, {});

        return res.status(200).json({
            status: true,
            message: "User access fetched successfully",
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    tenantId: user.tenantId,
                    roleType: user.roleType
                },
                roles,
                permissions: uniquePermissions,
                groupedPermissions
            }
        });

    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to fetch user access",
            error: error.message
        });
    }
};