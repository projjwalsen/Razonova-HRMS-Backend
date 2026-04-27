import { Router } from "express";
import * as subscriptionController from "./subscription.controller";
import { auth } from "../../../core/middleware/auth";
import { isPlatformAdmin } from "../../../core/middleware/platform.auth";

const router = Router();

router.use(auth, isPlatformAdmin);

//Subscriptions
router.post(
    "/modules/upsert",
    subscriptionController.upsertSubcriptionModule
);
router.get(
    "/modules",
    subscriptionController.getAllSubscriptionModules
);


router.post(
    "/assign-modules", 
    subscriptionController.assignModulesToTenant
);


router.patch(
    "/update/modules/:tenantId",
    subscriptionController.updateTenantSubscriptionModules
)


router.get(
    "/active-subscription/:tenantId",
    subscriptionController.getTenantSubscriptionDetails
)

router.get(
  "/subscribed-tenants",
  subscriptionController.getSubscribedTenants
);

router.post(
    "/cancel-subscription/:tenantId/:subscriptionId",
    subscriptionController.cancelTenantSubscription
)

export default router;