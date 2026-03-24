import { Router } from "express";
import * as subscriptionController from "./subscription.controller";
import { auth } from "../../../core/middleware/auth";
import { isPlatformAdmin } from "../../../core/middleware/platform.auth";

const router = Router();

//Subscriptions
router.post(
    "/create",
    auth,
    isPlatformAdmin,
    subscriptionController.createPlatformSubscription
);
router.patch(
    "/update/:id", 
    auth,
    isPlatformAdmin,
    subscriptionController.updatePlatformSubscription
);
router.get(
    "/all", 
    subscriptionController.getAllPlatformSubscriptions
);
router.delete(
    "/delete/:id",
    auth,
    isPlatformAdmin,
    subscriptionController.deletePlatformSubscription
);


export default router;