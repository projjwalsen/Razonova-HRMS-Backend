import { Request, Response } from "express";
import { PayrollService } from "./payroll.service";

/**
 * @swagger
 * /payroll/dashboard-kpis:
 *   get:
 *     tags:
 *       - Payroll
 *     summary: Get payroll dashboard
 *     description: Returns payroll KPI data for a given month and year.
 *     parameters:
 *       - in: query
 *         name: month
 *         required: true
 *         schema:
 *           type: integer
 *           example: 4
 *       - in: query
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *           example: 2026
 *     responses:
 *       200:
 *         description: Payroll dashboard fetched successfully
 *       400:
 *         description: Month and year are required
 *       404:
 *         description: Payroll data not found
 *       500:
 *         description: Internal server error
 */
export const getPayRollDashboard = async (req: Request, res: Response) => {
    try {
        const actor = (req as any).user;
        const { month, year } = req.query as any;

        if (!month || !year) {
            return res.status(400).json({
                status: false,
                message: "Month and year are required"
            });
        }

        const result = await PayrollService.getDashboard(
            actor.tenantId,
            Number(month),
            Number(year)    
        );

        if(!result) {
            return res.status(404).json({
                status: false,
                message: "Payroll data not found for the specified month and year"
            });
        }
        return res.status(200).json({
            status: true,
            message: "Payroll dashboard fetched successfully",
            data: result
        });

    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to fetch payroll dashboard",
            error: error.message
        });
    }
}

/**
 * @swagger
 * /payroll/pay-structure:
 *   post:
 *     tags:
 *       - Payroll
 *     summary: Create or update pay structure
 *     description: Creates a new pay structure or updates an existing one for the tenant.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - components
 *             properties:
 *               name:
 *                 type: string
 *                 example: Engineering Structure
 *               departmentId:
 *                 type: string
 *                 nullable: true
 *               designationId:
 *                 type: string
 *                 nullable: true
 *               isDefault:
 *                 type: boolean
 *                 example: false
 *               components:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - label
 *                     - componentType
 *                     - valueType
 *                     - value
 *                   properties:
 *                     label:
 *                       type: string
 *                       example: Basic Pay
 *                     componentType:
 *                       type: string
 *                       enum: [BASIC, ALLOWANCE, DEDUCTION]
 *                     valueType:
 *                       type: string
 *                       enum: [PERCENTAGE, FLAT]
 *                     value:
 *                       type: number
 *                       example: 40
 *                     isTaxable:
 *                       type: boolean
 *                       example: false
 *                     attachmentRequired:
 *                       type: boolean
 *                       example: false
 *     responses:
 *       200:
 *         description: Pay structure saved successfully
 *       400:
 *         description: Validation failed or save failed
 */
export const upsertPayStructure = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;

    const {
      name,
      departmentId,
      designationId,
      isDefault,
      components
    } = req.body;

    if (!name || !Array.isArray(components) || components.length === 0) {
      return res.status(400).json({
        status: false,
        message: "name and components are required"
      });
    }

    const result = await PayrollService.upsertPayStructure(actor.tenantId, {
      name,
      departmentId,
      designationId,
      isDefault,
      components: components.map((c: any) => ({
        label: c.label,
        type: c.componentType,
        valueType: c.valueType,
        value: Number(c.value),
        isTaxable: c.isTaxable ?? false,
        attachmentRequired: c.attachmentRequired ?? false
      }))
    });

    return res.status(200).json({
      status: true,
      message: "Pay structure saved successfully",
      data: result
    });
  } catch (error: any) {
    return res.status(400).json({
      status: false,
      message: error.message || "Failed to save pay structure"
    });
  }
};

/**
 * @swagger
 * /payroll/pay-structure:
 *   get:
 *     tags:
 *       - Payroll
 *     summary: Get pay structures
 *     description: Fetches all active pay structures for the tenant.
 *     responses:
 *       200:
 *         description: Pay structures fetched successfully
 *       400:
 *         description: Failed to fetch pay structures
 */
export const getPayStructures = async (req: Request, res: Response) => {
    try {
        const actor = (req as any).user;

        const result = await PayrollService.getPayStructures(actor.tenantId);
        return res.status(200).json({
            status: true,
            message: "Pay structures fetched successfully",
            data: result
        });
    } catch (error: any) {
        return res.status(400).json({
            status: false,
            message: error.message || "Failed to fetch pay structures"
        });
    }
}

/**
 * @swagger
 * /payroll/generate:
 *   post:
 *     tags:
 *       - Payroll
 *     summary: Generate payroll for month
 *     description: Generates draft payroll entries for all eligible employees for the specified month and year.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - month
 *               - year
 *             properties:
 *               month:
 *                 type: integer
 *                 example: 4
 *               year:
 *                 type: integer
 *                 example: 2026
 *     responses:
 *       200:
 *         description: Payroll generated successfully
 *       400:
 *         description: Month and year are required or generation failed
 *       404:
 *         description: Payroll generation failed for the specified month and year
 */
export const generatePayroll = async(req: Request, res: Response) => {
    try {
        const actor = (req as any).user;

        const { month, year } = req.body as any;

        if (!month || !year) {
            return res.status(400).json({
                status: false,
                message: "Month and year are required"
            });
        }

        const result = await PayrollService.generatePayrollForMonth(
            actor.tenantId,
            Number(month),
            Number(year)    
        );
        if(!result) {
            return res.status(404).json({
                status: false,
                message: "Failed to generate payroll for the specified month and year"
            });
        }

        return res.status(200).json({
            status: true,
            message: "Payroll generated successfully",
            data: result
        });
    } catch (error: any) {
        return res.status(400).json({
            status: false,
            message: error.message || "Failed to generate payroll"
        }); 
    }
}

/**
 * @swagger
 * /payroll/process/{payrollId}:
 *   post:
 *     tags:
 *       - Payroll
 *     summary: Process payroll
 *     description: Adds payroll items such as bonus, allowance, tax, or deduction and marks payroll as processed.
 *     parameters:
 *       - in: path
 *         name: payrollId
 *         required: true
 *         schema:
 *           type: string
 *         description: Payroll ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - label
 *                     - type
 *                     - amount
 *                   properties:
 *                     label:
 *                       type: string
 *                       example: Performance Bonus
 *                     type:
 *                       type: string
 *                       enum: [EARNING, ALLOWANCE, DEDUCTION, TAX, BONUS]
 *                     amount:
 *                       type: number
 *                       example: 5000
 *                     description:
 *                       type: string
 *                       nullable: true
 *     responses:
 *       200:
 *         description: Payroll processed successfully
 *       400:
 *         description: payrollId missing or process failed
 *       404:
 *         description: Payroll not found or could not be processed
 */
export const processPayroll = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    const { payrollId } = (req as any).params;
    const { items } = req.body;

    if (!payrollId) {
      return res.status(400).json({
        status: false,
        message: "payrollId is required"
      });
    }

    const result = await PayrollService.processPayroll(
      actor.tenantId,
      payrollId,
      Array.isArray(items) ? items : []
    );
    if(!result) {
      return res.status(404).json({
        status: false,
        message: "Failed to process payroll with the specified ID"
       });
    }

    return res.status(200).json({
      status: true,
      message: "Payroll processed successfully",
      data: result
    });
  } catch (error: any) {
    return res.status(400).json({
      status: false,
      message: error.message || "Failed to process payroll"
    });
  }
};

/**
 * @swagger
 * /payroll/all-listing:
 *   get:
 *     tags:
 *       - Payroll
 *     summary: Get payrolls
 *     description: Fetch payrolls for the tenant with optional filters.
 *     parameters:
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *           example: 4
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *           example: 2026
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, PROCESSED, DISBURSING, PAID, FAILED, CANCELLED]
 *     responses:
 *       200:
 *         description: Payrolls fetched successfully
 *       500:
 *         description: Failed to fetch payrolls
 */
export const getPayrolls = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    const { month, year, userId, status } = req.query;

    const result = await PayrollService.getPayrolls(actor.tenantId, {
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
      userId: userId ? String(userId) : undefined,
      status: status
        ? (String(status) as "DRAFT" | "PROCESSED" | "DISBURSING" | "PAID" | "FAILED" | "CANCELLED")
        : undefined
    });

    return res.status(200).json({
      status: true,
      message: "Payrolls fetched successfully",
      data: result
    });
  } catch (error: any) {
    return res.status(500).json({
      status: false,
      message: "Failed to fetch payrolls",
      error: error.message
    });
  }
};

/**
 * @swagger
 * /payroll/me-listing:
 *   get:
 *     tags:
 *       - Payroll
 *     summary: Get my payrolls
 *     description: Fetch all payroll records for the logged-in user.
 *     responses:
 *       200:
 *         description: My payrolls fetched successfully
 *       500:
 *         description: Failed to fetch my payrolls
 */
export const getMyPayrolls = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;

    const result = await PayrollService.getMyPayrolls(
      actor.tenantId,
      actor.id
    );

    return res.status(200).json({
      status: true,
      message: "My payrolls fetched successfully",
      data: result
    });
  } catch (error: any) {
    return res.status(500).json({
      status: false,
      message: "Failed to fetch my payrolls",
      error: error.message
    });
  }
};

/**
 * @swagger
 * /payroll/{payrollId}:
 *   get:
 *     tags:
 *       - Payroll
 *     summary: Get payroll by ID
 *     description: Fetch a payroll record by its ID for the tenant.
 *     parameters:
 *       - in: path
 *         name: payrollId
 *         required: true
 *         schema:
 *           type: string
 *         description: Payroll ID
 *     responses:
 *       200:
 *         description: Payroll fetched successfully
 *       400:
 *         description: payrollId is required
 *       404:
 *         description: Payroll not found
 *       500:
 *         description: Failed to fetch payroll
 */
export const getPayrollById = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    const { payrollId } = (req as any).params;

    if (!payrollId) {
      return res.status(400).json({
        status: false,
        message: "payrollId is required"
      });
    }

    const result = await PayrollService.getPayrollById(
      actor.tenantId,
      payrollId
    );

    if (!result) {
      return res.status(404).json({
        status: false,
        message: "Payroll not found"
      });
    }

    return res.status(200).json({
      status: true,
      message: "Payroll fetched successfully",
      data: result
    });
  } catch (error: any) {
    return res.status(500).json({
      status: false,
      message: "Failed to fetch payroll",
      error: error.message
    });
  }
};

/**
 * @swagger
 * /payroll/me/{payrollId}:
 *   get:
 *     tags:
 *       - Payroll
 *     summary: Get my payroll by ID
 *     description: Fetch a payroll record by ID for the logged-in user only.
 *     parameters:
 *       - in: path
 *         name: payrollId
 *         required: true
 *         schema:
 *           type: string
 *         description: Payroll ID
 *     responses:
 *       200:
 *         description: My payroll fetched successfully
 *       400:
 *         description: payrollId is required
 *       404:
 *         description: Payroll not found
 *       500:
 *         description: Failed to fetch payroll
 */
export const getMyPayrollById = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    const { payrollId } = (req as any).params;

    if (!payrollId) {
      return res.status(400).json({
        status: false,
        message: "payrollId is required"
      });
    }

    const result = await PayrollService.getPayrollById(
      actor.tenantId,
      payrollId,
      actor.id,
      true
    );

    if (!result) {
      return res.status(404).json({
        status: false,
        message: "Payroll not found"
      });
    }

    return res.status(200).json({
      status: true,
      message: "My payroll fetched successfully",
      data: result
    });
  } catch (error: any) {
    return res.status(500).json({
      status: false,
      message: "Failed to fetch payroll",
      error: error.message
    });
  }
};

/**
 * @swagger
 * /payroll/mark-disbursing/{payrollId}:
 *   post:
 *     tags:
 *       - Payroll
 *     summary: Mark payroll as disbursing
 *     description: Moves payroll status to DISBURSING before final payout.
 *     parameters:
 *       - in: path
 *         name: payrollId
 *         required: true
 *         schema:
 *           type: string
 *         description: Payroll ID
 *     responses:
 *       200:
 *         description: Payroll moved to disbursing successfully
 *       400:
 *         description: payrollId missing or failed to update status
 */
export const markPayrollDisbursing = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    const { payrollId } = (req as any).params;

    if (!payrollId) {
      return res.status(400).json({
        status: false,
        message: "payrollId is required"
      });
    }

    const result = await PayrollService.markPayrollDisbursing(
      actor.tenantId,
      payrollId
    );

    return res.status(200).json({
      status: true,
      message: "Payroll moved to disbursing successfully",
      data: result
    });
  } catch (error: any) {
    return res.status(400).json({
      status: false,
      message: error.message || "Failed to move payroll to disbursing"
    });
  }
};

/**
 * @swagger
 * /payroll/mark-paid/{payrollId}:
 *   post:
 *     tags:
 *       - Payroll
 *     summary: Mark payroll as paid
 *     description: Marks a payroll entry as paid after salary disbursement.
 *     parameters:
 *       - in: path
 *         name: payrollId
 *         required: true
 *         schema:
 *           type: string
 *         description: Payroll ID
 *     responses:
 *       200:
 *         description: Payroll marked as paid successfully
 *       400:
 *         description: payrollId missing or failed to mark paid
 */
export const markPayrollPaid = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    const { payrollId } = (req as any).params;

    if (!payrollId) {
      return res.status(400).json({
        status: false,
        message: "payrollId is required"
      });
    }

    const result = await PayrollService.markPayrollPaid(
      actor.tenantId,
      payrollId
    );

    return res.status(200).json({
      status: true,
      message: "Payroll marked as paid successfully",
      data: result
    });
  } catch (error: any) {
    return res.status(400).json({
      status: false,
      message: error.message || "Failed to mark payroll paid"
    });
  }
};

/**
 * @swagger
 * /payroll/mark-failed/{payrollId}:
 *   post:
 *     tags:
 *       - Payroll
 *     summary: Mark payroll as failed
 *     description: Marks a payroll entry as failed if salary transfer did not succeed.
 *     parameters:
 *       - in: path
 *         name: payrollId
 *         required: true
 *         schema:
 *           type: string
 *         description: Payroll ID
 *     responses:
 *       200:
 *         description: Payroll marked as failed successfully
 *       400:
 *         description: payrollId missing or failed to mark failed
 */
export const markPayrollFailed = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    const { payrollId } = (req as any).params;

    if (!payrollId) {
      return res.status(400).json({
        status: false,
        message: "payrollId is required"
      });
    }

    const result = await PayrollService.markPayrollFailed(
      actor.tenantId,
      payrollId
    );

    return res.status(200).json({
      status: true,
      message: "Payroll marked as failed successfully",
      data: result
    });
  } catch (error: any) {
    return res.status(400).json({
      status: false,
      message: error.message || "Failed to mark payroll failed"
    });
  }
};