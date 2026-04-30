import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express'
import { prisma } from './config/db/prisma';
import routes from './routes/index'
import { swaggerSpec } from './config/swagger/swagger';
import bcrypt from "bcrypt";
import { EmploymentType, RoleType, TenantStatus } from '@prisma/client';
import { startCrons } from './core/service/cron.job';

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
//   try {
//     console.log('🚀 Starting system admin seed...');

//     /**
//      * SYSTEM permissions based on your current schema:
//      * name + scope + module + action
//      */
//     const PERMISSIONS = [
//       {
//         name: 'Approve Tenant',
//         scope: RoleType.SYSTEM,
//         module: 'TENANT',
//         action: 'APPROVE'
//       },
//       {
//         name: 'Reject Tenant',
//         scope: RoleType.SYSTEM,
//         module: 'TENANT',
//         action: 'REJECT'
//       },
//       {
//         name: 'Create Permission',
//         scope: RoleType.SYSTEM,
//         module: 'PERMISSION',
//         action: 'CREATE'
//       },
//       {
//         name: 'Update Permission',
//         scope: RoleType.SYSTEM,
//         module: 'PERMISSION',
//         action: 'UPDATE'
//       },
//       {
//         name: 'Read Permission',
//         scope: RoleType.SYSTEM,
//         module: 'PERMISSION',
//         action: 'READ'
//       }
//     ];

//     /**
//      * System roles
//      */
//     const ROLES = [
//       'SUPER_ADMIN',
//       'REVIEW_ADMIN',
//       'PERMISSION_ADMIN'
//     ];

//     /**
//      * Role -> Permission mapping
//      */
//     const ROLE_PERMISSIONS: Record<string, string[]> = {
//       SUPER_ADMIN: [
//         'TENANT.APPROVE',
//         'TENANT.REJECT',
//         'PERMISSION.CREATE',
//         'PERMISSION.UPDATE',
//         'PERMISSION.READ'
//       ],
//       REVIEW_ADMIN: [
//         'TENANT.APPROVE',
//         'TENANT.REJECT'
//       ],
//       PERMISSION_ADMIN: [
//         'PERMISSION.CREATE',
//         'PERMISSION.UPDATE',
//         'PERMISSION.READ'
//       ]
//     };

//     const result = await prisma.$transaction(async (tx) => {
//       // --------------------------------------------------
//       // 1. Optional: create or reuse a system tenant
//       // --------------------------------------------------
//       let systemTenant = await tx.tenant.findFirst({
//         where: { isSystem: true }
//       });

//       if (!systemTenant) {
//         systemTenant = await tx.tenant.create({
//           data: {
//             name: 'HRMS SYSTEM',
//             status: TenantStatus.APPROVED,
//             isActive: true,
//             isSystem: true
//           }
//         });
//       }

//       // --------------------------------------------------
//       // 2. Seed permissions
//       // --------------------------------------------------
//       const permissionMap: Record<string, string> = {};

//       for (const permission of PERMISSIONS) {
//         const createdPermission = await tx.permission.upsert({
//           where: {
//             scope_module_action: {
//               scope: permission.scope,
//               module: permission.module,
//               action: permission.action
//             }
//           },
//           update: {
//             name: permission.name
//           },
//           create: {
//             name: permission.name,
//             scope: permission.scope,
//             module: permission.module,
//             action: permission.action
//           }
//         });

//         permissionMap[`${permission.module}.${permission.action}`] = createdPermission.id;
//       }

//       console.log('✅ Permissions seeded');

//       // --------------------------------------------------
//       // 3. Seed roles
//       // --------------------------------------------------
//       const roleMap: Record<string, string> = {};

//       for (const roleName of ROLES) {
//         let role = await tx.role.findFirst({
//           where: {
//             name: roleName,
//             type: RoleType.SYSTEM,
//             tenantId: null
//           }
//         });

//         if (!role) {
//           role = await tx.role.create({
//             data: {
//               name: roleName,
//               type: RoleType.SYSTEM,
//               tenantId: null
//             }
//           });
//         }

//         roleMap[roleName] = role.id;
//       }

//       console.log('✅ Roles seeded');

//       // --------------------------------------------------
//       // 4. Role -> Permission mapping
//       // --------------------------------------------------
//       for (const [roleName, permissionKeys] of Object.entries(ROLE_PERMISSIONS)) {
//         const roleId = roleMap[roleName];

//         for (const permissionKey of permissionKeys) {
//           const permissionId = permissionMap[permissionKey];

//           if (!permissionId) continue;

//           await tx.rolePermission.upsert({
//             where: {
//               roleId_permissionId: {
//                 roleId,
//                 permissionId
//               }
//             },
//             update: {},
//             create: {
//               roleId,
//               permissionId
//             }
//           });
//         }
//       }

//       console.log('✅ Role-Permission mapping done');

//       // --------------------------------------------------
//       // 5. Create / update system admin user
//       // --------------------------------------------------
//       const hashedPassword = await bcrypt.hash('Razonova@2025', 10);

//       const existingUser = await tx.user.findUnique({
//         where: {
//           email: 'razonova@hrms.com'
//         }
//       });

//       let user;

//       if (existingUser) {
//         user = await tx.user.update({
//           where: {
//             email: 'razonova@hrms.com'
//           },
//           data: {
//             name: 'Razonova System Admin',
//             phone: '9876543210',
//             password: hashedPassword,
//             tenantId: null,
//             isActive: true
//           }
//         });
//       } else {
//         user = await tx.user.create({
//           data: {
//             name: 'Razonova System Admin',
//             email: 'razonova@hrms.com',
//             phone: '9876543210',
//             password: hashedPassword,
//             tenantId: null,
//             isActive: true
//           }
//         });
//       }

//       console.log('✅ Super admin user ready');

//       // --------------------------------------------------
//       // 6. Assign SUPER_ADMIN role
//       // --------------------------------------------------
//       await tx.userRole.upsert({
//         where: {
//           userId_roleId: {
//             userId: user.id,
//             roleId: roleMap['SUPER_ADMIN']
//           }
//         },
//         update: {},
//         create: {
//           userId: user.id,
//           roleId: roleMap['SUPER_ADMIN']
//         }
//       });

//       console.log('✅ SUPER_ADMIN role assigned');

//       // --------------------------------------------------
//       // 7. Optional employee profile
//       // --------------------------------------------------
//       const existingProfile = await tx.employeeProfile.findUnique({
//         where: {
//           userId: user.id
//         }
//       });

//       let employeeProfile;

//       if (!existingProfile) {
//         employeeProfile = await tx.employeeProfile.create({
//           data: {
//             userId: user.id,
//             employeeCode: 'SYS-ADM-001',
//             employmentType: EmploymentType.FULL_TIME,
//             joiningDate: new Date(),
//             probationMonths: 0,
//             salary: 0,
//             addressLine1: '',
//             addressLine2: '',
//             city: 'Kolkata',
//             state: 'West Bengal',
//             country: 'India',
//             pinCode: '700091'
//           }
//         });
//       } else {
//         employeeProfile = existingProfile;
//       }

//       // --------------------------------------------------
//       // 8. Optional bank account
//       // --------------------------------------------------
//       const existingBank = await tx.employeeBankAccount.findUnique({
//         where: {
//           userId: user.id
//         }
//       });

//       let bankAccount;

//       if (!existingBank) {
//         bankAccount = await tx.employeeBankAccount.create({
//           data: {
//             userId: user.id,
//             accountHolderName: 'Razonova System Admin',
//             accountNumber: '123456789012',
//             ifscCode: 'HDFC0001234',
//             bankName: 'HDFC Bank',
//             branchName: 'Salt Lake',
//             upiId: 'razonova@upi',
//             isVerified: true,
//             isPrimary: true
//           }
//         });
//       } else {
//         bankAccount = existingBank;
//       }

//       return {
//         systemTenant,
//         permissions: permissionMap,
//         roles: roleMap,
//         user,
//         employeeProfile,
//         bankAccount
//       };
//     },
// 	{
// 		timeout: 60000, // 60 seconds
// 		maxWait: 60000, //60 seconds
// 	});

//     return res.status(200).json({
//       status: true,
//       message: 'System admin seeded successfully',
//       data: result
//     });
//   } catch (error: any) {
//     console.error('❌ Seed error:', error);
//     return res.status(500).json({
//       status: false,
//       message: 'Failed to seed system admin',
//       error: error?.message || 'Internal Server Error'
//     });
//   }
// });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`✅ Server running on port ${PORT}`);
	if(process.env.CRON_ENABLED === "true"){
		startCrons();
	}
});