import { prisma } from "../../config/db/prisma";
import { BasePolicy } from "./base.policy";
import { PolicyDecision } from "./types.policy";

export class DepartmentPolicy extends BasePolicy {
  static async canUpdateDepartment(
    actor: any,
    departmentId: string,
    payload: { name?: string; managerId?: string | null }
  ): Promise<PolicyDecision> {
    const department = await prisma.department.findFirst({
      where: {
        id: departmentId,
        tenantId: actor.tenantId
      },
      select: {
        id: true,
        tenantId: true,
        name: true,
        managerId: true
      }
    });

    if (!department) {
      return this.deny("DEPARTMENT_NOT_FOUND", "Department not found");
    }

    if (payload.name !== undefined) {
      const trimmedName = payload.name.trim();

      if (!trimmedName) {
        return this.deny("INVALID_NAME", "Department name cannot be empty");
      }

      const duplicateDepartment = await prisma.department.findFirst({
        where: {
          tenantId: actor.tenantId,
          name: trimmedName,
          NOT: {
            id: departmentId
          }
        },
        select: { id: true }
      });

      if (duplicateDepartment) {
        return this.deny(
          "DUPLICATE_DEPARTMENT",
          "Department with this name already exists"
        );
      }
    }

    if (payload.managerId !== undefined) {
      if (payload.managerId === null) {
        return this.allow();
      }

      const leadUser = await prisma.user.findFirst({
        where: {
          id: payload.managerId,
          tenantId: actor.tenantId,
          isActive: true
        },
        select: {
          id: true,
          departmentId: true
        }
      });

      if (!leadUser) {
        return this.deny(
          "INVALID_DEPARTMENT_LEAD",
          "Department lead user not found or inactive"
        );
      }

      // Optional strict rule:
      // department lead should belong to same department
      if (leadUser.departmentId && leadUser.departmentId !== departmentId) {
        return this.deny(
          "LEAD_DEPARTMENT_MISMATCH",
          "Selected department lead does not belong to this department"
        );
      }
    }

    return this.allow();
  }
}