import { prisma } from "../../config/db/prisma";
import { getDaysInMonth, getPayrollMonthEnd, getPayrollMonthStart, getTenantTimezone } from "../utils/util";

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
    static async upsertPayStructure (
        tenantId: string,
        payload: {
            name: string,
            departmentId?: string,
            designationId?: string,
            isDefault?: boolean,
            components: Array<{
                label: string,
                type: "BASIC" | "ALLOWANCE" | "DEDUCTION",
                valueType: "PERCENTAGE" | "FLAT",
                value: number
                isTaxable?: boolean
                attachmentRequired?: boolean
            }>
        }
    ) {
        const existing = await prisma.payStructure.findFirst({
            where: {
                tenantId,
                name: payload.name
            }
        });
        if(!existing) {
            // Create new structure
            const newStructure = await prisma.payStructure.create({
                data: {
                    tenantId,
                    name: payload.name,
                    departmentId: payload.departmentId,
                    designationId: payload.designationId,
                    isDefault: payload.isDefault || false,
                    components: {
                        create: payload.components.map(c => ({
                            label: c.label,
                            type: c.type,
                            valueType: c.valueType,
                            value: c.value,
                            isTaxable: c.isTaxable ?? false,
                            attachmentRequired: c.attachmentRequired ?? false
                        }))
                    }
                },
                include: {
                    components: true
                }
            })
        }

        return prisma.$transaction(async (tx) => {
            await tx.payStructureComponent.deleteMany({
                where: {
                    payStructure: {
                        tenantId,
                        name: payload.name
                    }
                }
            });
            return tx.payStructure.update({
                where: { id: existing!.id },
                data: {
                    departmentId: payload.departmentId,
                    designationId: payload.designationId,
                    isDefault: payload.isDefault || false,
                    components: {
                        create: payload.components.map(c => ({
                            label: c.label,
                            type: c.type,
                            valueType: c.valueType,
                            value: c.value,
                            isTaxable: c.isTaxable ?? false,
                            attachmentRequired: c.attachmentRequired ?? false
                        }))
                    }
                },
                include: {
                    components: true
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
    static async generatePayrollForMonth(tenantId: string, month: number, year: number) {
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
                const salary = user.employeeProfile?.salary ?? 0;
                if(!salary || salary <= 0) continue;


                const payStructure = await tx.payStructure.findFirst({
                    where: {
                        tenantId,
                        isActive: true,
                        OR: [
                            {
                                departmentId: user.departmentId ?? undefined,
                            },
                            {
                                designationId: user.designationId ?? undefined,
                            },
                            {
                                isDefault: true
                            }
                        ]
                    },
                    include: {
                        components: true
                    },
                    orderBy: {
                        isDefault: "asc" // Prioritize specific structures over default
                    }
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
                    if(leave.leaveType?.typeCode === "EARNED"){
                        paidLeaves += leave.totalDays;
                    }
                    if(leave.leaveType?.typeCode === "UNPAID"){
                        unpaidLeaves += leave.totalDays;
                    }
                }

                const payableDays = presentDays + lateDays + (halfDays * 0.5) + paidLeaves;
                const perDaySalary = salary / daysInMonth;

                let totalEarnings = 0;
                let totalAllowances = 0;
                let totalDeductions = 0;
                let totalTax = 0;

                for(const component of payStructure?.components ?? []){
                    const amount = component.valueType === "PERCENTAGE"
                    ? Number((salary * component.value / 100).toFixed(2))
                    : Number(component.value.toFixed(2));

                    if(component.type === "BASIC"){
                        totalEarnings += amount;
                    }
                    if(component.type === "ALLOWANCE"){
                        totalAllowances += amount;
                    }
                    if(component.type === "DEDUCTION"){
                        totalDeductions += amount;
                    }
                }
                const unpaidLeaveDeduction = Number((unpaidLeaves * perDaySalary).toFixed(2));
                const attendanceBasedGross = Number((payableDays * perDaySalary).toFixed(2));

                const grossSalary = Number(
                    (attendanceBasedGross + totalEarnings + totalAllowances).toFixed(2)
                );

                const netSalary = Number(
                    (grossSalary - totalDeductions - totalTax - unpaidLeaveDeduction).toFixed(2)
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
                        totalBonus: 0,
                        totalDeductions: totalDeductions + unpaidLeaveDeduction,
                        totalTax,
                        netSalary,
                        presentDays,
                        absentDays,
                        halfDays,
                        lateDays,
                        payableDays,
                        unpaidLeaves,
                        status: "DRAFT"
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
                        totalBonus: 0,
                        totalDeductions: totalDeductions + unpaidLeaveDeduction,
                        totalTax,
                        netSalary,
                        presentDays,
                        absentDays,
                        halfDays,
                        lateDays,
                        payableDays,
                        paidLeaves,
                        unpaidLeaves,
                        status: "DRAFT"
                    }
                });
                generatedPayrolls.push(payroll);
            }
        });
        return generatedPayrolls;
    }
    static async processPayroll(tenantId: string, payrollId: string, items? : Array<{
        label: string,
        type: "EARNING" | "ALLOWANCE" |"DEDUCTION" | "TAX" | "BONUS",
        amount: number,
        description?: string,
        attachmentUrl?: string
    }>) {
        const payroll = await prisma.payroll.findFirst({
            where: {
                tenantId,
                id: payrollId
            }
        });
        if(!payroll) throw new Error("Payroll not found");
        
        return prisma.$transaction(async (tx) => {
            await tx.payrollItem.deleteMany({
                where: {
                    payrollId
                }
            });
            let totalEarnings = payroll.totalEarnings;
            let totalAllowances = payroll.totalAllowances;
            let totalDeductions = payroll.totalDeductions;
            let totalTax = payroll.totalTax;
            let totalBonus = 0;

            for(const item of items ?? []){
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

            const netSalary = Number(
                (
                    payroll.baseSalary + totalEarnings
                    + totalAllowances + totalBonus - totalDeductions - totalTax
                ).toFixed(2)
            );

            return tx.payroll.update({
                where: { id: payrollId },
                data: {
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
                        components: true
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
                    components: true
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
                    components: true
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
                    components: true
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