/*
  Warnings:

  - Added the required column `workingDays` to the `AttendanceConfig` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AttendanceStatus" ADD VALUE 'ON_LEAVE';
ALTER TYPE "AttendanceStatus" ADD VALUE 'HOLIDAY';
ALTER TYPE "AttendanceStatus" ADD VALUE 'WEEK_OFF';

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "isHoliday" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isOnApprovedLeave" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPaidLeave" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isWeekOff" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "leaveRequestId" TEXT;

-- AlterTable
ALTER TABLE "AttendanceConfig" ADD COLUMN     "workingDays" JSONB NOT NULL;

-- CreateIndex
CREATE INDEX "Attendance_tenantId_status_date_idx" ON "Attendance"("tenantId", "status", "date");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "LeaveRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
