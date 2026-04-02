import { prisma } from "../../config/db/prisma";
import { diffInMinutes, getEndOfDay, getStartOfDay, getTenantTimezone, parseTimeToDate } from "../utils/util";

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
        fullDayMinutes?: number
    }) {
        return await prisma.attendanceConfig.upsert({
            where: { tenantId },
            update: {
                checkInTime: payload.checkInTime,
                checkOutTime: payload.checkOutTime,
                graceMinutes: payload.graceMinutes ?? 30,
                halfDayMinutes: payload.halfDayMinutes ?? 240,
                fullDayMinutes: payload.fullDayMinutes ?? 480
            },
            create: {
                tenantId,
                checkInTime: payload.checkInTime,
                checkOutTime: payload.checkOutTime,
                graceMinutes: payload.graceMinutes ?? 30,
                halfDayMinutes: payload.halfDayMinutes ?? 240,
                fullDayMinutes: payload.fullDayMinutes ?? 480
            }
        })
    }
    static async checkIn(tenantId: string, userId: string) {
        const config = await this.getTenantConfig(tenantId);
        if (!config) {
            throw new Error("Attendance configuration not found for tenant");
        }
        const timezone = await getTenantTimezone(tenantId);
        const now = new Date();
        const today = getStartOfDay(now, timezone);

        const scheduleCheckIn = parseTimeToDate(today, config.checkInTime, timezone);
        const lateThreshold = new Date(scheduleCheckIn.getTime() + (config.graceMinutes ?? 30) * 60000);

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
                status
            },
            create: {
                tenantId,
                userId,
                date: today,
                checkInAt: now,
                isLate,
                status,
                workedMinutes: 0,
            }
        })
    }
    static async checkOut (tenantId: string, userId: string) {
        const config = await this.getTenantConfig(tenantId);
        if (!config) {
            throw new Error("Attendance configuration not found for tenant");
        }
        const timezone = await getTenantTimezone(tenantId);
        const now = new Date();
        const today = getStartOfDay(now, timezone);

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
        const workedMinutes = diffInMinutes(attendance.checkInAt, now);
        const scheduledCheckOut = parseTimeToDate(today, config.checkOutTime, timezone);

        let finalStatus: "PRESENT" | "LATE" | "HALF_DAY" | "ABSENT" = attendance.isLate
            ? "LATE" : "PRESENT";
        
        if(attendance.checkInAt > scheduledCheckOut){
            finalStatus = "ABSENT";
        } else if (workedMinutes < (config.halfDayMinutes ?? 240)) {
            finalStatus = "ABSENT";
        } else if(workedMinutes < (config.fullDayMinutes ?? 480)){
            finalStatus = "HALF_DAY";
        } else {
            finalStatus = attendance.isLate ? "LATE" : "PRESENT";
        }

        return prisma.attendance.update({
            where: {
                id: attendance.id
            },
            data: {
                checkOutAt: now,
                workedMinutes,
                status: finalStatus
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
            endDate?: string
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

        return prisma.attendance.findMany({
            where,
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

        /** ------ Summary for one specific user ------ */
        if(userId){
            const totalPresentDays = records.filter((r) => 
            ["PRESENT", "LATE"].includes(r.status)
            ).length;

            const totalLateDays = records.filter((r) => r.status === "LATE").length;
            const totalAbsentDays = records.filter((r) => r.status === "ABSENT").length;
            const totalHalfDays = records.filter((r) => r.status === "HALF_DAY").length;

            const totalWorkedMinutes = records.reduce(
                (sum, r) => sum + (r.workedMinutes ?? 0), 0
            );

            const payableDays = totalPresentDays + totalHalfDays * 0.5;

            return {
                userId,
                month: selectedMonth,
                year: selectedYear,
                totalPresentDays,
                totalLateDays,
                totalAbsentDays,
                totalHalfDays,
                totalWorkedMinutes,
                payableDays
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
                    totalPresentDays: 0,
                    totalLateDays: 0,
                    totalAbsentDays: 0,
                    totalHalfDays: 0,
                    totalWorkedMinutes: 0,
                    payableDays: 0
                })
            }

            const item = summaryMap.get(key);

            if(record.status === "PRESENT"){
                item.totalPresentDays += 1;
                item.payableDays += 1;
            }
            if(record.status === "LATE"){
                item.totalPresentDays += 1;
                item.totalLateDays += 1;
                item.payableDays += 1;
            }
            if(record.status === "ABSENT"){
                item.totalAbsentDays += 1;
            }
            if(record.status === "HALF_DAY"){
                item.totalHalfDays += 1;
                item.payableDays += 0.5;
            }

            item.totalWorkedMinutes += (record.workedMinutes ?? 0);
        }
        return {
            month: selectedMonth,
            year: selectedYear,
            users: Array.from(summaryMap.values())
        }
    }
}