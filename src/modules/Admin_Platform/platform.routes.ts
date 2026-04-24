import { Router } from "express";
import * as platformController from "./platform.controller";
import { auth } from "../../core/middleware/auth";
import { isPlatformAdmin } from "../../core/middleware/platform.auth";
import subscriptionRoutes from "./subscriptions/subscription.routes";
import permRoutes from "./permission/perm.routes";

const router = Router();

/* ------ Only Platform Admins 🔐 ------ */
router.use("/subscription", subscriptionRoutes);
router.use("/permission", permRoutes);

/* ------ Tenant: Organizations Management 🏢 ------ */
router.get(
    "/organizations", 
    auth,
    isPlatformAdmin,
    platformController.getAllOrganizationsPlatform
);

router.get(
    "/dashboard/kpis",
    auth,
    isPlatformAdmin,
    platformController.getPlatformDashboardKpis
)

router.get(
    "/departments", 
    auth,
    isPlatformAdmin,
    platformController.getAllDepartmentsPlatform
);
router.patch(
    "/tenant/approve/:tenantId", 
    auth,
    isPlatformAdmin,
    platformController.approveTenant
);
router.patch(
    "/tenant/reject/:tenantId", 
    auth,
    isPlatformAdmin,
    platformController.rejectTenant
);

export default router;