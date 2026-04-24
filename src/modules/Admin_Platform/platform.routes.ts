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
router.use(auth, isPlatformAdmin)

router.get(
    "/organizations", 
    platformController.getAllOrganizationsPlatform
);

router.get(
    "/dashboard/kpis",
    platformController.getPlatformDashboardKpis
);

router.get(
    "/organizations/users",
    platformController.getAllOrganizationsUsers
)

router.get(
    "/departments", 
    platformController.getAllDepartmentsPlatform
);
router.patch(
    "/tenant/approve/:tenantId", 
    platformController.approveTenant
);
router.patch(
    "/tenant/reject/:tenantId", 
    platformController.rejectTenant
);

export default router;