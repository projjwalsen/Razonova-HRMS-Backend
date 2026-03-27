import { prisma } from "../../config/db/prisma";
import { BasePolicy } from "./base.policy";
import { PolicyDecision } from "./types.policy";

export class ReportingPolicy extends BasePolicy {
    static async canAssignManager(actor: any, userId: string, managerId: string | null): Promise<PolicyDecision> {
        const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, tenantId: true, isActive: true } });
        if(!targetUser){
            return this.deny(
                "USER_NOT_FOUND",
                "Target user not found"
            )
        };
        if (!actor.isSystem && actor.tenantId !== targetUser.tenantId) {
            return this.deny("CROSS_TENANT_ACTION", "You cannot manage users outside your tenant");
        }
        /* For top level users
        e.g. COMPANY_ADMIN, CEO, top-level HR can exists without any reporting Manager
        */
        if(managerId === null){
            return this.allow();
        }

        const manager = await prisma.user.findUnique({ 
            where: { id: (managerId as string) }, 
            select: { id: true, tenantId: true, isActive: true } 
        });
        if(!manager){
            return this.deny(
                "MANAGER_NOT_FOUND",
                "Manager user not found"
            )
        }

        if (targetUser.tenantId !== manager.tenantId) {
            return this.deny("TENANT_MISMATCH", "User and manager must belong to same tenant");
        }

        if (userId === managerId) {
            return this.deny("SELF_MANAGER", "User cannot be their own manager");
        }

        if (!manager.isActive) {
            return this.deny("INACTIVE_MANAGER", "Assigned manager must be active");
        }

        const createsCycle = await this.willCreateCycle(userId, managerId);
        if (createsCycle) {
            return this.deny("CYCLE_DETECTED", "Circular reporting hierarchy is not allowed");
        }

    return this.allow();
    }

    /* Algorithm: Detects if assigning a manager would create a cycle in the reporting hierarchy */
    static async willCreateCycle(userId: string, managerId: string): Promise<boolean> {
        let currentManagerId: string | null = managerId;
        const visited = new Set<string>(); // stores unique managerIds in the chain to detect cycles
        while (currentManagerId) {
            if (currentManagerId === userId) return true; // Cycle detected
            if(visited.has(currentManagerId)) return true; // Just in case, to prevent infinite loop

            visited.add(currentManagerId);
            
            const manager: any = await prisma.user.findUnique({ 
                where: { id: currentManagerId },
                select: { managerId: true } 
            });
            currentManagerId = manager?.managerId ?? null;
        }
        return false; // No cycle detected
    }
    /* Policy: Check if a user can read the reporting hierarchy */
    static async canReadHierarchy(actor: any, userId: string) {
        const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, tenantId: true }
        });

        if (!targetUser) {
            return this.deny(
                "USER_NOT_FOUND",
                "Target user not found"
            )
        }

        if (!actor.isSystem && actor.tenantId !== targetUser.tenantId) {
            return this.deny(
                "CROSS_TENANT_ACCESS",
                "You cannot access reporting hierarchy outside your tenant"
            );
        }

        return this.allow();
    }
}