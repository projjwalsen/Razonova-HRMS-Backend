import { NextFunction, Request, Response } from "express";
import { prisma } from "../../config/db/prisma";

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

export const checkPlanFeatureAccess = (feature: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const tenantId = user.tenantId;
      // Fetch user's subscription plan and check if it includes the required feature
      const sub = await prisma.tenantSubscription.findFirst({
        where: { tenantId, isActive: true },
        include: { plan: true }
      });
      
      const features = sub?.plan.features as any;
      if (!features || !features?.[feature] || !features[feature].enabled) {
        return res.status(403).json({
          status: false,
          message: `Access denied: Your current subscription plan does not include the "${feature}" feature.`
        });
      }
  
      req.plan = sub?.plan; // Attach plan info to request for downstream use
      req.features = features;
  
      next();
      
    } catch (error: any) {
      return res.status(500).json({
        status: false,
        message: "Error checking subscription features",
        error: (error as Error).message
      });
    }
  }
}