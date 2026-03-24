import { Request, Response } from "express";
import { prisma } from "../../config/db/prisma";

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
      where: statusUpper ? { status: statusUpper as any } : {},
      include: {
        organization: true,
        departments: true,
        users: true,
        _count: { select: { departments: true, users: true } }
      },
    });

    res.status(200).json({
        status: true,
        message: "Organizations fetched successfully.",
        data: orgs
    })
  } catch (err: any) {
    res.status(500).json({ 
        status: false,
        message: "An error occurred while fetching organizations.",
        error: err.message || "Internal Server Error"
    });
  }
};

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

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: { status: "APPROVED" }
    });
    res.status(200).json({
        status: true,
        message: "Tenant approved successfully.",
        data: tenant
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