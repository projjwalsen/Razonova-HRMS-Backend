import { NextFunction, Request, Response } from "express";
import { prisma } from "../../config/db/prisma";
import { SubscriptionService } from "../../modules/Admin_Platform/subscriptions/subscription.service";

/*
  x-middleware:
  name: isPlatformAdmin
  description: >
    Restricts access to platform admin-only routes.
    Allows access if:
      - User is a platform admin (tenantId === null)
      - OR user has a role with name "SYSTEM_ADMIN" and type "SYSTEM"
    Responds with 403 Forbidden if neither condition is met.
*/
export const isPlatformAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  const isPlatform = user.tenantId === null;
  const hasSystemAdminRole = Array.isArray(user.roles) &&
    user.roles.some((role: any) => role.name === "SYSTEM_ADMIN" && role.type === "SYSTEM");

  if (!isPlatform && !hasSystemAdminRole) {
    return res.status(403).json({
      message: "Access denied: Only platform admins allowed"
    });
  }
  next();
};

export const checkSubscriptionModuleAccess = (moduleKey: string) => {
  return async(req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      if(!user?.tenantId){
        return res.status(401).json({ 
            status: false, 
            message: "Tenant context missing" 
        });
      }

      const result = await SubscriptionService.getTenantActiveSubscriptions(user.tenantId);

      if(!result.hasSubscriptions || result.status !== 'ACTIVE'){
        return res.status(403).json({
          status: false,
          code: result.status,
          message: result.message
        });
      }

      const subscription: any = result.subscription;

      const normalizedModuleKey = moduleKey.trim().toUpperCase();
      const hasModuleAccess = subscription.modules.some((pm: any) => {
        return (
          pm.isEnabled === true &&
          pm.module?.isActive === true &&
          pm.module?.key === normalizedModuleKey
        )
      });

      if (!hasModuleAccess) {
        return res.status(403).json({
          status: false,
          code: "MODULE_NOT_INCLUDED",
          message: `Your current subscription plan does not include the ${normalizedModuleKey} module`
        });
      }


      (req as any).subscription = subscription; // Attach subscription details to request for downstream use
      (req as any).subscriptionModules = subscription.modules.map(
        (pm: any) => pm.module.key
      )

      next();
    } catch (error) {
      return res.status(500).json({
        status: false,
        message: "An error occurred while checking subscription access"
      });
    }
  }
}