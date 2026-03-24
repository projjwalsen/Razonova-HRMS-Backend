import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../../config/db/prisma";

export interface AuthRequest extends Request {
  user?: any;
}
export const auth = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ status: false, message: "No token provided" });
        }
        const token = authHeader.split(' ')[1]; // Get the token after 'Bearer'
        const user = jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret");
        if(!user){
            return res.status(401).json({ status: false, message: "Invalid token. Try LOGIN again !" });
        }
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
        const user = req.user;
        const userRoles = await prisma.userRole.findMany({
            where: { userId: user.id },
            include: {
                role: {
                    include: {
                        rolePermissions: {
                            include: {
                                permission: true
                            }
                        }
                    }
                }
            }
        });
        const userPermissions = userRoles.flatMap(ur => ur.role.rolePermissions.map(rp => rp.permission.name));
        if (!userPermissions.includes(permission)) {
            return res.status(403).json({ status: false, message: "Forbidden: You don't have the required permission" });
        }
        next();
    }
}