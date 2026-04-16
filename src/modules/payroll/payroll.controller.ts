import { Request, Response } from "express";
import { PayrollService } from "./payroll.service";

// type Request = Request & { user: { id: string; tenantId?: string } };

/**
 * @swagger
 * /payroll/dashboard-kpis:
 *   get:
 *     tags:
 *       - Payroll
 *     summary: Get payroll dashboard KPIs
 *     description: Returns payroll KPI data for a given month and year for the logged-in tenant.
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
 *         description: Valid month and year are required
 *       401:
 *         description: Unauthorized tenant context
 *       500:
 *         description: Failed to fetch payroll dashboard
 */
export const getPayRollDashboard = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    const tenantId = actor?.tenantId;
    const { month, year } = req.query;

    if (!tenantId) {
      return res.status(401).json({
        status: false,
        message: "Unauthorized tenant context"
      });
    }

    const parsedMonth = Number(month);
    const parsedYear = Number(year);

    if (!month || !year || Number.isNaN(parsedMonth) || Number.isNaN(parsedYear)) {
      return res.status(400).json({
        status: false,
        message: "Valid month and year are required"
      });
    }

    if (parsedMonth < 1 || parsedMonth > 12) {
      return res.status(400).json({
        status: false,
        message: "Month must be between 1 and 12"
      });
    }

    if (parsedYear < 2000 || parsedYear > 3000) {
      return res.status(400).json({
        status: false,
        message: "Year is invalid"
      });
    }

    const result = await PayrollService.getDashboard(
      tenantId,
      parsedMonth,
      parsedYear
    );

    return res.status(200).json({
      status: true,
      message: "Payroll dashboard fetched successfully",
      data: result
    });
  } catch (error: any) {
    return res.status(500).json({
      status: false,
      message: error?.message || "Failed to fetch payroll dashboard"
    });
  }
};

/**
 * @swagger
 * /payroll/component-master:
 *   post:
 *     tags:
 *       - Payroll
 *     summary: Create or update payroll component master
 *     description: Creates or updates a reusable payroll component master for the tenant.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *               - valueType
 *             properties:
 *               name:
 *                 type: string
 *                 example: House Rent Allowance
 *               type:
 *                 type: string
 *                 enum: [EARNING, ALLOWANCE, DEDUCTION, TAX, BONUS]
 *               valueType:
 *                 type: string
 *                 enum: [FLAT, PERCENTAGE_OF_BASIC]
 *              defaultValue:
 *                type: number
 *               isTaxable:
 *                 type: boolean
 *               isOptional:
 *                 type: boolean
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Payroll component master saved successfully
 *       400:
 *         description: Validation failed
 *       500:
 *         description: Internal server error
 */

export const upsertPayrollComponentMaster = async(req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    const tenantId = actor?.tenantId!;

    if(!tenantId) {
      return res.status(400).json({
        status: false,
        message: "Tenant ID is required"
      });
    }

    const {
      name,
      type,
      valueType,
      isTaxable,
      isOptional,
      defaultValue,
      isActive,
    } = req.body;

    if(!name || !type || !valueType) {
      return res.status(400).json({
        status: false,
        message: "name, type and valueType are required"
      });
    }

    const reservedBaseNames = ["basic", "basic pay", "base salary", "basic salary"];

    if (reservedBaseNames.includes(name.trim().toLowerCase())) {
      throw new Error("Base salary must come from EmployeeProfile.salary and cannot be configured as a payroll component");
    }

    const result = await PayrollService.upsertPayrollComponentMaster(tenantId, {
      name,
      type,
      valueType,
      isTaxable: Boolean(isTaxable),
      isOptional: Boolean(isOptional),
      defaultValue: defaultValue !== undefined ? Number(defaultValue) : undefined,
      isActive: Boolean(isActive)
    });

    if(!result) {
      return res.status(404).json({
        status: false,
        message: "Failed to save payroll component master"
      });
    }

    return res.status(200).json({
      status: true,
      message: "Payroll component master saved successfully",
      data: result
    });

  } catch (error: any) {
    return res.status(500).json({
      status: false,
      message: "Failed to save payroll component master",
      error: error.message
    });
  }
}

/**
 * @swagger
 * /payroll/component-master:
 *   get:
 *     tags:
 *       - Payroll
 *     summary: Get payroll component masters
 *     description: Fetch all payroll component masters for the tenant.
 *     responses:
 *       200:
 *         description: Payroll component masters fetched successfully
 *       500:
 *         description: Failed to fetch payroll component masters
 */
export const getPayrollComponentMasters = async(req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    const tenantId = actor?.tenantId!;

    if(!tenantId) {
      return res.status(400).json({
        status: false,
        message: "Tenant ID is required"
      });
    }

    const result = await PayrollService.getPayrollComponentMasters(tenantId);

    if(!result) {
      return res.status(404).json({
        status: false,
        message: "Failed to fetch payroll component masters"
      });
    }
    return res.status(200).json({
      status: true,
      message: "Payroll component masters fetched successfully",
      data: result
    });

  } catch (error: any) {
    return res.status(500).json({
      status: false,
      message: "Failed to fetch payroll component masters",
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
    const tenantId = actor?.tenantId!;

    const {
      id,
      name,
      departmentId,
      isDefault,
      isActive,
      components
    } = req.body;

    if (!name || !Array.isArray(components) || !components.length) {
      return res.status(400).json({
        status: false,
        message: "name and components are required"
      });
    }

    const result = await PayrollService.upsertPayStructure(tenantId, {
      id,
      name,
      departmentId,
      isActive,
      isDefault,
      components: (components ?? []).map((c: any) => ({
        payrollComponentMasterId: c.payrollComponentMasterId,
        valueType: c.valueType,
        value: c.value,
        isActive: c.isActive ?? true,
      }))
    });

    return res.status(200).json({
      status: true,
      message: id
        ? "Pay structure updated successfully"
        : "Pay structure created successfully",
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

export const getPayStructureForUser = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    const tenantId = actor?.tenantId!;
    const { userId } = (req as any).params;

    if (!userId) {
      return res.status(400).json({
        status: false,
        message: "userId is required"
      });
    }

    const data = await PayrollService.getPayStructureForUser(
      tenantId,
      userId
    );

    return res.status(200).json({
      status: true,
      message: "Pay structure fetched successfully",
      data
    });

  } catch (error: any) {
    return res.status(400).json({
      status: false,
      message: error.message || "Failed to fetch pay structure"
    });
  }
};




export const deletePayStructure = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    const tenantId = actor?.tenantId!;
    const { id } = (req as any).params;

    if (!id) {
      return res.status(400).json({
        status: false,
        message: "pay structure id is required"
      });
    }

    await PayrollService.deletePayStructure(tenantId, id);

    return res.status(200).json({
      status: true,
      message: "Pay structure deleted successfully"
    });
  } catch (error: any) {
    return res.status(400).json({
      status: false,
      message: error.message || "Failed to delete pay structure"
    });
  }
};


// show all employee details with baseSaLARY
export const getAllEmployeesForPayroll = async (req: Request, res: Response) => {
    try {
        const actor = (req as any).user;
        const tenantId = actor?.tenantId;

        const employees = await PayrollService.getAllEmployeesForPayroll(tenantId);

        return res.status(200).json({
            status: true,
            message: "Employees fetched successfully",
            data: employees
        });

    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: error?.message || "Failed to fetch employees"
        });
    }
};






/**
 * @swagger
 * /payroll/employee-components/{userId}:
 *   post:
 *     tags:
 *       - Payroll
 *     summary: Create or update employee payroll components
 *     description: Saves employee-specific payroll component overrides for a user.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: Employee user ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - components
 *             properties:
 *               components:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - payrollComponentMasterId
 *                     - value
 *                   properties:
 *                     payrollComponentMasterId:
 *                       type: string
 *                     valueType:
 *                       type: string
 *                       enum: [FLAT, PERCENTAGE_OF_BASIC]
 *                     value:
 *                       type: number
 *                     isActive:
 *                       type: boolean
 *                     remarks:
 *                       type: string
 *     responses:
 *       200:
 *         description: Employee payroll components saved successfully
 *       400:
 *         description: Validation failed
 */
export const upsertEmployeePayrollComponents = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    const tenantId = actor?.tenantId!;

    const { userId } = (req as any).params;
    const { components } = req.body;

    if (!userId || !Array.isArray(components)) {
      return res.status(400).json({
        status: false,
        message: "userId and components array are required"
      });
    }

    const compData = components.map((c: any) => ({
      payrollComponentMasterId: c.payrollComponentMasterId,
      valueType: c.valueType,
      value: c.value,
      isActive: c.isActive ?? true,
      remarks: c.remarks
    }));

    const result = await PayrollService.upsertEmployeePayrollComponent(
      tenantId,
      userId,
      {
        components: compData
      }
    );
    return res.status(200).json({
      status: true,
      message: "Employee payroll components saved successfully",
      data: result
    });
  } catch (error: any) {
    return res.status(400).json({
      status: false,
      message: error.message || "Failed to save employee payroll components"
    });
  }
}



/**
 * @swagger
 * /payroll/employee-components/{userId}:
 *   get:
 *     tags:
 *       - Payroll
 *     summary: Get employee payroll components
 *     description: Fetch employee-specific payroll component overrides for a user.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: Employee user ID
 *     responses:
 *       200:
 *         description: Employee payroll components fetched successfully
 *       400:
 *         description: userId is required
 */
export const getEmployeePayrollComponents = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    const tenantId = actor?.tenantId!;

    const { userId } = (req as any).params;

    if (!userId) {
      return res.status(400).json({
        status: false,
        message: "userId is required"
      });
    }

    const result = await PayrollService.getEmployeePayrollComponents(
      tenantId,
      userId
    );
    return res.status(200).json({
      status: true,
      message: "Employee payroll components fetched successfully",
      data: result
    });

  } catch (error: any) {
    return res.status(400).json({
      status: false,
      message: error.message || "Failed to fetch employee payroll components"
    });
  }
}


/**
 * @swagger
 * /payroll/generate:
 *   post:
 *     tags:
 *       - Payroll
 *     summary: Generate draft payroll for a month
 *     description: Generates draft payroll entries for all eligible employees for the specified month and year. Optional leave and attendance deduction settings can be provided for this draft generation run.
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
 *                 description: Payroll month (1-12)
 *               year:
 *                 type: integer
 *                 example: 2026
 *                 description: Payroll year
 *               leaveDeduction:
 *                 type: object
 *                 description: Optional leave deduction controls for draft payroll generation
 *                 properties:
 *                   enabled:
 *                     type: boolean
 *                     example: true
 *                     description: Enable or disable leave deduction during draft generation
 *               attendanceDeduction:
 *                 type: object
 *                 description: Optional attendance deduction controls for draft payroll generation
 *                 properties:
 *                   enabled:
 *                     type: boolean
 *                     example: true
 *                     description: Enable or disable attendance deduction during draft generation
 *     responses:
 *       200:
 *         description: Payroll generated successfully
 *       400:
 *         description: Month and year are required or payroll generation failed
 *       404:
 *         description: Failed to generate payroll for the specified month and year
 */
export const generatePayrollForMonth = async(req: Request, res: Response) => {
    try {
        const actor = (req as any).user;
        const tenantId = actor?.tenantId!;

        const { month, year, leaveDeduction, attendanceDeduction } = req.body as any;

        if (!month || !year) {
            return res.status(400).json({
                status: false,
                message: "Month and year are required"
            });
        }

        const result = await PayrollService.generatePayrollForMonth(
          tenantId,
          Number(month),
          Number(year),
          {
            leaveDeduction: leaveDeduction
              ? {
                  enabled: Boolean(leaveDeduction.enabled)
                }
              : undefined,

            attendanceDeduction: attendanceDeduction
              ? {
                  enabled: Boolean(attendanceDeduction.enabled)
                }
              : undefined
          }
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
 * /payroll/generate/user:
 *   post:
 *     tags:
 *       - Payroll
 *     summary: Update final payroll draft for one user
 *     description: Recalculates one employee's payroll draft with optional leave and attendance deduction overrides before final processing.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - month
 *               - year
 *             properties:
 *               userId:
 *                 type: string
 *               month:
 *                 type: integer
 *                 example: 4
 *               year:
 *                 type: integer
 *                 example: 2026
 *               leaveDeduction:
 *                 type: object
 *                 properties:
 *                   enabled:
 *                     type: boolean
 *                   manualLeaveCount:
 *                     type: number
 *                   manualAmountDeducted:
 *                     type: number
 *               attendanceDeduction:
 *                 type: object
 *                 properties:
 *                   enabled:
 *                     type: boolean
 *                   manualAbsentCount:
 *                     type: number
 *                   manualAmountDeducted:
 *                     type: number
 *     responses:
 *       200:
 *         description: Final payroll updated successfully for user
 *       400:
 *         description: Validation failed
 *       404:
 *         description: Payroll/user not found
 */

// export const updateFinalPayrollForUser = async(req: Request, res: Response) => {
//   try {
//     const actor = (req as any).user;
//     const tenantId = actor?.tenantId!;

//     const {
//       userId,
//       month,
//       year,
//       leaveDeduction,
//       attendanceDeduction,
//     } = req.body;

//     if(!userId){
//       return res.status(400).json({
//         status: false,
//         message: "userId is required"
//       });
//     }

//     if(month === undefined || month === null || Number.isNaN(Number(month))){
//       return res.status(400).json({
//         status: false,
//         message: "Valid month is required"
//       });
//     }

//     if(year === undefined || year === null || Number.isNaN(Number(year))){
//       return res.status(400).json({
//         status: false,
//         message: "Valid year is required"
//       });
//     }

//     const parsedMonth = Number(month);
//     const parsedYear = Number(year);

//     if(parsedMonth < 1 || parsedMonth > 12){
//       return res.status(400).json({
//         status: false,
//         message: "Invalid month. Please provide a month between 1 and 12."
//       });
//     }

//     const result = await PayrollService.updateFinalPayrollPerUser(
//       tenantId,
//       userId,
//       parsedMonth,
//       parsedYear,
//       {
//         leaveDeduction: leaveDeduction
//         ? {
//             enabled: Boolean(leaveDeduction.enabled),
//             manualLeaveCount: 
//               leaveDeduction.manualLeaveCount !== undefined &&
//               leaveDeduction.manualLeaveCount !== null
//               ? Number(leaveDeduction.manualLeaveCount)
//               : undefined,
//             manualAmountDeducted: 
//               leaveDeduction.manualAmountDeducted !== undefined &&
//               leaveDeduction.manualAmountDeducted !== null
//               ? Number(leaveDeduction.manualAmountDeducted)
//               : undefined,
//           }
//         : undefined,

//         attendanceDeduction: attendanceDeduction
//           ? {
//               enabled: Boolean(attendanceDeduction.enabled),
//               manualAbsentCount:
//                 attendanceDeduction.manualAbsentCount !== undefined &&
//                 attendanceDeduction.manualAbsentCount !== null
//                   ? Number(attendanceDeduction.manualAbsentCount)
//                   : undefined,
//               manualAmountDeducted:
//                 attendanceDeduction.manualAmountDeducted !== undefined &&
//                 attendanceDeduction.manualAmountDeducted !== null
//                   ? Number(attendanceDeduction.manualAmountDeducted)
//                   : undefined,
//             }
//           : undefined,
//       }
//     );

//     if(!result) {
//       return res.status(404).json({
//         status: false,
//         message: "Failed to update final payroll for user with the specified details"
//       });
//     }

//     return res.status(200).json({
//       status: true,
//       message: "Final payroll updated successfully for user",
//       data: result
//     });

//   } catch (error: any) {
//     return res.status(400).json({
//       status: false,
//       message: error.message || "Failed to update final payroll for user"
//     });
//   }
// }



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
    const tenantId = actor?.tenantId!;
    const { month, year, userId, status } = req.query;

    const result = await PayrollService.getPayrolls(tenantId, {
      userId: userId ? String(userId) : undefined,
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
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
    const { payrollId, userId } = (req as any).params;

    if (!payrollId) {
      return res.status(400).json({
        status: false,
        message: "payrollId is required"
      });
    }

    const result = await PayrollService.getPayrollById(
      actor.tenantId,
      payrollId,
      userId ? String(userId) : undefined,
      false
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