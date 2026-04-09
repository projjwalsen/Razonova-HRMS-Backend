import { Router } from "express";
import * as attendController from "./attend.controller";
import { auth } from "../../core/middleware/auth";

const router = Router();


router.use(auth);

router.post(
    "/config/upsert", 
    attendController.upsertAttendanceConfig
);

router.get(
    "/config", 
    attendController.getAttendanceConfig
);

/****** Check In & Out  ***/
router.post(
    "/check-in", 
    attendController.checkIn
);

router.post(
    "/check-out", 
    attendController.checkOut
);

/***** ------- Todays Attendance ------------- *****/

// Get today's attendance for the tenant
router.get(
    "/today",
    attendController.getTodaysAttendance
)
// Get today's attendance for a specific employee
router.get(
    "/today/:userId",
    attendController.getTodaysAttendance
)


/** ------------ Get attendance history ----------------- */
router.get(
    "/history",
    attendController.getAttendanceHistory
)

router.get(
    "/history/:userId",
    attendController.getAttendanceHistory
)


/**---------- Get Monthly Summary ---------------------- */
router.get(
    "/monthly",
    attendController.getMonthSummary
)

router.get(
    "/monthly/:userId",
    attendController.getMonthSummary
)

export default router;