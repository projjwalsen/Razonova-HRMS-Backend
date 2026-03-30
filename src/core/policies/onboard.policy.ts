import { BasePolicy } from "./base.policy";
import { PolicyDecision } from "./types.policy";

type invitePayload = {
    email: string;
    departmentId?: string;
    managerId?: string;
    roleId?: string;
    employeeCode?: string;
}

export class OnboardPolicy extends BasePolicy {
    static async canInvite(actor: any, payload: invitePayload): Promise<PolicyDecision> {
        if(!actor?.tenantId){
            return this.deny(
                "TENANT_ID_MISSING",
                "Actor does not have tenantId"
            )
        }
        if(!payload?.email){
            return this.deny(
                "EMAIL_MISSING",
                "Email is required to send an invite"
            )
        }
        if(!payload?.departmentId){
            return this.deny(
                "DEPARTMENT_ID_MISSING",
                "Department ID is required to send an invite"
            )
        }
        if(!payload?.managerId){
            return this.deny(
                "MANAGER_ID_MISSING",
                "Manager ID is required to send an invite"
            )
        }
        if(!payload?.roleId){
            return this.deny(
                "ROLE_ID_MISSING",
                "Role ID is required to send an invite"
            )
        }
        if(!payload?.employeeCode){
            return this.deny(
                "EMPLOYEE_CODE_MISSING",
                "Employee code is required to send an invite"
            )
        }
        return this.allow();
    }
}