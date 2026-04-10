import { Request, Response } from "express";
import { AttendService } from "./attend.service";

const handleError = (res: Response, error: any, fallbackMessage: string) => {
  const message = error?.message || fallbackMessage;

  if (
    message.includes("Already checked in") ||
    message.includes("Already checked out")
  ) {
    return res.status(409).json({ status: false, message });
  }

  if (
    message.includes("Cannot check in") ||
    message.includes("Cannot check out") ||
    message.includes("Check-in record not found")
  ) {
    return res.status(400).json({ status: false, message });
  }

  if (message.includes("Attendance configuration not found")) {
    return res.status(404).json({ status: false, message });
  }

  return res.status(500).json({
    status: false,
    message: fallbackMessage,
    error: message
  });
};


/** ---------- Set Attendance Configuration ---------------------- */
/**
 * @swagger
 * /attendance/config:
 *   post:
 *     tags:
 *       - attendance
 *     summary: Create or update tenant attendance configuration
 *     description: Create or update the attendance policy for the current tenant, including check-in/check-out timings, grace period, half-day/full-day thresholds, and working days.
 *     security:
 *       - bearerAuth: []
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
 *               checkInTime:
 *                 type: string
 *                 example: "09:00"
 *                 description: Scheduled tenant check-in time in HH:mm format.
 *               checkOutTime:
 *                 type: string
 *                 example: "18:00"
 *                 description: Scheduled tenant check-out time in HH:mm format.
 *               graceMinutes:
 *                 type: integer
 *                 example: 15
 *                 minimum: 0
 *                 description: Number of grace minutes allowed after check-in time before marking late attendance.
 *               halfDayMinutes:
 *                 type: integer
 *                 example: 240
 *                 minimum: 1
 *                 description: Minimum worked minutes required to mark the day as HALF_DAY.
 *               fullDayMinutes:
 *                 type: integer
 *                 example: 480
 *                 minimum: 1
 *                 description: Minimum worked minutes required to mark the day as PRESENT or LATE instead of HALF_DAY.
 *               workingDays:
 *                 type: array
 *                 description: Working weekdays for the tenant. Any day outside this list may be treated as WEEK_OFF.
 *                 items:
 *                   type: string
 *                   enum: [MON, TUE, WED, THU, FRI, SAT, SUN]
 *                 example: [MON, TUE, WED, THU, FRI]
 *           examples:
 *             defaultConfig:
 *               summary: Standard office timing
 *               value:
 *                 checkInTime: "09:00"
 *                 checkOutTime: "18:00"
 *                 graceMinutes: 15
 *                 halfDayMinutes: 240
 *                 fullDayMinutes: 480
 *                 workingDays: [MON, TUE, WED, THU, FRI]
 *             sixDayWeek:
 *               summary: Six day working week
 *               value:
 *                 checkInTime: "10:00"
 *                 checkOutTime: "19:00"
 *                 graceMinutes: 10
 *                 halfDayMinutes: 240
 *                 fullDayMinutes: 480
 *                 workingDays: [MON, TUE, WED, THU, FRI, SAT]
 *     responses:
 *       200:
 *         description: Attendance configuration upserted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Attendance configuration upserted successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "3f5e9c2b-4f4e-4e1f-8c8d-1f2d3a4b5c6d"
 *                     tenantId:
 *                       type: string
 *                       example: "9db0be9c-7dc8-4d10-a61f-44edc0d0b111"
 *                     checkInTime:
 *                       type: string
 *                       example: "09:00"
 *                     checkOutTime:
 *                       type: string
 *                       example: "18:00"
 *                     graceMinutes:
 *                       type: integer
 *                       example: 15
 *                     halfDayMinutes:
 *                       type: integer
 *                       example: 240
 *                     fullDayMinutes:
 *                       type: integer
 *                       example: 480
 *                     workingDays:
 *                       type: array
 *                       items:
 *                         type: string
 *                         enum: [MON, TUE, WED, THU, FRI, SAT, SUN]
 *                       example: [MON, TUE, WED, THU, FRI]
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: halfDayMinutes must be less than fullDayMinutes
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Attendance configuration context or tenant not found
 *       500:
 *         description: Failed to upsert attendance configuration
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Failed to upsert attendance configuration
 *                 error:
 *                   type: string
 */
export const upsertAttendanceConfig = async (req: Request, res: Response) => {
    try {
        const actor = (req as any).user;
        const {
            checkInTime,
            checkOutTime,
            graceMinutes,
            halfDayMinutes,
            fullDayMinutes,
            workingDays
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
            fullDayMinutes: fullDayMinutes !== undefined ? Number(fullDayMinutes) : undefined,
            workingDays: Array.isArray(workingDays) ? workingDays : undefined
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
        return handleError(res, error, "Failed to upsert attendance configuration");
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
        return handleError(res, error, "Failed to get attendance configuration");
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
        return handleError(res, error, "Failed to check in");
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
        return handleError(res, error, "Failed to check out");
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
        return handleError(res, error, "Failed to get today's attendance");
    }
}

/**
 * @swagger
 * /attendance/history:
 *   get:
 *     tags:
 *       - attendance
 *     summary: Get attendance history for all users
 *     description: Retrieve attendance history for all users in the tenant with optional date range and status filtering.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-04-01"
 *         description: Start date for attendance history filter.
 *       - in: query
 *         name: endDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-04-30"
 *         description: End date for attendance history filter.
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [PRESENT, ABSENT, LATE, HALF_DAY, ON_LEAVE, HOLIDAY, WEEK_OFF]
 *           example: PRESENT
 *         description: Filter attendance records by status.
 *     responses:
 *       200:
 *         description: Attendance history for all users fetched successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Failed to get attendance history
 */

/**
 * @swagger
 * /attendance/history/{userId}:
 *   get:
 *     tags:
 *       - attendance
 *     summary: Get attendance history for a specific user
 *     description: Retrieve attendance history for a specific user in the tenant with optional date range and status filtering.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID whose attendance history is required.
 *       - in: query
 *         name: startDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-04-01"
 *         description: Start date for attendance history filter.
 *       - in: query
 *         name: endDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-04-30"
 *         description: End date for attendance history filter.
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [PRESENT, ABSENT, LATE, HALF_DAY, ON_LEAVE, HOLIDAY, WEEK_OFF]
 *           example: ON_LEAVE
 *         description: Filter attendance records by status.
 *     responses:
 *       200:
 *         description: Attendance history for user fetched successfully
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: No attendance records found
 *       500:
 *         description: Failed to get attendance history
 */


export const getAttendanceHistory = async (req: Request, res: Response) => {
    try {
        const actor = (req as any).user;
        const { userId } = (req as any).params;
        const { startDate, endDate, status } = req.query;

        const result = await AttendService.getHistory(
            actor.tenantId,
            {
                userId: userId || undefined,
                startDate: startDate ? startDate.toString() : undefined,
                endDate: endDate ? endDate.toString() : undefined,
                status: status ? String(status) : undefined
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
        return handleError(res, error, "Failed to get attendance history");
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
        return handleError(res, error, "Failed to get monthly attendance summary");
    }
}