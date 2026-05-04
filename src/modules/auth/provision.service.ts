import { prisma } from "../../config/db/prisma";
import { seedTenantRoles, syncDefaultRolePermissions } from "../utils/seed.roles";

export const provisionTenantAfterSignup = async (
  tenantId: string,
  userId: string,
  companyName: string
) => {
  await seedTenantRoles(prisma, tenantId);
  await syncDefaultRolePermissions(prisma, tenantId);

  await prisma.$transaction(async (tx) => {
    const roles = await tx.role.findMany({
      where: {
        tenantId,
        type: "TENANT",
        name: { in: ["COMPANY_ADMIN", "EMPLOYEE"] }
      },
      select: { id: true, name: true }
    });

    const adminRole = roles.find((r) => r.name === "COMPANY_ADMIN");
    const empRole = roles.find((r) => r.name === "EMPLOYEE");

    if (!adminRole || !empRole) {
      throw new Error("Required tenant roles not found");
    }

    const hrDepartment = await tx.department.upsert({
      where: {
        name_tenantId: {
          tenantId,
          name: "HR"
        }
      },
      update: {},
      create: {
        tenantId,
        name: "HR"
      }
    });

    const hrDesignation = await tx.designation.upsert({
      where: {
        name_tenantId: {
          tenantId,
          name: "HR Manager"
        }
      },
      update: {
        departmentId: hrDepartment.id
      },
      create: {
        tenantId,
        name: "HR Manager",
        departmentId: hrDepartment.id
      }
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        departmentId: hrDepartment.id,
        designationId: hrDesignation.id
      }
    });

    await tx.userRole.createMany({
      data: [
        { userId, roleId: adminRole.id },
        { userId, roleId: empRole.id }
      ],
      skipDuplicates: true
    });

    await tx.organization.upsert({
      where: {
        // add @@unique([tenantId]) to Organization if you want this
        tenantId
      } as any,
      update: {
        name: companyName
      },
      create: {
        tenantId,
        name: companyName
      }
    });
  });
};