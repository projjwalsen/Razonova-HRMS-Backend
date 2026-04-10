import { EmploymentType, LeaveAccrualFrequency, LeaveApproverType, LeaveCountMode, LeaveTypeCode, Prisma } from "@prisma/client";
import { prisma } from "../../config/db/prisma";
import { getDayDiffInclusiveTZ, getEndOfDay, getStartOfDay, getTenantTimezone } from "../utils/util";
import Holidays from "date-holidays";
import { AttendService } from "../attendence/attend.service";

class AppError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number = 400) {
        super(message);
        this.statusCode = statusCode;
    }
}

type ActorUser = {
    id: string;
    tenantId: string | null;
    managerId?: string | null;
    departmentId?: string | null;
    designationId?: string | null;
    department?: { managerId?: string | null } | null;
    employeeProfile?: {
        joiningDate?: Date | null;
        probationMonths?: number | null;
        employmentType?: EmploymentType | null;
    } | null;
}

export class LeaveService {
    static async upsertLeaveType(tenantId: string, payload: {
        name: string;
        typeCode?: string | null;
        isActive?: boolean;
        }) {
        return prisma.leaveType.upsert({
            where: {
            tenantId_name: {
                tenantId,
                name: payload.name.trim()
            }
            },
            update: {
                typeCode: payload.typeCode ? (payload.typeCode as LeaveTypeCode) : null,
                isActive: payload.isActive !== undefined ? payload.isActive : true
            },
            create: {
                tenantId,
                name: payload.name,
                typeCode: payload.typeCode ? (payload.typeCode as LeaveTypeCode) : null,
                isActive: payload.isActive !== undefined ? payload.isActive : true
            }
        });
    }
    static async getLeaveTypes(tenantId: string) {
        return prisma.leaveType.findMany({
            where: { tenantId, isActive: true },
            orderBy: { createdAt: "desc" }
        })
    }
    static async upsertLeavePolicy(
        tenantId: string,
        payload: {
            name: string;
            employmentType: EmploymentType;
            probationMonths?: number;
            isActive?: boolean;
            rules: Array<{
                leaveTypeId: string;
                annualAllocation: number;
                maxPerRequest?: number;
                maxPerYear?: number;
                maxConsecutiveDays?: number;
                allowDuringProbation?: boolean;
                attachmentRequired?: boolean;
                priorNoticeDays?: number;
                sandwichLeaveAllowed?: boolean;
                countMode?: LeaveCountMode;
                isPaid?: boolean;
                carryForwardAllowed?: boolean;
                carryForwardLimit?: number;
                accrualFrequency?: LeaveAccrualFrequency;
                accrualAmount?: number;
                // regionHolidayCalendarId?: string | null;
            }>;
        }
    ) {
        return prisma.$transaction(async (tx) => {
            const policy = await tx.leavePolicy.upsert({
                where: {
                    tenantId_name: {
                        tenantId,
                        name: payload.name.trim()
                    }
                },
                update: {
                    employmentType: payload.employmentType ?? null,
                    probationMonths: payload.probationMonths ?? null,
                    isActive: payload.isActive !== undefined ? payload.isActive : true
                },
                create: {
                    tenantId,
                    name: payload.name.trim(),
                    employmentType: payload.employmentType ?? null,
                    probationMonths: payload.probationMonths ?? null,
                    isActive: payload.isActive !== undefined ? payload.isActive : true
                }
            });
            await tx.leavePolicyRule.deleteMany({
                where: { leavePolicyId: policy.id }
            });
            if(payload.rules && payload.rules?.length > 0) {
                await tx.leavePolicyRule.createMany({
                    data: payload.rules.map((r) => ({
                        leavePolicyId: policy.id,
                        leaveTypeId: r.leaveTypeId,
                        annualAllocation: r.annualAllocation,
                        maxPerRequest: r.maxPerRequest,
                        maxPerYear: r.maxPerYear,
                        maxConsecutiveDays: r.maxConsecutiveDays,
                        allowDuringProbation: r.allowDuringProbation ?? false,
                        attachmentRequired: r.attachmentRequired ?? false,
                        priorNoticeDays: r.priorNoticeDays,
                        sandwichLeaveAllowed: r.sandwichLeaveAllowed ?? false,
                        countMode: r.countMode ?? "WORKING_DAYS",
                        isPaid: r.isPaid,
                        carryForwardAllowed: r.carryForwardAllowed,
                        carryForwardLimit: r.carryForwardLimit,
                        accrualFrequency: r.accrualFrequency,
                        accrualAmount: r.accrualAmount,
                        // regionHolidayCalendarId: r.regionHolidayCalendarId ?? null
                    }))
                });
            }
            return tx.leavePolicy.findUnique({
                where: { id: policy.id },
                include: {
                    rules: {
                        include: {
                            leaveType: true,
                            // regionHolidayCalendar: true
                        }
                    }
                }
            })
        });
    }
    static async getLeavePolicies(tenantId: string) {
        return prisma.leavePolicy.findMany({
            where: { tenantId, isActive: true },
            include: {
                rules: {
                    include: {
                        leaveType: true,
                        // regionHolidayCalendar: true
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        });
    }
    static async upsertApprovalPolicy(
        tenantId: string,
        payload: {
            name: string;
            leavePolicyId?: string | null;
            leaveTypeId?: string | null;
            departmentId?: string | null;
            designationId?: string | null;
            isActive?: boolean;
            levels: Array<{
                level: number;
                approverType: LeaveApproverType;
                roleId?: string;
                userId?: string;
                minApprovals?: number | 1;
            }>;
        }
    ) {
        return prisma.$transaction(async (tx) => {
            const policy = await tx.leaveApprovalPolicy.upsert({
                where: {
                    tenantId_name: {
                        tenantId,
                        name: payload.name.trim()
                    }
                },
                update: {
                    leavePolicyId: payload.leavePolicyId ?? undefined,
                    leaveTypeId: payload.leaveTypeId ?? undefined,
                    departmentId: payload.departmentId ?? undefined,
                    designationId: payload.designationId ?? undefined,
                    isActive: payload.isActive !== undefined ? payload.isActive : true
                },
                create: {
                    tenantId,
                    name: payload.name.trim(),
                    leavePolicyId: payload.leavePolicyId ?? undefined,
                    leaveTypeId: payload.leaveTypeId ?? undefined,
                    departmentId: payload.departmentId ?? undefined,
                    designationId: payload.designationId ?? undefined,
                    isActive: payload.isActive !== undefined ? payload.isActive : true
                }
            })
            await tx.leaveApprovalPolicyLevel.deleteMany({
                where: { approvalPolicyId: policy.id }
            });
            if(payload.levels && payload.levels?.length > 0) {
                await tx.leaveApprovalPolicyLevel.createMany({
                    data: payload.levels.map((l) => ({
                        approvalPolicyId: policy.id,
                        level: l.level,
                        approverType: l.approverType,
                        roleId: l.roleId ?? null,
                        userId: l.userId ?? null,
                        minApprovals: l.minApprovals ?? 1
                    }))
                })
            }
            return tx.leaveApprovalPolicy.findUnique({
                where: { id: policy.id },
                include: {
                    levels: {
                        orderBy: { level: "asc" },
                        include: {
                            role: true,
                            user: {
                                select: { id: true, name: true, email: true }
                            }
                        }
                    }
                }
            })
        })
    }
    static async getApprovalPolicies(tenantId: string) {
        return prisma.leaveApprovalPolicy.findMany({
            where: { tenantId, isActive: true },
            include: {
                leavePolicy: true,
                leaveType: true,
                department: true,
                designation: true,
                levels: {
                    orderBy: { level: "asc" },
                    include: {
                        role: true,
                        user: {
                            select: { id: true, name: true, email: true }
                        }
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        })
    }


    /** --------------  Holiday Calendar Setup ------------------------- */

    static async importHolidayCalendarYear(
        tenantId: string,
        payload: {
            holidayCalendarId: string;
            year?: number;
        }
    ) {
        if(!payload.holidayCalendarId) {
            throw new Error("Holiday calendar ID is required");
        }
        const year = payload.year ?? new Date().getFullYear();

        const calendar = await prisma.holidayCalendar.findFirst({
            where: {
                id: payload.holidayCalendarId,
                tenantId
            },
        });
        if(!calendar) {
            throw new Error("Holiday calendar not found");
        }
        if(["GLOBAL", "CUSTOM"].includes(calendar.regionType)) {
            throw new Error("Only region-specific holiday calendars can be imported");
        }

        let hd: Holidays;
        if(calendar.regionType === "COUNTRY") {
            hd = new Holidays(calendar.country!.toUpperCase());
        } else if(calendar.regionType === "STATE") {
            hd = new Holidays(
                calendar.country!.toUpperCase(), 
                calendar.state!.toUpperCase()
            );
        } else {
            hd = new Holidays(
                calendar.country!.toUpperCase(), 
                calendar.state!.toUpperCase(), 
                calendar.city!.toUpperCase()
            );
        }

        const timezone = await getTenantTimezone(tenantId);
        const holidays = hd.getHolidays(year) ?? [];

        let importedCount = 0;
        let skippedCount = 0;
        let failedCount = 0;

        for(const h of holidays) {
            try {
                const holidayName = h.name;
                const rawDate = 
                    h.start instanceof Date
                    ? h.start
                    : h.date
                      ? new Date(h.date)
                      : null;

                if(!holidayName || !rawDate || Number.isNaN(rawDate.getTime())) {
                    skippedCount += 1;
                    continue;
                }
                const holidayDate = getStartOfDay(rawDate, timezone);

                const existing = await prisma.holiday.findUnique({
                    where: {
                        holidayCalendarId_date: {
                            holidayCalendarId: calendar.id,
                            date: holidayDate
                        }
                    }
                });
                if(existing) {
                    skippedCount += 1;
                    continue;
                }

                await prisma.holiday.create({
                    data: {
                        tenantId,
                        holidayCalendarId: calendar.id,
                        name: holidayName,
                        date: holidayDate,
                        isOptional: false
                    }
                });
                importedCount += 1;
            } catch (error) {
                failedCount += 1;
            }
        }
        return {
            attempted: true,
            importedCount,
            skippedCount,
            failedCount
        }
    }

    static async createHolidayCalendar(
        tenantId: string,
        payload: {
            name: string;
            regionType: "GLOBAL" | "COUNTRY" | "STATE" | "CITY" | "CUSTOM";
            country?: string;
            state?: string;
            city?: string;
            year?: number;
            isDefault?: boolean;
           isActive?: boolean;
        }
    ) {
        if(!["GLOBAL", "COUNTRY", "STATE", "CITY", "CUSTOM"].includes(payload.regionType)) {
            throw new Error("Invalid region type");
        }
        if(["COUNTRY", "STATE", "CITY"].includes(payload.regionType) && !payload.country?.trim()) {
            throw new Error("Country is required for the selected region type");
        }

        const year = payload.year ?? new Date().getFullYear();
        const calendar = await prisma.$transaction(async (tx) => {
            if(payload.isDefault){
                await tx.holidayCalendar.updateMany({
                    where: {
                        tenantId,
                        isDefault: true
                    },
                    data: {
                        isDefault: false
                    }
                })
            }
            
            return tx.holidayCalendar.create({
                data: {
                    tenantId,
                    name: payload.name,
                    regionType: payload.regionType,
                    country: payload.country ?? null,
                    state: payload.state ?? null,
                    city: payload.city ?? null,
                    year,
                    isDefault: payload.isDefault ?? false,
                    isActive: payload.isActive !== undefined ? payload.isActive : true
                }
            })
        });
        let importedSummary = {
            attempted: false,
            importedCount: 0,
            skippedCount: 0,
            failedCount: 0
        }
        if(!["GLOBAL", "CUSTOM"].includes(calendar.regionType)){
            importedSummary = await this.importHolidayCalendarYear(tenantId, {
                holidayCalendarId: calendar.id,
                year
            });
        }

        const fullCalendar = await prisma.holidayCalendar.findUnique({
            where: { 
                id: calendar.id,
                tenantId
            },
            include: {
                holidays: {
                    orderBy: { date: "asc" }
                },
                _count: {
                    select: {
                        holidays: true
                    }
                }
            }
        });

        return {
            ...fullCalendar,
            importedSummary
        }
    }

    static async createHoliday(
        tenantId: string,
        payload: {
            holidayCalendarId: string;
            name: string;
            date: string;
            isOptional?: boolean;
        }
    ) {
        if(!payload.holidayCalendarId) {
            throw new Error("Holiday calendar ID is required");
        }
        if(!payload.name?.trim()) {
            throw new Error("Holiday name is required");
        }
        if(!payload.date?.trim()) {
            throw new Error("Holiday date is required");
        }

        const calendar = await prisma.holidayCalendar.findFirst({
            where: {
                id: payload.holidayCalendarId,
                tenantId
            }
        });
        if(!calendar) {
            throw new Error("Holiday calendar not found");
        }
        const timezone = await getTenantTimezone(tenantId);
        const parsedDate = new Date(payload.date);

        if(Number.isNaN(parsedDate.getTime())) {
            throw new Error("Invalid date format");
        }
        const holidayDate = getStartOfDay(parsedDate, timezone);

        const existing = await prisma.holiday.findUnique({
            where: {
                holidayCalendarId_date: {
                    holidayCalendarId: calendar.id,
                    date: holidayDate
                }
            }
        });
        if(existing) {
            throw new Error(
                `Holiday already exists on ${holidayDate.toISOString().slice(0, 10)} for this calendar`
            );
        }

        return prisma.holiday.create({
            data: {
                tenantId,
                holidayCalendarId: payload.holidayCalendarId,
                name: payload.name.trim(),
                date: holidayDate,
                isOptional: payload.isOptional ?? false
            }
        })
    }

    static async getHolidaysCalendars(tenantId: string) {
        return prisma.holidayCalendar.findMany({
            where: { tenantId },
            include: {
                holidays: {
                    orderBy: { date: "asc" }
                },
                _count: {
                    select: {
                        holidays: true
                    }
                }
            },
            orderBy: [
                { isDefault: "desc" },
                { createdAt: "desc" }
            ]
        })
    }

    static async getActiveHolidayCalendar(tenantId: string) {
        return prisma.holidayCalendar.findFirst({
            where: {
                tenantId,
                isDefault: true,
                isActive: true
            },
            include: {
                holidays: {
                    orderBy: { date: "asc" }
                }
            }
        });
    }

    static async deleteHolidayCalendar(tenantId: string, calendarId: string) {
        const calendar = await prisma.holidayCalendar.findFirst({
            where: {
                id: calendarId,
                tenantId
            }
        });

        if(!calendar) {
            throw new Error("Holiday calendar not found");
        }

        return prisma.$transaction(async (tx) => {
            //removing reference from leave policy rule 
            await tx.leavePolicyRule.updateMany({
                where: {
                    regionHolidayCalenderId: calendarId
                },
                data: {
                    regionHolidayCalenderId: null
                }
            });

            //delete holiday inside this calendar
            await tx.holiday.deleteMany(
                {
                    where: {
                        holidayCalendarId: calendarId
                    }
                }
            );

            //delete calendar
            await tx.holidayCalendar.delete({
                where: {
                    id: calendarId,
                }
            });

            return {
                success: true,
                message: "Holiday calendar approved successfully",
            }
        })
    }

    static async updateWorkWeek(
        tenantId: string,
        workingDays: string[]
    ) {
        return prisma.setting.upsert({
            where: {
                tenantId_key: {
                    tenantId,
                    key: "WORK_WEEK"
                }
            },
            update: {
                value: { workingDays }
            },
            create: {
                tenantId,
                key: "WORK_WEEK",
                value: { workingDays }
            }
        })
    }
    static async getWorkWeek(tenantId: string) {
        const row = await prisma.setting.findUnique({
            where: {
                tenantId_key: {
                    tenantId,
                    key: "WORK_WEEK"
                }
            }
        });
        if(!row) {
            return {
                workingDays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]
            }
        }
        return row.value;
    }
    private static getWeekdayName(date: Date) {
        const map = [
        "SUNDAY",
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
        "SATURDAY"
        ];
        return map[date.getDay()];
    }
    private static async getWorkingDays(tenantId: string){
        const row = await prisma.setting.findUnique({
            where: {
                tenantId_key: {
                    tenantId,
                    key: "WORK_WEEK"
                }
            }
        });
        if(!row?.value || typeof row.value !== "object"){
            return ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];
        }
        return ((row.value as any).workingDays ?? [
            "MONDAY",
            "TUESDAY",
            "WEDNESDAY",
            "THURSDAY",
            "FRIDAY"
        ]) as string[];
    }
    private static isOnProbation(joiningDate?: Date | null, probationMonths?: number | null) {
        if(!joiningDate || !probationMonths) return false;
        const probationEndDate = new Date(joiningDate);
        probationEndDate.setMonth(probationEndDate.getMonth() + probationMonths);
        const today = new Date();
        return today < probationEndDate;
    }
    private static calculateAccruedAllocation(
        annualAllocation: number,
        accrualFrequency: string | null,
        accrualAmount: number | null,
        joiningDate?: Date | null,
        currentDate = new Date()
    ) {
        if(!accrualFrequency || !accrualAmount){
            return annualAllocation;
        }
        if(!joiningDate){
            return annualAllocation;
        }
        const months = 
        (currentDate.getFullYear() - joiningDate.getFullYear()) * 12 +
        (currentDate.getMonth() - joiningDate.getMonth());

        if(accrualFrequency === "MONTHLY") {
            const accrued = (Math.floor(months) + 1) * accrualAmount;
            return Math.min(annualAllocation, accrued);
        }
        if(accrualFrequency === "QUARTERLY") {
            const accrued = (Math.floor(months / 3) + 1) * accrualAmount;
            return Math.min(annualAllocation, accrued);
        }
        return annualAllocation;

    }
    private static enumerateDates(startDate: Date, endDate: Date) {
        const dates: Date[] = [];
        const cursor = new Date(startDate);
        while(cursor <= endDate) {
            dates.push(new Date(cursor));
            cursor.setDate(cursor.getDate() + 1);
        }
        return dates;
    }
    private static calculateLeaveDays(
        dates: Date[],
        holidays: Date[],
        workingDays: string[],
        countMode: string,
        sandwichLeaveAllowed: boolean
    ) {
        const holidaySet = new Set(holidays.map(d => new Date(d).toDateString()));
        if(countMode === "CALENDAR_DAYS") {
            return dates.length;
        }
        let leaveDays = 0;
        for(const date of dates) {
            const dayName = this.getWeekdayName(date);
            const isHoliday = holidaySet.has(date.toDateString());
            const isWorkingDay = workingDays.includes(dayName);

            if(sandwichLeaveAllowed){
                leaveDays += 1;
                continue;
            }
            if(isWorkingDay && !isHoliday) {
                leaveDays += 1;
            }
        }
        return leaveDays;
    }
    private static async resolveApplicablePolicy(tenantId: string, userId: string) {
        const user = await prisma.user.findFirst({
        where: { id: userId, tenantId },
        include: {
            department: true,
            employeeProfile: true
        }
        });

        if (!user) {
        throw new AppError("User not found in tenant", 404);
        }

        const employmentType = user.employeeProfile?.employmentType ?? EmploymentType.OTHER;

        const leavePolicy = await prisma.leavePolicy.findFirst({
        where: {
            tenantId,
            isActive: true,
            employmentType
        },
        include: {
            rules: {
            include: {
                leaveType: true,
                holidayCalendar: {
                include: { holidays: true }
                }
            }
            }
        },
        orderBy: { createdAt: "desc" }
        });

        // Fallback to a general (null employmentType) policy if no type-specific one exists
        if (!leavePolicy) {
            const fallbackPolicy = await prisma.leavePolicy.findFirst({
            where: {
                tenantId,
                isActive: true,
                employmentType: null
            },
            include: {
                rules: {
                include: {
                    leaveType: true,
                    holidayCalendar: {
                    include: { holidays: true }
                    }
                }
                }
            },
            orderBy: { createdAt: "desc" }
            });
            if (!fallbackPolicy) {
                throw new AppError("No active leave policy found");
            }
            return { user, leavePolicy: fallbackPolicy };
        }

        return { user, leavePolicy };
    }
    private static async resolveApprovalPolicy(
        tenantId: string,
        user: ActorUser | null,
        leaveTypeId: string | null,
        leavePolicyId?: string | null
    ) {
        // 1. Most specific: leavePolicy + leaveType + department + designation
        let policy = await prisma.leaveApprovalPolicy.findFirst({
            where: {
                tenantId,
                isActive: true,
                leavePolicyId: leavePolicyId ?? null,
                leaveTypeId: leaveTypeId ?? null,
                departmentId: user?.departmentId ?? null,
                designationId: user?.designationId ?? null
            },
            include: {
                levels: {
                    orderBy: { level: "asc" }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        if (policy) return policy;

        // 2. leavePolicy + leaveType + designation
        policy = await prisma.leaveApprovalPolicy.findFirst({
            where: {
                tenantId,
                isActive: true,
                leavePolicyId: leavePolicyId ?? null,
                leaveTypeId: leaveTypeId ?? null,
                designationId: user?.designationId ?? null,
                departmentId: null
            },
            include: {
                levels: {
                    orderBy: { level: "asc" }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        if (policy) return policy;

        // 3. leavePolicy + leaveType + department
        policy = await prisma.leaveApprovalPolicy.findFirst({
            where: {
                tenantId,
                isActive: true,
                leavePolicyId: leavePolicyId ?? null,
                leaveTypeId: leaveTypeId ?? null,
                departmentId: user?.departmentId ?? null,
                designationId: null
            },
            include: {
                levels: {
                    orderBy: { level: "asc" }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        if (policy) return policy;

        // 4. leavePolicy + leaveType
        policy = await prisma.leaveApprovalPolicy.findFirst({
            where: {
                tenantId,
                isActive: true,
                leavePolicyId: leavePolicyId ?? null,
                leaveTypeId: leaveTypeId ?? null,
                departmentId: null,
                designationId: null
            },
            include: {
                levels: {
                    orderBy: { level: "asc" }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        if (policy) return policy;

        // 5. leavePolicy only fallback
        policy = await prisma.leaveApprovalPolicy.findFirst({
            where: {
                tenantId,
                isActive: true,
                leavePolicyId: leavePolicyId ?? null,
                leaveTypeId: null,
                departmentId: null,
                designationId: null
            },
            include: {
                levels: {
                    orderBy: { level: "asc" }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        return policy;
    }
    private static async resolveApproverIds(
        tx: Prisma.TransactionClient,
        tenantId: string,
        applicant: ActorUser,
        level: {
            approverType: LeaveApproverType;
            roleId?: string | null;
            userId?: string | null;
        }
    ):Promise<string[]> {
        switch (level.approverType){
            case "REPORTING_MANAGER":
                return applicant.managerId ? [applicant.managerId] : [];
            case "DEPARTMENT_MANAGER":
                return applicant.department?.managerId ? [applicant.department.managerId] : [];
            case "COMPANY_ADMIN": {
                const admins = await tx.userRole.findMany({
                    where: {
                        role: {
                            tenantId,
                            name: "COMPANY_ADMIN",
                            type: "TENANT"
                        }
                    },
                    select: { userId: true }
                });
                return admins.map(a => a.userId);
            }
            case "SPECIFIC_USER":
                return level.userId ? [level.userId] : [];
            case "ROLE": {
                if(!level.roleId) return [];
                const users = await tx.userRole.findMany({
                    where: {
                        roleId: level.roleId
                    },
                    select: { userId: true }
                });
                return users.map(u => u.userId);
            }
            default:
                return [];
        }
    }
    private static async recalculateLeaveBalance(
        tx: Prisma.TransactionClient,
        balanceId: string,
    ) {
        const balance = await tx.leaveBalance.findUnique({
            where: { id: balanceId },
        });
        if(!balance) return;

        const remainingDays =
        balance.allocatedDays +
        balance.carriedForwardDays -
        balance.usedDays;

        await tx.leaveBalance.update({
            where: { id: balanceId },
            data: { remainingDays }
        })
    }

    static async getMyLeaveBalance(
        tenantId: string,
        userId: string,
    ) {
        const timezone = await getTenantTimezone(tenantId);
        const now = getStartOfDay(new Date(), timezone);
        const year = now.getFullYear();

        const { user, leavePolicy } = await this.resolveApplicablePolicy(tenantId, userId);
        const onProbation = this.isOnProbation(
            user.employeeProfile?.joiningDate,
            leavePolicy.probationMonths
        );

        const existingBalances = await prisma.leaveBalance.findMany({
            where: {
                tenantId,
                userId,
                year
            },
            include: {
                leaveType: true
            }
        });

        const existingLeaveTypeIds = new Set(
            existingBalances.map((balance) => balance.leaveTypeId)
        );

        const ruleMap = new Map(
            leavePolicy.rules.map(rule => [rule.leaveTypeId, rule])
        );

        for (const balance of existingBalances) {
            const rule = ruleMap.get(balance.leaveTypeId);
            if (!rule) continue; // leave type no longer in policy — skip
            if (onProbation && !rule.allowDuringProbation) continue;

            // Recalculate correct allocation based on current policy rule
            const correctAllocatedDays = this.calculateAccruedAllocation(
                rule.annualAllocation,
                rule.accrualFrequency ?? "YEARLY",
                rule.accrualAmount,
                user.employeeProfile?.joiningDate ?? null,
                now
            );

            // Update only if the allocatedDays are stale (from an old/missing policy)
            if (balance.allocatedDays !== correctAllocatedDays) {
                const newRemaining = correctAllocatedDays
                    + balance.carriedForwardDays
                    - balance.usedDays;

                await prisma.leaveBalance.update({
                    where: { id: balance.id },
                    data: {
                        allocatedDays: correctAllocatedDays,
                        remainingDays: Math.max(0, newRemaining)
                    }
                });
            }
        }

        // Create balances for leave types in policy that don't have a record yet
        for (const rule of leavePolicy.rules) {
            if (onProbation && !rule.allowDuringProbation) {
                continue;
            }
            if (existingLeaveTypeIds.has(rule.leaveTypeId)) {
                continue;
            }

            const allocatedDays = this.calculateAccruedAllocation(
                rule.annualAllocation,
                rule.accrualFrequency ?? "YEARLY",
                rule.accrualAmount,
                user.employeeProfile?.joiningDate ?? null,
                now
            );

            await prisma.leaveBalance.create({
                data: {
                    tenantId,
                    userId,
                    leaveTypeId: rule.leaveTypeId,
                    year,
                    allocatedDays,
                    takenDays: 0,
                    carriedForwardDays: 0,
                    usedDays: 0,
                    remainingDays: allocatedDays
                }
            });
        }

        return prisma.leaveBalance.findMany({
            where: {
                tenantId,
                userId,
                year
            },
            include: {
                leaveType: true
            },
            orderBy: [
                { createdAt: "desc" }
            ]
        });
    }

    static async runYearlyCarryForward(
        tenantId: string,
        fromYear: number,
        toYear: number
    ) {
        //1 . fetch all leave balance of fromYear
        const balances = await prisma.leaveBalance.findMany({
            where: {
                tenantId,
                year: fromYear
            },
            include: {
                leaveType: true,
            }
        });

        //2. for each balance, check the policy rule if carry forward is allowed and calculate carry forward days
        for(const bal of balances) {
            const policyRule = await prisma.leavePolicyRule.findFirst({
                where: {
                    leaveTypeId: bal.leaveTypeId,
                    leavePolicy: {
                        tenantId,
                        isActive: true
                    }
                }
            });

            if(!policyRule) continue;

            let carryForwardDays = 0;

            if(policyRule.carryForwardAllowed) {
                carryForwardDays = Math.min(
                    bal.remainingDays,
                    policyRule.carryForwardLimit ?? bal.remainingDays
                )
            }

            // next year allocation will be same as annual allocation defined in policy
            const nextYearAllocation = policyRule.annualAllocation;

            // 3. update or create leave balance for toYear with carry forward days and new allocation
            await prisma.leaveBalance.upsert({
                where: {
                    tenantId_userId_leaveTypeId_year: {
                        tenantId,
                        userId: bal.userId,
                        leaveTypeId: bal.leaveTypeId,
                        year: toYear
                    }
                },
                update: {
                    allocatedDays: nextYearAllocation,
                    carriedForwardDays: carryForwardDays,
                    remainingDays: nextYearAllocation + carryForwardDays
                },
                create: {
                    tenantId,
                    userId: bal.userId,
                    leaveTypeId: bal.leaveTypeId,
                    year: toYear,
                    allocatedDays: nextYearAllocation,
                    takenDays: 0,
                    carriedForwardDays: carryForwardDays,
                    usedDays: 0,
                    remainingDays: nextYearAllocation + carryForwardDays
                }
            })
        }

        return {
            success: true,
            message: `Carry forward process completed from year ${fromYear} to ${toYear}`
        }
    }

    static async applyLeave(tenantId: string, userId: string, payload: {
        leaveTypeId: string;
        startDate: string;
        endDate: string;
        reason?: string;
        attachmentUrls?: string[];
    }){
        const timezone = await getTenantTimezone(tenantId);
        const { user, leavePolicy } = await this.resolveApplicablePolicy(tenantId, userId);

        const policyRule = leavePolicy.rules.find(r => r.leaveTypeId === payload.leaveTypeId);
        if(!policyRule) {
            throw new AppError("Leave type is not covered under your leave policy");
        }

        const startDate = getStartOfDay(new Date(payload.startDate), timezone);
        const endDate = getEndOfDay(new Date(payload.endDate), timezone);

        if(startDate > endDate) {
            throw new AppError("Start date cannot be after end date");
        }

        // check is the employee is on probation or not
        const onProbation = this.isOnProbation(
            user.employeeProfile?.joiningDate,
            user.employeeProfile?.probationMonths
        );
        // if on probation, check if the policy allows applying for this leave type
        if(onProbation && !policyRule.allowDuringProbation) {
            throw new AppError("You cannot apply for this leave type while on probation");
        }

        const today = getStartOfDay(new Date(), timezone);
        // check prior notice requirement days
        const minApplyDate = new Date(today);
        minApplyDate.setDate(minApplyDate.getDate() + (policyRule.priorNoticeDays ?? 0));

        if(startDate < minApplyDate) {
            throw new AppError(
                `You must apply for this leave at least ${policyRule.priorNoticeDays} days in advance`
            );
        }
        if(policyRule.attachmentRequired && !payload.attachmentUrls?.length) {
            throw new AppError("Attachment is required for this leave type");
        }

        // to avoid leave overlap
        const overlappingLeaves = await prisma.leaveRequest.findFirst({
            where: {
                tenantId,
                userId,
                status: { in: ["PENDING", "PARTIALLY_APPROVED", "APPROVED"] },
                startDate: { lte: endDate },
                endDate: { gte: startDate }
            }
        });
        if(overlappingLeaves) {
            throw new AppError("You have an overlapping leave request during this period");
        }

        // break down all days between start and end date
        const dates = this.enumerateDates(startDate, endDate);
        // get holidays and working days from policy
        const holidays = policyRule.holidayCalendar?.holidays.map(h => h.date) ?? [];
        const workingDays = await this.getWorkingDays(tenantId);

        const totalDays = this.calculateLeaveDays(
            dates,
            holidays,
            workingDays,
            policyRule.countMode,
            policyRule.sandwichLeaveAllowed,
        );
        if(totalDays <= 0) {
            throw new AppError("Invalid leave days");
        }
        if(policyRule.maxPerRequest && totalDays > policyRule.maxPerRequest) {
            throw new AppError(`Maximum leave per request is  ${policyRule.maxPerRequest} days`);
        }
        if(policyRule.maxConsecutiveDays && totalDays > policyRule.maxConsecutiveDays){
            throw new AppError(`Maximum consecutive leave is ${policyRule.maxConsecutiveDays} days`);
        }
        const year = startDate.getFullYear();

        // credited allocation for the year
        const accruedAllocation = this.calculateAccruedAllocation(
            policyRule.annualAllocation,
            policyRule.accrualFrequency ?? "YEARLY",
            policyRule.accrualAmount,
            user.employeeProfile?.joiningDate ?? null
        );

        // check leave balance
        const leaveBalance = await prisma.leaveBalance.upsert({
            where: {
                tenantId_userId_leaveTypeId_year: {
                    tenantId,
                    userId,
                    leaveTypeId: payload.leaveTypeId,
                    year
                }
            },
            update: {},
            create: {
                tenantId,
                userId,
                leaveTypeId: payload.leaveTypeId,
                year,
                allocatedDays: accruedAllocation,
                takenDays: 0,
                carriedForwardDays: 0,
                usedDays: 0,
                remainingDays: accruedAllocation
            }
        });
        // check rule and leave allow max per year
        if(policyRule.maxPerYear && leaveBalance.usedDays + totalDays > policyRule.maxPerYear){
            throw new AppError(`Maximum leave per year for this leave type is ${policyRule.maxPerYear} days`);
        }
        if(policyRule.isPaid && leaveBalance.remainingDays < totalDays) {
            throw new AppError(`Insufficient leave balance. Available: ${leaveBalance.remainingDays}`)
        }

        // fetch and attach approval policy to the leaveRequest
        const approvalPolicy = await this.resolveApprovalPolicy(
            tenantId,
            user,
            payload.leaveTypeId,
            leavePolicy.id,
        )

        const hasApprovalFlow = approvalPolicy?.levels?.length;

        return prisma.$transaction(async (tx) => {
            const leaveRequest = await tx.leaveRequest.create({
                data: {
                    tenantId,
                    userId,
                    leaveTypeId: payload.leaveTypeId,
                    leavePolicyId: leavePolicy.id,
                    leavePolicyRuleId: policyRule.id,
                    approvalPolicyId: approvalPolicy?.id ?? null,
                    startDate,
                    endDate,
                    totalDays,
                    reason: payload.reason || null,
                    attachmentUrls: payload.attachmentUrls ?? [],
                    status: hasApprovalFlow ? "PENDING" : "APPROVED",
                    currentApprovalLevel: hasApprovalFlow ? 1 : 0,
                    approvedAt: hasApprovalFlow ? null : new Date(),
                }
            });
            if(!hasApprovalFlow && policyRule.isPaid) {
                await tx.leaveBalance.update({
                    where: {
                        id: leaveBalance.id
                    },
                    data: {
                        takenDays: {
                            increment: totalDays
                        },
                        usedDays: {
                            increment: totalDays
                        },
                        // remainingDays: {
                        //     decrement: totalDays
                        // }
                    }
                })
                await this.recalculateLeaveBalance(tx, leaveBalance.id);
            }

            if(hasApprovalFlow){
                // create approval records for each level
                for(const level of approvalPolicy!.levels) {
                    const approverIds = await this.resolveApproverIds(
                        tx,
                        tenantId,
                        user,
                        {
                            approverType: level.approverType,
                            roleId: level.roleId,
                            userId: level.userId
                        }
                    );
                    const uniqueSet = [...new Set(approverIds)];
                    if(!uniqueSet.length) {
                        throw new AppError(
                            `No approvers found for level ${level.level} of the approval policy`
                        );
                    }
                    for(const approverId of uniqueSet) {
                        await tx.leaveApproval.create({
                            data: {
                                leaveRequestId: leaveRequest.id,
                                approverId,
                                level: level.level,
                                decision: "PENDING",
                            }
                        });

                    }
                }
            }
            return tx.leaveRequest.findUnique({
                where: { id: leaveRequest.id },
                include: {
                    user: { select: { id: true, name: true, email: true } },
                    leaveType: true,
                    leavePolicy: true, 
                    approvals: {
                        include: {
                            approver: {
                                select: { id: true, name: true, email: true }
                            }
                        },
                        orderBy: [{ level: "asc" }, { createdAt: "asc" }]
                    }
                }
            })
        })
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
                leavePolicy: true,
                approvals: {
                    include: {
                        approver: {
                            select: { id: true, name: true, email: true }
                        },
                    },
                    orderBy: { createdAt: "asc" }
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
        return prisma.$transaction(async (tx) => {
            const leaveRequest = await prisma.leaveRequest.findFirst({
                where: {
                    id: leaveRequestId,
                    tenantId
                },
                include: {
                    approvals: true,
                    leavePolicyRule: true
                }
            });

            if(!leaveRequest) {
                throw new AppError("Leave request not found", 404);
            }

            const approval = leaveRequest.approvals.find(
                (a) =>
                    a.approverId === approverId &&
                a.level === leaveRequest.currentApprovalLevel
            );
            if(!approval) {
                throw new AppError("You are not an approver for this leave request at the current level", 403);
            }

            if(approval.decision !== "PENDING") {
                throw new AppError("You have already acted on this leave request", 400);
            }

            //updating approval row
            await tx.leaveApproval.update({
                where: { id: approval.id },
                data: {
                    decision: "APPROVE",
                    remarks: remarks || null,
                    actedAt: new Date(),
                }
            });

            const currentLevelApprovals = await tx.leaveApproval.findMany({
                where: {
                    leaveRequestId,
                    level: leaveRequest.currentApprovalLevel
                }
            });
            const hasPendingCurrentLevel = currentLevelApprovals.some(a => a.decision === "PENDING");

            if(hasPendingCurrentLevel){
                await tx.leaveRequest.update({
                    where: { id: leaveRequestId },
                    data: {
                        status: "PARTIALLY_APPROVED"
                    }
                })
                return {
                    success: true,
                    message: "You have approved this leave request. Waiting for other approvers at the same level to act."
                }
            }

            const nextlevelApprovals = await tx.leaveApproval.findFirst({
                where: {
                    leaveRequestId,
                    level: {
                        gt: leaveRequest.currentApprovalLevel
                    }
                },
                orderBy: { level: "asc" }
            })

            if(nextlevelApprovals) {
                await tx.leaveRequest.update({
                    where: { id: leaveRequestId },
                    data: {
                        status: "PARTIALLY_APPROVED",
                        currentApprovalLevel: nextlevelApprovals.level
                    }
                })
                return {
                    success: true,
                    message: "You have approved this leave request. It has been moved to the next approval level."
                }
            }

            await tx.leaveRequest.update({
                where: { id: leaveRequestId },
                data: {
                    status: "APPROVED",
                    approvedAt: new Date(),
                    currentApprovalLevel: 0
                }
            });

            await AttendService.syncAttendanceForApprovedLeave(
                tenantId,
                leaveRequest.userId,
                leaveRequest.id
            )

            if(leaveRequest.leavePolicyRule?.isPaid) {
                const balance = await tx.leaveBalance.findFirst({
                    where: {
                        tenantId,
                        userId: leaveRequest.userId,
                        leaveTypeId: leaveRequest.leaveTypeId,
                        year: leaveRequest.startDate.getFullYear()
                    }
                });
                if(!balance){
                    throw new AppError("Leave balance not found for the user and leave type", 404);
                }

                await tx.leaveBalance.update({
                    where: { id: balance.id },
                    data: {
                        takenDays: {
                            increment: leaveRequest.totalDays
                        },
                        usedDays: {
                            increment: leaveRequest.totalDays
                        },
                    }
                })

                await this.recalculateLeaveBalance(tx, balance.id);
            }

            return {
                success: true,
                message: "Leave request has been fully approved"
            }
        })
        
    }
    static async rejectLeave (
        tenantId: string,
        approverId: string,
        leaveRequestId: string,
        remarks?: string
    ) {

        return prisma.$transaction(async (tx) => {
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
                throw new AppError("Leave request not found", 404);
            }

            const approval = leaveRequest.approvals.find(
                (a) =>
                    a.approverId === approverId &&
                a.level === leaveRequest.currentApprovalLevel
            );

            if(!approval) {
                throw new AppError("You are not an approver for this leave request at the current level", 403);
            }

            if(approval.decision !== "PENDING") {
                throw new AppError("You have already acted on this leave request", 400);
            }

            await tx.leaveApproval.update({
                where: { id: approval.id },
                data: {
                    decision: "REJECT",
                    remarks: remarks ?? null,
                    actedAt: new Date(),
                }
            })
            await tx.leaveRequest.update({
                where: { id: leaveRequestId },
                data: {
                    status: "REJECTED",
                    rejectedAt: new Date(),
                    currentApprovalLevel: 0
                }
            })

            return {
                success: true,
            }
        })
        
    }
    static async cancelLeaveRequest(
        tenantId: string, userId: string, leaveRequestId: string, reason: string
    ) {
        return prisma.$transaction(async (tx) => {
            const leaveRequest = await prisma.leaveRequest.findUnique({
                where: {
                    id: leaveRequestId,
                    tenantId,
                    userId
                },
            });

            if(!leaveRequest) {
                throw new AppError("Leave request not found", 404);
            }

            if(!["PENDING", "PARTIALLY_APPROVED"].includes(leaveRequest.status)) {
                throw new AppError("Only pending or partially approved leave requests can be cancelled", 400);
            }

            await tx.leaveRequest.update({
                where: { id: leaveRequestId },
                data: {
                    status: "CANCELLED",
                    reason: reason ?? null,
                    currentApprovalLevel: 0
                }
            })

            await tx.leaveApproval.updateMany({
                where: {
                    leaveRequestId,
                    decision: "PENDING"
                },
                data: {
                    remarks: "Leave request cancelled by applicant",
                    actedAt: new Date(),
                }
            })
            return {
                success: true,
            }
        })
    }
}