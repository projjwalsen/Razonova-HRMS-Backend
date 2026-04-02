
import { Request, Response } from "express";
import { LeaveService } from "./leave.service";
import { uploadToS3 } from "../../config/s3/s3.config";

/**
 * @swagger
 * /leave/type:
 *   post:
 *     summary: Upsert a leave type
 *     tags: [Leave]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               typeCode:
 *                 type: string
 *               maxLimit:
 *                 type: integer
 *               attachmentRequired:
 *                 type: boolean
 *               priorNoticeDays:
 *                 type: integer
 *               allowHalfDay:
 *                 type: boolean
 *               sandwichLeaveAllowed:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Leave type upserted successfully
 *       404:
 *         description: Leave type not found for update
 *       500:
 *         description: Failed to create leave type
 *   get:
 *     summary: Get all leave types
 *     tags: [Leave]
 *     responses:
 *       200:
 *         description: Leave types fetched successfully
 *       404:
 *         description: No leave types found
 *       500:
 *         description: Failed to fetch leave types
 */


/** -- Upsert Leave Type -- */
export const upsertLeaveType = async (req: Request, res: Response) => {
    try {
        const actor = (req as any).user;

        const {
            name,
            typeCode,
            maxLimit,
            attachmentRequired,
            priorNoticeDays,
            allowHalfDay,
            sandwichLeaveAllowed,
        } = req.body;

        const result = await LeaveService.upsertLeaveType(actor.tenantId, {
            name: name.trim(),
            typeCode,
            maxLimit: maxLimit !== undefined ? Number(maxLimit) : 0,
            attachmentRequired: attachmentRequired ?? false,
            priorNoticeDays: priorNoticeDays ?? 0,
            allowHalfDay: allowHalfDay ?? false,
            sandwichLeaveAllowed: sandwichLeaveAllowed ?? false,
        })
        if(!result) {
            return res.status(404).json({
                status: false,
                message: "Leave type not found for update"
            })
        }
        return res.status(200).json({
            status: true,
            message: "Leave type upserted successfully",
            data: result
        })
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to create leave type",
            error: error.message
        })
    }
}

export const getLeaveTypes = async (req: Request, res: Response) => {
    try {
        const actor = (req as any).user;

        const result = await LeaveService.getLeaveTypes(actor.tenantId);

        if(!result) {
            return res.status(404).json({
                status: false,
                message: "No leave types found"
            })
        }
        return res.status(200).json({
            status: true,
            message: "Leave types fetched successfully",
            data: result
        })

    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to fetch leave types",
            error: error.message
        })
    }
}

/**
 * @swagger
 * /leave/apply:
 *   post:
 *     summary: Apply for leave
 *     tags: [Leave]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               leaveTypeId:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               reason:
 *                 type: string
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Leave applied successfully
 *       404:
 *         description: Failed to apply for leave
 *       500:
 *         description: Failed to apply for leave
 */
export const applyLeave = async (req: Request, res: Response) => {
    try {
        const actor = (req as any).user;
        const { 
            leaveTypeId,
            startDate,
            endDate,
            reason,
        } = req.body;

        let attachmentUrls: string[] = [];
        const files = (req as any).file;

        if(files && files.length > 0) {
            for(const file of files) {
                const url = await uploadToS3(
                    file,
                    actor.tenantId,
                    `leave-attachments/${actor.id}/${Date.now()}-${file.originalname}`
                );
                attachmentUrls.push(url);
            }
        }
        const result = await LeaveService.applyLeave(actor.tenantId, actor.id, {
            leaveTypeId,
            startDate: startDate,
            endDate: endDate,
            reason,
            attachmentUrls: attachmentUrls.length > 0 ? attachmentUrls : undefined
        });
        if(!result) {
            return res.status(404).json({
                status: false,
                message: "Failed to apply for leave"
            })
        }
        return res.status(200).json({
            status: true,
            message: "Leave applied successfully",
            data: result
        })
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to apply for leave",
            error: error.message
        })
    }
}

/**
 * @swagger
 * /leave/cancel/{requestId}:
 *   post:
 *     summary: Cancel a leave request
 *     tags: [Leave]
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Leave request cancelled successfully
 *       400:
 *         description: Request ID is required
 *       404:
 *         description: Leave request not found or cannot be cancelled
 *       500:
 *         description: Failed to cancel leave request
 */
export const cancelLeaveRequests = async (req: Request, res: Response) => {
    try {
        const actor = (req as any).user;
        const { requestId } = (req as any).params;
        const { reason } = req.body;
        if(!requestId) {
            return res.status(400).json({
                status: false,
                message: "Request ID is required"
            })
        }

        const result = await LeaveService.cancelLeaveRequest(
            actor.tenantId,
            actor.id,
            requestId,
            reason
        );
        if(!result) {
            return res.status(404).json({
                status: false,
                message: "Leave request not found or cannot be cancelled"
            })
        }
        return res.status(200).json({
            status: true,
            message: "Leave request cancelled successfully",
            data: result
        })
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to cancel leave request",
            error: error.message
        })
    }
}

/**
 * @swagger
 * /leave/requests/{userId}:
 *   get:
 *     summary: Get leave requests for a user
 *     tags: [Leave]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Leave requests fetched successfully
 *       400:
 *         description: User ID is required
 *       404:
 *         description: No leave requests found
 *       500:
 *         description: Failed to fetch leave requests
 */
export const getLeaveRequests = async (req: Request, res: Response) => {
    try {
        const actor = (req as any).user;
        const { userId } = (req as any).params;


        const result = await LeaveService.getLeaveRequests(actor.tenantId, userId);

        if(!result || result.length === 0) {
            return res.status(404).json({
                status: false,
                message: "No leave requests found",
                data: []
            })
        }
        return res.status(200).json({
            status: true,
            message: "Leave requests fetched successfully",
            data: result
        })

    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to fetch leave requests",
            error: error.message
        })
    }
}


/**
 * @swagger
 * /leave/approve/{requestId}:
 *   post:
 *     summary: Approve a leave request
 *     tags: [Leave]
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               remarks:
 *                 type: string
 *     responses:
 *       200:
 *         description: Leave request approved successfully
 *       400:
 *         description: Request ID is required
 *       404:
 *         description: Leave request not found or already processed
 *       500:
 *         description: Failed to approve leave request
 */
export const approveLeaveRequests = async (req: Request, res: Response) => {
    try {
        const actor = (req as any).user;
        const { requestId } = (req as any).params;
        const { remarks } = req.body;

        if(!requestId) {
            return res.status(400).json({
                status: false,
                message: "Request ID is required"
            })
        }
        const result = await LeaveService.approveLeave(
            actor.tenantId,
            actor.id,
            requestId,
            remarks
        );
        if(!result) {
            return res.status(404).json({
                status: false,
                message: "Leave request not found or already processed"
            })
        }
        return res.status(200).json({
            status: true,
            message: "Leave request approved successfully",
            data: result
        })
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to approve leave request",
            error: error.message
        })
    }
}

/**
 * @swagger
 * /leave/reject/{requestId}:
 *   post:
 *     summary: Reject a leave request
 *     tags: [Leave]
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               remarks:
 *                 type: string
 *     responses:
 *       200:
 *         description: Leave request rejected successfully
 *       400:
 *         description: Request ID is required
 *       404:
 *         description: Leave request not found or already processed
 *       500:
 *         description: Failed to reject leave request
 */
export const rejectLeaveRequests = async (req: Request, res: Response) => {
    try {
        const actor = (req as any).user;
        const { requestId } = (req as any).params;
        const { remarks } = req.body;

        if(!requestId) {
            return res.status(400).json({
                status: false,
                message: "Request ID is required"
            })
        }

        const result = await LeaveService.rejectLeave(
            actor.tenantId,
            actor.id,
            requestId,
            remarks
        );
        if(!result) {
            return res.status(404).json({
                status: false,
                message: "Leave request not found or already processed"
            })
        }
        return res.status(200).json({
            status: true,
            message: "Leave request rejected successfully",
            data: result
        })
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to reject leave request",
            error: error.message
        })
    }
}