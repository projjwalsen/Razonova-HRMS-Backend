-- AlterTable
ALTER TABLE "AttendanceConfig" ADD COLUMN     "fullDayMinutes" INTEGER NOT NULL DEFAULT 480,
ADD COLUMN     "halfDayMinutes" INTEGER NOT NULL DEFAULT 240;
