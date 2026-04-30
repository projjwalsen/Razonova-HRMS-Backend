import { Request, Response } from "express";
import { prisma } from "../../config/db/prisma";
import { seedTenantRoles, syncDefaultRolePermissions } from "../utils/seed.roles";

/**
 * @swagger
 * /platform/organizations:
 *   get:
 *     tags:
 *       - platform
 *     summary: Get all organizations (platform admin)
 *     description: Retrieve all organizations across tenants. Accessible only by SYSTEM/SUPER_ADMIN.
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *         required: false
 *         description: "Filter organizations by tenant status. Allowed values: PENDING, APPROVED, REJECTED. If not provided, returns all."
 *     responses:
 *       200:
 *         description: Organizations fetched successfully.
 *       400:
 *         description: Invalid status filter.
 *       401:
 *         description: Unauthorized access.
 *       500:
 *         description: Internal server error.
 */
export const getAllOrganizationsPlatform = async (req: Request, res: Response) => {
  try {
    const { status } = (req as any).query;
    let statusUpper = (status as string)?.toUpperCase();
    if(statusUpper && !["PENDING", "APPROVED", "REJECTED"].includes(statusUpper)) {
        return res.status(400).json({
            status: false,
            message: "Invalid status filter. Allowed values are PENDING, APPROVED, REJECTED."
        });
    }
    const orgs = await prisma.tenant.findMany({
      where: {
        isSystem: false,
        ... (statusUpper ? { status: statusUpper as any } : {})
      },
      select: {
        id: true,
        name: true,
        status: true,
        isActive: true,
        createdAt: true,

        organization: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            industry: true,
            companySize: true,
            city: true,
            state: true,
            country: true,
          },
          take: 1
        },

        users: {
          where: {
            userRoles: {
              some: {
                role: {
                  name: "COMPANY_ADMIN",
                  type: "TENANT"
                }
              }
            }
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
          take: 1
        },

        subscription: {
          where: {
            isActive: true,
          },
          select: {
            id: true,
            startDate: true,
            endDate: true,
          },
          take: 1
        },

        _count: {
          select: {
            departments: true,
            users: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    const data = orgs.map(org => {
      const organization = org.organization[0] || null;
      const admin = org.users[0] || null;
      const subscription = org.subscription[0] || null;

      return {
        id: org.id,
        tenantName: org.name,
        companyName: organization?.name || org.name,
        logoUrl: organization?.logoUrl || null,
        industry: organization?.industry || null,
        companySize: organization?.companySize || null,
        city: organization?.city || null,
        state: organization?.state || null,
        country: organization?.country || null,

        status: org.status,
        isActive: org.isActive,
        createdAt: org.createdAt,

        companyAdmin: admin
          ? {
              id: admin.id,
              name: admin.name,
              email: admin.email,
              phone: admin.phone,
            }
          : null,

        subscription: subscription
          ? {
              id: subscription.id,
              startDate: subscription.startDate,
              endDate: subscription.endDate,
            }
          : null,

        departmentsCount: org._count.departments,
        usersCount: org._count.users,
      }
    })

    res.status(200).json({
        status: true,
        message: "Organizations fetched successfully.",
        data
    })
  } catch (err: any) {
    res.status(500).json({ 
        status: false,
        message: "An error occurred while fetching organizations.",
        error: err.message || "Internal Server Error"
    });
  }
};


/* -------- DASHBOARD KPI's -------------- */
/**
 * @swagger
 * /admin/dashboard/kpis:
 *   get:
 *     tags:
 *       - Dashboard (Platform)
 *     summary: Get platform dashboard KPIs
 *     description: Returns high-level platform metrics — total companies, total users, active users, and pending company approvals.
 *     responses:
 *       200:
 *         description: Dashboard KPIs fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalCompanies:
 *                       type: integer
 *                       example: 42
 *                     totalUsers:
 *                       type: integer
 *                       example: 310
 *                     activeUsers:
 *                       type: integer
 *                       example: 275
 *                     pendingCompanies:
 *                       type: integer
 *                       example: 5
 *       500:
 *         description: Internal server error
 */
export const getPlatformDashboardKpis = async (req: Request, res: Response) => {
  try {
    const [
      totalCompanies,
      totalUsers,
      activeUsers,
      pendingCompanies
    ] = await Promise.all([
      prisma.tenant.count({
        where: {
          isSystem: false,
          status: "APPROVED"
        }
      }),

      prisma.user.count({
        where: {
          tenant: {
            isSystem: false,
          }
        }
      }),

      prisma.user.count({
        where: {
          isActive: true,
          tenant: {
            isSystem: false,
          }
        }
      }),

      prisma.tenant.count({
        where: {
          isSystem: false,
          status: "PENDING"
        }
      })
    ]);

    return res.status(200).json({
      status: true,
      message: "Dashboard KPIs fetched successfully",
      data: {
        totalCompanies,
        totalUsers,
        activeUsers,
        pendingCompanies
      }
    });

  } catch (error: any) {
    res.status(500).json({
      status: false,
      message: "An error occurred while fetching dashboard KPIs.",
      error: error.message || "Internal Server Error"
    });
  }
}


/* -------- Gets all companies users ------------- */
/**
 * @swagger
 * /platform/organizations/users:
 *   get:
 *     summary: Get users grouped by company
 *     description: Platform admin API to list users from all non-system companies, grouped company-wise.
 *     tags:
 *       - Platform
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, admins, employees]
 *           default: all
 *         description: Filter users by role type. admins = COMPANY_ADMIN only, employees = excludes COMPANY_ADMIN.
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *         description: Filter companies by tenant approval status.
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search users by name, email, or phone.
 *     responses:
 *       200:
 *         description: Organization users fetched successfully.
 *       400:
 *         description: Invalid user or invalid filter.
 *       500:
 *         description: Internal server error.
 */
export const getAllOrganizationsUsers = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    if(!actor.id){
      return res.status(400).json({
        status: false,
        message: "Invalid user."
      });
    }

    const {
      type = "all", // all | admins | employees
      status,
      search,
      page = "1",
      limit = "10"
    } = req.query;

    const statusUpper = (status as string)?.toUpperCase();
    if(
      statusUpper && 
      !["PENDING", "APPROVED", "REJECTED"].includes(statusUpper)
    ){
      return res.status(400).json({
        status: false,
        message: "Invalid status filter. Allowed values are PENDING, APPROVED, REJECTED."
      });
    }

    if(!["all", "admins", "employees"].includes(type as string)){
      return res.status(400).json({
        status: false,
        message: "Invalid type filter. Allowed values are all, admins, employees."
      });
    }

    const whereClause: any = {};

    if(search && typeof search === "string"){
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ]
    }

    if(type === "admins"){
      whereClause.userRoles = {
        some: {
          role: {
            name: "COMPANY_ADMIN",
            type: "TENANT"
          }
        }
      }
    }

    if(type === "employees"){
      whereClause.NOT = {
        userRoles: {
          some: {
            role: {
              name: "COMPANY_ADMIN",
              type: "TENANT"
            }
          }
        }
      }
    }

    const companies = await prisma.tenant.findMany({
      where: {
        isSystem: false,
        ... (statusUpper ? { status: statusUpper as any } : {})
      },
      orderBy: {
        createdAt: "desc"
      },
      select: {
        id: true,
        name: true,
        status: true,
        isActive: true,

        organization: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            industry: true,
            companySize: true,
          },
          take: 1
        },

        users: {
          where: whereClause,
          orderBy: {
            createdAt: "desc"
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            isActive: true,
            createdAt: true,

            department: {
              select: {
                id: true,
                name: true
              }
            },
            designation: {
              select: {
                id: true,
                name: true
              }
            },
            userRoles: {
              select: {
                role: {
                  select: {
                    id: true,
                    name: true,
                    type: true
                  }
                }
              }
            }
          }
        },
        _count: {
          select: {
            users: true
          }
        }
      }
    });


    const data = companies.map(company => {
      const organization = company.organization[0] || null;

      return {
        company : {
          id: company.id,
          tenantName: company.name,
          companyName: organization?.name || company.name,
          logoUrl: organization?.logoUrl || null,
          industry: organization?.industry || null,
          status: company.status,
          isActive: company.isActive,
          totalUsers: company._count.users
        },

        users: company.users.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          isActive: user.isActive,
          createdAt: user.createdAt,

          department: user.department
          ? {
              id: user.department.id,
              name: user.department.name
            }
          : null,
          
          designations: user.designation
          ? {
              id: user.designation.id,
              name: user.designation.name
            }
          : null,
          
          roles: user.userRoles.map(ur => ({
            id: ur.role.id,
            name: ur.role.name,
            type: ur.role.type
          })),
        }))
      }
    });

    return res.status(200).json({
      status: true,
      message: "Organization users fetched successfully.",
      data
    });
  } catch (error: any) {
    res.status(500).json({
      status: false,
      message: "An error occurred while fetching organization users.",
      error: error.message || "Internal Server Error"
    });
  }
}



/**
 * @swagger
 * /platform/departments:
 *   get:
 *     tags:
 *       - platform
 *     summary: Get all departments (platform admin)
 *     description: Retrieve all departments across tenants. Accessible only by SYSTEM/SUPER_ADMIN.
 *     responses:
 *       200:
 *         description: Departments fetched successfully.
 *       401:
 *         description: Unauthorized access.
 *       500:
 *         description: Internal server error.
 */
export const getAllDepartmentsPlatform = async (req: Request, res: Response) => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        tenant: true,
        manager: true,
        _count: { select: { users: true } }
      },
    });

    res.status(200).json({
        status: true,
        message: "Departments fetched successfully.",
        data: departments
    });
  } catch (err: any) {
    res.status(500).json({
        status: false,
        message: "An error occurred while fetching departments.",
        error: err.message || "Internal Server Error"
    });
  }
};

/**
 * @swagger
 * /platform/tenant/approve/{tenantId}:
 *   patch:
 *     tags:
 *       - platform
 *     summary: Approve a tenant (company)
 *     description: Approve a pending tenant (company) by ID. Accessible only by platform admin.
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         schema:
 *           type: string
 *         required: true
 *         description: Tenant (company) ID to approve
 *     responses:
 *       200:
 *         description: Tenant approved successfully.
 *       400:
 *         description: Bad request.
 *       401:
 *         description: Unauthorized access.
 *       500:
 *         description: Internal server error.
 */
export const approveTenant = async (req: Request, res: Response) => {
  try {
    const { tenantId } = (req as any).params;

    const hasSubscription = await prisma.tenantSubscription.findFirst({
      where: { tenantId, isActive: true }
    });
    if(!hasSubscription){
      return res.status(400).json({
        status: false,
        message: "Cannot approve tenant without an active subscription. Please ensure the tenant has an active subscription before approval."
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.update({
        where: { id: tenantId },
        data: { status: "APPROVED" }
      });

      await seedTenantRoles(tx, tenantId);
      await syncDefaultRolePermissions(tx, tenantId);

      return tenant;
    });
    res.status(200).json({
        status: true,
        message: "Tenant approved successfully.",
        data: result
    });

  } catch (error: any) {
      return res.status(500).json({
          status: false,
          message: "An error occurred while approving tenant.",
          error: error.message || "Internal Server Error"
      });
  }
}

/**
 * @swagger
 * /platform/tenant/reject/{tenantId}:
 *   patch:
 *     tags:
 *       - platform
 *     summary: Reject a tenant (company)
 *     description: Reject a pending tenant (company) by ID. Accessible only by platform admin.
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         schema:
 *           type: string
 *         required: true
 *         description: Tenant (company) ID to reject
 *     responses:
 *       200:
 *         description: Tenant rejected successfully.
 *       400:
 *         description: Bad request.
 *       401:
 *         description: Unauthorized access.
 *       500:
 *         description: Internal server error.
 */
export const rejectTenant = async (req: Request, res: Response) => {
  try {
    const { tenantId } = (req as any).params;

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: { status: "REJECTED" }
    });
    res.status(200).json({
        status: true,
        message: "Tenant rejected",
        data: tenant
    });
  } catch (error: any) {
      return res.status(500).json({
          status: false,
          message: "An error occurred while rejecting tenant.",
          error: error.message || "Internal Server Error"
      });
  }
}


/** ----- Platform general settings -------- */
// export const upsertPlatformSettings = async (req: Request, res: Response) => {
//   try {
//       const { key, value } = req.body;
//       let PLATFORM_SETTING_TENANT_ID = null;
//       if(!key || !value) {
//           return res.status(400).json({
//               status: false,
//               message: "Key and value are required."
//           });
//       }

//       const settings = await prisma.setting.upsert({
//       where: {
//         tenantId_key: {
//           tenantId: PLATFORM_SETTING_TENANT_ID!,
//           key
//         }
//       },
//       update: { value },
//       create: {
//         tenantId: PLATFORM_SETTING_TENANT_ID!,
//         key,
//         value
//       }
//     });

//       res.status(200).json({
//         status: true,
//         message: "Platform settings updated successfully.",
//         data: settings
//       });
//   } catch (error: any) {
//     return res.status(500).json({
//       status: false,
//       message: "An error occurred while updating platform settings.",
//       error: error.message || "Internal Server Error"
//     });
//   }
// }

// export const getPlatformSettings = async (req: Request, res: Response) => {
//   try {
    
//   } catch (error: any) {
//     return res.status(500).json({
//       status: false,
//       message: "An error occurred while fetching platform settings.",
//       error: error.message || "Internal Server Error"
//     });
//   }
// }