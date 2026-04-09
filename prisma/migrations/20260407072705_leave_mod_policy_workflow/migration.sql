/*
  Warnings:

  - You are about to drop the column `status` on the `LeaveApproval` table. All the data in the column will be lost.
  - You are about to drop the column `adminApprovedAt` on the `LeaveRequest` table. All the data in the column will be lost.
  - You are about to drop the column `companyAdminId` on the `LeaveRequest` table. All the data in the column will be lost.
  - You are about to drop the column `managerApprovedAt` on the `LeaveRequest` table. All the data in the column will be lost.
  - You are about to drop the column `reportingManagerId` on the `LeaveRequest` table. All the data in the column will be lost.
  - You are about to drop the column `allowHalfDay` on the `LeaveType` table. All the data in the column will be lost.
  - You are about to drop the column `attachmentRequired` on the `LeaveType` table. All the data in the column will be lost.
  - You are about to drop the column `maxLimits` on the `LeaveType` table. All the data in the column will be lost.
  - You are about to drop the column `priorNoticeDays` on the `LeaveType` table. All the data in the column will be lost.
  - You are about to drop the column `sandwichLeaveAllowed` on the `LeaveType` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[leaveRequestId,approverId,level]` on the table `LeaveApproval` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `level` to the `LeaveApproval` table without a default value. This is not possible if the table is not empty.
  - Added the required column `leavePolicyId` to the `LeaveRequest` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "HolidayRegionType" AS ENUM ('GLOBAL', 'COUNTRY', 'STATE', 'CITY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'TRAINEE', 'INTERN', 'CONTRACT', 'OTHER');

-- CreateEnum
CREATE TYPE "LeaveApproverType" AS ENUM ('REPORTING_MANAGER', 'DEPARTMENT_MANAGER', 'COMPANY_ADMIN', 'SPECIFIC_USER', 'ROLE');

-- CreateEnum
CREATE TYPE "LeaveAccuralFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "LeaveCountMode" AS ENUM ('CALENDAR_DAYS', 'WORKING_DAYS');

-- DropForeignKey
ALTER TABLE "LeaveRequest" DROP CONSTRAINT "LeaveRequest_companyAdminId_fkey";

-- DropForeignKey
ALTER TABLE "LeaveRequest" DROP CONSTRAINT "LeaveRequest_reportingManagerId_fkey";

-- DropIndex
DROP INDEX "LeaveApproval_approverId_status_idx";

-- DropIndex
DROP INDEX "LeaveApproval_leaveRequestId_approverId_key";

-- AlterTable
ALTER TABLE "EmployeeProfile" ADD COLUMN     "employmentType" "EmploymentType",
ADD COLUMN     "probationMonths" INTEGER;

-- AlterTable
ALTER TABLE "LeaveApproval" DROP COLUMN "status",
ADD COLUMN     "actedAt" TIMESTAMP(3),
ADD COLUMN     "decision" "LeaveApprovalAction" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "level" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "LeaveRequest" DROP COLUMN "adminApprovedAt",
DROP COLUMN "companyAdminId",
DROP COLUMN "managerApprovedAt",
DROP COLUMN "reportingManagerId",
ADD COLUMN     "approvalPolicyId" TEXT,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "currentApprovalLevel" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "leavePolicyId" TEXT NOT NULL,
ADD COLUMN     "leavePolicyRuleId" TEXT;

-- AlterTable
ALTER TABLE "LeaveType" DROP COLUMN "allowHalfDay",
DROP COLUMN "attachmentRequired",
DROP COLUMN "maxLimits",
DROP COLUMN "priorNoticeDays",
DROP COLUMN "sandwichLeaveAllowed";

-- CreateTable
CREATE TABLE "LeaveBalance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "allocatedDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "takenDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carriedForwardDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "usedDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remainingDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeavePolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "employmentType" "EmploymentType",
    "probationMonths" INTEGER DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeavePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeavePolicyRule" (
    "id" TEXT NOT NULL,
    "leavePolicyId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "annualAllocation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxPerRequest" DOUBLE PRECISION,
    "maxPerYear" DOUBLE PRECISION,
    "maxConsecutiveDays" DOUBLE PRECISION,
    "allowDuringProbation" BOOLEAN NOT NULL DEFAULT false,
    "attachmentRequired" BOOLEAN NOT NULL DEFAULT false,
    "priorNoticeDays" INTEGER,
    "sandwichLeaveAllowed" BOOLEAN NOT NULL DEFAULT false,
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "carryForwardAllowed" BOOLEAN NOT NULL DEFAULT false,
    "carryForwardLimit" DOUBLE PRECISION,
    "accrualFrequency" "LeaveAccuralFrequency",
    "accrualAmount" DOUBLE PRECISION,
    "regionHolidayCalenderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeavePolicyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveApprovalPolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "leavePolicyId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "departmentId" TEXT,
    "designationId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveApprovalPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveApprovalPolicyLevel" (
    "id" TEXT NOT NULL,
    "approvalPolicyId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "approverType" "LeaveApproverType" NOT NULL,
    "roleId" TEXT,
    "userId" TEXT,
    "minApprovals" INTEGER DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveApprovalPolicyLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HolidayCalendar" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "regionType" "HolidayRegionType" NOT NULL DEFAULT 'GLOBAL',
    "country" TEXT,
    "state" TEXT,
    "city" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HolidayCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "holidayCalendarId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeaveBalance_tenantId_userId_year_idx" ON "LeaveBalance"("tenantId", "userId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveBalance_tenantId_userId_leaveTypeId_year_key" ON "LeaveBalance"("tenantId", "userId", "leaveTypeId", "year");

-- CreateIndex
CREATE INDEX "LeavePolicy_tenantId_employmentType_isActive_idx" ON "LeavePolicy"("tenantId", "employmentType", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LeavePolicy_tenantId_name_key" ON "LeavePolicy"("tenantId", "name");

-- CreateIndex
CREATE INDEX "LeavePolicyRule_leaveTypeId_idx" ON "LeavePolicyRule"("leaveTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "LeavePolicyRule_leavePolicyId_leaveTypeId_key" ON "LeavePolicyRule"("leavePolicyId", "leaveTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveApprovalPolicy_tenantId_name_key" ON "LeaveApprovalPolicy"("tenantId", "name");

-- CreateIndex
CREATE INDEX "LeaveApprovalPolicyLevel_approvalPolicyId_level_idx" ON "LeaveApprovalPolicyLevel"("approvalPolicyId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveApprovalPolicyLevel_approvalPolicyId_level_key" ON "LeaveApprovalPolicyLevel"("approvalPolicyId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "HolidayCalendar_tenantId_name_key" ON "HolidayCalendar"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Holiday_tenantId_date_idx" ON "Holiday"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_holidayCalendarId_date_key" ON "Holiday"("holidayCalendarId", "date");

-- CreateIndex
CREATE INDEX "LeaveApproval_approverId_decision_idx" ON "LeaveApproval"("approverId", "decision");

-- CreateIndex
CREATE INDEX "LeaveApproval_leaveRequestId_level_idx" ON "LeaveApproval"("leaveRequestId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveApproval_leaveRequestId_approverId_level_key" ON "LeaveApproval"("leaveRequestId", "approverId", "level");

-- AddForeignKey
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeavePolicy" ADD CONSTRAINT "LeavePolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeavePolicyRule" ADD CONSTRAINT "LeavePolicyRule_leavePolicyId_fkey" FOREIGN KEY ("leavePolicyId") REFERENCES "LeavePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeavePolicyRule" ADD CONSTRAINT "LeavePolicyRule_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeavePolicyRule" ADD CONSTRAINT "LeavePolicyRule_regionHolidayCalenderId_fkey" FOREIGN KEY ("regionHolidayCalenderId") REFERENCES "HolidayCalendar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApprovalPolicy" ADD CONSTRAINT "LeaveApprovalPolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApprovalPolicy" ADD CONSTRAINT "LeaveApprovalPolicy_leavePolicyId_fkey" FOREIGN KEY ("leavePolicyId") REFERENCES "LeavePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApprovalPolicy" ADD CONSTRAINT "LeaveApprovalPolicy_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApprovalPolicy" ADD CONSTRAINT "LeaveApprovalPolicy_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApprovalPolicy" ADD CONSTRAINT "LeaveApprovalPolicy_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApprovalPolicyLevel" ADD CONSTRAINT "LeaveApprovalPolicyLevel_approvalPolicyId_fkey" FOREIGN KEY ("approvalPolicyId") REFERENCES "LeaveApprovalPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApprovalPolicyLevel" ADD CONSTRAINT "LeaveApprovalPolicyLevel_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApprovalPolicyLevel" ADD CONSTRAINT "LeaveApprovalPolicyLevel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_leavePolicyId_fkey" FOREIGN KEY ("leavePolicyId") REFERENCES "LeavePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_leavePolicyRuleId_fkey" FOREIGN KEY ("leavePolicyRuleId") REFERENCES "LeavePolicyRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_approvalPolicyId_fkey" FOREIGN KEY ("approvalPolicyId") REFERENCES "LeaveApprovalPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HolidayCalendar" ADD CONSTRAINT "HolidayCalendar_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_holidayCalendarId_fkey" FOREIGN KEY ("holidayCalendarId") REFERENCES "HolidayCalendar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
