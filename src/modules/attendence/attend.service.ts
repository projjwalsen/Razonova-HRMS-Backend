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
}