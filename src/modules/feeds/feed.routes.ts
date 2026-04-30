import { Router } from "express";
import * as feedController from "./feed.controller";
import { auth, checkTenantApproval } from "../../core/middleware/auth";

const router = Router();

router.use(auth, checkTenantApproval);

router.post(
    "/create-post",
    feedController.createFeedPost
);

router.get("/feeds", feedController.getFeed);

router.post("/:feedId/comments", feedController.addFeedComment);

router.post("/:feedId/reactions/toggle", feedController.toggleFeedReaction);


export default router;