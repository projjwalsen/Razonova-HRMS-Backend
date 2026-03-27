import { PolicyDecision } from "./types.policy";

/* Base policy class for handling policy decisions */
export class BasePolicy {
    /* ------  helpers ---------------- */
    protected static allow(): PolicyDecision{
        return { allowed: true };
    }
    protected static deny(code?: string, message?: string): PolicyDecision{
        return { allowed: false, code, message };
    }
    /* helper: Check if the actor is a platform actor */
    protected static isPlatformActor(actor: any): boolean {
        return (
            actor?.tenantId === null &&
            Array.isArray(actor?.role) &&
            actor.role.some(
                (r: any) => r.name === "SUPER_ADMIN" && r.type === "SYSTEM"
            )
        )
    }
    /* helper: Check if belongs to the same tenant/Organization */
    protected static isSameTenant(
        actorTenantId: string | null, 
        ...targetTenantIds: (string | null)[]
    ): boolean {
        return !!actorTenantId && targetTenantIds.every(tid => tid === actorTenantId);
    }
    /* helper: Check if the actor is a tenant actor */
    protected static isTenantActor(actor: any): boolean {
        return !!actor?.tenantId
    }
}