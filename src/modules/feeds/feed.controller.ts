import { Request, Response } from "express";
import { FeedService } from "./feed.service";
import { ReactionType } from "@prisma/client";

/**
 * @swagger
 * /feed-wall/create-post:
 *   post:
 *     tags:
 *       - feed
 *     summary: Create a feed post
 *     description: Create a manual company-wide or department-specific feed post.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 example: "New leave policy has been updated from next month."
 *               departmentId:
 *                 type: string
 *                 nullable: true
 *                 example: "dept_uuid_here"
 *                 description: If null or omitted, post is company-wide. If provided, post is department-specific.
 *     responses:
 *       201:
 *         description: Post created successfully
 *       400:
 *         description: Failed to create post
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Failed to create post
 */
export const createFeedPost = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    const { content, departmentId } = req.body;

    const result = await FeedService.createPost(actor, {
      content,
      departmentId
    });
    if(!result) {
      return res.status(400).json({
        status: false,
        message: "Failed to create post"
      });
    }

    return res.status(201).json({
      status: true,
      message: "Post created successfully",
      data: result
    });
  } catch (error: any) {
    return res.status(500).json({
      status: false,
      message: "Failed to create post",
      error: error.message
    });
  }
};

/**
 * @swagger
 * /feed-wall/feeds:
 *   get:
 *     tags:
 *       - feed
 *     summary: Get feed wall
 *     description: Get latest feed posts/events. For older feed items, pass cursor as the createdAt value of the last loaded feed item.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: cursor
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *         example: "2026-04-28T10:30:00.000Z"
 *         description: Fetch feeds older than this timestamp.
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 50
 *         example: 20
 *       - in: query
 *         name: departmentId
 *         required: false
 *         schema:
 *           type: string
 *         example: "dept_uuid_here"
 *         description: If provided, returns company-wide feeds plus this department's feeds.
 *     responses:
 *       200:
 *         description: Feed fetched successfully
 *         content:
 *           application/json:
 *             example:
 *               status: true
 *               message: "Feed fetched successfully"
 *               data:
 *                 limit: 20
 *                 nextCursor: "2026-04-28T10:30:00.000Z"
 *                 hasMore: true
 *                 feeds:
 *                   - id: "feed_uuid_1"
 *                     type: "EVENT"
 *                     content: null
 *                     metadata:
 *                       eventType: "BIRTHDAY"
 *                     subjectedUser:
 *                       id: "user_uuid"
 *                       name: "Rahul Sharma"
 *                     comments: []
 *                     reactions: []
 *                     _count:
 *                       comments: 0
 *                       reactions: 3
 *                   - id: "feed_uuid_2"
 *                     type: "POST"
 *                     content: "New leave policy has been updated."
 *                     actor:
 *                       id: "admin_uuid"
 *                       name: "HR Admin"
 *                     comments: []
 *                     reactions: []
 *                     _count:
 *                       comments: 2
 *                       reactions: 5
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Failed to fetch feed
 */
export const getFeed = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    const { cursor, limit, departmentId } = req.query;

    const result = await FeedService.getFeed(actor, {
      cursor: cursor ? String(cursor) : undefined,
      limit: limit ? Number(limit) : 20,
      departmentId: departmentId ? String(departmentId) : undefined
    });

    return res.status(200).json({
      status: true,
      message: "Feed fetched successfully",
      data: result
    });
  } catch (error: any) {
    return res.status(500).json({
      status: false,
      message: "Failed to fetch feed",
      error: error.message
    });
  }
};


/**
 * @swagger
 * /feed-wall/{feedId}/comments:
 *   post:
 *     tags:
 *       - feed
 *     summary: Add comment to a feed item
 *     description: Add a comment/wish/congratulation to a feed post or event.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: feedId
 *         required: true
 *         schema:
 *           type: string
 *         example: "feed_uuid_here"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 example: "Happy Birthday Rahul! 🎉"
 *     responses:
 *       201:
 *         description: Comment added successfully
 *       400:
 *         description: Failed to add comment
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Feed not found or not accessible
 *       500:
 *         description: Failed to add comment
 */
export const addFeedComment = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    const { feedId } = (req as any).params;
    const { content } = req.body;

    const result = await FeedService.addComment(actor, feedId, content);
    if(!result) {
      return res.status(400).json({
        status: false,
        message: "Failed to add comment"
      });
    }

    return res.status(201).json({
      status: true,
      message: "Comment added successfully",
      data: result
    });
  } catch (error: any) {
    return res.status(500).json({
      status: false,
      message: "Failed to add comment",
      error: error.message
    });
  }
};

/**
 * @swagger
 * /feed-wall/{feedId}/reactions/toggle:
 *   post:
 *     tags:
 *       - feed
 *     summary: Toggle reaction on a feed item
 *     description: Add, update, or remove the current user's reaction. If the same reaction already exists, it is removed. If a different reaction exists, it is updated.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: feedId
 *         required: true
 *         schema:
 *           type: string
 *         example: "feed_uuid_here"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [LIKE, LOVE, CLAP, CELEBRATE]
 *                 example: CELEBRATE
 *     responses:
 *       200:
 *         description: Reaction toggled successfully
 *         content:
 *           application/json:
 *             examples:
 *               added:
 *                 value:
 *                   status: true
 *                   message: "Reaction saved successfully"
 *                   data:
 *                     action: "ADDED"
 *                     reaction:
 *                       id: "reaction_uuid"
 *                       feedId: "feed_uuid_here"
 *                       userId: "user_uuid"
 *                       type: "CELEBRATE"
 *               removed:
 *                 value:
 *                   status: true
 *                   message: "Reaction removed successfully"
 *                   data:
 *                     action: "REMOVED"
 *                     reaction: null
 *       400:
 *         description: Invalid reaction type
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Feed not found or not accessible
 *       500:
 *         description: Failed to toggle reaction
 */
export const toggleFeedReaction = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    const { feedId } = (req as any).params;
    const { type } = req.body;

    if (!Object.values(ReactionType).includes(type)) {
      return res.status(400).json({
        status: false,
        message: "Invalid reaction type"
      });
    }

    const result = await FeedService.toggleReaction(actor, feedId, type);

    return res.status(200).json({
      status: true,
      message:
        result.action === "REMOVED"
          ? "Reaction removed successfully"
          : "Reaction saved successfully",
      data: result
    });
  } catch (error: any) {
    return res.status(500).json({
      status: false,
      message: "Failed to toggle reaction",
      error: error.message
    });
  }
};