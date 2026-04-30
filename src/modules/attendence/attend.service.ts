import { prisma } from "../../config/db/prisma";
import { diffInMinutes, getEndOfDay, getStartOfDay, getTenantTimezone, parseTimeToDate } from "../utils/util";

type AttendanceResolvedDay = {
    date: Date;
    status:
    | "PRESENT"
    | "ABSENT"
    | "LATE"
    | "HALF_DAY"
    | "ON_LEAVE"
    | "HOLIDAY"
    | "WEEK_OFF";
    leaveRequestId?: string;
    isPaidLeave?: boolean;
    isHoliday?: boolean;
    isWeekOff?: boolean;
    remarks?: string | null;
}

type AttendanceLocationInput = {
    lat?: number;
    lng?: number;
    address?: string;
}

export class AttendService {
    static async getTenantConfig(tenantId: string){
        return await prisma.attendanceConfig.findUnique({
            where: { tenantId }
        });
    }
    static async upsertAttendanceConfig(tenantId: string, payload: {
        checkInTime: string,
        checkOutTime: string,
        graceMinutes?: number,
        halfDayMinutes?: number,
        fullDayMinutes?: number,
        locationEnabled?: boolean,
        workingDays?: string[]
    }) {
        return await prisma.attendanceConfig.upsert({
            where: { tenantId },
            update: {
                checkInTime: payload.checkInTime,
                checkOutTime: payload.checkOutTime,
                graceMinutes: payload.graceMinutes ?? 30,
                halfDayMinutes: payload.halfDayMinutes ?? 240,
                fullDayMinutes: payload.fullDayMinutes ?? 480,
                locationEnabled: payload.locationEnabled ?? false,
                workingDays: payload.workingDays ?? ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]
            },
            create: {
                tenantId,
                checkInTime: payload.checkInTime,
                checkOutTime: payload.checkOutTime,
                graceMinutes: payload.graceMinutes ?? 30,
                halfDayMinutes: payload.halfDayMinutes ?? 240,
                fullDayMinutes: payload.fullDayMinutes ?? 480,
                locationEnabled: payload.locationEnabled ?? false,
                workingDays: payload.workingDays ?? ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]
            }
        })
    }

    private static weekdayCode(date: Date, timezone: string) {
        const weekday = new Intl.DateTimeFormat("en-US", {
            weekday: "long",
            timeZone: timezone
        }).format(date).toUpperCase();

        const map: Record<string, string> = {
            "SUNDAY": "SUNDAY",
            "MONDAY": "MONDAY",
            "TUESDAY": "TUESDAY",
            "WEDNESDAY": "WEDNESDAY",
            "THURSDAY": "THURSDAY",
            "FRIDAY": "FRIDAY",
            "SATURDAY": "SATURDAY"
        }
        return map[weekday];
    }

    private static getHolidayForDay(tenantId: string, date: Date) {
        return prisma.holiday.findFirst({
            where: {
                tenantId,
                date
            },
            include: {
                holidayCalendar: {
                    select: {
                        id: true,
                        name: true,
                        isActive: true
                    }
                }
            }
        })
    }

    private static async getApprovedLeaveForDate(
        tenantId: string,
        userId: string,
        date: Date
    ) {
        return prisma.leaveRequest.findFirst({
            where: {
                tenantId,
                userId,
                status: "APPROVED",
                startDate: { lte: date },
                endDate: { gte: date }
            },
            include: {
                leaveType: true,
                leavePolicyRule: {
                    select: {
                        isPaid: true
                    }
                }
            }
        })
    }

    static async resolveAttendanceDay(
        tenantId: string,
        userId: string,
        dateInput?: Date
    ): Promise<AttendanceResolvedDay> {
        const timezone = await getTenantTimezone(tenantId);
        const baseDate = dateInput ?? new Date();
        const date = getStartOfDay(baseDate, timezone);

        const config = await this.getTenantConfig(tenantId);

        if(!config) {
            throw new Error("Attendance configuration not found for tenant");
        }

        const workingDays = Array.isArray(config.workingDays)
        ? (config.workingDays as string[])
        : ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];

        const weekDay = this.weekdayCode(date, timezone);
        const isWorkingDay = workingDays.includes(weekDay);

        if(!isWorkingDay){
            return {
                date,
                status: "WEEK_OFF",
                isWeekOff: true,
                remarks: "Auto resolved as week-off"
            }
        }

        const holiday = await this.getHolidayForDay(tenantId, date);
        if(holiday && holiday.holidayCalendar?.isActive){
            return {
                date,
                status: "HOLIDAY",
                isHoliday: true,
                remarks: `Holiday: ${holiday.name}`
            }
        }

        const leave = await this.getApprovedLeaveForDate(tenantId, userId, date);
        if(leave){
            return {
                date,
                status: "ON_LEAVE",
                leaveRequestId: leave.id,
                isPaidLeave: leave.leavePolicyRule?.isPaid ?? false,
                remarks: `On Leave: ${leave.leaveType.name}`
            }
        }

        return {
            date,
            status: "ABSENT",
            remarks: "No holiday/leave applied & no attendance punch yet"
        }

    }

    static async syncAttendanceForApprovedLeave(
        tenantId: string,
        userId: string,
        leaveRequestId: string,
    ) {
        const leaveRequest = await prisma.leaveRequest.findUnique({
            where: { id: leaveRequestId },
            include: {
                leaveType: true,
                leavePolicyRule: true
            }
        });

        if(!leaveRequest || leaveRequest.status !== "APPROVED"){
            throw new Error("Approved leave request not found");
        }
        if (leaveRequest.tenantId !== tenantId) {
            throw new Error("Leave request does not belong to this tenant");
        }

        if (leaveRequest.userId !== userId) {
            throw new Error("Leave request does not belong to this user");
        }

        const timezone = await getTenantTimezone(tenantId);
        const start = getStartOfDay(leaveRequest.startDate, timezone);
        const end = getEndOfDay(leaveRequest.endDate, timezone);

        const dates: Date[] = [];
        const cursor = new Date(start);

        while(cursor <= end){
            dates.push(getStartOfDay(cursor, timezone));
            cursor.setDate(cursor.getDate() + 1);
        }

        await prisma.$transaction(async (tx) => {
            for(const date of dates){
                const [existingAttendance, holiday] = await Promise.all([
                    tx.attendance.findUnique({
                        where: {
                            userId_date: {
                            userId,
                            date
                            }
                        }
                    }),
                    tx.holiday.findFirst({
                        where: {
                            tenantId,
                            date: {
                                gte: start,
                                lte: end
                            }
                        }
                    })
                ]);

                // 1) Holiday wins over leave
                if (holiday) {
                    await tx.attendance.upsert({
                    where: {
                        userId_date: {
                        userId,
                        date
                        }
                    },
                    update: {
                        status: "HOLIDAY",
                        leaveRequestId: null,
                        isOnApprovedLeave: false,
                        isPaidLeave: false,
                        isHoliday: true,
                        isWeekOff: false,
                        remarks: `Holiday: ${holiday.name}`
                    },
                    create: {
                        tenantId,
                        userId,
                        date,
                        status: "HOLIDAY",
                        workedMinutes: 0,
                        leaveRequestId: null,
                        isOnApprovedLeave: false,
                        isPaidLeave: false,
                        isHoliday: true,
                        isWeekOff: false,
                        remarks: `Holiday: ${holiday.name}`
                    }
                    });

                    continue;
                }

                // 2) If employee has already punched attendance, don't overwrite blindly
                if (existingAttendance?.checkInAt || existingAttendance?.checkOutAt) {
                    // Minimal safe behavior: keep actual attendance and skip syncing
                    // You can also log this somewhere later for conflict handling
                    continue;
                }

                // 3) If already marked as week off, don't overwrite
                if (existingAttendance?.status === "WEEK_OFF" || existingAttendance?.isWeekOff) {
                    continue;
                }

                // 4) If already marked as holiday, don't overwrite
                if (existingAttendance?.status === "HOLIDAY" || existingAttendance?.isHoliday) {
                    continue;
                }

                await tx.attendance.upsert({
                    where: {
                        userId_date: {
                            userId,
                            date
                        }
                    },
                    update: {
                        status: leaveRequest.totalDays === 0.5 ? "HALF_DAY" : "ON_LEAVE",
                        leaveRequestId: leaveRequest.id,
                        isOnApprovedLeave: true,
                        isPaidLeave: leaveRequest.leavePolicyRule?.isPaid ?? false,
                        isHoliday: false,
                        isWeekOff: false,
                        remarks: `Auto-synced from approved leave: ${leaveRequest.leaveType.name}`
                    },
                    create: {
                        tenantId,
                        userId,
                        date,
                        status: leaveRequest.totalDays === 0.5 ? "HALF_DAY" : "ON_LEAVE",
                        leaveRequestId: leaveRequest.id,
                        isOnApprovedLeave: true,
                        workedMinutes: 0,
                        isPaidLeave: leaveRequest.leavePolicyRule?.isPaid ?? false,
                        isHoliday: false,
                        isWeekOff: false,
                        remarks: `Auto-synced from approved leave: ${leaveRequest.leaveType.name}`
                    }
                })
            }
        })

    }


    static async resolveToday(tenantId: string, userId: string) {
        return this.resolveAttendanceDay(tenantId, userId, new Date());
    }




    static async checkIn(tenantId: string, userId: string, location?: AttendanceLocationInput) {
        const config = await this.getTenantConfig(tenantId);
        if (!config) {
            throw new Error("Attendance configuration not found for tenant");
        }
        const timezone = await getTenantTimezone(tenantId);
        const now = new Date();
        const today = getStartOfDay(now, timezone);

        if(config.locationEnabled) {
            if(
                location?.lat === undefined ||
                location?.lng === undefined ||
                Number.isNaN(Number(location.lat)) ||
                Number.isNaN(Number(location.lng))
            ) {
                throw new Error("Invalid location coordinates");
            }
        }

        const resolved = await this.resolveAttendanceDay(tenantId, userId, today);

        if(resolved.status === "ON_LEAVE") {
            throw new Error("Cannot check in while on approved leave");
        }

        if(resolved.status === "HOLIDAY") {
            throw new Error("Cannot check in on a holiday");
        }


        const scheduleCheckIn = parseTimeToDate(today, config.checkInTime, timezone);
        const lateThreshold = new Date(
            scheduleCheckIn.getTime() + (config.graceMinutes ?? 30) * 60000
        );

        const existing = await prisma.attendance.findUnique({
            where: {
                userId_date: {
                    userId,
                    date: today
                }
            }
        });
        if (existing?.checkInAt) {
            throw new Error("Already checked in for today");
        }

        const isLate = now > lateThreshold;
        const status = isLate ? "LATE" : "PRESENT";

        return prisma.attendance.upsert({
            where: {
                userId_date: {
                    userId,
                    date: today
                },
            },
            update: {
                checkInAt: now,
                isLate,
                status,
                checkInLat: location?.lat !== undefined ? location.lat : existing?.checkInLat,
                checkInLng: location?.lng !== undefined ? location.lng : existing?.checkInLng,
                checkInAddress: location?.address !== undefined ? location.address : existing?.checkInAddress,
                leaveRequestId: null,
                isOnApprovedLeave: false,
                isHoliday: false,
                isWeekOff: false,
            },
            create: {
                tenantId,
                userId,
                date: today,
                checkInAt: now,
                isLate,
                status,
                workedMinutes: 0,
                isOnApprovedLeave: false,
                isPaidLeave: false,
                isHoliday: false,
                isWeekOff: false,
                checkInLat: location?.lat !== undefined ? location.lat : undefined,
                checkInLng: location?.lng !== undefined ? location.lng : undefined,
                checkInAddress: location?.address !== undefined ? location.address : undefined,
            }
        })
    }

    static async checkOut (tenantId: string, userId: string, location?: AttendanceLocationInput) {
        const config = await this.getTenantConfig(tenantId);
        if (!config) {
            throw new Error("Attendance configuration not found for tenant");
        }
        const timezone = await getTenantTimezone(tenantId);
        const now = new Date();
        const today = getStartOfDay(now, timezone);

        if(config.locationEnabled) {
            if(
                location?.lat === undefined ||
                location?.lng === undefined ||
                Number.isNaN(Number(location.lat)) ||
                Number.isNaN(Number(location.lng))
            ) {
                throw new Error("Invalid location coordinates");
            }
        }

        const attendance = await prisma.attendance.findUnique({
            where: {
                userId_date: {
                    userId,
                    date: today
                }
            }
        });
        if (!attendance || !attendance.checkInAt) {
            throw new Error("Check-in record not found for today");
        }
        if (attendance.checkOutAt) {
            throw new Error("Already checked out for today");
        }
        if (attendance.status === "ON_LEAVE" || attendance.isOnApprovedLeave) {
            throw new Error("Cannot check out on an approved leave day");
        }

        const workedMinutes = diffInMinutes(attendance.checkInAt, now);

        let finalStatus: "PRESENT" | "LATE" | "HALF_DAY" | "ABSENT" = attendance.isLate
            ? "LATE" : "PRESENT";
        
        // if(attendance.checkInAt > scheduledCheckOut){
        //     finalStatus = "ABSENT";
        // } else
        if (workedMinutes < (config.halfDayMinutes ?? 240)) {
            finalStatus = "ABSENT";
        } else if(workedMinutes < (config.fullDayMinutes ?? 480)){
            finalStatus = "HALF_DAY";
        } else {
            finalStatus = attendance.isLate ? "LATE" : "PRESENT";
        }

        await prisma.attendance.update({
            where: {
                id: attendance.id
            },
            data: {
                checkOutAt: now,
                workedMinutes,
                status: finalStatus,

                checkOutLat: location?.lat !== undefined ? location.lat : attendance.checkOutLat,
                checkOutLng: location?.lng !== undefined ? location.lng : attendance.checkOutLng,
                checkOutAddress: location?.address !== undefined ? location.address : attendance.checkOutAddress,
            }
        })
        await this.resolveAttendanceDay(tenantId, userId, today);

        return prisma.attendance.findUnique({
            where: {
                id: attendance.id
            }
        })
    }




    static async getTodaysAttendance(tenantId: string, userId?: string) {
        const timezone = await getTenantTimezone(tenantId);
        const today = getStartOfDay(new Date(), timezone);

        return prisma.attendance.findMany({
            where: {
                tenantId,
                date: today,
                ...(userId ? { userId } : {})
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                leaveRequest: {
                    select: {
                        id: true,
                        status: true,
                        totalDays: true,
                        leaveType: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                updatedAt: "desc"
            }
        })
    }


    static async getHistory(
        tenantId: string,
        params: {
            userId?: string,
            startDate?: string,
            endDate?: string,
            status?: string
        }
    ) {
        const where: any = {
            tenantId,
            ...(params.userId ? { userId: params.userId } : {}),
        };
        const timezone = await getTenantTimezone(tenantId);

        if(params.startDate || params.endDate) {
            where.date = {};
            if(params.startDate) {
                where.date.gte = getStartOfDay(new Date(params.startDate), timezone);
            }
            if(params.endDate) {
                where.date.lte = getEndOfDay(new Date(params.endDate), timezone);
            }
        }
        if(params.status){
            where.status = params.status;
        }

        return prisma.attendance.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                leaveRequest: {
                    select: {
                        id: true,
                        status: true,
                        totalDays: true,
                        leaveType: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                date: "desc"
            }
        })
    }


    static async getMonthSummary(
        tenantId: string,
        userId?: string,
        month?: number,
        year?: number
    ) {
        const now = new Date();
        const selectedMonth = month ?? now.getMonth() + 1;
        const selectedYear = year ?? now.getFullYear();

        const startDate = new Date(selectedYear, selectedMonth - 1, 1);
        const endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);

        const records = await prisma.attendance.findMany({
            where: {
                tenantId,
                ...(userId ? { userId } : {}),
                date: {
                    gte: startDate,
                    lte: endDate
                }
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            },
            orderBy: {
                date: "asc"
            }
        });


        const summary = (items: typeof records) => {
            const totalPresentDays = items.filter((r) => 
            ["PRESENT", "LATE"].includes(r.status)
            ).length;
    
            const totalLateDays = items.filter((r) => r.status === "LATE").length;
            const totalAbsentDays = items.filter((r) => r.status === "ABSENT").length;
            const totalHalfDays = items.filter((r) => r.status === "HALF_DAY").length;
            const totalOnLeaveDays = items.filter((r) => r.status === "ON_LEAVE").length;
            const totalPaidLeaveDays = items.filter(
                (r) => r.status === "ON_LEAVE" && r.isPaidLeave
            ).length;
            const totalUnpaidLeaveDays = items.filter(
                (r) => r.status === "ON_LEAVE" && !r.isPaidLeave
            ).length;
            const totalHolidayDays = items.filter((r) => r.status === "HOLIDAY").length;
            const totalWeekOffDays = items.filter((r) => r.status === "WEEK_OFF").length;

            const totalWorkedMinutes = items.reduce(
                (sum, r) => sum + (r.workedMinutes ?? 0), 0
            );
    
            const payableDays = totalPresentDays + totalHalfDays * 0.5 + totalPaidLeaveDays + totalHolidayDays + totalWeekOffDays;

            return {
                totalPresentDays,
                totalLateDays,
                totalAbsentDays,
                totalHalfDays,
                totalOnLeaveDays,
                totalPaidLeaveDays,
                totalUnpaidLeaveDays,
                totalHolidayDays,
                totalWeekOffDays,
                totalWorkedMinutes,
                payableDays
            };
        }

        /** ------ Summary for one specific user ------ */
        if(userId){
            return {
                userId,
                month: selectedMonth,
                year: selectedYear,
                ...summary(records)
            }
        }

        /**------------------ Summary For All users --------------------- */
        const summaryMap = new Map<string, any>();

        for(const record of records){
            const key = record.userId;

            if(!summaryMap.has(key)){
                summaryMap.set(key, {
                    userId: record.userId,
                    name: record.user.name,
                    email: record.user.email,
                    records: [] as typeof records,
                })
                summaryMap.get(key).records.push(record);
            }

            return {
                month: selectedMonth,
                year: selectedYear,
                users: Array.from(summaryMap.values()).map((entry) => ({
                    userId: entry.userId,
                    name: entry.name,
                    email: entry.email,
                    ...summary(entry.records)
                }))
            }
        }
    }

    static async markOutDuty(actor: any, payload: {
        userId: string;
        startDate: string;
        endDate: string;
        reason: string;
    }) {
        if(!actor?.tenantId){
            throw new Error("Actor tenant context missing");
        }

        const config = await this.getTenantConfig(actor.tenantId);
        if (!config) {
            throw new Error("Attendance configuration not found for tenant");
        }

        const timezone = await getTenantTimezone(actor.tenantId);

        const start = getStartOfDay(new Date(payload.startDate), timezone);
        const end = getEndOfDay(new Date(payload.endDate), timezone);

        // find the targeted user
        const targetedUser = await prisma.user.findFirst({
            where: {
                id: payload.userId,
                tenantId: actor.tenantId,
                isActive: true
            }
        });

        if(!targetedUser){
            throw new Error("Targeted user not found in tenant");
        }

        // find attendances for the user in the given date range
        const dates: Date[] = [];
        const cursor = new Date(start);

        while(cursor <= end){
            dates.push(getStartOfDay(cursor, timezone));
            cursor.setDate(cursor.getDate() + 1);
        }

        return prisma.$transaction(async (tx) => {
            const outDuty = await tx.outDuty.create({
                data: {
                    tenantId: actor.tenantId,
                    userId: payload.userId,
                    markedById: actor.id,
                    startDate: start,
                    endDate: end,
                    reason: payload.reason
                }
            });

            for(const date of dates){
                const resolvedAttendance = await this.resolveAttendanceDay(
                    actor.tenantId,
                    payload.userId,
                    date
                );

                if(resolvedAttendance.status === "HOLIDAY" || resolvedAttendance.status === "WEEK_OFF"){
                    continue;
                }

                if(resolvedAttendance.status === "ON_LEAVE"){
                    continue;
                }

                const checkInAt = parseTimeToDate(date, config.checkInTime, timezone);
                const checkOutAt = parseTimeToDate(date, config.checkOutTime, timezone);
                const workedMinutes = diffInMinutes(checkInAt, checkOutAt);

                await tx.attendance.upsert({
                    where: {
                        userId_date: {
                            userId: payload.userId,
                            date
                        }
                    },
                    update: {
                        checkInAt,
                        checkOutAt,
                        workedMinutes,
                        status: "OUT_DUTY",
                        isOutDuty: true,
                        outDutyReason: payload.reason,
                        isLate: false,
                        isOnApprovedLeave: false,
                        isHoliday: false,
                        isWeekOff: false,
                        manuallyUpdatedById: actor.id,
                        manuallyUpdatedAt: new Date(),
                        remarks: `Out Duty: ${payload.reason}`
                    },
                    create: {
                        tenantId: actor.tenantId,
                        userId: payload.userId,
                        date,
                        checkInAt,
                        checkOutAt,
                        workedMinutes,
                        status: "OUT_DUTY",
                        isOutDuty: true,
                        outDutyReason: payload.reason,
                        isLate: false,
                        isOnApprovedLeave: false,
                        isPaidLeave: false,
                        isHoliday: false,
                        isWeekOff: false,
                        manuallyUpdatedById: actor.id,
                        manuallyUpdatedAt: new Date(),
                        remarks: `Out Duty: ${payload.reason}`
                    }
                })
            }

            return outDuty;
        })
    }

    static async getOutDuties(actor: any, payload: {
        userId?: string;
        startDate?: string;
        endDate?: string;
        status?: string;
    }) {
        if(!actor?.tenantId){
            throw new Error("Actor tenant context missing");
        }
        const timezone = await getTenantTimezone(actor.tenantId);
        const where: any = {
            tenantId: actor.tenantId,
            ...(payload.userId ? { userId: payload.userId } : {}),
            ...(payload.status ? { reason: { contains: payload.status } } : {})
        };

        if(payload.startDate || payload.endDate) {
            where.startDate = {};

            if(payload.startDate) {
                where.startDate.gte = getStartOfDay(new Date(payload.startDate), timezone);
            }

            if(payload.endDate) {
                where.endDate = {
                    lte: getEndOfDay(new Date(payload.endDate), timezone)
                };
            }
        }

        return prisma.outDuty.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                markedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            },
            orderBy: {
                createdAt: "desc"
            }
        })
    }

    static async upsertRegularizationPolicy(actor: any, payload: {
        id?: string;
        name: string;
        departmentId?: string | null;
        designationId?: string | null;
        approverType: "REPORTING_MANAGER" | "DEPARTMENT_MANAGER" | "COMPANY_ADMIN" | "SPECIFIC_USER";
        userId?: string | null;
        isActive?: boolean;
    }) {
        if (!actor?.tenantId) {
            throw new Error("Actor tenant context missing");
        }

        if (!payload.name?.trim()) {
            throw new Error("Policy name is required");
        }

        if (!payload.approverType) {
            throw new Error("Approver type is required");
        }

        if (payload.approverType === "SPECIFIC_USER" && !payload.userId) {
            throw new Error("userId is required for SPECIFIC_USER approver type");
        }

        if (payload.departmentId) {
            const department = await prisma.department.findFirst({
            where: {
                id: payload.departmentId,
                tenantId: actor.tenantId
            }
            });

            if (!department) {
            throw new Error("Department not found");
            }
        }

        if (payload.designationId) {
            const designation = await prisma.designation.findFirst({
            where: {
                id: payload.designationId,
                tenantId: actor.tenantId
            }
            });

            if (!designation) {
            throw new Error("Designation not found");
            }
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
            throw new Error("Specific approver user not found");
            }
        }


        if (payload.id) {
            const existing = await prisma.attendanceRegularizationPolicy.findFirst({
            where: {
                id: payload.id,
                tenantId: actor.tenantId
            }
            });

            if (!existing) {
            throw new Error("Attendance regularization policy not found");
            }

            return prisma.attendanceRegularizationPolicy.update({
            where: { id: payload.id },
            data: {
                name: payload.name.trim(),
                departmentId: payload.departmentId ?? null,
                designationId: payload.designationId ?? null,
                approverType: payload.approverType as any,
                userId: payload.approverType === "SPECIFIC_USER" ? payload.userId : null,
                isActive: payload.isActive ?? true
            },
            include: {
                department: true,
                designation: true,
                user: {
                select: {
                    id: true,
                    name: true,
                    email: true
                }
                },
            }
            });
        }

        return prisma.attendanceRegularizationPolicy.upsert({
            where: {
            tenantId_name: {
                tenantId: actor.tenantId,
                name: payload.name.trim()
            }
            },
            update: {
            departmentId: payload.departmentId ?? null,
            designationId: payload.designationId ?? null,
            approverType: payload.approverType as any,
            userId: payload.approverType === "SPECIFIC_USER" ? payload.userId : null,
            isActive: payload.isActive ?? true
            },
            create: {
            tenantId: actor.tenantId,
            name: payload.name.trim(),
            departmentId: payload.departmentId ?? null,
            designationId: payload.designationId ?? null,
            approverType: payload.approverType as any,
            userId: payload.approverType === "SPECIFIC_USER" ? payload.userId : null,
            isActive: payload.isActive ?? true
            },
            include: {
            department: true,
            designation: true,
            user: {
                select: {
                id: true,
                name: true,
                email: true
                }
            },
            }
        });
    }


    static async getRegularizationPolicies(actor: any) {
        if (!actor?.tenantId) {
            throw new Error("Actor tenant context missing");
        }

        return prisma.attendanceRegularizationPolicy.findMany({
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

    private static async resolveAttendanceRegularizationPolicy(
        tenantId: string,
        user: any
    ) {
        let policy = await prisma.attendanceRegularizationPolicy.findFirst({
            where: {
            tenantId,
            isActive: true,
            departmentId: user.departmentId ?? null,
            designationId: user.designationId ?? null
            },
            orderBy: { createdAt: "desc" }
        });

        if (policy) return policy;

        policy = await prisma.attendanceRegularizationPolicy.findFirst({
            where: {
            tenantId,
            isActive: true,
            departmentId: user.departmentId ?? null,
            designationId: null
            },
            orderBy: { createdAt: "desc" }
        });

        if (policy) return policy;

        policy = await prisma.attendanceRegularizationPolicy.findFirst({
            where: {
            tenantId,
            isActive: true,
            departmentId: null,
            designationId: null
            },
            orderBy: { createdAt: "desc" }
        });

        return policy;
    }

    static async createRegularizationRequest(actor: any, payload: {
        date: string;
        requestedCheckInAt?: string;
        requestedCheckOutAt?: string;
        reason: string;
    }) {
        if(!actor?.tenantId){
            throw new Error("Actor tenant context missing");
        }
        if(!payload.date){
            throw new Error("Date is required");
        }

        const timezone = await getTenantTimezone(actor.tenantId);
        const attendanceDate = getStartOfDay(new Date(payload.date), timezone);

        const existingPendingRequest = await prisma.attendanceRegularizationRequest.findFirst({
            where: {
                tenantId: actor.tenantId,
                userId: actor.id,
                date: attendanceDate,
                status: "PENDING"
            }
        });

        if(existingPendingRequest) {
            throw new Error("A pending regularization request already exists for this date.");
        }

        const user = await prisma.user.findFirst({
            where: {
                id: actor.id,
                tenantId: actor.tenantId
            },
            include: {
                department: true,
                employeeProfile: true
            }
        });
        if(!user){
            throw new Error("User not found");
        }

        const policy = await this.resolveAttendanceRegularizationPolicy(actor.tenantId, user);

        if(!policy){
            throw new Error("No attendance regularization policy found for tenant");
        }

        const attendance = await prisma.attendance.findUnique({
            where: {
                userId_date: {
                    userId: actor.id,
                    date: attendanceDate
                }
            }
        });

        return prisma.attendanceRegularizationRequest.create({
            data: {
            tenantId: actor.tenantId,
            userId: actor.id,
            attendanceId: attendance?.id ?? null,
            date: attendanceDate,
            requestedCheckInAt: payload.requestedCheckInAt
                ? new Date(payload.requestedCheckInAt)
                : null,
            requestedCheckOutAt: payload.requestedCheckOutAt
                ? new Date(payload.requestedCheckOutAt)
                : null,
            reason: payload.reason.trim(),
            status: "PENDING",
            approverType: policy.approverType,
            approverUserId: policy.userId ?? null,
            }
        });
    }

    static async getPendingRegularizationApprovals(actor: any) {
        if (!actor?.tenantId) {
            throw new Error("Actor tenant context missing");
        }

        const requests = await prisma.attendanceRegularizationRequest.findMany({
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
                    select: {
                    id: true,
                    name: true,
                    managerId: true
                    }
                },
                designation: {
                    select: {
                    id: true,
                    name: true
                    }
                },
                employeeProfile: {
                    select: {
                    photoUrl: true,
                    employeeCode: true
                    }
                }
                }
            },
            attendance: true,
            approvedBy: {
                select: {
                id: true,
                name: true,
                email: true
                }
            },
            rejectedBy: {
                select: {
                id: true,
                name: true,
                email: true
                }
            }
            },
            orderBy: {
            createdAt: "desc"
            }
        });

        const allowedRequests = [];

        for (const request of requests) {
            const canApprove = await this.canApproveRegularization(actor, request);

            if (canApprove) {
            allowedRequests.push(request);
            }
        }

        return allowedRequests;
    }

    private static async canApproveRegularization(actor: any, request: any) {
        const requester = request.user;

        if(request.approverType === "SPECIFIC_USER"){
            return request.approverUserId === actor.id;
        }
        if(request.approverType === "REPORTING_MANAGER"){
            return requester.managerId === actor.id;
        }
        if(request.approverType === "DEPARTMENT_MANAGER"){
            const department = await prisma.department.findFirst({
                where:{
                    id: requester.departmentId,
                    tenantId: actor.tenantId
                }
            });

            return department?.managerId === actor.id
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

        return false
    }

    static async approveRegularization(
        actor: any,
        requestId: string,
        remarks?: string
    ) {
        if(!actor.tenantId){
            throw new Error ("Actor tenant context missing");
        }

        return prisma.$transaction(async (tx) => {
            const request = await tx.attendanceRegularizationRequest.findFirst({
                where: {
                    id: requestId,
                    tenantId: actor.tenantId,
                    status: "PENDING"
                },
                include: {
                    user: true,
                    attendance: true
                }
            });

            if(!request){
                throw new Error("Regularization request not found");
            }

            const canApprove = await this.canApproveRegularization(actor, request);

            if(!canApprove){
                throw new Error("You don't have permission to approve this request");
            }

            const config = await tx.attendanceConfig.findFirst({
                where: {
                    tenantId: actor.tenantId
                }
            });

            if(!config){
                throw new Error("Attendance configuration not found for tenant");
            }

            const checkInAt = request.requestedCheckInAt;
            const checkOutAt = request.requestedCheckOutAt;

            const workedMinutes = checkInAt && checkOutAt ? diffInMinutes(checkInAt, checkOutAt) : 0;

            let finalStatus: any = "REGULARIZED";

            if (checkInAt && checkOutAt) {
                if (workedMinutes < (config.halfDayMinutes ?? 240)) {
                    finalStatus = "ABSENT";
                } else if (workedMinutes < (config.fullDayMinutes ?? 480)) {
                    finalStatus = "HALF_DAY";
                } else {
                    finalStatus = "REGULARIZED";
                }
            }

            await tx.attendance.upsert({
                where: {
                    userId_date: {
                    userId: request.userId,
                    date: request.date
                    }
                },
                update: {
                    checkInAt: checkInAt ?? undefined,
                    checkOutAt: checkOutAt ?? undefined,
                    workedMinutes,
                    status: finalStatus,
                    isLate: false,
                    regularizedById: actor.id,
                    regularizedAt: new Date(),
                    regularizationReason: request.reason,
                    manuallyUpdatedById: actor.id,
                    manuallyUpdatedAt: new Date(),
                    remarks: `Regularized: ${request.reason}`
                },
                create: {
                    tenantId: actor.tenantId,
                    userId: request.userId,
                    date: request.date,
                    checkInAt,
                    checkOutAt,
                    workedMinutes,
                    status: finalStatus,
                    isLate: false,
                    isOnApprovedLeave: false,
                    isPaidLeave: false,
                    isHoliday: false,
                    isWeekOff: false,
                    regularizedById: actor.id,
                    regularizedAt: new Date(),
                    regularizationReason: request.reason,
                    manuallyUpdatedById: actor.id,
                    manuallyUpdatedAt: new Date(),
                    remarks: `Regularized: ${request.reason}`
                }
            });

            return tx.attendanceRegularizationRequest.update({
                where: { id: request.id },
                data: {
                    status: "APPROVED",
                    approvedById: actor.id,
                    approvedAt: new Date()
                }
            });
        })
    }

    static async rejectRegularization(
        actor: any,
        requestId: string,
        remarks?: string
    ) {
        if(!actor.tenantId){
            throw new Error ("Actor tenant context missing");
        }

        const request = await prisma.attendanceRegularizationRequest.findFirst({
            where: {
                id: requestId,
                tenantId: actor.tenantId,
                status: "PENDING"
            },
            include: {
                user: true
            }
        });

        if(!request){
            throw new Error("Regularization request not found");
        }

        const canApprove = await this.canApproveRegularization(actor, request);

        if(!canApprove){
            throw new Error("You'r not allowed to reject this request");
        }



        return prisma.attendanceRegularizationRequest.update({
            where: { id: request.id },
            data: {
                status: "REJECTED",
                rejectedById: actor.id,
                rejectedAt: new Date(),
                reason: remarks ?? "No reason provided"
            }
        });
    }
}