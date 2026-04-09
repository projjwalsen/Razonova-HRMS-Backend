import { Request, Response } from "express";
import { AttendService } from "./attend.service";

/** ---------- Set Attendance Configuration ---------------------- */
/**
 * @swagger
 * /attendance/config:
 *   post:
 *     tags:
 *       - attendance
 *     summary: Set or update attendance configuration for a tenant
 *     description: Set or update check-in/out times, grace minutes, half/full day minutes for a tenant.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - checkInTime
 *               - checkOutTime
 *             properties:
 *               checkInTime: { type: string, example: "09:00" }
 *               checkOutTime: { type: string, example: "18:00" }
 *               graceMinutes: { type: integer, example: 15 }
 *               halfDayMinutes: { type: integer, example: 240 }
 *               fullDayMinutes: { type: integer, example: 480 }
 *     responses:
 *       200:
 *         description: Attendance configuration upserted successfully
 *       400:
 *         description: Validation error
 *       500:
 *         description: Failed to upsert attendance configuration
 */
export const upsertAttendanceConfig = async (req: Request, res: Response) => {
    try {
        const actor = (req as any).user;
        const {
            checkInTime,
            checkOutTime,
            graceMinutes,
            halfDayMinutes,
            fullDayMinutes
        } = req.body;

        if (!checkInTime || !checkOutTime) {
            return res.status(400).json({
                status: false,
                message: "checkInTime and checkOutTime are required"
            });
        }
        if(graceMinutes !== undefined && Number(graceMinutes) < 0){
            return res.status(400).json({
                status: false,
                message: "graceMinutes cannot be negative"
            });
        }
        if (halfDayMinutes !== undefined && Number(halfDayMinutes) <= 0) {
            return res.status(400).json({
                status: false,
                message: "halfDayMinutes must be greater than 0"
            });
        }

        if (fullDayMinutes !== undefined && Number(fullDayMinutes) <= 0) {
            return res.status(400).json({
                status: false,
                message: "fullDayMinutes must be greater than 0"
            });
        }
        if(
            halfDayMinutes !== undefined &&
            fullDayMinutes !== undefined &&
            Number(halfDayMinutes) > Number(fullDayMinutes)
        ) {
            return res.status(400).json({
                status: false,
                message: "halfDayMinutes must be less than fullDayMinutes"
            });
        }
        const result = await AttendService.upsertAttendanceConfig(actor.tenantId, {
            checkInTime,
            checkOutTime,
            graceMinutes: graceMinutes !== undefined ? Number(graceMinutes) : undefined,
            halfDayMinutes: halfDayMinutes !== undefined ? Number(halfDayMinutes) : undefined,
            fullDayMinutes: fullDayMinutes !== undefined ? Number(fullDayMinutes) : undefined
        });

        if(!result){
            return res.status(500).json({
                status: false,
                message: "Failed to upsert attendance configuration"
            });
        }
        return res.status(200).json({
            status: true,
            message: "Attendance configuration upserted successfully",
            data: result
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to upsert attendance configuration",
            error: error.message
        })
    }
}

/**
 * @swagger
 * /attendance/config:
 *   get:
 *     tags:
 *       - attendance
 *     summary: Get attendance configuration for a tenant
 *     description: Retrieve the attendance configuration for the current tenant.
 *     responses:
 *       200:
 *         description: Attendance configuration fetched successfully
 *       404:
 *         description: Attendance configuration not found for tenant
 *       500:
 *         description: Failed to get attendance configuration
 */
export const getAttendanceConfig = async (req: Request, res: Response) => {
    try {
        const actor = (req as any).user;
        const result = await AttendService.getTenantConfig(actor.tenantId);
        if(!result){
            return res.status(404).json({
                status: false,
                message: "Attendance configuration not found for tenant"
            });
        }
        return res.status(200).json({
            status: true,
            message: "Attendance configuration fetched successfully",
            data: result
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to get attendance configuration",
            error: error.message
        })
    }
}

/**
 * @swagger
 * /attendance/check-in:
 *   post:
 *     tags:
 *       - attendance
 *     summary: Check in for attendance
 *     description: Mark check-in for the current user.
 *     responses:
 *       200:
 *         description: Checked in successfully
 *       500:
 *         description: Failed to check in
 */
export const checkIn = async (req: Request, res: Response) => {
    try {
        const actor = (req as any).user;
        const result = await AttendService.checkIn(actor.tenantId, actor.id);
        if(!result){
            return res.status(500).json({
                status: false,
                message: "Failed to check in"
            });
        }
        return res.status(200).json({
            status: true,
            message: "Checked in successfully",
            data: result
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to check in",
            error: error.message
        })
    }
}

/**
 * @swagger
 * /attendance/check-out:
 *   post:
 *     tags:
 *       - attendance
 *     summary: Check out for attendance
 *     description: Mark check-out for the current user.
 *     responses:
 *       200:
 *         description: Checked out successfully
 *       500:
 *         description: Failed to check out
 */
export const checkOut = async (req: Request, res: Response) => {
    try {
        const actor = (req as any).user;
        const result = await AttendService.checkOut(actor.tenantId, actor.id);
        if(!result){
            return res.status(500).json({
                status: false,
                message: "Failed to check out"
            });
        }
        return res.status(200).json({
            status: true,
            message: "Checked out successfully",
            data: result
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to check out",
            error: error.message
        })
    }
}

/**
 * @swagger
 * /attendance/today/{userId}:
 *   get:
 *     tags:
 *       - attendance
 *     summary: Get today's attendance
 *     description: Get today's attendance for a specific user or the current user.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: false
 *         schema:
 *           type: string
 *         description: User ID (optional, if not provided, fetches for current user)
 *     responses:
 *       200:
 *         description: Today's attendance fetched successfully
 *       404:
 *         description: No attendance record found for today
 *       500:
 *         description: Failed to get today's attendance
 */
export const getTodaysAttendance = async (req: Request, res: Response) => {
    try {
        const actor = (req as any).user;
        const { userId } = (req as any).params;

        const result = await AttendService.getTodaysAttendance(
            actor.tenantId,
            userId || undefined
        );
        if(!result){
            return res.status(404).json({
                status: false,
                message: "No attendance record found for today"
            });
        }
        return res.status(200).json({
            status: true,
            message: "Today's attendance fetched successfully",
            data: result
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to get today's attendance",
            error: error.message
        })
    }
}

/**
 * @swagger
 * /attendance/history/{userId}:
 *   get:
 *     tags:
 *       - attendance
 *     summary: Get attendance history
 *     description: Get attendance history for a specific user or all users, filtered by date range.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: false
 *         schema:
 *           type: string
 *         description: User ID (optional)
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (optional)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (optional)
 *     responses:
 *       200:
 *         description: Attendance history fetched successfully
 *       404:
 *         description: No attendance records found
 *       500:
 *         description: Failed to get attendance history
 */
export const getAttendanceHistory = async (req: Request, res: Response) => {
    try {
        const actor = (req as any).user;
        const { userId } = (req as any).params;
        const { startDate, endDate } = req.query;

        const result = await AttendService.getHistory(
            actor.tenantId,
            {
                userId: userId || undefined,
                startDate: startDate ? startDate.toString() : undefined,
                endDate: endDate ? endDate.toString() : undefined
            }
        );
        if (!result) {
            return res.status(404).json({
                status: false,
                message: "No attendance records found"
            });
        }
        return res.status(200).json({
            status: true,
            message: "Attendance history fetched successfully",
            data: result
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to get attendance history",
            error: error.message
        })
    }
}

/**
 * @swagger
 * /attendance/summary/{userId}:
 *   get:
 *     tags:
 *       - attendance
 *     summary: Get monthly attendance summary
 *     description: Get monthly attendance summary for a specific user or all users.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: false
 *         schema:
 *           type: string
 *         description: User ID (optional)
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *         description: Month (1-12)
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *         description: Year (e.g., 2026)
 *     responses:
 *       200:
 *         description: Monthly attendance summary fetched successfully
 *       404:
 *         description: No attendance summary found for the month
 *       500:
 *         description: Failed to get monthly attendance summary
 */
export const getMonthSummary = async (req: Request, res: Response) => {
    try {
        const actor = (req as any).user;
        const { userId } = (req as any).params;
        const { month, year } = req.query;

        if(month !== undefined && (Number(month) < 1 || Number(month) > 12)){
            return res.status(400).json({
                status: false,
                message: "month must be between 1 and 12"
            });
        }
        if(year !== undefined && Number(year) < 2000){
            return res.status(400).json({
                status: false,
                message: "year must be greater than 2000"
            });
        }

        const result = await AttendService.getMonthSummary(
            actor.tenantId,
            userId || undefined,
            month ? Number(month) : undefined,
            year ? Number(year) : undefined
        );
        if (!result) {
            return res.status(404).json({
                status: false,
                message: "No attendance summary found for the month"
            });
        }
        return res.status(200).json({
            status: true,
            message: "Monthly attendance summary fetched successfully",
            data: result
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to get monthly attendance summary",
            error: error.message
        })
    }
}