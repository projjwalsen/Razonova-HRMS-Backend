import { PayrollItemType, PayStructureValueType, Prisma } from "@prisma/client";
import { prisma } from "../../config/db/prisma";
import { getDaysInMonth, getPayrollMonthEnd, getPayrollMonthStart, getTenantTimezone } from "../utils/util";

type ResolvedPayrollComponent = {
    payrollComponentMasterId: string,
    name?: string | undefined,
    type: "EARNING" | "ALLOWANCE" |"DEDUCTION" | "TAX" | "BONUS",
    valueType: "FLAT" | "PERCENTAGE_OF_BASIC",
    value: number,
    amount: number,
    isTaxable: boolean,
}

export class PayrollService {
    static async getDashboard(tenantId: string, month: number, year: number) {
        const payrolls = await prisma.payroll.findMany({
            where: {
                tenantId,
                month,
                year
            }
        });

        const totalPayroll = payrolls.reduce((sum, p) => sum + p.netSalary, 0);
        const processedCount = payrolls.filter(p => p.status === "PROCESSED" || p.status === "PAID").length;
        const pendingCount = payrolls.filter(p => p.status === "DRAFT").length;
        const avgSalary = payrolls.length > 0
        ? totalPayroll / payrolls.length
        : 0;

        return {
            totalPayroll,
            processedCount,
            pendingCount,
            avgSalary
        }
    }

    static async upsertPayrollComponentMaster(
        tenantId: string,
        payload: {
            name: string,       
            type: "EARNING" | "ALLOWANCE" |"DEDUCTION" | "TAX" | "BONUS",
            valueType: "FLAT" | "PERCENTAGE_OF_BASIC",
            isTaxable?: boolean,
            isOptional?: boolean,
            isActive?: boolean
        }
    ) {
        const name = payload.name.trim();
        // create a new component master if not exists, else update the existing one
        const existing = await prisma.payrollComponentMaster.findFirst({
            where: {
                tenantId,
                name
            }
        });
        if(!existing) {
            return prisma.payrollComponentMaster.create({
                data: {
                    tenantId,
                    name,
                    type: payload.type,
                    valueType: payload.valueType,
                    isTaxable: payload.isTaxable ?? false,
                    isOptional: payload.isOptional ?? false,
                    isActive: payload.isActive ?? true
                }
            })
        }

        return prisma.payrollComponentMaster.update({
            where: { id: existing.id },
            data: {
                name,
                type: payload.type,
                valueType: payload.valueType,
                isTaxable: payload.isTaxable ?? false,
                isOptional: payload.isOptional ?? false,
                isActive: payload.isActive ?? true
            }
        })
        
    }

    static async getPayrollComponentMasters(tenantId: string) {
        return prisma.payrollComponentMaster.findMany({
            where: {
                tenantId
            },
            orderBy: [
                { type: "asc" }, { createdAt: "desc" }
            ]
        })
    }

    static async upsertPayStructure (
        tenantId: string,
        payload: {
            name: string,
            departmentId?: string,
            designationId?: string,
            isDefault?: boolean,
            isActive?: boolean,
            components: Array<{
                payrollComponentMasterId: string,
                valueType?: PayStructureValueType,
                value: number,
                isActive?: boolean,
            }>
        }
    ) {
        const name = payload.name.trim();

        const masterIds = payload.components.map(c => c.payrollComponentMasterId);

        // find all referenced component masters and validate
        const masters = await prisma.payrollComponentMaster.findMany({
            where: {
                tenantId,
                id: {
                    in: masterIds
                },
                isActive: true
            }
        });

        if(masters.length !== masterIds.length) {
            throw new Error("One or more payroll component masters are invalid");
        }

        const existing = await prisma.payStructure.findFirst({
            where: {
                tenantId,
                name
            }
        });

        const componentsData = payload.components.map(c => {
            const master = masters.find(m => m.id === c.payrollComponentMasterId)!;
            return {
                payrollMasterComponent: {
                    connect: { id: c.payrollComponentMasterId }
                },
                valueType: c.valueType ?? master.valueType,
                value: c.value,
                isActive: c.isActive ?? true,
            }
        })

        if(!existing) {
            // Create new structure
            return prisma.payStructure.create({
                data: {
                    tenantId,
                    name: payload.name,
                    departmentId: payload.departmentId,
                    designationId: payload.designationId,
                    isDefault: payload.isDefault || false,
                    components: {
                        create: componentsData
                    }
                },
                include: {
                    department: true,
                    designation: true,
                    components: {
                        include: {
                            payrollMasterComponent: true
                        }
                    }
                }
            })
        }


        return prisma.$transaction(async (tx) => {
            await tx.payStructureComponent.deleteMany({
                where: {
                    payStructureId: existing.id
                }
            });
            return tx.payStructure.update({
                where: { id: existing!.id },
                data: {
                    departmentId: payload.departmentId,
                    designationId: payload.designationId,
                    isDefault: payload.isDefault || false,
                    isActive: payload.isActive ?? true,
                    components: {
                        create: componentsData
                    }
                },
                include: {
                    department: true,
                    designation: true,
                    components: {
                        include: {
                            payrollMasterComponent: true
                        }
                    }
                }
            })
        })
    }
    static async getPayStructures(tenantId: string) {
        return prisma.payStructure.findMany({
            where: {
                tenantId
            },
            include: {
                components: true,
                department: true,
                designation: true
            },
            orderBy: {
                createdAt: "desc"
            }
        });
    }


    static async upsertEmployeePayrollComponent(
        tenantId: string,
        userId: string,
        payload: {
            components: Array<{
                payrollComponentMasterId: string,
                valueType?: PayStructureValueType,
                value: number,
                isActive?: boolean,
                remarks?: string
            }>
        }
    ) {
        const user = await prisma.user.findFirst({
            where: {
                tenantId,
                id: userId
            }
        });
        if(!user) {
            throw new Error("User not found");
        }
        const masterIds = payload.components.map(c => c.payrollComponentMasterId);

        // find all referenced component masters and validate
        const masters = await prisma.payrollComponentMaster.findMany({
            where: {
                tenantId,
                id: {
                    in: masterIds
                },
                isActive: true
            }
        });

        if(masters.length !== masterIds.length) {
            throw new Error("One or more payroll component masters are invalid");
        }

        return prisma.$transaction(async (tx) => {
            for(const component of payload.components) {
                const master = masters.find(m => m.id === component.payrollComponentMasterId)!;

                await tx.employeePayrollComponent.upsert({
                    where: {
                        userId_payrollMasterComponentId: {
                            userId,
                            payrollMasterComponentId: component.payrollComponentMasterId
                        }
                    },
                    update: {
                        valueType: component.valueType,
                        value: component.value,
                        isActive: component.isActive,
                        remarks: component.remarks
                    },
                    create: {
                        tenantId,
                        userId,
                        payrollMasterComponentId: component.payrollComponentMasterId,
                        valueType: component.valueType ?? master.valueType,
                        value: Number(component.value),
                        isActive: component.isActive ?? true,
                        remarks: component.remarks ?? null
                    },
                })
            }

            return tx.employeePayrollComponent.findMany({
                where: {
                    userId,
                    tenantId
                },
                include: {
                    payrollMasterComponent: true
                },
                orderBy: {
                    createdAt: "desc"
                }
            })
        })
    }

    static async getEmployeePayrollComponents(tenantId: string, userId: string) {
        return prisma.employeePayrollComponent.findMany({
            where: {
                tenantId,
                userId,
                isActive: true
            },
            include: {
                payrollMasterComponent: true
            },
            orderBy: {
                createdAt: "desc"
            }
        })
    }

    private static calculateComponentAmount(
        baseSalary: number,
        valueType: PayStructureValueType,
        value: number
    ){
        if(valueType === "PERCENTAGE_OF_BASIC"){
            return Number(((baseSalary * value) / 100).toFixed(2));
        }

        return Number(value.toFixed(2));
    }

    private static applyAttendanceLeaveAdjustment(args: {
        resolvedComponents: ResolvedPayrollComponent[];
        unpaidLeaves: number;
        absentDays: number;
        perDaySalary: number;
        config?: {
            leaveDeduction?: {
                enabled?: boolean;
                manualLeaveCount?: number;
                manualAmountDeducted?: number;
            },
            attendanceDeduction?: {
                enabled?: boolean;
                manualAbsentCount?: number;
                manualAmountDeducted?: number;
            }
        }
    }) {
        const {
            resolvedComponents,
            unpaidLeaves,
            absentDays,
            perDaySalary,
            config
        } = args;

        const leaveDeductionComponent = resolvedComponents.find(comp =>
            comp.type === "DEDUCTION" &&
            comp.name?.toLowerCase().includes("leave")
        );
        const attendanceDeductionComponent = resolvedComponents.find(comp =>
            comp.type === "DEDUCTION" &&
            comp.name?.toLowerCase().includes("attendance")
        );

        const leaveDeductionEnabled = config?.leaveDeduction?.enabled ?? Boolean(leaveDeductionComponent);
        const attendanceDeductionEnabled = config?.attendanceDeduction?.enabled ?? Boolean(attendanceDeductionComponent);

        const effectiveUnpaidLeaves = config?.leaveDeduction?.manualLeaveCount ?? unpaidLeaves;
        const effectiveAbsentDays = config?.attendanceDeduction?.manualAbsentCount ?? absentDays;

        const unpaidLeaveDeduction = !leaveDeductionEnabled 
        ? 0
        : config?.leaveDeduction?.manualAmountDeducted ??
        Number((effectiveUnpaidLeaves * perDaySalary).toFixed(2));

        const attendanceDeduction = !attendanceDeductionEnabled
        ? 0
        : config?.attendanceDeduction?.manualAmountDeducted ??
        Number((effectiveAbsentDays * perDaySalary).toFixed(2));

        return {
            leaveDeductionEnabled,
            attendanceDeductionEnabled,
            effectiveUnpaidLeaves,
            effectiveAbsentDays,
            unpaidLeaveDeduction,
            attendanceDeduction
        }
    }


    // Resolve the final payroll component set for one employee before generating payroll.
    private static async resolvePayrollComponents(
        tx: any,
        tenantId: string,
        userId: string,
        payStructureId: string,
        baseSalary: number
    ){
        // 1. Load active components from assigned pay structure
        const structureComponents = await tx.payStructureComponent.findMany({
            where: {
                payStructureId,
                isActive: true,
                payrollMasterComponent: {
                    tenantId,
                    isActive: true,
                }
            },
            include: {
                payrollMasterComponent: true
            }
        });

        // 2. Load active employee level overrides for the user
        const employeeOverrides = await tx.employeePayrollComponent.findMany({
            where: {
                tenantId,
                userId,
                isActive: true,
                payrollMasterComponent: {
                    isActive: true
                }
            },
            include: {
                payrollMasterComponent: true
            }
        });

        // 3. Merge the two sets, giving priority to employee level overrides
        const overrideMap = new Map(
            employeeOverrides.map((item: any) => [item.payrollMasterComponentId, item])
        );

        const resolvedComponents: ResolvedPayrollComponent[] = [];

        type EmployeeOverride = Prisma.employeePayrollComponentGetPayload<{
            include: {
                payrollMasterComponent: true;
            };
        }>;

        
        for(const structureComponent of structureComponents) {

            const override = overrideMap.get(structureComponent.payrollMasterComponentId) as EmployeeOverride | undefined; // Check if there's an employee level override for this component
            const master = structureComponent.payrollMasterComponent; // get master component details

            const valueType = override?.valueType ?? structureComponent?.valueType
            const value = override?.value ?? structureComponent.value;
            const amount = this.calculateComponentAmount(baseSalary, valueType, value);

            resolvedComponents.push({
                payrollComponentMasterId: structureComponent.payrollMasterComponentId,
                name: master.name,
                type: master.type as PayrollItemType,
                valueType,
                value,
                amount,
                isTaxable: master.isTaxable
            })
        }

        // 4. Add any additional employee level components that are not part of the structure
        for(const override of employeeOverrides) {
            const existsInStructure = structureComponents.some((comp: any) => comp.payrollMasterComponentId === override.payrollMasterComponentId);

            if(existsInStructure) continue;

            const master = override.payrollMasterComponent;
            const valueType = override.valueType;
            const value = override.value;
            const amount = this.calculateComponentAmount(baseSalary, valueType, value);

            resolvedComponents.push({
                payrollComponentMasterId: override.payrollMasterComponentId,
                name: master.name,
                type: master.type as PayrollItemType,
                valueType,
                value,
                amount,
                isTaxable: master.isTaxable
            })
        }

        return resolvedComponents;
    }


    static async generatePayrollForMonth(tenantId: string, month: number, year: number,
        config?: {
            leaveDeduction?: {
                enabled: boolean,
                manualLeaveCount?: number,
                manualAmountDeducted?: number
            },
            attendanceDeduction?: {
                enabled: boolean,
                manualAbsentCount?: number,
                manualAmountDeducted?: number
            }
        }
    ) {
        const timezone = await getTenantTimezone(tenantId);

        const monthStart = getPayrollMonthStart(month, year, timezone);
        const monthEnd = getPayrollMonthEnd(month, year, timezone)
        const daysInMonth = getDaysInMonth(month, year, timezone);

        const users = await prisma.user.findMany({
            where: {
                tenantId,
                isActive: true
            },
            include: {
                employeeProfile: true,
                designation: true,
                department: true,
            }
        });
        const generatedPayrolls: any[] = [];

        await prisma.$transaction(async (tx) => {
            for(const user of users) {
                const salary = Number(user.employeeProfile?.salary ?? 0);
                if(!salary || salary <= 0) continue;


                const payStructure = await tx.payStructure.findFirst({
                    where: {
                        tenantId,
                        isActive: true,
                        OR: [
                            {
                                departmentId: user.departmentId ?? undefined,
                                designationId: user.designationId ?? undefined
                            },
                            {
                                departmentId: user.departmentId ?? undefined,
                                designationId: null,
                            },
                            {
                                departmentId: null,
                                designationId: user.designationId ?? undefined
                            },
                            {
                                isDefault: true
                            }
                        ]
                    },
                    include: {
                        components: true
                    },
                    orderBy: [
                        { isDefault: "asc" },
                        { createdAt: "desc" }
                    ]
                });
                if (!payStructure) continue; // Skip if no pay structure found

                const attendances = await tx.attendance.findMany({
                    where: {
                        tenantId,
                        userId: user.id,
                        date: {
                            gte: monthStart,
                            lte: monthEnd
                        }
                    }
                });
                
                const approvedLeaves = await tx.leaveRequest.findMany({
                    where: {
                        tenantId,
                        userId: user.id,
                        status: "APPROVED",
                        startDate: {
                            lte: monthEnd
                        },
                        endDate: {
                            gte: monthStart
                        }
                    },
                    include: {
                        leavePolicyRule: true,
                        leaveType: true
                    }
                });
                const presentDays = attendances.filter(a => a.status === "PRESENT").length;
                const lateDays = attendances.filter(a => a.status === "LATE").length;
                const halfDays = attendances.filter(a => a.status === "HALF_DAY").length;
                const absentDays = attendances.filter(a => a.status === "ABSENT").length;

                let paidLeaves = 0;
                let unpaidLeaves = 0;

                for(const leave of approvedLeaves){
                    if(leave.leavePolicyRule?.isPaid){
                        paidLeaves += leave.totalDays;
                    } else {
                        unpaidLeaves += leave.totalDays;
                    }
                }

                const payableDays = presentDays + lateDays + (halfDays * 0.5) + paidLeaves;
                const perDaySalary = Number((salary / daysInMonth).toFixed(2));

                const resolvedComponents = await this.resolvePayrollComponents(
                    tx,
                    tenantId,
                    user.id,
                    payStructure.id,
                    salary
                )

                let totalEarnings = 0;
                let totalAllowances = 0;
                let totalDeductions = 0;
                let totalTax = 0;
                let totalBonus = 0;

                for(const component of resolvedComponents){
                    if(component.type === "EARNING") totalEarnings += component.amount;
                    if(component.type === "ALLOWANCE") totalAllowances += component.amount;
                    if(component.type === "DEDUCTION") totalDeductions += component.amount;
                    if(component.type === "TAX") totalTax += component.amount;
                    if(component.type === "BONUS") totalBonus += component.amount;
                }

                // Optional : Admin controlled attendance / leave based deduction impact
                const adjustments = this.applyAttendanceLeaveAdjustment({
                    resolvedComponents,
                    unpaidLeaves,
                    absentDays,
                    perDaySalary,
                    config
                });


                const attendanceBasedGross = Number((payableDays * perDaySalary).toFixed(2));

                const finalTotalDeduction = Number(
                    (
                        totalDeductions +
                        adjustments.unpaidLeaveDeduction +
                        adjustments.attendanceDeduction
                    ).toFixed(2)
                );

                const grossSalary = Number(
                    (attendanceBasedGross + totalEarnings + totalAllowances + totalBonus).toFixed(2)
                );

                const netSalary = Number(
                    (grossSalary - finalTotalDeduction - totalTax).toFixed(2)
                );

                const payroll = await tx.payroll.upsert({
                    where: {
                        tenantId_userId_month_year: {
                            tenantId,
                            userId: user.id,
                            month,
                            year
                        }
                    },
                    update: {
                        payStructureId: payStructure.id,
                        baseSalary: salary,
                        grossSalary,
                        totalEarnings,
                        totalAllowances,
                        totalBonus,
                        totalDeductions: finalTotalDeduction,
                        totalTax,
                        netSalary,
                        presentDays,
                        absentDays: adjustments.effectiveAbsentDays,
                        halfDays,
                        lateDays,
                        payableDays,
                        unpaidLeaves: adjustments.effectiveUnpaidLeaves,
                        status: "DRAFT",
                        items: {
                            deleteMany: {} // Clear existing items, they will be re-created based on current config and adjustments
                        }
                    },
                    create: {
                        tenantId,
                        userId: user.id,
                        payStructureId: payStructure.id,
                        month,
                        year,
                        baseSalary: salary,
                        grossSalary,
                        totalEarnings,
                        totalAllowances,
                        totalBonus,
                        totalDeductions: finalTotalDeduction,
                        totalTax,
                        netSalary,
                        presentDays,
                        absentDays: adjustments.effectiveAbsentDays,
                        halfDays,
                        lateDays,
                        payableDays,
                        paidLeaves,
                        unpaidLeaves: adjustments.effectiveUnpaidLeaves,
                        status: "DRAFT",
                    }
                });
                // Generate payroll items for the resolved components
                const generatedItemsData = [
                    ...resolvedComponents.map(comp => ({
                        payrollId: payroll.id,
                        label: comp.name as string,
                        type: comp.type,
                        amount: comp.amount,
                        description: `Auto generated from payroll configuration`
                    })),
                    ...(adjustments.unpaidLeaveDeduction > 0
                        ? [
                            {
                                payrollId: payroll.id,
                                label: "Leave Deduction",
                                type: "DEDUCTION" as PayrollItemType,
                                amount: adjustments.unpaidLeaveDeduction,
                                description: `Deduction for ${adjustments.effectiveUnpaidLeaves} unpaid leave days`
                            }
                        ]
                    :  []),
                    ...(adjustments.attendanceDeduction > 0 
                        ? [
                            {
                                payrollId: payroll.id,
                                label: "Attendance Deduction",
                                type: "DEDUCTION" as PayrollItemType,
                                amount: adjustments.attendanceDeduction,
                                description: `Deduction for ${adjustments.effectiveAbsentDays} absent days`
                            }
                        ]
                    : [])
                ];

                if(generatedItemsData.length) {
                    await tx.payrollItem.createMany({
                        data: generatedItemsData
                    });
                }


                const fullPayroll = await tx.payroll.findFirst({
                    where: { id: payroll.id },
                    include: {
                        items: true,
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true
                            }
                        },
                        payStructure: {
                            include: {
                                components: {
                                    include: {
                                        payrollMasterComponent: true
                                    }
                                }
                            }
                        },
                        payslip: true
                    }
                });

                generatedPayrolls.push(fullPayroll);
            }
        });
        return generatedPayrolls;
    }

    static async updateFinalPayrollPerUser(
        tenantId: string,
        userId: string,
        month: number,
        year: number,
        config?: {
            leaveDeduction?: {
                enabled: boolean,
                manualLeaveCount?: number,
                manualAmountDeducted?: number
            },
            attendanceDeduction?: {
                enabled: boolean,
                manualAbsentCount?: number,
                manualAmountDeducted?: number
            }
        }
    ) {
        const timezone = await getTenantTimezone(tenantId);

        const monthStart = getPayrollMonthStart(month, year, timezone);
        const monthEnd = getPayrollMonthEnd(month, year, timezone)
        const daysInMonth = getDaysInMonth(month, year, timezone);

        const user = await prisma.user.findFirst({
            where: {
                tenantId,
                id: userId,
                isActive: true
            },
            include: {
                employeeProfile: true,
                designation: true,
                department: true,
            }
        });

        if(!user) {
            throw new Error("User not found");
        }

        const salary = Number(user.employeeProfile?.salary ?? 0);
        if(!salary || salary <= 0) {
            throw new Error("Employee salary not defined or invalid");
        }

        return prisma.$transaction(async (tx) => {
            const payStructure = await tx.payStructure.findFirst({
                where: {
                    tenantId,
                    isActive: true,
                    OR: [
                        {
                            departmentId: user.departmentId ?? undefined,
                            designationId: user.designationId ?? undefined
                        },
                        {
                            departmentId: user.departmentId ?? undefined,
                            designationId: null,
                        },
                        {
                            departmentId: null,
                            designationId: user.designationId ?? undefined
                        },
                        {
                            isDefault: true
                        }
                    ]
                },
                include: {
                    components: {
                        include: {
                            payrollMasterComponent: true
                        }
                    }
                },
                orderBy: [
                    { isDefault: "asc" },
                    { createdAt: "desc" }
                ]
            });

            if (!payStructure) {
                throw new Error("No pay structure assigned to employee");
            }

            const attendances = await tx.attendance.findMany({
                where: {
                    tenantId,
                    userId: user.id,
                    date: {
                        gte: monthStart,
                        lte: monthEnd
                    }
                }
            });

            const approvedLeaves = await tx.leaveRequest.findMany({
                where: {
                    tenantId,
                    userId: user.id,
                    status: "APPROVED",
                    startDate: {
                        lte: monthEnd
                    },
                    endDate: {
                        gte: monthStart
                    }
                },
                include: {
                    leavePolicyRule: true,
                    leaveType: true
                }
            });

            const presentDays = attendances.filter(a => a.status === "PRESENT").length;
            const lateDays = attendances.filter(a => a.status === "LATE").length;
            const halfDays = attendances.filter(a => a.status === "HALF_DAY").length;
            const absentDays = attendances.filter(a => a.status === "ABSENT").length;

            let paidLeaves = 0;
            let unpaidLeaves = 0;

            for(const leave of approvedLeaves) {
                if(leave.leavePolicyRule?.isPaid){
                    paidLeaves += leave.totalDays;
                } else{
                    unpaidLeaves += leave.totalDays;
                }
            }

            const payableDays = presentDays + lateDays + (halfDays * 0.5) + paidLeaves;
            const perDaySalary = Number((salary / daysInMonth).toFixed(2));

            const resolvedComponents = await this.resolvePayrollComponents(
                tx,
                tenantId,
                user.id,
                payStructure.id,
                salary
            );

            let totalEarnings = 0;
            let totalAllowances = 0;
            let totalDeductions = 0;
            let totalTax = 0;
            let totalBonus = 0;

            for(const component of resolvedComponents){
                if(component.type === "EARNING") totalEarnings += component.amount;
                if(component.type === "ALLOWANCE") totalAllowances += component.amount;
                if(component.type === "DEDUCTION") totalDeductions += component.amount;
                if(component.type === "TAX") totalTax += component.amount;
                if(component.type === "BONUS") totalBonus += component.amount;
            };

            const adjustments = this.applyAttendanceLeaveAdjustment({
                resolvedComponents,
                unpaidLeaves,
                absentDays,
                perDaySalary,
                config
            });

            const attendanceBasedGross = Number((payableDays * perDaySalary).toFixed(2));

            const finalTotalDeduction = Number(
                (
                    totalDeductions +
                    adjustments.unpaidLeaveDeduction +
                    adjustments.attendanceDeduction
                ).toFixed(2)
            );

            const grossSalary = Number(
                (
                    attendanceBasedGross + totalEarnings + totalAllowances + totalBonus
                ).toFixed(2)
            );

            const netSalary = Number(
                (grossSalary - finalTotalDeduction - totalTax).toFixed(2)
            );

            const payroll = await tx.payroll.upsert({
                where: {
                    tenantId_userId_month_year: {
                        tenantId,
                        userId: user.id,
                        month,
                        year
                    }
                },
                update: {
                    payStructureId: payStructure.id,
                    baseSalary: salary,
                    grossSalary,
                    totalEarnings,
                    totalAllowances,
                    totalBonus,
                    totalDeductions: finalTotalDeduction,
                    totalTax,
                    netSalary,
                    presentDays,
                    absentDays: adjustments.effectiveAbsentDays,
                    halfDays,
                    lateDays,
                    payableDays,
                    paidLeaves,
                    unpaidLeaves: adjustments.effectiveUnpaidLeaves,
                    status: "DRAFT",
                    items: {
                        deleteMany: {}
                    }
                },
                create: {
                    tenantId,
                    userId: user.id,
                    payStructureId: payStructure.id,
                    month,
                    year,
                    baseSalary: salary,
                    grossSalary,
                    totalEarnings,
                    totalAllowances,
                    totalBonus,
                    totalDeductions: finalTotalDeduction,
                    totalTax,
                    netSalary,
                    presentDays,
                    absentDays: adjustments.effectiveAbsentDays,
                    halfDays,
                    lateDays,
                    payableDays,
                    paidLeaves,
                    unpaidLeaves: adjustments.effectiveUnpaidLeaves,
                    status: "DRAFT",
                }
            });

            // return the enriched version of the payroll with resolved components for frontend display
            const generatedItemsData = [
                ...resolvedComponents.map(comp => ({
                    payrollId: payroll.id,
                    label: comp.name as string,
                    type: comp.type,
                    amount: comp.amount,
                    description: `Auto generated from payroll configuration`
                })),
                ...(adjustments.unpaidLeaveDeduction > 0
                    ? [
                        {
                            payrollId: payroll.id,
                            label: "Leave Deduction",
                            type: "DEDUCTION" as PayrollItemType,
                            amount: adjustments.unpaidLeaveDeduction,
                            description: `Deduction for ${adjustments.effectiveUnpaidLeaves} unpaid leave days`
                        }
                    ]
                : []),
                ...(adjustments.attendanceDeduction > 0
                    ? [
                        {
                            payrollId: payroll.id,
                            label: "Attendance Deduction",
                            type: "DEDUCTION" as PayrollItemType,
                            amount: adjustments.attendanceDeduction,
                            description: `Deduction for ${adjustments.effectiveAbsentDays} absent days`
                        }
                    ]
                : [])
            ];


            if(generatedItemsData.length ){
                await tx.payrollItem.createMany({
                    data: generatedItemsData
                })
            }

            // Refetch payroll with items to return enriched data for frontend display
            const fullPayroll = await tx.payroll.findFirst({
                where: { id: payroll.id },
                include: {
                    items: true,
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        }
                    },
                    payStructure: {
                        include: {
                            components: {
                                include: {
                                    payrollMasterComponent: true
                                }
                            }
                        }
                    },
                    payslip: true
                }
            });

            return fullPayroll;
        })

    }

    static async processPayroll(tenantId: string, payrollId: string, 
        items? : Array<{
            label: string,
            type: PayrollItemType,
            amount: number,
            description?: string,
            attachmentUrl?: string
        }>
    ) {
        const payroll = await prisma.payroll.findFirst({
            where: {
                tenantId,
                id: payrollId
            }
        });
        if(!payroll) throw new Error("Payroll not found");
        
        return prisma.$transaction(async (tx) => {
            // If no extra manual items are provided, just finalize the payroll
            if (!items || items.length === 0) {
                return tx.payroll.update({
                    where: { id: payrollId },
                    data: {
                    status: "PROCESSED",
                    processedAt: new Date(),
                    },
                    include: {
                    items: true,
                    user: {
                        select: {
                        id: true,
                        name: true,
                        email: true,
                        },
                    },
                    payslip: true,
                    },
                });
            }
            let totalEarnings = payroll.totalEarnings;
            let totalAllowances = payroll.totalAllowances;
            let totalDeductions = payroll.totalDeductions;
            let totalTax = payroll.totalTax;
            let totalBonus = payroll.totalBonus;

            for(const item of items){
                await tx.payrollItem.create({
                    data: {
                        payrollId,
                        label: item.label,
                        type: item.type,
                        amount: item.amount,
                        description: item.description ?? null,
                        attachmentUrl: item.attachmentUrl ?? null
                    }
                });

                if(item.type === "BONUS") totalBonus += item.amount;
                if(item.type === "EARNING") totalEarnings += item.amount;
                if(item.type === "ALLOWANCE") totalAllowances += item.amount;
                if(item.type === "DEDUCTION") totalDeductions += item.amount;
                if(item.type === "TAX") totalTax += item.amount;
            }

            const grossSalary = Number(
                (
                    payroll.baseSalary + totalEarnings
                    + totalAllowances + totalBonus
                ).toFixed(2)
            );

            const netSalary = Number(
                (
                    grossSalary - totalDeductions - totalTax
                ).toFixed(2)
            );

            return tx.payroll.update({
                where: { id: payrollId },
                data: {
                    grossSalary,
                    totalEarnings,
                    totalAllowances,
                    totalBonus,
                    totalDeductions,
                    totalTax,
                    netSalary,
                    status: "PROCESSED",
                    processedAt: new Date()
                },
                include: {
                    items: true,
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        }
                    },
                    payslip: true
                }
            });
        });
    }

    static async getPayrolls(
        tenantId: string,
        filters?: {
            userId?: string,
            month?: number,
            year?: number,
            status?: "DRAFT" | "PROCESSED" | "PAID" | "DISBURSING" | "FAILED" |"CANCELLED"
        }
    ){
        return prisma.payroll.findMany({
            where: {
                tenantId,
                ...(filters?.month ? { month: filters.month } : {}),
                ...(filters?.year ? { year: filters.year } : {}),
                ...(filters?.userId ? { userId: filters.userId } : {}),
                ...(filters?.status ? { status: filters.status } : {})
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        employeeProfile: true,
                        bankAccount: true,
                        department: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        designation: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                },
                items: true,
                payslip: true,
                payStructure: {
                    include: {
                        components: {
                            include: {
                                payrollMasterComponent: true
                            }
                        }
                    }
                }
            },
            orderBy: [
                { year: "desc" },
                { month: "desc" },
                { createdAt: "desc" }
            ]
        })
    }

    static async getMyPayrolls(tenantId: string, userId: string) {
        return prisma.payroll.findMany({
            where: {
                tenantId,
                userId
            },
            include: {
                items: true,
                payslip: true,
                payStructure: {
                    include: {
                        components: {
                            include: {
                                payrollMasterComponent: true
                            }
                        }
                    }
                }
            },
            orderBy: [
                { year: "desc" },
                { month: "desc" }
            ]
        });
    }
    static async getPayrollById(
        tenantId: string,
        payrollId: string,
        actorUserId?: string,
        selfOnly = false
    ){
        return prisma.payroll.findFirst({
            where: {
                id: payrollId,
                tenantId,
                ...(selfOnly ? { userId: actorUserId } : {})
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        department: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        designation: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        employeeProfile: true,
                        bankAccount: true
                    }
                },
                items: true,
                payslip: true,
                payStructure: {
                    include: {
                        components: {
                            include: {
                                payrollMasterComponent: true
                            }
                        }
                    }
                }
            }
        });
    }
    static async markPayrollPaid(tenantId: string, payrollId: string) {
        const payroll = await prisma.payroll.findFirst({
            where: {
                id: payrollId,
                tenantId
            }
        });

        if (!payroll) {
        throw new Error("Payroll not found");
        }

        if (payroll.status === "PAID") {
        throw new Error("Payroll is already marked as paid");
        }

        if (payroll.status === "CANCELLED") {
        throw new Error("Cancelled payroll cannot be marked as paid");
        }

        return prisma.payroll.update({
            where: { id: payrollId },
            data: {
                status: "PAID",
                paidAt: new Date()
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        bankAccount: true
                    }
                },
                items: true,
                payslip: true,
                payStructure: {
                    include: {
                        components: {
                            include: {
                                payrollMasterComponent: true
                            }
                        }
                    }
                }
            }
        });
    }
    static async markPayrollDisbursing(tenantId: string, payrollId: string) {
        const payroll = await prisma.payroll.findFirst({
            where: {
                id: payrollId,
                tenantId
            },
            include: {
                user: {
                select: {
                    id: true,
                    name: true,
                    bankAccount: true
                }
                }
            }
        });

        if (!payroll) {
        throw new Error("Payroll not found");
        }

        if (payroll.status !== "PROCESSED") {
        throw new Error("Only processed payroll can be moved to disbursing");
        }

        if (!payroll.user.bankAccount) {
        throw new Error("Employee bank account is not configured");
        }

        return prisma.payroll.update({
            where: { id: payrollId },
            data: {
                status: "DISBURSING"
            },
            include: {
                user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    bankAccount: true
                }
                },
                items: true,
                payslip: true
            }
        });
    }
    static async markPayrollFailed(tenantId: string, payrollId: string) {
        const payroll = await prisma.payroll.findFirst({
            where: {
                id: payrollId,
                tenantId
            }
        });

        if (!payroll) {
        throw new Error("Payroll not found");
        }

        if (payroll.status !== "DISBURSING") {
        throw new Error("Only disbursing payroll can be marked as failed");
        }

        return prisma.payroll.update({
            where: { id: payrollId },
            data: {
                status: "FAILED"
            },
            include: {
                user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    bankAccount: true
                }
                },
                items: true,
                payslip: true
            }
        });
    }
}