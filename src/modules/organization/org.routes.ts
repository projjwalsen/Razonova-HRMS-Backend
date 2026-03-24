import { Router } from "express";
import { createDepartment, createDesignation, createOrganizationInfo, createOrganizationSettings, deleteDepartment, deleteDesignation, getAllDepartments, getDesignations, getOrganizationInfo, getOrganizationSettings, updateDepartment, updateDesignation } from "./org.controller";
import { auth } from "../../core/middleware/auth";
import { createFileUpload } from "../../core/middleware/service/multer.service";


const router = Router();

const upload = createFileUpload({
    maxSize: 12, // 12MB
    allowedTypes: [ 'image/jpeg', 'image/png', 'image/jpg', 'image/webp']
})

//Organization
router.post("/create", upload.single('image'), auth ,createOrganizationInfo);
router.get("/info/:id", getOrganizationInfo);
router.post('/settings-create', createOrganizationSettings);
router.get('/settings/:tenantId', getOrganizationSettings);

//Department
router.post('/department/create', createDepartment);
router.get('/departments',auth ,getAllDepartments);
router.patch('/department/:id', updateDepartment);
router.delete('/department/:id', deleteDepartment);

//Designation
router.post('/designation/create', createDesignation);
router.get('/designations', getDesignations);
router.patch('/designation/update/:id', updateDesignation);
router.delete('/designation/delete/:id', deleteDesignation);

export default router;