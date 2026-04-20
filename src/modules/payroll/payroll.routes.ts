import { Router } from "express";
import * as payrollController from "./payroll.controller";
import { auth, checkPermission, checkTenantApproval } from "../../core/middleware/auth";

const router = Router();

router.use(auth, checkTenantApproval)

/* -------------- DASHBOARD KPI's ---------------- */
router.get(
    "/dashboard-kpis",
    checkPermission("PAYROLL:READ"),
    payrollController.getPayRollDashboard
);
/* -------------- PAYROLL COMPONENT MASTER ----------------  */
router.post(
    "/component-master", 
    checkPermission("PAYROLL:COMPONENTS_MANAGE"),
    payrollController.upsertPayrollComponentMaster
);

router.get(
    "/component-master", 
    checkPermission("PAYROLL:COMPONENTS_READ"),
    payrollController.getPayrollComponentMasters
)

/* -------------- PAYROLL - Create PAYStructure ---------------- */
router.post(
    "/pay-structure", 
    checkPermission("PAY_STRUCTURE:MANAGE"),
    payrollController.upsertPayStructure
);

router.patch(
    "/pay-structure",
    checkPermission("PAY_STRUCTURE:MANAGE"),
    payrollController.upsertPayStructure
)

router.delete(
    "/pay-structure/:id",
    checkPermission("PAY_STRUCTURE:DELETE"),
    payrollController.deletePayStructure
)

/* -------------- PAYROLL - Get PayStructures ---------------- */
router.get(
    "/pay-structure", 
    checkPermission("PAY_STRUCTURE:READ"),
    payrollController.getPayStructures
);

router.get(
  "/pay-structure/user/:userId",
  checkPermission("PAY_STRUCTURE:READ"),
  payrollController.getPayStructureForUser
);

/* -------------- EMPLOYEE PAYROLL COMPONENT OVERRIDE ---------------- */
router.post(
    "/employee-components/:userId",
    checkPermission("EMPLOYEE_PAYROLL:OVERRIDE"),
    payrollController.upsertEmployeePayrollComponents
)

router.get(
    "/employee-components/:userId",
    checkPermission("PAYROLL:READ"),
    payrollController.getEmployeePayrollComponents
)




/* -------------- PAYROLL - Generate DRAFT Payroll ---------------- */
router.post(
    "/generate", 
    checkPermission("PAYROLL:GENERATE"),
    payrollController.generatePayrollForMonth
);

// update specific user draft payroll for the month
// router.post(
//     "/generate/user", 
//     payrollController.updateFinalPayrollForUser
// )

/* -------------- PAYROLL - Processing ---------------- */
router.post(
    "/process/:payrollId", 
    checkPermission("PAYROLL:PROCESS"),
    payrollController.processPayroll
)

/* -------------- PAYROLL - Status Flow ---------------- */
// Mark Payroll as Disbursing
router.post(
    "/mark-disbursing/:payrollId",
    checkPermission("PAYROLL:MARK_DISBURSE"), 
    payrollController.markPayrollDisbursing
);

// Mark Payroll as Paid
router.post(
    "/mark-paid/:payrollId", 
    checkPermission("PAYROLL:MARK_PAID"),
    payrollController.markPayrollPaid
)

// Mark Payroll as Failed
router.post(
    "/mark-failed/:payrollId", 
    payrollController.markPayrollFailed
)


router.get(
    "/all-employees",
    checkPermission("PAYROLL:READ"),
    payrollController.getAllEmployeesForPayroll
)




/* -------------- PAYROLL - COMPANY listing Payrolls ---------------- */
router.get(
    "/all-listing", 
    checkPermission("PAYROLL:READ"),
    payrollController.getPayrolls
)

/* -------------- PAYROLL - Employee Payroll listing All Month and year ---------------- */
router.get(
    "/me-listing",
    checkPermission("PAYROLL:READ_SELF"), 
    payrollController.getMyPayrolls
)

/* -------------- PAYROLL - Get Payroll details by ID ---------------- */
router.get(
    "/:payrollId/:userId", 
    checkPermission("PAYROLL:READ"),
    payrollController.getPayrollById
)

/* -------------- PAYROLL - Get My Payroll details by ID ---------------- */
router.get(
    "/me/:payrollId", 
    checkPermission("PAYROLL:READ_SELF"),
    payrollController.getMyPayrollById
)


/* --------------------- Payslip ------------------------------------------ */
router.get(
    "/payslip/preview/:payrollId", 
    checkPermission("PAYROLL:PAYSLIP_PREVIEW_ADMIN"),
    payrollController.previewPayslip
);
router.get(
    "/payslip/download/:payrollId", 
    checkPermission("PAYROLL:PAYSLIP_DOWNLOAD_ADMIN"),
    payrollController.downloadPayslip
);

router.get(
    "/me/payslip/preview/:payrollId", 
    checkPermission("PAYROLL:PAYSLIP_PREVIEW_SELF"),
    payrollController.previewMyPayslip
);
router.get(
    "/me/payslip/download/:payrollId",
    checkPermission("PAYROLL:PAYSLIP_DOWNLOAD_SELF"),
    payrollController.downloadMyPayslip
);

export default router;