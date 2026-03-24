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
// app.get('/seed-super-admin', async (req, res) => {
// 	try {
// 		console.log("🚀 Starting platform seed...");

// 		// 🔥 STEP 0: MIGRATE OLD SYSTEM TENANT (if exists)
// 		const systemTenant = await prisma.tenant.findFirst({
// 			where: { isSystem: true },
// 		});

// 		if (systemTenant) {
// 			console.log("⚠️ Migrating SYSTEM tenant data...");

// 			// Move users → platform (tenantId = null)
// 			await prisma.user.updateMany({
// 			where: { tenantId: systemTenant.id },
// 			data: { tenantId: null },
// 			});

// 			// Move roles → platform (tenantId = null)
// 			await prisma.role.updateMany({
// 			where: {
// 				tenantId: systemTenant.id,
// 				type: RoleType.SYSTEM,
// 			},
// 			data: { tenantId: null },
// 			});

// 			console.log("✅ SYSTEM tenant migration done");

// 			// OPTIONAL: delete system tenant (only if safe)
// 			// await prisma.tenant.delete({ where: { id: systemTenant.id } });
// 		}

// 		// ✅ STEP 1: Create Permissions
// 		const permissions = [
// 			"BILLING_VIEW",
// 			"BILLING_MANAGE",
// 			"AUDIT_VIEW",
// 			"COMPANY_APPROVE",
// 			"SUPPORT_IMPERSONATE",
// 			"ANALYTICS_VIEW",
// 		];

// 		const permissionMap: Record<string, string> = {};

// 		for (const name of permissions) {
// 			const p = await prisma.permission.upsert({
// 			where: { name },
// 			update: {},
// 			create: { name },
// 			});

// 			permissionMap[name] = p.id;
// 		}

// 		console.log("✅ Permissions seeded");

// 		// ✅ STEP 2: Create SYSTEM Roles
// 		const roles = [
// 			"SUPER_ADMIN",
// 			"FINANCE_ADMIN",
// 			"AUDIT_ADMIN",
// 			"REVIEW_ADMIN",
// 			"SUPPORT_ADMIN",
// 		];

// 		const roleMap: Record<string, string> = {};

// 		for (const roleName of roles) {
// 			let role = await prisma.role.findFirst({
// 			where: {
// 				name: roleName,
// 				type: RoleType.SYSTEM,
// 			},
// 			});

// 			if (!role) {
// 				role = await prisma.role.create({
// 					data: {
// 					name: roleName,
// 					type: RoleType.SYSTEM,
// 					tenantId: null,
// 					},
// 				});
// 			}
// 			// 🔥 FIX
//   			roleMap[roleName] = role.id;
// 		}

// 		console.log("✅ Roles seeded");

// 		// ✅ STEP 3: Role → Permission Mapping
// 		const ROLE_PERMISSIONS: Record<string, string[]> = {
// 			SUPER_ADMIN: permissions,

// 			FINANCE_ADMIN: ["BILLING_VIEW", "BILLING_MANAGE"],
// 			AUDIT_ADMIN: ["AUDIT_VIEW"],
// 			REVIEW_ADMIN: ["COMPANY_APPROVE"],
// 			SUPPORT_ADMIN: ["SUPPORT_IMPERSONATE"],
// 		};

// 		for (const roleName in ROLE_PERMISSIONS) {
// 			const roleId = roleMap[roleName];

// 			for (const perm of ROLE_PERMISSIONS[roleName]) {
// 			await prisma.rolePermission.upsert({
// 				where: {
// 				roleId_permissionId: {
// 					roleId,
// 					permissionId: permissionMap[perm],
// 				},
// 				},
// 				update: {},
// 				create: {
// 				roleId,
// 				permissionId: permissionMap[perm],
// 				},
// 			});
// 			}
// 		}

// 		console.log("✅ Role-Permission mapping done");

// 		// ✅ STEP 4: Create / Update Super Admin User
// 		const user = await prisma.user.upsert({
// 			where: { email: "razonova@hrms.com" },
// 			update: {
// 			tenantId: null, // 🔥 ensure platform user
// 			},
// 			create: {
// 			name: "Razonova",
// 			email: "razonova@hrms.com",
// 			password: await bcrypt.hash("Razonova@2025", 10), // ⚠️ hash in real app
// 			tenantId: null,
// 			isActive: true,
// 			},
// 		});

// 		console.log("✅ Super Admin user ready");

// 		// ✅ STEP 5: Assign SUPER_ADMIN Role
// 		await prisma.userRole.upsert({
// 			where: {
// 			userId_roleId: {
// 				userId: user.id,
// 				roleId: roleMap["SUPER_ADMIN"],
// 			},
// 			},
// 			update: {},
// 			create: {
// 			userId: user.id,
// 			roleId: roleMap["SUPER_ADMIN"],
// 			},
// 		});

// 		console.log("✅ SUPER_ADMIN role assigned");

// 		return res.json({ message: "Platform seeded successfully" });
// 	} catch (error: any) {
// 		res.status(500).json({ error: error.message });
// 	}
// });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`✅ Server running on port ${PORT}`);
});