import { ReactionType } from "@prisma/client";
import { prisma } from "../../config/db/prisma";
import { getEndOfDay, getStartOfDay, getTenantTimezone } from "../utils/util";

export class FeedService {

    static async createPost(actor: any, payload: {
        content: string;
        departmentId?: string | null;
    }) {
        if(!actor.tenantId) {
            throw new Error("Tenant context missing for creating feed post");
        }
        if(!payload.content) {
            throw new Error("Content is required for creating feed post");
        }

        if(payload.departmentId){
            const department = await prisma.department.findFirst({
                where: {
                    id: payload.departmentId,
                    tenantId: actor.tenantId
                }
            });

            if(!department) {
                throw new Error("Department not found or not accessible");
            }
        }
        
        return prisma.feed.create({
            data: {
                tenantId: actor.tenantId,
                actorId: actor.id,
                departmentId: payload.departmentId || null,
                type: "POST",
                content: payload.content.trim(),
                metadata: {}
            }
        })
    }

    static async createNewJoiningEvent(tx: any, payload: {
        tenantId: string;
        userId: string;
        departmentId?: string | null;
        designationId?: string | null;
    }) {
        return tx.feed.create({
            data: {
                tenantId: payload.tenantId,
                subjectedUserId: payload.userId,
                departmentId: payload.departmentId || null,
                type: "EVENT",
                content: null,
                metadata: {
                    eventType: "NEW_JOINING",
                    designationId: payload.designationId || null
                }
            }
        })
    }

    static async getFeed(actor: any, params: {
        cursor?: string;
        limit?: number;
        departmentId?: string;
    }) {
    const limit = Math.min(params.limit || 20, 50);

    const whereClause: any = {
        tenantId: actor.tenantId,
        ...(params.cursor
        ? {
            createdAt: {
                lt: new Date(params.cursor)
            }
            }
        : {})
    };

    // If departmentId is passed, show company-wide + that department feed
    if (params.departmentId) {
        whereClause.OR = [
        { departmentId: null },
        { departmentId: params.departmentId }
        ];
    }

    // If departmentId is NOT passed, do NOT add OR.
    // This returns all tenant feeds: department feeds + company-wide feeds.

    const feeds = await prisma.feed.findMany({
        where: whereClause,
        include: {
        actor: {
            select: {
            id: true,
            email: true,
            name: true,
            employeeProfile: {
                select: {
                photoUrl: true
                }
            }
            }
        },
        subjectedUser: {
            select: {
            id: true,
            name: true,
            email: true,
            department: {
                select: { id: true, name: true }
            },
            designation: {
                select: { id: true, name: true }
            },
            employeeProfile: {
                select: {
                photoUrl: true,
                dateOfBirth: true,
                joiningDate: true
                }
            }
            }
        },
        department: {
            select: { id: true, name: true }
        },
        comments: {
            take: 5,
            orderBy: { createdAt: "desc" },
            include: {
            user: {
                select: {
                id: true,
                name: true,
                employeeProfile: {
                    select: {
                    photoUrl: true
                    }
                }
                }
            }
            }
        },
        reactions: true,
        _count: {
            select: {
            comments: true,
            reactions: true
            }
        }
        },
        orderBy: { createdAt: "desc" },
        take: limit
    });

    const nextCursor =
        feeds.length === limit
        ? feeds[feeds.length - 1].createdAt.toISOString()
        : null;

    return {
        limit,
        nextCursor,
        hasMore: Boolean(nextCursor),
        feeds
    };
    }

    static async addComment(actor: any, feedId: string, comment: string) {
        if(!actor.tenantId) {
            throw new Error("Tenant context missing for adding comment");
        }
        if(!comment) {
            throw new Error("Comment content is required");
        }

        const feed = await prisma.feed.findFirst({
            where: {
                id: feedId,
                tenantId: actor.tenantId,
                OR: [
                    { departmentId: null },
                    { departmentId: actor.departmentId || undefined }
                ]
            }
        });

        if(!feed) {
            throw new Error("Feed post not found or not accessible");
        }
        const content = comment.trim();

        return prisma.feedComment.create({
            data: {
                feedId,
                userId: actor.id,
                content
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        employeeProfile: {
                            select: {
                                photoUrl: true
                            }
                        }
                    }
                }
            }
        })
    }

    static async toggleReaction(actor: any, feedId: string, type: ReactionType) {
        if(!actor.tenantId) {
            throw new Error("Tenant context missing for toggling reaction");
        }

        const feed = await prisma.feed.findFirst({
            where: {
                id: feedId,
                tenantId: actor.tenantId,
                OR: [
                    { departmentId: null },
                    { departmentId: actor.departmentId || undefined }
                ]
            }
        });

        if(!feed) {
            throw new Error("Feed post not found or not accessible");
        }

        const existingReaction = await prisma.feedReaction.findUnique({
            where: {
                feedId_userId: {
                    feedId,
                    userId: actor.id
                }
            }
        })

        if(existingReaction && existingReaction.type === type){
            await prisma.feedReaction.delete({
                where: {
                    feedId_userId: {
                        feedId,
                        userId: actor.id
                    }
                }
            });

            return {
                action: "REMOVED",
                reaction: null
            }
        }

        const reaction = await prisma.feedReaction.upsert({
            where: {
                feedId_userId: {
                    feedId,
                    userId: actor.id
                }
            },
            update: {
                type
            },
            create: {
                feedId,
                userId: actor.id,
                type
            }
        })

        return {
            action: existingReaction ? "UPDATED" : "ADDED",
            reaction
        }
    }

    static async generateBirthdayOrAnniversaryEvents(tenantId: string) {
        const timezone = await getTenantTimezone(tenantId);
        const now = new Date();

        const startOfToday = getStartOfDay(now, timezone);
        const endOfToday = getEndOfDay(now, timezone);
        
        const todayMonth = now.getMonth();
        const todayDate = now.getDate();

        const users = await prisma.user.findMany({
            where: {
                tenantId,
                isActive: true,
                employeeProfile: {
                    OR: [
                        { dateOfBirth: { not: null } },
                        { joiningDate: { not: null } }
                    ]
                }
            },
            include: {
                employeeProfile: true
            }
        });

        for(const user of users){
            const profile = user.employeeProfile;
            if(!profile) continue;

            const dob = profile.dateOfBirth;
            const joiningDate = profile.joiningDate;

            if(dob && dob.getMonth() === todayMonth && dob.getDate() === todayDate){
                const exists = await prisma.feed.findFirst({
                    where: {
                        tenantId,
                        subjectedUserId: user.id,
                        type: "EVENT",
                        createdAt: {
                            gte: startOfToday,
                            lt: endOfToday
                        },
                        metadata: {
                            path: ["eventType"],
                            equals: "BIRTHDAY"
                        }
                    }
                });

                if(!exists){
                    await prisma.feed.create({
                        data: {
                            tenantId,
                            subjectedUserId: user.id,
                            departmentId: user.departmentId,
                            type: "EVENT",
                            content: null,
                            metadata: {
                                eventType: "BIRTHDAY"
                            }
                        }
                    })
                }
            }

            if(joiningDate && joiningDate.getMonth() === todayMonth && joiningDate.getDate() === todayDate){
                const years = now.getFullYear() - joiningDate.getFullYear();

                if(years > 0){
                    const exists = await prisma.feed.findFirst({
                        where: {
                            tenantId,
                            subjectedUserId: user.id,
                            type: "EVENT",
                            createdAt: {
                                gte: startOfToday,
                                lt: endOfToday
                            },
                            metadata: {
                                path: ["eventType"],
                                equals: "WORK_ANNIVERSARY"
                            }
                        }
                    });

                    if(!exists){
                        await prisma.feed.create({
                            data: {
                                tenantId,
                                subjectedUserId: user.id,
                                departmentId: user.departmentId,
                                type: "EVENT",
                                content: null,
                                metadata: {
                                    eventType: "WORK_ANNIVERSARY",
                                    years
                                }
                            }
                        });
                    }
                }
            }
        }
    }
}