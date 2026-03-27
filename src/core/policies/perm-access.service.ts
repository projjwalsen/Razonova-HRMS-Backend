/* -- Permission Access Policy -- */
/* Reads DB permission data  */

import { prisma } from "../../config/db/prisma";
import { BasePolicy } from "./base.policy";

/* ----- class PermissionAccessPolicy:  checks for user permissions --------*/
export class PermissionAccessPolicy extends BasePolicy {
    /* Policy for checking if actor can access a permission */
    static async getUserPermissionKeys(userId: string): Promise<string[]> {
        /* 1. Fetch user roles */
        const userRoles = await prisma.userRole.findMany({
            where: { userId },
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
        /* 2. Extract permission keys */
        const permissionKeys = userRoles.flatMap((ur: any) => 
            ur.role.rolePermissions.map((rolePerm: any) => {
                if(rolePerm.permission.key) return rolePerm.permission.key;
                return `${rolePerm.permission.module}:${rolePerm.permission.action}`;
            })
        );

        return [...new Set(permissionKeys)]; // Return unique keys
    };

    /* Check if a user has a specific permission */
    static async hasPermission(userId: string, permissionKey: string): Promise<boolean> {
        /** - check if user has a specific permission */
        const userPermissions = await this.getUserPermissionKeys(userId);
        /* return the result including the permission key */
        return userPermissions.includes(permissionKey);
    }
}