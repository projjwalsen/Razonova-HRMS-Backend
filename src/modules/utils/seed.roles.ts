export async function seedTenantRoles(tx: any, tenantId: string) {
    try {
        const roles = [
            "EMPLOYEE",
            "MANAGER"
        ];
        
        for (const roleName of roles) {
            await tx.role.upsert({
                where: {
                    name_tenantId: {
                        name: roleName,
                        tenantId: tenantId
                    }
                },
                update: {},
                create: {
                    name: roleName,
                    tenantId: tenantId,
                    type: "TENANT"
                }
            })
        }
        return true;
    } catch (error: any) {
        throw new Error(`Failed to seed tenant roles: ${(error as Error).message}`);
    }
}

export async function syncDefaultRolePermissions(tx: any, tenantId: string) {
  const roles = await tx.role.findMany({
    where: { tenantId }
  });

  const permissions = await tx.permission.findMany({
    where: { scope: "TENANT" }
  });

  for (const role of roles) {
    let allowed: string[] = [];

    if (role.name === "COMPANY_ADMIN") {
      allowed = permissions.map((p: any) => `${p.module}.${p.action}`);
    }

    if (role.name === "MANAGER") {
      allowed = permissions
        .filter((p: any) =>
          ["EMPLOYEE", "EMPLOYEE_ONBOARDING"].includes(p.module) &&
          ["READ", "UPDATE"].includes(p.action)
        )
        .map((p: any) => `${p.module}.${p.action}`);
    }

    if (role.name === "EMPLOYEE") {
      allowed = [
        "EMPLOYEE.READ",
      ];
    }

    for (const perm of permissions) {
      const key = `${perm.module}.${perm.action}`;
      if (!allowed.includes(key)) continue;

      await tx.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: perm.id
          }
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: perm.id
        }
      });
    }
  }
}