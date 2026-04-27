import { prisma } from "../../../config/db/prisma";
import { addDays, addMonths, addYears } from "date-fns";
import { getEndOfDay, getStartOfDay, getTenantTimezone } from "../../utils/util";
import e from "express";

type BillingCycle = "MONTHLY" | "YEARLY";

export class SubscriptionService {

    static async upsertSubscriptionModule(payload: {
        key: string;
        name: string;
        description?: string;
        isActive?: boolean;
        monthlyPrice?: number;
        yearlyPrice?: number;
    }) {
        if (!payload.key?.trim()) throw new Error("Module key is required");
        if (!payload.name?.trim()) throw new Error("Module name is required");
        const key = payload.key.trim().toUpperCase();

        return prisma.subscriptionModule.upsert({
            where: { key },
            update: {
                name: payload.name,
                description: payload.description ?? null,
                monthlyPrice: payload.monthlyPrice ?? 0,
                yearlyPrice: payload.yearlyPrice ?? 0,
                isActive: payload.isActive ?? true,
            },
            create: {
                key,
                name: payload.name.trim(),
                description: payload.description ?? null,
                monthlyPrice: payload.monthlyPrice ?? 0,
                yearlyPrice: payload.yearlyPrice ?? 0,
                isActive: payload.isActive ?? true,
            }
        })
    }

    static async getSubscriptionModules(){
        return prisma.subscriptionModule.findMany({
            where: {
                isActive: true
            },
            orderBy: {
                name: "asc"
            }
        })
    }

    /** -- Assign modules to tenant ---- */
    static async assignModulesToTenant(payload: {
        tenantId: string;
        billingCycle?: BillingCycle;
        startDate?: Date;
        endDate?: Date;
        modules: Array<{
            moduleKey: string;
            isEnabled?: boolean;
        }>
    }) {

        if(!payload.tenantId) throw new Error("Tenant ID is required");
        if(!Array.isArray(payload.modules) || payload.modules.length === 0){
            throw new Error("At least one module must be provided");
        }

        const timezone = await getTenantTimezone(payload.tenantId);
        const billingCycle = payload.billingCycle ?? "MONTHLY";

        const normalizedStartDate = getStartOfDay(
            payload.startDate ?? new Date(),
            timezone
        );

        let calculatedEndDate: null | Date;
        if(payload.endDate){
            calculatedEndDate = getEndOfDay(payload.endDate, timezone);
        } else if (billingCycle === "MONTHLY"){
            // for monthly
            calculatedEndDate = getEndOfDay(
                addDays(addMonths(normalizedStartDate, 1), -1),
                timezone
            );
        } else if (billingCycle === "YEARLY") {
            // for yearly
            calculatedEndDate = getEndOfDay(
                addDays(addYears(normalizedStartDate, 1), -1),
                timezone
            );
        } else {
            throw new Error("Invalid billing cycle");
        }

        const moduleKeys = payload.modules.map(m => m.moduleKey.trim().toUpperCase());

        const existingModules = await prisma.subscriptionModule.findMany({
            where: {
                key: { in: moduleKeys },
                isActive: true
            }
        });

        if(existingModules.length !== moduleKeys.length){
            throw new Error("One or more module keys are invalid or inactive");
        }

        return prisma.$transaction(async (tx) => {
            // clean up old module assignments for the tenant
            await tx.tenantSubscription.updateMany({
                where: {
                    tenantId: payload.tenantId,
                    isActive: true
                },
                data: {
                    isActive: false,
                    cancelledAt: new Date(),
                    // endDate: new Date() // set end date to now for immediate effect
                }
            });

            const subscription = await tx.tenantSubscription.create({
                data: {
                    tenantId: payload.tenantId,
                    billingCycle,
                    startDate: normalizedStartDate,
                    endDate: calculatedEndDate,
                    isActive: true,
                }
            });

            await tx.tenantSubscriptionModule.createMany({
                data: existingModules.map((mod) => {
                    const input = payload.modules.find(
                        (m) => m.moduleKey.trim().toUpperCase() === mod.key
                    );

                    return {
                        subscriptionId: subscription.id,
                        moduleId: mod.id,
                        isEnabled: input?.isEnabled ?? true,
                        monthlyPrice: mod.monthlyPrice ?? 0,
                        yearlyPrice: mod.yearlyPrice ?? 0
                    }
                })
            });

            return tx.tenantSubscription.findUnique({
                where: { id: subscription.id },
                include: {
                    tenant: true,
                    modules: {
                        include: {
                            module: true
                        }
                    }
                }
            })
        })
    }
    
    static async updateTenantSubscriptionModules(payload: {
        tenantId: string;
        modules: Array<{
            moduleKey: string;
            isEnabled: boolean;
        }>
    }) {

        if(!payload.modules || payload.modules.length === 0){
            throw new Error("Modules array is required and cannot be empty");
        }

        // 1. find active subscription first
        const activeSubscription = await prisma.tenantSubscription.findFirst({
            where: {
                tenantId: payload.tenantId,
                isActive: true
            },
            include: {
                modules: true
            },
            orderBy: {
                createdAt: "desc"
            }
        });

        if(!activeSubscription){
            throw new Error("Active subscription not found for tenant");
        }

        // 2. find module IDs for the provided module keys
        const modulekeys = payload.modules.map((mod) => mod.moduleKey.trim().toUpperCase());

        // 3. fetch subscription modules for the active subscription that match the provided module keys
        const subscriptionModules = await prisma.subscriptionModule.findMany({
            where: {
                key: {
                    in: modulekeys
                },
                isActive: true
            }
        });

        if(subscriptionModules.length !== modulekeys.length){
            throw new Error("One or more modules not found for the provided keys or not active");
        }

        // 4. update the isEnabled status for each matched subscription module
        return prisma.$transaction(async (tx) => {
            for(const mod in payload.modules){
                // find the module key from the payload and convert to uppercase
                const key = payload.modules[mod].moduleKey.trim().toUpperCase();
                // find the corresponding tenant subscription module entry
                const subModuleKey = subscriptionModules.find((subMod) => subMod.key === key);
                if(!subModuleKey){
                    throw new Error(`Subscription module not found for key: ${key}`);
                }

                // upsert the tenant subscription module with the new isEnabled value
                await tx.tenantSubscriptionModule.upsert({
                    where: {
                        subscriptionId_moduleId: {
                            subscriptionId: activeSubscription.id,
                            moduleId: subModuleKey.id
                        }
                    },
                    update: {
                        isEnabled: payload.modules[mod].isEnabled,
                        monthlyPrice: subModuleKey.monthlyPrice ?? 0,
                        yearlyPrice: subModuleKey.yearlyPrice ?? 0
                    },
                    create: {
                        subscriptionId: activeSubscription.id,
                        moduleId: subModuleKey.id,
                        isEnabled: payload.modules[mod].isEnabled,
                        monthlyPrice: subModuleKey.monthlyPrice ?? 0,
                        yearlyPrice: subModuleKey.yearlyPrice ?? 0
                    }
                })


                // return the updated subscription with modules
                return tx.tenantSubscription.findUnique({
                    where: { id: activeSubscription.id },
                    include: {
                        tenant: true,
                        modules: {
                            include: {
                                module: true
                            }
                        }
                    }
                })
            }
        })
    }

    static async getTenantActiveSubscriptions(tenantId: string){
        const timezone = await getTenantTimezone(tenantId);
        const now = new Date();
        const subscriptions = await prisma.tenantSubscription.findFirst({
            where: {
                tenantId,
                isActive: true
            },
            include: {
                modules: {
                    include: {
                        module: true
                    }
                }
            },
            orderBy: {
                createdAt: "desc"
            }
        });

        if(!subscriptions){
            return {
                hasSubscriptions: false,
                status: "NO_SUBSCRIPTION",
                message: "No active subscription found for tenant",
                subscription: null,
                modules: []
            }
        }

        const isExpired = subscriptions.endDate !== null &&
        getEndOfDay(subscriptions.endDate, timezone) < now;

        if(isExpired){
            await prisma.tenantSubscription.update({
                where: { id: subscriptions.id },
                data: { isActive: false }
            })
            return {
                hasSubscriptions: false,
                status: "EXPIRED",
                message: "Subscription has expired",
                subscription: {
                    ...subscriptions,
                    isActive: false
                },
                modules: subscriptions.modules
            }
        }

        return {
            hasSubscriptions: true,
            status: "ACTIVE",
            message: "Active subscription found",
            subscription: subscriptions,
            modules: subscriptions.modules
        };
    }

    static async getSubscribedTenants(filters?: {
        status?: "ACTIVE" | "EXPIRED" | "CANCELLED";
        }) {
        const now = new Date();

        const subscriptions = await prisma.tenantSubscription.findMany({
            where: {
            ...(filters?.status === "ACTIVE" ? { isActive: true, endDate: { gte: now } } : {}),
            ...(filters?.status === "EXPIRED" ? { endDate: { lt: now } } : {}),
            ...(filters?.status === "CANCELLED" ? { isActive: false, cancelledAt: { not: null } } : {})
            },
            include: {
            tenant: true,
            modules: {
                include: {
                module: true
                }
            }
            },
            orderBy: {
            createdAt: "desc"
            }
        });

        return subscriptions;
    }

    static async cancelSubscription(payload: {
        tenantId: string;
        subscriptionId?: string;
    }){
        const timezone = await getTenantTimezone(payload.tenantId);

        const subscriptions = await prisma.tenantSubscription.findFirst({
            where: {
                tenantId: payload.tenantId,
                ...(payload.subscriptionId ? { id: payload.subscriptionId } : {}),
                isActive: true
            },
            include: {
                modules: {
                    include: {
                    module: true
                    }
                }
            },
            orderBy: {
                createdAt: "desc"
            }
        });

        if(!subscriptions){
            throw new Error("Active subscription not found for tenant");
        }

        return prisma.tenantSubscription.update({
            where: { id: subscriptions.id },
            data: {
                isActive: false,
                cancelledAt: new Date(),
                endDate: new Date()
            },
            include: {
                tenant: true,
                modules: {
                     include: {
                        module: true
                    }
                }   
            }
        });
    }
}