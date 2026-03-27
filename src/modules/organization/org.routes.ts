import { Router } from "express";
import { createDepartment, createDesignation, createOrganizationInfo, createOrganizationSettings, deleteDepartment, deleteDesignation, getAllDepartments, getDesignations, getOrganizationInfo, getOrganizationSettings, updateDepartment, updateDesignation, updateOrganizationInfo } from "./org.controller";
import { auth, checkPermission } from "../../core/middleware/auth";
import { createFileUpload } from "../../core/service/multer.service";
import RoleRoute from "../access-control/role.routes"
import UserRoute from "../users/user.routes";
import ReportingRoute from "../reporting/reporting.routes";

const router = Router();

router.use("/role", RoleRoute);
router.use("/reporting", ReportingRoute);
router.use("/users", UserRoute);


const upload = createFileUpload({
    maxSize: 12, // 12MB
    allowedTypes: [ 'image/jpeg', 'image/png', 'image/jpg', 'image/webp']
})

router.use(auth)

//Organization
router.post(
    "/info-create", 
    upload.single('image'),
    createOrganizationInfo
);
router.get(
    "/info/:id", 
    getOrganizationInfo
);
router.patch(
    "/info-update/:id",
    upload.single('image'),
    updateOrganizationInfo
)

//Organization Settings -- General Locale & Date Format
router.post(
    '/settings-create', 
    createOrganizationSettings
);
router.get(
    '/settings/:tenantId', 
    getOrganizationSettings
);


//Department
router.post(
    '/department/create', 
    checkPermission("DEPARTMENT:CREATE"),
    createDepartment
);
router.get(
    '/departments',
    checkPermission("DEPARTMENT:READ"),
    getAllDepartments
);
router.patch(
    '/department/update/:id', 
    checkPermission("DEPARTMENT:UPDATE"),
    updateDepartment
);
router.delete(
    '/department/delete/:id', 
    deleteDepartment
);

//Designation
router.post(
    '/designation/create', 
    checkPermission("DESIGNATION:CREATE"),
    createDesignation
);
router.get(
    '/designations', 
    checkPermission("DESIGNATION:READ"),
    getDesignations
);
router.patch(
    '/designation/update/:id', 
    checkPermission("DESIGNATION:UPDATE"),
    updateDesignation
);
router.delete(
    '/designation/delete/:id', 
    deleteDesignation
);



export default router;