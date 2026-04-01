import { Router } from "express";
import { createDepartment, createDesignation, createOrganizationInfo, createOrganizationSettings, deleteDepartment, deleteDesignation, getAllDepartments, getDesignations, getOrganizationInfo, getOrganizationSettings, updateDepartment, updateDesignation, updateOrganizationInfo, upsertOrganizationSettings } from "./org.controller";
import { auth, checkPermission } from "../../core/middleware/auth";
import { createFileUpload } from "../../core/service/multer.service";
import RoleRoute from "../access-control/role.routes"
import UserRoute from "../users/user.routes";
import ReportingRoute from "../reporting/reporting.routes";
import AttendRoute from "../attendence/attend.routes";

const router = Router();

router.use("/role", RoleRoute);
router.use("/reporting", ReportingRoute);
router.use("/users", UserRoute);
router.use("/attendance", AttendRoute);


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
    "/info", 
    getOrganizationInfo
);
router.patch(
    "/info-update/:orgId",
    upload.single('image'),
    updateOrganizationInfo
)

//Organization Settings -- General Locale & Date Format
router.post(
    '/settings-create', 
    createOrganizationSettings
);
router.get(
    '/settings', 
    getOrganizationSettings
);

router.patch(
    '/settings/update', 
    upsertOrganizationSettings
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
    '/department/update/:deptId', 
    checkPermission("DEPARTMENT:UPDATE"),
    updateDepartment
);
router.delete(
    '/department/delete/:deptId', 
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
    '/designation/update/:desigId', 
    checkPermission("DESIGNATION:UPDATE"),
    updateDesignation
);
router.delete(
    '/designation/delete/:desigId', 
    deleteDesignation
);



export default router;