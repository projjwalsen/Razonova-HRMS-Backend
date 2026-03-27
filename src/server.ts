import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express'
import { prisma } from './config/db/prisma';
import routes from './routes/index'
import { swaggerSpec } from './config/swagger/swagger';
import bcrypt from "bcrypt";
import { RoleType } from '@prisma/client';

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api', routes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/swagger.json", (req, res) => res.json(swaggerSpec));

// Health check route
app.get('/health', (req, res) => {
	console.log('Health check endpoint hit');
	res.json({ status: 'ok' });
});


// Seed normal Super Admin user and SYSTEM role (POST /seed-super-admin)
// async function main() {
//   // 1. Add new permissions (skipDuplicates: true ensures no duplicates)
//   const newPermissions = [
//     { name: "Read User", scope: RoleType.TENANT, module: "REPORTING", action: "READ" },
//     { name: "Update Reporting Manager", scope: RoleType.TENANT, module: "REPORTING", action: "MANAGER_UPDATE" },
//   ];

//   await prisma.permission.createMany({
//     data: newPermissions,
//     skipDuplicates: true,
//   });

//   // 2. Fetch all tenants and the new permissions
//   const tenants = await prisma.tenant.findMany({ select: { id: true } });
//   const permissions = await prisma.permission.findMany({
//     where: {
//       module: "REPORTING",
//       action: { in: ["READ", "MANAGER_UPDATE"] },
//       scope: RoleType.TENANT,
//     }
//   });

//   // 3. For each tenant, assign new permissions to COMPANY_ADMIN
//   for (const tenant of tenants) {
//     const companyAdminRole = await prisma.role.findFirst({
//       where: {
//         name: "COMPANY_ADMIN",
//         type: RoleType.TENANT,
//         tenantId: tenant.id,
//       }
//     });
//     if (!companyAdminRole) continue;

//     const rolePermissionData = permissions.map((p) => ({
//       roleId: companyAdminRole.id,
//       permissionId: p.id,
//     }));

//     await prisma.rolePermission.createMany({
//       data: rolePermissionData,
//       skipDuplicates: true,
//     });
//   }

//   console.log("Seeded user permissions and mapped to COMPANY_ADMIN for all tenants.");
// }

// Uncomment to run
// main()
//   .catch((e) => {
//     console.error("Seed failed:", e);
//     process.exit(1);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`✅ Server running on port ${PORT}`);
});