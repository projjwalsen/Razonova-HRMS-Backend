// resignation.controller.ts

import { Request, Response } from "express";
import { LeaveApproverType } from "@prisma/client";
import { ResignationService } from "./resignation.service";

/**
 * @swagger
 * /resignations/policy:
 *   post:
 *     tags:
 *       - resignations
 *     summary: Create or update resignation approval policy
 *     description: >
 *       COMPANY_ADMIN/HR can create or update who approves resignation requests.
 *       Controller passes req.body directly into ResignationService.upsertApprovalPolicy(actor, req.body).
 *       If id is provided, policy is updated. If id is not provided, a new policy is created.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - approverType
 *             properties:
 *               id:
 *                 type: string
 *                 example: "policy_uuid"
 *                 description: Optional. Required only when updating existing policy.
 *               name:
 *                 type: string
 *                 example: "Default Resignation Approval Policy"
 *               departmentId:
 *                 type: string
 *                 nullable: true
 *                 example: "department_uuid"
 *                 description: Optional. If null, applies company-wide fallback.
 *               designationId:
 *                 type: string
 *                 nullable: true
 *                 example: "designation_uuid"
 *                 description: Optional. Used for designation-specific policy.
 *               approverType:
 *                 type: string
 *                 enum: [REPORTING_MANAGER, DEPARTMENT_MANAGER, COMPANY_ADMIN, SPECIFIC_USER]
 *                 example: "COMPANY_ADMIN"
 *               userId:
 *                 type: string
 *                 nullable: true
 *                 example: "approver_user_uuid"
 *                 description: Required only when approverType is SPECIFIC_USER.
 *               isActive:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Resignation approval policy saved successfully
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Failed to save resignation approval policy
 */
export const upsertResignationApprovalPolicy = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    const result = await ResignationService.upsertApprovalPolicy(actor, req.body);

    return res.status(200).json({
      status: true,
      message: "Resignation approval policy saved successfully",
      data: result
    });
  } catch (error: any) {
    return res.status(500).json({
      status: false,
      message: "Failed to save resignation approval policy",
      error: error.message
    });
  }
};

/**
 * @swagger
 * /resignations/policy:
 *   get:
 *     tags:
 *       - resignations
 *     summary: Get resignation approval policies
 *     description: >
 *       Fetch all resignation approval policies for the current tenant.
 *       No request body is required. Controller calls ResignationService.getApprovalPolicies(actor).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Resignation approval policies fetched successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Failed to fetch resignation approval policies
 */
export const getResignationApprovalPolicies = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    const result = await ResignationService.getApprovalPolicies(actor);

    return res.status(200).json({
      status: true,
      message: "Resignation approval policies fetched successfully",
      data: result
    });
  } catch (error: any) {
    return res.status(500).json({
      status: false,
      message: "Failed to fetch resignation approval policies",
      error: error.message
    });
  }
};


/**
 * @swagger
 * /resignations/request:
 *   post:
 *     tags:
 *       - resignations
 *     summary: Submit resignation request
 *     description: >
 *       Employee submits resignation request.
 *       Controller extracts reason and preferredLastWorkingDate from req.body
 *       and passes them to ResignationService.submitResignation(actor, payload).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 example: "I am resigning due to personal reasons."
 *               preferredLastWorkingDate:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *                 example: "2026-05-31"
 *     responses:
 *       201:
 *         description: Resignation request submitted successfully
 *       400:
 *         description: reason is required or pending request already exists
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Failed to submit resignation request
 */
export const submitResignation = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    const { reason, preferredLastWorkingDate } = req.body;

    if (!reason) {
      return res.status(400).json({
        status: false,
        message: "reason is required"
      });
    }

    const result = await ResignationService.submitResignation(actor, {
      reason,
      preferredLastWorkingDate
    });

    return res.status(201).json({
      status: true,
      message: "Resignation request submitted successfully",
      data: result
    });
  } catch (error: any) {
    return res.status(500).json({
      status: false,
      message: "Failed to submit resignation request",
      error: error.message
    });
  }
};

/**
 * @swagger
 * /resignations/my:
 *   get:
 *     tags:
 *       - resignations
 *     summary: Get my resignation requests
 *     description: >
 *       Fetch resignation requests submitted by the logged-in employee.
 *       No request body is required. Controller calls ResignationService.getMyResignations(actor).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: My resignation requests fetched successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Failed to fetch resignation requests
 */
export const getMyResignations = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    const result = await ResignationService.getMyResignations(actor);

    return res.status(200).json({
      status: true,
      message: "My resignation requests fetched successfully",
      data: result
    });
  } catch (error: any) {
    return res.status(500).json({
      status: false,
      message: "Failed to fetch resignation requests",
      error: error.message
    });
  }
};

/**
 * @swagger
 * /resignations/pending-approvals:
 *   get:
 *     tags:
 *       - resignations
 *     summary: Get pending resignation approvals
 *     description: >
 *       Fetch pending resignation requests that the logged-in user is allowed to approve
 *       based on the stored approver snapshot.
 *       No request body is required. Controller calls ResignationService.getPendingApprovals(actor).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pending resignation approvals fetched successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Failed to fetch pending resignation approvals
 */
export const getPendingResignationApprovals = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    const result = await ResignationService.getPendingApprovals(actor);

    return res.status(200).json({
      status: true,
      message: "Pending resignation approvals fetched successfully",
      data: result
    });
  } catch (error: any) {
    return res.status(500).json({
      status: false,
      message: "Failed to fetch pending resignation approvals",
      error: error.message
    });
  }
};

/**
 * @swagger
 * /resignations/{requestId}/approve:
 *   patch:
 *     tags:
 *       - resignations
 *     summary: Approve resignation request
 *     description: >
 *       Authorized approver approves a pending resignation request.
 *       Controller extracts approvedLastWorkingDate and adminRemarks from req.body
 *       and passes them to ResignationService.approveResignation(actor, requestId, payload).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *         example: "resignation_request_uuid"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - approvedLastWorkingDate
 *             properties:
 *               approvedLastWorkingDate:
 *                 type: string
 *                 format: date
 *                 example: "2026-05-31"
 *               adminRemarks:
 *                 type: string
 *                 nullable: true
 *                 example: "Approved after discussion with manager."
 *     responses:
 *       200:
 *         description: Resignation request approved successfully
 *       400:
 *         description: approvedLastWorkingDate is required
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: User is not allowed to approve this request
 *       404:
 *         description: Pending resignation request not found
 *       500:
 *         description: Failed to approve resignation request
 */
export const approveResignation = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    const { requestId } = (req as any).params;
    const { approvedLastWorkingDate, adminRemarks } = req.body;

    if (!approvedLastWorkingDate) {
      return res.status(400).json({
        status: false,
        message: "approvedLastWorkingDate is required"
      });
    }

    const result = await ResignationService.approveResignation(actor, requestId, {
      approvedLastWorkingDate,
      adminRemarks
    });

    return res.status(200).json({
      status: true,
      message: "Resignation request approved successfully",
      data: result
    });
  } catch (error: any) {
    return res.status(500).json({
      status: false,
      message: "Failed to approve resignation request",
      error: error.message
    });
  }
};

/**
 * @swagger
 * /resignations/{requestId}/reject:
 *   patch:
 *     tags:
 *       - resignations
 *     summary: Reject resignation request
 *     description: >
 *       Authorized approver rejects a pending resignation request.
 *       Controller extracts remarks from req.body and passes it to
 *       ResignationService.rejectResignation(actor, requestId, remarks).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *         example: "resignation_request_uuid"
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               remarks:
 *                 type: string
 *                 example: "Rejected after discussion with employee."
 *     responses:
 *       200:
 *         description: Resignation request rejected successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: User is not allowed to reject this request
 *       404:
 *         description: Pending resignation request not found
 *       500:
 *         description: Failed to reject resignation request
 */
export const rejectResignation = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    const { requestId } = (req as any).params;
    const { remarks } = req.body;

    const result = await ResignationService.rejectResignation(
      actor,
      requestId,
      remarks
    );

    return res.status(200).json({
      status: true,
      message: "Resignation request rejected successfully",
      data: result
    });
  } catch (error: any) {
    return res.status(500).json({
      status: false,
      message: "Failed to reject resignation request",
      error: error.message
    });
  }
};

/**
 * @swagger
 * /resignations/{requestId}/withdraw:
 *   patch:
 *     tags:
 *       - resignations
 *     summary: Withdraw resignation request
 *     description: >
 *       Employee withdraws their own pending resignation request.
 *       No request body is required. Controller passes requestId to
 *       ResignationService.withdrawResignation(actor, requestId).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *         example: "resignation_request_uuid"
 *     responses:
 *       200:
 *         description: Resignation request withdrawn successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Pending resignation request not found
 *       500:
 *         description: Failed to withdraw resignation request
 */
export const withdrawResignation = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    const { requestId } = (req as any).params;

    const result = await ResignationService.withdrawResignation(actor, requestId);

    return res.status(200).json({
      status: true,
      message: "Resignation request withdrawn successfully",
      data: result
    });
  } catch (error: any) {
    return res.status(500).json({
      status: false,
      message: "Failed to withdraw resignation request",
      error: error.message
    });
  }
};

/**
 * @swagger
 * /resignations/{requestId}/complete:
 *   patch:
 *     tags:
 *       - resignations
 *     summary: Complete resignation and deactivate employee
 *     description: >
 *       Completes an approved resignation request and deactivates the employee.
 *       No request body is required. Controller passes requestId to
 *       ResignationService.completeResignation(actor, requestId).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *         example: "resignation_request_uuid"
 *     responses:
 *       200:
 *         description: Resignation completed successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Approved resignation request not found
 *       500:
 *         description: Failed to complete resignation
 */
export const completeResignation = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    const { requestId } = (req as any).params;

    const result = await ResignationService.completeResignation(actor, requestId);

    return res.status(200).json({
      status: true,
      message: "Resignation completed successfully",
      data: result
    });
  } catch (error: any) {
    return res.status(500).json({
      status: false,
      message: "Failed to complete resignation",
      error: error.message
    });
  }
};