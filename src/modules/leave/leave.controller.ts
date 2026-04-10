
import { Request, Response } from "express";
import { LeaveService } from "./leave.service";
import { uploadToS3 } from "../../config/s3/s3.config";
import { error } from "node:console";


type AuthRequest = Request & {
    user?: {
        id: string;
        tenantId: string;
    }
}

function handleError(res: Response, error: any, fallback: string) {
  return res.status(error.statusCode || 500).json({
    status: false,
    message: error.message || fallback
  });
}

/** ----------- Upsert Leave Type ----------------------------------------- */
/**
 * @swagger
 * /leave/type:
 *   post:
 *     summary: Create or update a leave type
 *     tags: [Leave]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Casual Leave
 *               typeCode:
 *                 type: string
 *                 enum: [CASUAL, SICK, MATERNITY, PATERNITY, EARNED, UNPAID]
 *               isActive:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Leave type saved successfully
 *
 *   get:
 *     summary: Get all active leave types
 *     tags: [Leave]
 *     responses:
 *       200:
 *         description: Leave types fetched successfully
 */
export const upsertLeaveType = async (req: AuthRequest, res: Response) => {
    try {
        const actor = (req as any).user;
        const {
            name,
            typeCode,
            isActive
        } = req.body;

        const data = await LeaveService.upsertLeaveType(
            actor.tenantId,
            {
                name,
                typeCode,
                isActive
            }
        );
        if(!data) {
            return handleError(res,
                error,
                "Failed to create leave type"
            )
        }
        return res.status(200).json({
            status: true,
            message: "Leave type saved successfully",
            data
        })
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to create leave type",
            error: error.message
        })
    }
}

// Get Leave Types --------- Admin and Managers

export const getLeaveTypes = async (req: AuthRequest, res: Response) => {
    try {
        const actor = (req as any).user;

        const data = await LeaveService.getLeaveTypes(actor.tenantId);
        if(!data) {
            return handleError(res,
                new Error("No leave types found"),
                "Failed to fetch leave types"
            )
        }
        return res.status(200).json({
            status: true,
            message: "Leave types fetched successfully",
            data
        })

    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to fetch leave types",
            error: error.message
        })
    }
}


/* -----------  Create / Update Leave Policy ---------------------------- */

/**
 * @swagger
 * /leave/policy:
 *   post:
 *     summary: Create or update a leave policy
 *     tags: [Leave]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - employmentType
 *               - rules
 *             properties:
 *               id:
 *                 type: string
 *               name:
 *                 type: string
 *                 example: Full Time Leave Policy
 *               employmentType:
 *                 type: string
 *                 enum: [FULL_TIME, TRAINEE, INTERN, CONTRACT, OTHER]
 *               probationMonths:
 *                 type: integer
 *                 example: 3
 *               isActive:
 *                 type: boolean
 *               rules:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     leaveTypeId:
 *                       type: string
 *                     annualAllocation:
 *                       type: number
 *                     maxPerRequest:
 *                       type: number
 *                     maxPerYear:
 *                       type: number
 *                     maxConsecutiveDays:
 *                       type: number
 *                     allowDuringProbation:
 *                       type: boolean
 *                     attachmentRequired:
 *                       type: boolean
 *                     priorNoticeDays:
 *                       type: integer
 *                     sandwichLeaveAllowed:
 *                       type: boolean
 *                     countMode:
 *                       type: string
 *                       enum: [WORKING_DAYS, CALENDAR_DAYS]
 *                     isPaid:
 *                       type: boolean
 *                     carryForwardAllowed:
 *                       type: boolean
 *                     carryForwardLimit:
 *                       type: number
 *                     accrualFrequency:
 *                       type: string
 *                       enum: [MONTHLY, QUARTERLY, YEARLY]
 *                     accrualAmount:
 *                       type: number
 *     responses:
 *       200:
 *         description: Leave policy created or updated successfully
 *
 *   get:
 *     summary: Get all leave policies
 *     tags: [Leave]
 *     responses:
 *       200:
 *         description: Leave policies fetched successfully
 */
export const upsertLeavePolicy = async (req: AuthRequest, res: Response) => {
    try {
        const actor = (req as any).user;

        const {
            id,
            name,
            employmentType,
            probationMonths,
            isActive,
            rules
        } = req.body;

        if(!name.trim()){
            return res.status(400).json({
                status: false,
                message: "Leave policy name is required"
            })
        }
        if(!employmentType.trim()){
            return res.status(400).json({
                status: false,
                message: "Employment type is required"
            })
        }

        if(!Array.isArray(rules) || !rules.length){
            return res.status(400).json({
                status: false,
                message: "At least one leave rule is required"
            })
        }

        const payload = {
            id: id ?? undefined,// for update if id present
            name: name.trim(),
            employmentType,
            probationMonths: probationMonths !== undefined && probationMonths !== null ? Number(probationMonths) : undefined,
            isActive: isActive !== undefined ? Boolean(isActive) : true,
            rules: rules.map((rule: any) => ({
                leaveTypeId: rule.leaveTypeId,
                annualAllocation: Number(rule.annualAllocation),
                maxPerRequest: rule.maxPerRequest !== undefined ? Number(rule.maxPerRequest) : undefined,
                maxPerYear: rule.maxPerYear !== undefined ? Number(rule.maxPerYear) : undefined,
                maxConsecutiveDays: rule.maxConsecutiveDays !== undefined ? Number(rule.maxConsecutiveDays) : undefined,
                allowDuringProbation: rule.allowDuringProbation !== undefined ? Boolean(rule.allowDuringProbation) : false,
                attachmentRequired: rule.attachmentRequired !== undefined ? Boolean(rule.attachmentRequired) : false,
                priorNoticeDays: rule.priorNoticeDays !== undefined ? Number(rule.priorNoticeDays) : undefined,
                sandwichLeaveAllowed: rule.sandwichLeaveAllowed !== undefined ? Boolean(rule.sandwichLeaveAllowed) : false,
                countMode: rule.countMode || "WORKING_DAYS",
                isPaid: rule.isPaid !== undefined ? Boolean(rule.isPaid) : true,
                carryForwardAllowed: rule.carryForwardAllowed !== undefined ? Boolean(rule.carryForwardAllowed) : false,
                carryForwardLimit: rule.carryForwardLimit !== undefined ? Number(rule.carryForwardLimit) : undefined,
                accrualFrequency: rule.accrualFrequency || "MONTHLY",
                accrualAmount: rule.accrualAmount !== undefined ? Number(rule.accrualAmount) : undefined,
            }))
        }
        
        const result = await LeaveService.upsertLeavePolicy(actor.tenantId, payload);
        if(!result) {
            return res.status(404).json({
                status: false,
                message: "Failed to create leave policy"
            })
        }
        return res.status(200).json({
            status: true,
            message: id ? "Leave policy updated successfully" : "Leave policy created successfully",
            data: result
        })
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to create leave policy",
            error: error.message
        })
    }
}

// Get Leave Policies --------- Admin and Managers

export const getLeavePolicies = async (req: AuthRequest, res: Response) => {
    try {
        const actor = (req as any).user;
        const data = await LeaveService.getLeavePolicies(actor.tenantId);
        if(!data) {
            return handleError(res,
                new Error("No leave policies found"),
                "Failed to fetch leave policies"
            )
        }
        return res.status(200).json({
            status: true,
            message: "Leave policies fetched successfully",
            data
        })
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to fetch leave policies",
            error: error.message
        })
    }
}

/* ------------- Upsert Approval Policy --------- Admin and Managers */

/**
 * @swagger
 * /leave/approval-policy:
 *   post:
 *     summary: Create or update an approval policy
 *     tags: [Leave]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - levels
 *             properties:
 *               id:
 *                 type: string
 *               name:
 *                 type: string
 *               leavePolicyId:
 *                 type: string
 *               leaveTypeId:
 *                 type: string
 *               departmentId:
 *                 type: string
 *               designationId:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *               levels:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - level
 *                     - approverType
 *                   properties:
 *                     level:
 *                       type: integer
 *                       example: 1
 *                     approverType:
 *                       type: string
 *                       enum: [REPORTING_MANAGER, DEPARTMENT_MANAGER, COMPANY_ADMIN, SPECIFIC_USER, ROLE]
 *                     roleId:
 *                       type: string
 *                     userId:
 *                       type: string
 *                     minApprovals:
 *                       type: integer
 *                       example: 1
 *     responses:
 *       200:
 *         description: Approval policy created or updated successfully
 *
 *   get:
 *     summary: Get all approval policies
 *     tags: [Leave]
 *     responses:
 *       200:
 *         description: Approval policies fetched successfully
 */
export const upsertApprovalPolicy = async (req: AuthRequest, res: Response) => {
    try {
        const actor = (req as any).user;

        const {
            id,
            name,
            leavePolicyId,
            leaveTypeId,
            departmentId,
            designationId,
            isActive,
            levels
        } = req.body;

        if (!name?.trim()) {
            return res.status(400).json({
                status: false,
                message: "Approval policy name is required"
            })
        }

        if (!Array.isArray(levels) || !levels.length) {
        return res.status(400).json({
            status: false,
            message: "At least one approval level is required"
        });
        }

        const payload = {
            id: id ?? undefined,
            name: name.trim(),
            leavePolicyId: leavePolicyId ?? null,
            leaveTypeId: leaveTypeId ?? null,
            departmentId: departmentId ?? null,
            designationId: designationId ?? null,
            isActive: isActive !== undefined ? Boolean(isActive) : true,
            levels: levels.map((level: any) => ({
                level: Number(level.level),
                approverType: level.approverType,
                roleId: level.roleId ?? undefined,
                userId: level.userId ?? undefined,
                minApprovals:
                level.minApprovals !== undefined && level.minApprovals !== null
                    ? Number(level.minApprovals)
                    : 1
            }))
        };

        for (const level of payload.levels) {
            if (!level.level || level.level < 1) {
                return res.status(400).json({
                status: false,
                message: "Each approval level must be a positive number"
                });
            }

            if (!level.approverType) {
                return res.status(400).json({
                status: false,
                message: "Approver type is required for each level"
                });
            }

            if (level.approverType === "ROLE" && !level.roleId) {
                return res.status(400).json({
                status: false,
                message: "roleId is required when approverType is ROLE"
                });
            }

            if (level.approverType === "SPECIFIC_USER" && !level.userId) {
                return res.status(400).json({
                status: false,
                message: "userId is required when approverType is SPECIFIC_USER"
                });
            }

            if (level.minApprovals && level.minApprovals < 1) {
                return res.status(400).json({
                status: false,
                message: "minApprovals must be at least 1"
                });
            }
        }

        const uniqueLevels = new Set(payload.levels.map((l) => l.level));
            if (uniqueLevels.size !== payload.levels.length) {
            return res.status(400).json({
                status: false,
                message: "Approval levels must be unique"
            });
        }

        const result = await LeaveService.upsertApprovalPolicy(actor.tenantId, payload);

        return res.status(200).json({
            status: true,
            message: id
                ? "Approval policy updated successfully"
                : "Approval policy created successfully",
            data: result
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to create approval policy",
            error: error.message
        })
    }
}

// Get Approval Policies --------- Admin and Managers

export const getApprovalPolicies = async (req: AuthRequest, res: Response) => {
    try {
        const actor = (req as any).user;

        const result = await LeaveService.getApprovalPolicies(actor.tenantId);

        if(!result || result.length === 0) {
            return res.status(404).json({
                status: false,
                message: "No approval policies found"
            })
        }
        return res.status(200).json({
            status: true,
            message: "Approval policies fetched successfully",
            data: result
        })
    } catch (error: any) {
        return res.status(500).json({
            status: false,            
            message: "Failed to fetch approval policies",
            error: error.message
        })
    }
}

/* --------- Create Holiday Calendar --------- Admin -- COMPANY_ADMIN  ----- */

/**
 * @swagger
 * /leave/holiday-calendar:
 *   post:
 *     summary: Create a holiday calendar and auto-import holidays for region calendars
 *     tags: [Leave]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - regionType
 *             properties:
 *               name:
 *                 type: string
 *               regionType:
 *                 type: string
 *                 enum: [GLOBAL, COUNTRY, STATE, CITY, CUSTOM]
 *               country:
 *                 type: string
 *               state:
 *                 type: string
 *               city:
 *                 type: string
 *               year:
 *                 type: integer
 *                 example: 2026
 *               isDefault:
 *                 type: boolean
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Holiday calendar created successfully
 */
export const createHolidayCalendar = async (req: AuthRequest, res: Response) => {
    try {
        const actor = (req as any).user;

        const {
            name,
            regionType,
            country,
            state,
            city,
            year,
            isDefault,
            isActive
        } = req.body;

        if(!name.trim()) {
            return res.status(400).json({
                status: false,
                message: "Holiday calendar name is required"
            })
        }
        if(regionType === "COUNTRY" && !country) {
            return res.status(400).json({
                status: false,
                message: "Country is required for region type COUNTRY"
            })
        }
        const payload = {
            name: name.trim(),
            regionType,
            country: country ?? undefined,
            state: state ?? undefined,
            city: city ?? undefined,
            year: year !== undefined && year !== null ? Number(year) : undefined,
            isDefault: isDefault !== undefined ? Boolean(isDefault) : false,
            isActive: isActive !== undefined ? Boolean(isActive) : true
        };

        const result = await LeaveService.createHolidayCalendar(actor.tenantId, payload);
        if(!result) {
            return res.status(404).json({
                status: false,
                message: "Failed to create holiday calendar"
            })
        }
        return res.status(200).json({
            status: true,
            message: "Holiday calendar created successfully",
            data: result
        })
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to create holiday calendar",
            error: error.message
        })
    }
}

// Create Holiday in Calendar
/**
 * @swagger
 * /leave/holiday:
 *   post:
 *     summary: Add a holiday to an existing calendar
 *     tags: [Leave]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - holidayCalendarId
 *               - name
 *               - date
 *             properties:
 *               holidayCalendarId:
 *                 type: string
 *               name:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *               isOptional:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Holiday created successfully
 */
export const createHoliday = async (req: AuthRequest, res: Response) => {
    try {
        const actor = (req as any).user;

        const {
            holidayCalendarId,
            name,
            date,
            isOptional
        } = req.body;

        if(!holidayCalendarId) {
            return res.status(400).json({
                status: false,
                message: "Holiday calendar ID is required"
            })
        }
        if(!name.trim()) {
            return res.status(400).json({
                status: false,
                message: "Holiday name is required"
            })
        }
        if(!date) {
            return res.status(400).json({
                status: false,
                message: "Holiday date is required"
            })
        }

        const result = await LeaveService.createHoliday(actor.tenantId, {
            holidayCalendarId,
            name: name.trim(),
            date: new Date(date).toString(),
            isOptional: isOptional !== undefined ? Boolean(isOptional) : false
        });
        if(!result) {
            return res.status(404).json({
                status: false,
                message: "Failed to create holiday"
            })
        }
        return res.status(200).json({
            status: true,
            message: "Holiday created successfully",
            data: result
        })
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to create holiday",
            error: error.message
        })
    }
}

/** ______________ ADMIN POV _______________________ */
/**
 * @swagger
 * /leave/holiday-calendars:
 *   get:
 *     summary: Get all holiday calendars
 *     tags: [Leave]
 *     responses:
 *       200:
 *         description: Holiday calendars fetched successfully
 *
 * /leave/holiday-calendar/active:
 *   get:
 *     summary: Get active default holiday calendar
 *     tags: [Leave]
 *     responses:
 *       200:
 *         description: Active holiday calendar fetched successfully
 */
export const getHolidaysCalendars = async (req: AuthRequest, res: Response) => {
  try {
    const actor = req.user;

    const result = await LeaveService.getHolidaysCalendars(actor.tenantId);
    if (!result || result.length === 0) {
      return res.status(404).json({
        status: false,
        message: "No holiday calendars found"
      });
    }

    return res.status(200).json({
      status: true,
      message: "Holiday calendars fetched successfully",
      data: result
    });
  } catch (error: any) {
    return res.status(error?.statusCode || 500).json({
      status: false,
      message: error?.message || "Failed to fetch holiday calendars"
    });
  }
};

/**
 * @swagger
 * /leave/holiday-calendar/{holidayCalendarId}:
 *   delete:
 *     summary: Delete a holiday calendar
 *     tags: [Leave]
 *     parameters:
 *       - in: path
 *         name: holidayCalendarId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Holiday calendar deleted successfully
 *       404:
 *         description: Holiday calendar not found
 *       500:
 *         description: Failed to delete holiday calendar
 */
export const deleteHolidayCalendar = async (req: AuthRequest, res: Response) => {
    try {
        const actor = (req as any).user;
        const { calendarId } = (req as any).params;

        if(!calendarId) {
            return res.status(400).json({
                status: false,
                message: "Holiday calendar ID is required"
            })
        }

        const result = await LeaveService.deleteHolidayCalendar(actor.tenantId, calendarId);
        if(!result) {
            return res.status(404).json({
                status: false,
                message: "Failed to delete holiday calendar"
            })
        }

        return res.status(200).json({
            status: true,
            message: "Holiday calendar deleted successfully"
        })

    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to delete holiday calendar",
            error: error.message
        });
    }
}

/** ------------  USER POV ______________________ */
export const getActiveHolidayCalendar = async (req: AuthRequest, res: Response) => {
  try {
    const actor = req.user;

    const result = await LeaveService.getActiveHolidayCalendar(actor.tenantId);
    if (!result) {
      return res.status(404).json({
        status: false,
        message: "No active holiday calendar found"
      });
    }

    return res.status(200).json({
      status: true,
      message: "Active holiday calendar fetched successfully",
      data: result
    });
  } catch (error: any) {
    return res.status(error?.statusCode || 500).json({
      status: false,
      message: error?.message || "Failed to fetch active holiday calendar"
    });
  }
};

/**
 * @swagger
 * /leave/work-week:
 *   put:
 *     summary: Update tenant work week
 *     tags: [Leave]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - workingDays
 *             properties:
 *               workingDays:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [SUNDAY, MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY]
 *     responses:
 *       200:
 *         description: Work week updated successfully
 *
 *   get:
 *     summary: Get tenant work week
 *     tags: [Leave]
 *     responses:
 *       200:
 *         description: Work week fetched successfully
 */
/** ------------  Update Work Week  -- ORGANIZATION settings ______________________ */
export const updateWorkWeek = async (req: AuthRequest, res: Response) => {
    try {
        const actor = req.user;
        const { workingDays } = req.body;

        const validDays = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
        if (!Array.isArray(workingDays) || workingDays.length === 0) {
            return res.status(400).json({
                status: false,
                message: "workingDays must be a non-empty array"
            });
        }
        for (const day of workingDays) {
            if (!validDays.includes(day)) {
                return res.status(400).json({
                    status: false,
                    message: `Invalid day: ${day}. Valid days are ${validDays.join(", ")}`
                });
            }
        }

        const result = await LeaveService.updateWorkWeek(actor.tenantId, workingDays);
        if (!result) {
            return res.status(404).json({
                status: false,
                message: "Failed to update work week"
            });
        }
        return res.status(200).json({
            status: true,
            message: "Work week updated successfully",
            data: result
        });
    } catch (error: any) {
        return res.status(error?.statusCode || 500).json({
            status: false,
            message: error?.message || "Failed to update work week"
        });
    }
}

export const getWorkWeek = async (req: AuthRequest, res: Response) => {
    try {
        const actor = req.user;
        const result = await LeaveService.getWorkWeek(actor.tenantId);
        if (!result) {
            return res.status(404).json({
                status: false,
                message: "Failed to fetch work week"
            });
        }
        return res.status(200).json({
            status: true,
            message: "Work week fetched successfully",
            data: result
        });
    } catch (error: any) {
        return res.status(error?.statusCode || 500).json({
            status: false,
            message: error?.message || "Failed to fetch work week"
        });
    }
}



/*** _____________ LEAVE PART _____________________ */


// ------------Apply Leave -------------------------

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
 *             required:
 *               - leaveTypeId
 *               - startDate
 *               - endDate
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
 *       201:
 *         description: Leave applied successfully
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
        const files = (req as any).files || [];

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

// Get My Leave Balance --------- Users

/**
 * @swagger
 * /leave/balance/me:
 *   get:
 *     summary: Get my leave balance
 *     tags: [Leave]
 *     responses:
 *       200:
 *         description: Leave balance fetched successfully
 *
 * /leave/requests:
 *   get:
 *     summary: Get all leave requests for tenant
 *     tags: [Leave]
 *     responses:
 *       200:
 *         description: Leave requests fetched successfully
 *
 * /leave/requests/{userId}:
 *   get:
 *     summary: Get leave requests for a specific user
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
 *
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
 *
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
 *
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
 */



export const getMyLeaveBalance = async (req: AuthRequest, res: Response) => {
    try {
        const actor = req.user;
        const result = await LeaveService.getMyLeaveBalance(actor.tenantId, actor.id);
        if(!result) {
            return res.status(404).json({
                status: false,
                message: "Failed to fetch leave balance"
            })
        }
        return res.status(200).json({
            status: true,
            message: "Leave balance fetched successfully",
            data: result
        })
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to fetch leave balance",
            error: error.message
        })
    }
}

// Get Leave Requests --------- Admin and Managers
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

// Cancel Leave Request --------- Users
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


// Approve / Reject Leave Request --------- Admin and Managers

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