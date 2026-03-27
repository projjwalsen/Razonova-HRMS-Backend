import { Request, Response } from "express";
import { prisma } from "../../config/db/prisma";
import { deleteFromS3, uploadToS3 } from "../../config/s3/s3.config";
import { DepartmentPolicy } from "../../core/policies/departmnt.policy";

/**
 * @swagger
 * /org/info:
 *   post:
 *     tags:
 *       - organization
 *     summary: Create organization info
 *     description: Create basic organization details including logo upload.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               tenantId:
 *                 type: string
 *                 description: Tenant (company) ID
 *               name:
 *                 type: string
 *                 description: Organization name
 *               logo:
 *                 type: string
 *                 format: binary
 *                 description: Organization logo file
 *               industry:
 *                 type: string
 *               companySize:
 *                 type: string
 *               addressLine1:
 *                 type: string
 *               addressLine2:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               country:
 *                 type: string
 *               pinCode:
 *                 type: string
 *     responses:
 *       201:
 *         description: Organization info created successfully
 *       400:
 *         description: Bad request
 */
export const createOrganizationInfo = async (req: Request, res: Response) => {
    try {
        const {
            tenantId,
            name,
            industry,
            companySize,
            addressLine1,
            addressLine2,
            city,
            state,
            country,
            pinCode
        } = req.body;

        if(!tenantId){
            return res.status(400).json({ 
                status: false, 
                message: "tenantId is required" 
            });
        }
        let orgName = name;
        if(!orgName){
            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId }
            });
            orgName = tenant?.name || "Organization Name";
        }
        let logoUrl: string | undefined = undefined;
        if(req.file){
            logoUrl = await uploadToS3(
                req.file,
                tenantId,
                "company-logos"
            );
        }
        const organization = await prisma.organization.create({
            data: {
                tenantId,
                name: orgName,
                logoUrl,
                industry,
                companySize,
                addressLine1,
                addressLine2,
                city,
                state,
                country,
                pinCode
            }
        });

        res.status(201).json({ 
            status: true, 
            message: "Organization info created successfully", 
            data: organization 
        });
    } catch (error: any) {
        console.error("Error creating organization info:", error);
        return res.status(500).json({ 
            status: false, 
            message: "Failed to create organization info" 
        });
    }
}

/**
 * @swagger
 * /org/info/{id}:
 *   get:
 *     tags:
 *       - organization
 *     summary: Get organization info by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Organization ID
 *     responses:
 *       200:
 *         description: Organization info retrieved successfully
 *       404:
 *         description: Organization not found
 *       400:
 *         description: Bad request
 */
export const getOrganizationInfo = async (req: Request, res: Response) => {
    try {
        const { id } = (req as any).params;
        if (!id) {
            return res.status(400).json({
                status: false,
                message: "Organization ID is required"
            });
        }
        const organization = await prisma.organization.findUnique({
            where: { id },
            include: {
                tenant: true
            }
        });
        if (!organization) {
            return res.status(404).json({
                status: false,
                message: "Organization not found"
            });
        }
        res.status(200).json({
            status: true,
            message: "Organization info retrieved successfully",
            data: organization
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to retrieve organization info",
            error: error.message
        });
    }
};

/**
 * @swagger
 * /org/info/{orgId}:
 *   patch:
 *     tags:
 *       - organization
 *     summary: Update organization info
 *     description: Update organization details including logo. If a new logo is provided, the old one will be deleted.
 *     parameters:
 *       - in: path
 *         name: orgId
 *         schema:
 *           type: string
 *         required: true
 *         description: Organization ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               industry:
 *                 type: string
 *               companySize:
 *                 type: string
 *               addressLine1:
 *                 type: string
 *               addressLine2:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               country:
 *                 type: string
 *               pinCode:
 *                 type: string
 *                 format: binary
 *                 description: New organization logo file
 *     responses:
 *       200:
 *         description: Organization updated successfully
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Organization not found
 *       500:
 *         description: Internal server error
 */
export const updateOrganizationInfo = async (req: Request, res: Response) => {
    try {
        const { orgId } = (req as any).params;
        const actor = (req as any).user; // Assuming auth middleware sets req.user
        const tenantId = actor.tenantId;
        const {
            name,
            industry,
            companySize,
            addressLine1,
            addressLine2,
            city,
            state,
            country,
            pinCode
        } = req.body;
        let logoUrl: string | undefined = undefined;
        if (!orgId) {
            return res.status(400).json({
                status: false,
                message: "Organization ID is required"
            });
        }
        if(!tenantId){
            return res.status(400).json({
                status: false,
                message: "Tenant ID is required"
            });
        }
        const existingOrg = await prisma.organization.findUnique({
            where: { id: orgId }
        });
        if (!existingOrg) {
            return res.status(404).json({
                status: false,
                message: "Organization not found"
            });
        }
        if(existingOrg.tenantId !== tenantId){
            return res.status(403).json({
                status: false,
                message: "You do not have permission to update this organization info"
            });
        }

        let updateData: any = {
            ...(name && { name }),
            ...(industry && { industry }),
            ...(companySize && { companySize }),
            ...(addressLine1 && { addressLine1 }),
            ...(addressLine2 && { addressLine2 }),
            ...(city && { city }),
            ...(state && { state }),
            ...(country && { country }),
            ...(pinCode && { pinCode }),
        }

        if(req.file){
            if(existingOrg.logoUrl){
                try {
                    await deleteFromS3(existingOrg.logoUrl);
                } catch (error) {
                    throw new Error("Failed to delete existing logo from S3: " + (error as Error).message);
                }
            }
            logoUrl = await uploadToS3(
                req.file,
                existingOrg.tenantId,
                "company-logos"
            );
            updateData.logoUrl = logoUrl;
        }

        const organizations = await prisma.organization.update({
            where: { id: orgId },
            data: updateData,
            include: { tenant: true }
        });
        return res.status(200).json({
            status: true,
            message: "Organization info updated successfully",
            data: organizations
        })

    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to update organization info",
            error: error.message
        });
    }
}

/**
 * @swagger
 * /org/settings:
 *   post:
 *     tags:
 *       - organization
 *     summary: Create or update organization settings
 *     description: Save or update a key-value setting for a tenant.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tenantId:
 *                 type: string
 *                 description: Tenant (company) ID
 *               key:
 *                 type: string
 *                 description: Setting key (e.g., timezone, currency)
 *               value:
 *                 type: object
 *                 description: Setting value (can be string, number, or JSON)
 *     responses:
 *       200:
 *         description: Setting saved successfully
 *       400:
 *         description: Bad request
 */
export const createOrganizationSettings = async (req: Request, res: Response) => {
    try {
        const { tenantId, settings } = req.body;

        if(!tenantId || !Array.isArray(settings) || settings.length === 0){
            return res.status(400).json({
                status: false,
                message: "tenantId and settings array are required"
            });
        }
        //validate each setting have key and value exists
        for(const s of settings){
            if(!s.key || s.value === undefined){
                return res.status(400).json({
                    status: false,
                    message: "Each setting must have a key and value"
                });
            }
        }
        // Using transaction for consistency
        const results = await prisma.$transaction(
            settings.map((s: { key: string, value: any }) =>
                prisma.setting.upsert({
                    where: {
                        tenantId_key: { tenantId, key: s.key}
                    },
                    update: { value: s.value },
                    create: { 
                        tenantId, 
                        key: s.key, 
                        value: s.value 
                    }
                })
            )
        );
        if(!results){
            return res.status(500).json({
                status: false,
                message: "Failed to save settings ❌"
            });
        }
        return res.status(200).json({
            status: true,
            message: "Settings saved successfully ✅",
            data: results
        });
    } catch (error: any) {
        res.status(500).json({
            status: false,
            message: "Failed to save setting ❌",
            error: error.message
        });
    }
}

/**
 * @swagger
 * /org/settings:
 *   get:
 *     tags:
 *       - organization
 *     summary: Get organization settings
 *     description: Retrieve all settings for a tenant.
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema:
 *           type: string
 *         required: true
 *         description: Tenant (company) ID
 *     responses:
 *       200:
 *         description: Settings retrieved successfully
 *       400:
 *         description: Bad request
 */
export const getOrganizationSettings = async (req: Request, res: Response) => {
    try {
        const { tenantId } = (req as any).params;
        if (!tenantId) {
            return res.status(400).json({
                status: false,
                message: "tenantId is required"
            });
        }
        const settings = await prisma.setting.findMany({
            where: { tenantId }
        });
        res.status(200).json({
            status: true,
            message: "Settings retrieved successfully",
            data: settings
        });
    } catch (error: any) {
        res.status(500).json({
            status: false,
            message: "Failed to retrieve settings",
            error: error.message
        });
    }
}

/**
 * @swagger
 * /org/department/create:
 *   post:
 *     tags:
 *       - organization
 *     summary: Create department
 *     description: Create a new department for a tenant.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Department name
 *     responses:
 *       201:
 *         description: Department created successfully
 *       400:
 *         description: Bad request
 */
export const createDepartment = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user.tenantId;
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({
                status: false,
                message: "Department name is required"
            });
        }
        const department = await prisma.department.create({
            data: {
                name,
                tenantId
            }
        })
        res.status(201).json({
            status: true,
            message: "Department created successfully",
            data: department
        });
    } catch (error: any) {
        res.status(500).json({
            status: false,
            message: "Failed to create department",
            error: (error as Error).message
        });
    }
}

/**
 * @swagger
 * /org/departments:
 *   get:
 *     tags:
 *       - organization
 *     summary: Get all departments
 *     description: Retrieve all departments for a tenant.
 *     responses:
 *       200:
 *         description: Departments retrieved successfully
 *       400:
 *         description: Bad request
 */
export const getAllDepartments = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user.tenantId;
        const departments = await prisma.department.findMany({
            where: { tenantId },
            include: {
                manager: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                _count: {
                    select: { users: true }
                }
            },
        });
        res.status(200).json({
            status: true,
            message: "Departments retrieved successfully",
            data: departments
        });

    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to retrieve departments",
            error: (error as Error).message
        });
    }
}


/**
 * @swagger
 * /org/department/delete/{id}:
 *   delete:
 *     tags:
 *       - organization
 *     summary: Delete department
 *     description: Delete a department for a tenant.
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Department ID
 *     responses:
 *       200:
 *         description: Department deleted successfully
 *       400:
 *         description: Bad request
 */
export const deleteDepartment = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user.tenantId;
        const { id } = (req as any).params;

        if(!id){
            return res.status(400).json({
                status: false,
                message: "Department ID is required"
            });
        }
        await prisma.department.delete({
            where: { id }
        });
        res.status(200).json({
            status: true,
            message: "Department deleted successfully"
        });
    } catch (error: any) {
        res.status(500).json({
            status: false,
            message: "Failed to delete department",
            error: (error as Error).message
        });
    }
}

/**
 * @swagger
 * /org/designation/create:
 *   post:
 *     tags:
 *       - designation
 *     summary: Create a designation
 *     description: Create a new designation (job title) for a department within the organization.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Designation name (e.g., HR Manager)
 *               departmentId:
 *                 type: string
 *                 description: Department ID
 *               code:
 *                 type: string
 *                 description: Optional designation code
 *     responses:
 *       201:
 *         description: Designation created successfully
 *       400:
 *         description: Bad request
 */
export const createDesignation = async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { name, departmentId, code } = req.body;

    if (!name) {
      return res.status(400).json({ status: false, message: "Name is required" });
    }

    const designation = await prisma.designation.create({
      data: {
        name,
        tenantId,
        departmentId,
      },
    });

    res.status(201).json({ status: true, data: designation });
  } catch (err: any) {
    res.status(500).json({ status: false, message: err.message });
  }
};

/**
 * @swagger
 * /org/designations:
 *   get:
 *     tags:
 *       - designation
 *     summary: Get all designations
 *     description: Retrieve all designations for the current tenant, including department info and user count.
 *     responses:
 *       200:
 *         description: Designations retrieved successfully
 *       500:
 *         description: Internal server error
 */
export const getDesignations = async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;

    const designations = await prisma.designation.findMany({
      where: { tenantId },
      include: {
        department: true,
        _count: { select: { users: true } }
      }
    });

    res.status(200).json({ status: true, data: designations });
  } catch (err: any) {
    res.status(500).json({ status: false, message: err.message });
  }
};

/**
 * @swagger
 * /org/designation/update/{id}:
 *   patch:
 *     tags:
 *       - designation
 *     summary: Update a designation
 *     description: Update the name or department of a designation.
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Designation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: New designation name
 *               departmentId:
 *                 type: string
 *                 description: New department ID
 *     responses:
 *       200:
 *         description: Designation updated successfully
 *       500:
 *         description: Internal server error
 */
export const updateDesignation = async (req: Request, res: Response) => {
  try {
    const { id } = (req as any).params;
    const { name, departmentId } = req.body;

    const updated = await prisma.designation.update({
      where: { id },
      data: { name, departmentId },
    });

    res.status(200).json({ status: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ status: false, message: err.message });
  }
};

/**
 * @swagger
 * /org/designation/delete/{id}:
 *   delete:
 *     tags:
 *       - designation
 *     summary: Delete a designation
 *     description: Delete a designation by ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Designation ID
 *     responses:
 *       200:
 *         description: Designation deleted successfully
 *       500:
 *         description: Internal server error
 */
export const deleteDesignation = async (req: Request, res: Response) => {
  try {
    const { id } = (req as any).params;

    await prisma.designation.delete({
      where: { id },
    });

    res.status(200).json({ status: true, message: "Designation deleted" });
  } catch (err: any) {
    res.status(500).json({ status: false, message: err.message });
  }
};

/**
 * @swagger
 * /org/department/update/{departmentId}:
 *   patch:
 *     tags:
 *       - organization
 *     summary: Assign department lead and/or update department name
 *     description: Update a department by assigning a manager (lead) and/or changing the department name. Validates that the manager exists, is active, and belongs to the department.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: departmentId
 *         schema:
 *           type: string
 *         required: true
 *         description: Department ID to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: New department name (optional, must be unique within tenant)
 *                 example: "Engineering"
 *               managerId:
 *                 type: string
 *                 nullable: true
 *                 description: User ID to assign as department lead (optional, can be null to remove lead)
 *                 example: "usr_123abc"
 *     responses:
 *       200:
 *         description: Department updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Department lead assigned successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     tenantId:
 *                       type: string
 *                     managerId:
 *                       type: string
 *                     manager:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         email:
 *                           type: string
 *       400:
 *         description: Bad request (invalid parameters)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Department ID is required"
 *       403:
 *         description: Forbidden (authorization failed)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: false
 *                 code:
 *                   type: string
 *                   example: "DUPLICATE_DEPARTMENT"
 *                 message:
 *                   type: string
 *                   example: "Department with this name already exists"
 *       404:
 *         description: Department not found
 *       500:
 *         description: Internal server error
 */
export const updateDepartment = async (req: Request, res: Response) => {
    try {
        const actor = (req as any).user;
        const { departmentId } = (req as any).params;
        const { name, managerId } = req.body;

        if(!departmentId){
            return res.status(400).json({
                status: false,
                message: "Department ID is required"
            });
        }
        if(name !== undefined && typeof name !== "string"){
            return res.status(400).json({
                status: false,
                message: "Invalid designation name must be string"
            });
        }
        if(managerId !== undefined && typeof managerId !== "string"){
            return res.status(400).json({
                status: false,
                message: "Invalid managerId must be string"
            });
        }

        const decision = await DepartmentPolicy.canUpdateDepartment(actor, departmentId, { name, managerId });
        if(!decision.allowed){
            return res.status(403).json({
                status: false,
                code: decision.code,
                message: decision.message || "You do not have permission to assign department lead"
            });
        }

        const updatedDepartment = await prisma.department.update({
            where: { id: departmentId },
            data: { 
                ...(name !== undefined ? { name: name.trim() } : {}),
                ...(managerId !== undefined ? { managerId } : {}),
            },
            select: {
                id: true,
                name: true,
                tenantId: true,
                managerId: true,
                manager: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });

        if(!updatedDepartment){
            return res.status(404).json({
                status: false,
                message: "Department not found"
            });
        }
        return res.status(200).json({
            status: true,
            message: "Department lead assigned successfully",
            data: updatedDepartment
        });

    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: "Failed to assign department lead",
            error: (error as Error).message
        });
    }
}