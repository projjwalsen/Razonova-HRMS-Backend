// resignation.service.ts

import { LeaveApproverType } from "@prisma/client";
import { prisma } from "../../config/db/prisma";

export class ResignationService {
  static async upsertApprovalPolicy(actor: any, payload: {
    id?: string;
    name: string;
    departmentId?: string | null;
    designationId?: string | null;
    approverType: LeaveApproverType;
    userId?: string | null;
    isActive?: boolean;
  }) {
    if (!actor?.tenantId) {
      throw new Error("Tenant context missing");
    }

    if (!payload.name?.trim()) {
      throw new Error("Policy name is required");
    }

    if (!payload.approverType) {
      throw new Error("Approver type is required");
    }

    if (payload.approverType === "SPECIFIC_USER" && !payload.userId) {
      throw new Error("userId is required for SPECIFIC_USER approver");
    }

    if (payload.userId) {
      const user = await prisma.user.findFirst({
        where: {
          id: payload.userId,
          tenantId: actor.tenantId,
          isActive: true
        }
      });

      if (!user) {
        throw new Error("Approver user not found");
      }
    }

    if (payload.id) {
      const existing = await prisma.resignationApprovalPolicy.findFirst({
        where: {
          id: payload.id,
          tenantId: actor.tenantId
        }
      });

      if (!existing) {
        throw new Error("Resignation approval policy not found");
      }

      return prisma.resignationApprovalPolicy.update({
        where: { id: payload.id },
        data: {
          name: payload.name.trim(),
          departmentId: payload.departmentId ?? null,
          designationId: payload.designationId ?? null,
          approverType: payload.approverType,
          userId: payload.approverType === "SPECIFIC_USER" ? payload.userId : null,
          isActive: payload.isActive ?? true
        }
      });
    }

    return prisma.resignationApprovalPolicy.create({
      data: {
        tenantId: actor.tenantId,
        name: payload.name.trim(),
        departmentId: payload.departmentId ?? null,
        designationId: payload.designationId ?? null,
        approverType: payload.approverType,
        userId: payload.approverType === "SPECIFIC_USER" ? payload.userId : null,
        isActive: payload.isActive ?? true
      }
    });
  }

  static async getApprovalPolicies(actor: any) {
    if (!actor?.tenantId) {
      throw new Error("Tenant context missing");
    }

    return prisma.resignationApprovalPolicy.findMany({
      where: {
        tenantId: actor.tenantId
      },
      include: {
        department: {
          select: { id: true, name: true }
        },
        designation: {
          select: { id: true, name: true }
        },
        user: {
          select: { id: true, name: true, email: true }
        },
      },
      orderBy: {
        createdAt: "desc"
      }
    });
  }

  private static async resolveApprovalPolicy(tenantId: string, user: any) {
    let policy = await prisma.resignationApprovalPolicy.findFirst({
      where: {
        tenantId,
        isActive: true,
        departmentId: user.departmentId ?? null,
        designationId: user.designationId ?? null
      },
      orderBy: { createdAt: "desc" }
    });

    if (policy) return policy;

    policy = await prisma.resignationApprovalPolicy.findFirst({
      where: {
        tenantId,
        isActive: true,
        departmentId: user.departmentId ?? null,
        designationId: null
      },
      orderBy: { createdAt: "desc" }
    });

    if (policy) return policy;

    return prisma.resignationApprovalPolicy.findFirst({
      where: {
        tenantId,
        isActive: true,
        departmentId: null,
        designationId: null
      },
      orderBy: { createdAt: "desc" }
    });
  }

  private static async canApprove(actor: any, request: any) {
    const requester = request.user;

    if (request.approverType === "SPECIFIC_USER") {
      return request.approverUserId === actor.id;
    }

    if (request.approverType === "REPORTING_MANAGER") {
      return requester.managerId === actor.id;
    }

    if (request.approverType === "DEPARTMENT_MANAGER") {
      if (!requester.departmentId) return false;

      const department = await prisma.department.findFirst({
        where: {
          id: requester.departmentId,
          tenantId: actor.tenantId
        }
      });

      return department?.managerId === actor.id;
    }

    if (request.approverType === "COMPANY_ADMIN") {
      const adminRole = await prisma.userRole.findFirst({
        where: {
          userId: actor.id,
          role: {
            tenantId: actor.tenantId,
            name: "COMPANY_ADMIN",
            type: "TENANT"
          }
        }
      });

      return Boolean(adminRole);
    }

    return false;
  }

  static async submitResignation(actor: any, payload: {
    reason: string;
    preferredLastWorkingDate?: string;
  }) {
    if (!actor?.tenantId) {
      throw new Error("Tenant context missing");
    }

    if (!payload.reason?.trim()) {
      throw new Error("Reason is required");
    }

    const existing = await prisma.resignationRequest.findFirst({
      where: {
        tenantId: actor.tenantId,
        userId: actor.id,
        status: "PENDING"
      }
    });

    if (existing) {
      throw new Error("You already have a pending resignation request");
    }

    const user = await prisma.user.findFirst({
      where: {
        id: actor.id,
        tenantId: actor.tenantId,
        isActive: true
      }
    });

    if (!user) {
      throw new Error("User not found");
    }

    const policy = await this.resolveApprovalPolicy(actor.tenantId, user);

    if (!policy) {
      throw new Error("No active resignation approval policy found");
    }

    return prisma.resignationRequest.create({
      data: {
        tenantId: actor.tenantId,
        userId: actor.id,
        reason: payload.reason.trim(),
        preferredLastWorkingDate: payload.preferredLastWorkingDate
          ? new Date(payload.preferredLastWorkingDate)
          : null,

        approverType: policy.approverType,
        approverUserId: policy.userId ?? null,
      }
    });
  }

  static async getMyResignations(actor: any) {
    if (!actor?.tenantId) {
      throw new Error("Tenant context missing");
    }

    return prisma.resignationRequest.findMany({
      where: {
        tenantId: actor.tenantId,
        userId: actor.id
      },
      include: {
        approvedBy: {
          select: { id: true, name: true, email: true }
        },
        rejectedBy: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });
  }

  static async getPendingApprovals(actor: any) {
    if (!actor?.tenantId) {
      throw new Error("Tenant context missing");
    }

    const requests = await prisma.resignationRequest.findMany({
      where: {
        tenantId: actor.tenantId,
        status: "PENDING"
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            managerId: true,
            departmentId: true,
            designationId: true,
            department: {
              select: { id: true, name: true, managerId: true }
            },
            designation: {
              select: { id: true, name: true }
            }
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    const allowed = [];

    for (const request of requests) {
      const canApprove = await this.canApprove(actor, request);
      if (canApprove) allowed.push(request);
    }

    return allowed;
  }

  static async approveResignation(actor: any, requestId: string, payload: {
    approvedLastWorkingDate: string;
    adminRemarks?: string;
  }) {
    if (!actor?.tenantId) {
      throw new Error("Tenant context missing");
    }

    if (!payload.approvedLastWorkingDate) {
      throw new Error("approvedLastWorkingDate is required");
    }

    const request = await prisma.resignationRequest.findFirst({
      where: {
        id: requestId,
        tenantId: actor.tenantId,
        status: "PENDING"
      },
      include: {
        user: true
      }
    });

    if (!request) {
      throw new Error("Pending resignation request not found");
    }

    const canApprove = await this.canApprove(actor, request);

    if (!canApprove) {
      throw new Error("You are not allowed to approve this resignation request");
    }

    return prisma.resignationRequest.update({
      where: { id: request.id },
      data: {
        status: "APPROVED",
        approvedById: actor.id,
        approvedAt: new Date(),
        approvedLastWorkingDate: new Date(payload.approvedLastWorkingDate),
        adminRemarks: payload.adminRemarks ?? null
      }
    });
  }

  static async rejectResignation(actor: any, requestId: string, remarks?: string) {
    if (!actor?.tenantId) {
      throw new Error("Tenant context missing");
    }

    const request = await prisma.resignationRequest.findFirst({
      where: {
        id: requestId,
        tenantId: actor.tenantId,
        status: "PENDING"
      },
      include: {
        user: true
      }
    });

    if (!request) {
      throw new Error("Pending resignation request not found");
    }

    const canApprove = await this.canApprove(actor, request);

    if (!canApprove) {
      throw new Error("You are not allowed to reject this resignation request");
    }

    return prisma.resignationRequest.update({
      where: { id: request.id },
      data: {
        status: "REJECTED",
        rejectedById: actor.id,
        rejectedAt: new Date(),
        adminRemarks: remarks ?? null
      }
    });
  }

  static async withdrawResignation(actor: any, requestId: string) {
    if (!actor?.tenantId) {
      throw new Error("Tenant context missing");
    }

    const request = await prisma.resignationRequest.findFirst({
      where: {
        id: requestId,
        tenantId: actor.tenantId,
        userId: actor.id,
        status: "PENDING"
      }
    });

    if (!request) {
      throw new Error("Pending resignation request not found");
    }

    return prisma.resignationRequest.update({
      where: { id: request.id },
      data: {
        status: "WITHDRAWN",
        withdrawnAt: new Date()
      }
    });
  }

  static async completeResignation(actor: any, requestId: string) {
    if (!actor?.tenantId) {
      throw new Error("Tenant context missing");
    }

    const request = await prisma.resignationRequest.findFirst({
      where: {
        id: requestId,
        tenantId: actor.tenantId,
        status: "APPROVED"
      }
    });

    if (!request) {
      throw new Error("Approved resignation request not found");
    }

    return prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: request.userId },
        data: {
          isActive: false
        }
      });

      await tx.employeeProfile.updateMany({
        where: {
          userId: request.userId
        },
        data: {
          exitDate: request.approvedLastWorkingDate,
          exitReason: request.reason
        }
      });

      return tx.resignationRequest.update({
        where: { id: request.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date()
        }
      });
    });
  }
}