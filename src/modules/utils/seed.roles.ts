export async function seedTenantRoles(tx: any, tenantId: string) {
    try {
        const roles = [
            "EMPLOYEE",
            "MANAGER",
            "COMPANY_ADMIN"
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

  const rowsToInsert: Array<{ roleId: string; permissionId: string }> = [];

  for (const role of roles) {
    let allowed: string[] = [];

    if (role.name === "COMPANY_ADMIN") {
      allowed = permissions.map((p: any) => `${p.module}:${p.action}`);
    } else if (role.name === "MANAGER") {
      allowed = permissions
        .filter((p: any) =>
          ["ATTENDANCE", "PAYROLL", "LEAVE", "EMPLOYEE"].includes(String(p.module)) &&
          ["READ", "MANAGE"].includes(String(p.action))
        )
        .map((p: any) => `${p.module}:${p.action}`);
    } else if (role.name === "EMPLOYEE") {
      allowed = [
        "EMPLOYEE:READ",
        "HOLIDAY_CALENDAR:READ",
        "LEAVE:READ",
        "LEAVE:READ_SELF",
        "LEAVE:APPLY",
        "ATTENDANCE:READ",
        "ATTENDANCE:CHECK_IN",
        "ATTENDANCE:CHECK_OUT",
        "PAYROLL:READ_SELF",
        "PAYROLL:PAYSLIP_PREVIEW_SELF",
        "PAYROLL:PAYSLIP_DOWNLOAD_SELF",
        "RESIGNATION:SUBMIT",
        "RESIGNATION:VIEW"
      ];
    } else {
      continue;
    }

    for (const perm of permissions) {
      const key = `${perm.module}:${perm.action}`;
      if (!allowed.includes(key)) continue;

      rowsToInsert.push({
        roleId: role.id,
        permissionId: perm.id
      });
    }
  }

  if (rowsToInsert.length > 0) {
    await tx.rolePermission.createMany({
      data: rowsToInsert,
      skipDuplicates: true
    });
  }

  return true;
}
