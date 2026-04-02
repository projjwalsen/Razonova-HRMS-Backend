import { LeaveTypeCode } from "@prisma/client";
import { prisma } from "../../config/db/prisma";
import { getDayDiffInclusiveTZ, getEndOfDay, getStartOfDay, getTenantTimezone } from "../utils/util";
import { success } from "zod";

export class LeaveService {
    static async upsertLeaveType(tenantId: string, payload: {
        name: string;
        typeCode?: string | null;
        maxLimit?: number | null;
        attachmentRequired?: boolean;
        priorNoticeDays?: number;
        allowHalfDay?: boolean;
        sandwichLeaveAllowed?: boolean;
        }) {
        return prisma.leaveType.upsert({
            where: {
            tenantId_name: {
                tenantId,
                name: payload.name
            }
            },
            update: {
                typeCode: payload.typeCode ? (payload.typeCode as LeaveTypeCode) : null,
                maxLimit: payload.maxLimit,
                attachmentRequired: payload.attachmentRequired,
                priorNoticeDays: payload.priorNoticeDays,
                allowHalfDay: payload.allowHalfDay,
                sandwichLeaveEnabled: payload.sandwichLeaveAllowed
            },
            create: {
                tenantId,
                name: payload.name,
                typeCode: payload.typeCode ? (payload.typeCode as LeaveTypeCode) : null,
                maxLimit: payload.maxLimit,
                attachmentRequired: payload.attachmentRequired,
                priorNoticeDays: payload.priorNoticeDays,
                allowHalfDay: payload.allowHalfDay,
                sandwichLeaveEnabled: payload.sandwichLeaveAllowed
            }
        });
    }
    static async getLeaveTypes(tenantId: string) {
        return prisma.leaveType.findMany({
            where: { tenantId, isActive: true },
            orderBy: { createdAt: "desc" }
        })
    }
    static async applyLeave(tenantId: string, userId: string, payload: {
        leaveTypeId: string;
        startDate: string;
        endDate: string;
        reason?: string;
        attachmentUrls?: string[];
    }){
        const timezone = await getTenantTimezone(tenantId);
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                department: true
            }
        });
        if(!user || user.tenantId !== tenantId) {
            throw new Error("User not found in tenant");
        }
        const leaveType = await prisma.leaveType.findUnique({
            where: { 
                id: payload.leaveTypeId,
                tenantId,
                isActive: true
            }
        });
        if(!leaveType) {
            throw new Error("Leave type not found");
        }
        const startDate = getStartOfDay(new Date(payload.startDate), timezone);
        const endDate = getEndOfDay(new Date(payload.endDate), timezone);

        if(startDate > endDate) {
            throw new Error("Start date cannot be after end date");
        }

        const today = getStartOfDay(new Date(), timezone);
        const priorNoticeDate = leaveType.priorNoticeDays ?? 0;
        const minApplyDate = new Date(today);
        minApplyDate.setDate(minApplyDate.getDate() + priorNoticeDate);

        if(startDate < minApplyDate) {
            throw new Error(`Leave must be applied at least ${priorNoticeDate} day(s) in advance`);
        }
        if(leaveType.attachmentRequired && !payload.attachmentUrls?.length) {
            throw new Error("Attachment is required for this leave type");
        }
        const totalDays = getDayDiffInclusiveTZ(startDate, endDate, timezone);

        if(leaveType.maxLimits !== 0 && leaveType.maxLimits !== undefined && leaveType.maxLimits !== null){
            const yearStart = new Date(startDate.getFullYear(), 0, 1);
            const yearEnd = new Date(startDate.getFullYear(), 11, 31);
            
            const usedLeaves = await prisma.leaveRequest.findMany({
                where: {
                    tenantId,
                    userId,
                    leaveTypeId: leaveType.id,
                    status: "APPROVED",
                    startDate: { gte: yearStart },
                    endDate: { lte: yearEnd }
                },
                select: {
                    totalDays: true
                }
            });

            const usedDays = usedLeaves.reduce((sum, lr) => sum + lr.totalDays, 0);
            if(usedDays + totalDays > leaveType.maxLimits) {
                throw new Error(`Applying for ${totalDays} day(s) exceeds the maximum limit of ${leaveType.maxLimits} day(s) for this leave type. You have already used ${usedDays} day(s) this year.`);
            }
        }
        const companyAdminRole = await prisma.role.findFirst({
            where: {
                tenantId,
                name: "COMPANY_ADMIN",
                type: "TENANT"
            }
        });
        let companyAdminId: string | null = null;
        if(companyAdminRole){
            const companyAdminUser = await prisma.userRole.findFirst({
                where: {
                    roleId: companyAdminRole.id
                }
            });
            companyAdminId = companyAdminUser?.userId || null;
        }

        const reportingManagerId = user?.managerId || null;
        const departmentHeadId = user?.department?.managerId || null;

        const approverIds = new Set<string>();
        // If user is manager only company admin approves
        if(departmentHeadId && departmentHeadId === userId){
            if(companyAdminId) approverIds.add(companyAdminId);
        }else{
            if(reportingManagerId) approverIds.add(reportingManagerId);
            if(departmentHeadId) approverIds.add(departmentHeadId);
            if(companyAdminId) approverIds.add(companyAdminId);
        }

        const result = await prisma.$transaction(async (tx) => {
            const leaveRequest = await tx.leaveRequest.create({
                data: {
                    tenantId,
                    userId,
                    leaveTypeId: leaveType.id,
                    startDate,
                    endDate,
                    totalDays,
                    reason: payload.reason,
                    attachmentUrls: payload.attachmentUrls ? payload.attachmentUrls : [],
                    reportingManagerId,
                    departmentHeadId,
                    companyAdminId: companyAdminId,
                    status: approverIds.size === 0 ? "APPROVED" : "PENDING"
                }
            });
            for(const approverId of approverIds) {
                await tx.leaveApproval.create({
                    data: {
                        leaveRequestId: leaveRequest.id,
                        approverId,
                        status: "PENDING"
                    }
                })
            }
            return leaveRequest;
        })
        return result;
    }
    static async getLeaveRequests(tenantId: string, userId?: string) {
        return prisma.leaveRequest.findMany({
        where: {
            tenantId,
            ...(userId ? { userId } : {})
        },
        include: {
            user: { select: { id: true, name: true, email: true } },
            leaveType: true,
            approvals: {
            include: {
                approver: {
                select: { id: true, name: true, email: true }
                }
            }
            }
        },
        orderBy: {
            createdAt: "desc"
        }
        });
    }
    static async approveLeave(
        tenantId: string,
        approverId: string,
        leaveRequestId: string,
        remarks?: string
    ){
        const leaveRequest = await prisma.leaveRequest.findUnique({
            where: {
                id: leaveRequestId,
                tenantId
            },
            include: {
                approvals: true,
                user: {
                    include: {
                        department: true
                    }
                }
            }
        });
        if(!leaveRequest) {
            throw new Error("Leave request not found");
        }
        const approval = leaveRequest.approvals.find(a => a.approverId === approverId);
        if(!approval) {
            throw new Error("You are not an approver for this leave request");
        }
        if(approval.status !== "PENDING") {
            throw new Error("You have already acted on this leave request");
        }
        await prisma.$transaction(async (tx) => {
            await tx.leaveApproval.update({
                where: { id: approval.id },
                data: {
                    status: "APPROVE",
                    remarks: remarks || null
                }
            })
            // Check if all approvals are done
            const allApprovals = await prisma.leaveApproval.findMany({
                where: { leaveRequestId }
            });
            const stillPending = allApprovals.some(a => 
                a.id === approverId ? false : a.status === "PENDING"
            );
            const anyRejected = allApprovals.some(a => 
                a.id === approverId ? false : a.status === "REJECT"
            );
            if(anyRejected){
                await prisma.leaveRequest.update({
                    where: { id: leaveRequestId },
                    data: {
                        status: "REJECTED",
                        rejectedAt: new Date()
                    }
                })
                return;
            }
            if(stillPending){
                await tx.leaveRequest.update({
                    where: { id: leaveRequestId },
                    data: {
                        status: "PARTIALLY_APPROVED"
                    }
                })
            } else {
                await tx.leaveRequest.update({
                    where: { id: leaveRequestId },
                    data: {
                        status: "APPROVED",
                        approvedAt: new Date()
                    }
                })
            }
        })
        return { success: true };
    }
    static async rejectLeave (
        tenantId: string,
        approverId: string,
        leaveRequestId: string,
        remarks?: string
    ) {
        const leaveRequest = await prisma.leaveRequest.findUnique({
            where: {
                id: leaveRequestId,
                tenantId
            },
            include: {
                approvals: true
            }
        });
        if(!leaveRequest) {
            throw new Error("Leave request not found");
        }
        const approval = leaveRequest.approvals.find(a => a.approverId === approverId);
        if(!approval) {
            throw new Error("You are not an approver for this leave request");
        }
        if(approval.status !== "PENDING") {
            throw new Error("You have already acted on this leave request");
        }
        await prisma.$transaction(async (tx) => {
            await tx.leaveApproval.update({
                where: { id: approval.id },
                data: {
                    status: "REJECT",
                    remarks: remarks || null
                }
            });
            await tx.leaveRequest.update({
                where: { id: leaveRequestId },
                data: {
                    status: "REJECTED",
                    rejectedAt: new Date()
                }
            })
        })
        return { success: true };
    }
    static async cancelLeaveRequest(
        tenantId: string, userId: string, leaveRequestId: string, reason: string
    ) {
        const leaveRequest = await prisma.leaveRequest.findUnique({
            where: {
                id: leaveRequestId,
                tenantId,
                userId
            },
            include: {
                approvals: true
            },
        });
        if(!leaveRequest) {
            throw new Error("Leave request not found");
        }
        if(!["PENDING", "PARTIALLY_APPROVED"].includes(leaveRequest.status)) {
            throw new Error("Only pending or partially approved leave requests can be cancelled");
        }
        await prisma.$transaction(async (tx) => {
            await tx.leaveRequest.update({
                where: { id: leaveRequestId },
                data: {
                    status: "CANCELLED",
                }
            });
            await tx.leaveApproval.updateMany({
                where: {
                    leaveRequestId,
                    status: "PENDING"
                },
                data: {
                    remarks: `Cancelled by user. Reason: ${reason}`
                }
            })
        });
        return { success: true };
    }
}