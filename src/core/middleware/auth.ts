import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../../config/db/prisma";
import { PermissionAccessPolicy } from "../policies/perm-access.service";

export interface AuthRequest extends Request {
  user?: any;
  tenant?: any;
}
export const auth = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ status: false, message: "No token provided" });
        }
        const token = authHeader.split(' ')[1]; // Get the token after 'Bearer'
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret");
        if(!decoded){
            return res.status(401).json({ status: false, message: "Invalid token. Try LOGIN again !" });
        }

        // Freshly fetch USER + ROLES from DB
        const freshUser = await prisma.user.findUnique({
            where: { id: (decoded as any).id },
            include: {
                userRoles: {
                    include: {
                        role: true
                    }
                }
            }
        });

        if(!freshUser){
            return res.status(401).json({ status: false, message: "User not found. Try LOGIN again !" });
        }

        const roles = freshUser.userRoles.map(ur => ur.role);

        const roleType = roles.some(r => r.type === "SYSTEM") ? "SYSTEM" : "TENANT";

        const user = {
            id: freshUser.id,
            email: freshUser.email,
            tenantId: freshUser.tenantId,
            roles,
            roleType
        };

        console.log("Authenticated User:", user);

        req.user = user; // Attach the decoded user object to the request
        next(); 

    } catch (error: any) {
        res.status(401).json({ 
            status: false, 
            message: "Unauthorized",
            error: (error as Error).message
        });
    }
}

export const checkPermission = (permission: string) => {
    return async(req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if(!user?.id){
                return res.status(401).json({ 
                    status: false, 
                    message: "Unauthorized" 
                });
            }
            /** Check for permission access from perm-access.service */
            const hasPermission = await PermissionAccessPolicy.hasPermission(user.id, permission);
            if (!hasPermission) {
                return res.status(403).json({ 
                    status: false,
                    code: "PERMISSION_DENIED",
                    message: "Forbidden: You don't have permission to access this resource" 
                });
            }
            /** If user has the required permission, proceed */
            next();
        } catch (error: any) {
            return res.status(500).json({ 
                status: false, 
                message: "Failed to verify permissions",
                error: (error as Error).message
            });  
        }
    }
}

export const checkTenantApproval = async(req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    //if user is platform admin, allow access
    if(!user.tenantId){
        return next();
    }
    const tenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: {
            id: true,
            name: true,
            status: true
        }
    });
    if (!tenant || tenant.status !== "APPROVED") {
        return res.status(403).json({ status: false, message: "Your organization is not approved yet" });
    }
    req.tenant = tenant; // Attach tenant info to request for further use
    next();
}