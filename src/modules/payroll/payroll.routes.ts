import { Router } from "express";
import * as payrollController from "./payroll.controller";
import { auth } from "../../core/middleware/auth";

const router = Router();

router.use(auth)

/* -------------- DASHBOARD KPI's ---------------- */
router.get(
    "/dashboard-kpis", 
    payrollController.getPayRollDashboard
);
/* -------------- PAYROLL COMPONENT MASTER ----------------  */
router.post(
    "/component-master", 
    payrollController.upsertPayrollComponentMaster
);

router.get(
    "/component-master", 
    payrollController.getPayrollComponentMasters
)

/* -------------- PAYROLL - Create PAYStructure ---------------- */
router.post(
    "/pay-structure", 
    payrollController.upsertPayStructure
);

router.patch(
    "/pay-structure",
    payrollController.upsertPayStructure
)

/* -------------- PAYROLL - Get PayStructures ---------------- */
router.get(
    "/pay-structure", 
    payrollController.getPayStructures
);

/* -------------- EMPLOYEE PAYROLL COMPONENT OVERRIDE ---------------- */
router.post(
    "/employee-components/:userId",
    payrollController.upsertEmployeePayrollComponents
)

router.get(
    "/employee-components/:userId",
    payrollController.getEmployeePayrollComponents
)




/* -------------- PAYROLL - Generate DRAFT Payroll ---------------- */
router.post(
    "/generate", 
    payrollController.generatePayrollForMonth
);

// update specific user draft payroll for the month
router.post(
    "/generate/user", 
    payrollController.updateFinalPayrollForUser
)

/* -------------- PAYROLL - Processing ---------------- */
router.post(
    "/process/:payrollId", 
    payrollController.processPayroll
)

/* -------------- PAYROLL - Status Flow ---------------- */
// Mark Payroll as Disbursing
router.post(
    "/mark-disbursing/:payrollId", 
    payrollController.markPayrollDisbursing
);

// Mark Payroll as Paid
router.post(
    "/mark-paid/:payrollId", 
    payrollController.markPayrollPaid
)

// Mark Payroll as Failed
router.post(
    "/mark-failed/:payrollId", 
    payrollController.markPayrollFailed
)

/* -------------- PAYROLL - COMPANY listing Payrolls ---------------- */
router.get(
    "/all-listing", 
    payrollController.getPayrolls
)

/* -------------- PAYROLL - Employee Payroll listing All Month and year ---------------- */
router.get(
    "/me-listing", 
    payrollController.getMyPayrolls
)

/* -------------- PAYROLL - Get Payroll details by ID ---------------- */
router.get(
    "/:payrollId/:userId", 
    payrollController.getPayrollById
)

/* -------------- PAYROLL - Get My Payroll details by ID ---------------- */
router.get(
    "/me/:payrollId", 
    payrollController.getMyPayrollById
)

export default router;