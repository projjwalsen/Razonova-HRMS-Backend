import { prisma } from "../../config/db/prisma";
import { BasePolicy } from "./base.policy";
import { PolicyDecision } from "./types.policy";

type TargetUser = {
    id: string;
    tenantId: string | null;
}

type TargetRole = {
    id: string;
    name: string;
    type: "SYSTEM" | "TENANT";
    tenantId: string | null;
}

export class RolePolicy extends BasePolicy{
    /* Policy for creating a role */
    static async canCreateRole({
        actor,
        tenantId,
        name
    }: {
        actor: any;
        tenantId: string;
        name: string;
    }): Promise<PolicyDecision>{
        if(!this.isTenantActor(actor)){
            return this.deny(
                "NOT_TENANT_ACTOR",
                "Only tenant actors can create roles"
            )
        }
        /* Cross Tenant cant create role */
        if(actor.tenantId !== tenantId){
            return this.deny(
                "CROSS_TENANT_ACTION",
                "Cannot create role for a different tenant"
            )
        }
        const normalizedRoleName = String(name).toUpperCase();
        const reservedRoleNames = ["EMPLOYEE"];
        if(reservedRoleNames.includes(normalizedRoleName)){
            return this.deny(
                "RESERVED_ROLE_NAME",
                "Cannot create role with a reserved name"
            )
        }

        return this.allow();
    }

    static async canAssignRole(
        actor: any, targetUser: TargetUser, targetRole: TargetRole
    ): Promise<PolicyDecision> {
        if(!this.isTenantActor(actor)){
            return this.deny(
                "NOT_TENANT_ACTOR",
                "Only tenant actors can assign roles"
            )
        }
        /* Cross Tenant cant assign role */
        if(!this.isSameTenant(actor.tenantId, targetUser.tenantId, targetRole.tenantId)){
            return this.deny(
                "CROSS_TENANT_ACTION",
                "Cannot assign role across different tenants"
            )
        }
        if(targetRole.type !== "TENANT"){
            return this.deny(
                "INVALID_ROLE_TYPE",
                "Can only assign tenant roles"
            )
        }
        if(targetRole.type === "TENANT" && targetRole.name === "EMPLOYEE"){
            return this.deny(
                "RESERVED_ROLE",
                "Cannot assign reserved EMPLOYEE role"
            )
        }
        if(targetRole.name === "COMPANY_ADMIN"){
            const actorCompanyAdmin = await prisma.userRole.findFirst({
                where: {
                    userId: actor.id,
                    role: {
                        tenantId: actor.tenantId,
                        name: "COMPANY_ADMIN",
                        type: "TENANT"
                    }
                }
            });
            if(!actorCompanyAdmin){
                return this.deny(
                    "COMPANY_ADMIN_REQUIRED",
                    "Only COMPANY_ADMIN can assign COMPANY_ADMIN role"
                )
            }
        }
        return this.allow();
    }

    static async canUnassignRole(
        actor: any, targetUser: TargetUser, targetRole: TargetRole
    ): Promise<PolicyDecision> {
        if(!this.isTenantActor(actor)){
            return this.deny(
                "NOT_TENANT_ACTOR",
                "Only tenant actors can unassign roles"
            )
        }
        /* Cross Tenant cant unassign role */
        if(!this.isSameTenant(actor.tenantId, targetUser.tenantId, targetRole.tenantId)){
            return this.deny(
                "CROSS_TENANT_ACTION",
                "Cannot unassign role across different tenants"
            )
        }
        if(targetRole.type !== "TENANT"){
            return this.deny(
                "INVALID_ROLE_TYPE",
                "Can only unassign tenant roles"
            )
        }
        if(targetRole.name === "COMPANY_ADMIN"){
            const actorCompanyAdmin = await prisma.userRole.findFirst({
                where: {
                    userId: actor.id,
                    role: {
                        tenantId: actor.tenantId,
                        name: "COMPANY_ADMIN",
                        type: "TENANT"
                    }
                }
            });
            if(!actorCompanyAdmin){
                return this.deny(
                    "COMPANY_ADMIN_REQUIRED",
                    "Only COMPANY_ADMIN can unassign COMPANY_ADMIN role"
                )
            }
            const adminCount = await prisma.userRole.count({
                where: {
                    role: {
                        tenantId: actor.tenantId,
                        name: "COMPANY_ADMIN",
                        type: "TENANT"
                    }
                }
            });
            if(adminCount <= 1){
                return this.deny(
                    "LAST_COMPANY_ADMIN",
                    "Cannot unassign the last COMPANY_ADMIN role"
                )
            }
        }
        return this.allow();
    }

    static async canTransferRole(
        actor: any, fromUser: TargetUser, toUser: TargetUser, targetRole: TargetRole
    ): Promise<PolicyDecision> {
        if(!this.isTenantActor(actor)){
            return this.deny(
                "NOT_TENANT_ACTOR",
                "Only tenant actors can transfer roles"
            )
        }
        if(!this.isSameTenant(
            actor.tenantId,
            fromUser.tenantId,
            toUser.tenantId,
            targetRole.tenantId
        )){
            return this.deny(
                "CROSS_TENANT_ACTION",
                 "Cannot transfer role across different tenants"
            )
        }
        if(targetRole.type !== "TENANT"){
            return this.deny(
                "INVALID_ROLE_TYPE",
                "Can only transfer tenant roles"
            )
        }
        if (targetRole.name === "EMPLOYEE") {
            return this.deny(
                "BASE_ROLE_TRANSFER_FORBIDDEN",
                "EMPLOYEE base role cannot be transferred"
            );
        }

        if (targetRole.name === "COMPANY_ADMIN" && actor.id === fromUser.id) {
            return this.deny(
                "SELF_TRANSFER_FORBIDDEN",
                "You cannot transfer COMPANY_ADMIN role away from yourself"
            );
        }
        if(targetRole.name === "COMPANY_ADMIN"){
            const actorCompanyAdmin = await prisma.userRole.findFirst({
                where: {
                    userId: actor.id,
                    role: {
                        tenantId: actor.tenantId,
                        name: "COMPANY_ADMIN",
                        type: "TENANT"
                    }
                }
            });
            if(!actorCompanyAdmin){
                return this.deny(
                    "COMPANY_ADMIN_REQUIRED",
                    "Only COMPANY_ADMIN can transfer COMPANY_ADMIN role"
                )
            }
        }
        return this.allow();
    }
}
