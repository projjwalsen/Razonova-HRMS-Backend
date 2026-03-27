export type PolicyContext = {
    actor: any; // The user performing the action
    tenant?: any; // The tenant context, if applicable
    targetUser?: any; // The user being acted upon, if applicable
    targetRole?: any; // The role being acted upon, if applicable
    permissionIds?: string[]; // The permissions involved in the action, if applicable
    permissions: any[]; // The permissions of the actor
}

export type PolicyDecision = {
    allowed: boolean; // Whether the action is allowed or not
    code?: string; // Optional code for the decision, e.g., "ROLE_NOT_FOUND", "PERMISSION_DENIED"
    message?: string; // Optional message explaining the decision
}