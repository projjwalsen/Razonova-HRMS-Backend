/*
  Warnings:

  - The values [PERCENTAGE] on the enum `PayStructureValueType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `attachmentRequired` on the `PayStructureComponent` table. All the data in the column will be lost.
  - You are about to drop the column `isTaxable` on the `PayStructureComponent` table. All the data in the column will be lost.
  - You are about to drop the column `label` on the `PayStructureComponent` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `PayStructureComponent` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[panNumber]` on the table `EmployeeProfile` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[aadharNumber]` on the table `EmployeeProfile` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[payStructureId,payrollMasterComponentId]` on the table `PayStructureComponent` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `payrollMasterComponentId` to the `PayStructureComponent` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PayrollComponentFreq" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');

-- AlterEnum
BEGIN;
CREATE TYPE "PayStructureValueType_new" AS ENUM ('PERCENTAGE_OF_BASIC', 'FLAT');
ALTER TABLE "PayStructureComponent" ALTER COLUMN "valueType" TYPE "PayStructureValueType_new" USING ("valueType"::text::"PayStructureValueType_new");
ALTER TYPE "PayStructureValueType" RENAME TO "PayStructureValueType_old";
ALTER TYPE "PayStructureValueType_new" RENAME TO "PayStructureValueType";
DROP TYPE "public"."PayStructureValueType_old";
COMMIT;

-- AlterTable
ALTER TABLE "EmployeeProfile" ADD COLUMN     "aadharNumber" TEXT,
ADD COLUMN     "panNumber" TEXT;

-- AlterTable
ALTER TABLE "PayStructureComponent" DROP COLUMN "attachmentRequired",
DROP COLUMN "isTaxable",
DROP COLUMN "label",
DROP COLUMN "type",
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "payrollMasterComponentId" TEXT;

-- DropEnum
DROP TYPE "PayStructureCompType";

-- CreateTable
CREATE TABLE "PayrollComponentMaster" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PayrollItemType" NOT NULL,
    "valueType" "PayStructureValueType" NOT NULL,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "isTaxable" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollComponentMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employeePayrollComponent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "payrollMasterComponentId" TEXT NOT NULL,
    "valueType" "PayStructureValueType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employeePayrollComponent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayrollComponentMaster_tenantId_type_isActive_idx" ON "PayrollComponentMaster"("tenantId", "type", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollComponentMaster_tenantId_name_key" ON "PayrollComponentMaster"("tenantId", "name");

-- CreateIndex
CREATE INDEX "employeePayrollComponent_payrollMasterComponentId_isActive_idx" ON "employeePayrollComponent"("payrollMasterComponentId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "employeePayrollComponent_userId_payrollMasterComponentId_key" ON "employeePayrollComponent"("userId", "payrollMasterComponentId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeProfile_panNumber_key" ON "EmployeeProfile"("panNumber");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeProfile_aadharNumber_key" ON "EmployeeProfile"("aadharNumber");

-- CreateIndex
CREATE INDEX "PayStructureComponent_payrollMasterComponentId_isActive_idx" ON "PayStructureComponent"("payrollMasterComponentId", "isActive");

-- CreateIndex
CREATE INDEX "PayStructureComponent_payStructureId_isActive_idx" ON "PayStructureComponent"("payStructureId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PayStructureComponent_payStructureId_payrollMasterComponent_key" ON "PayStructureComponent"("payStructureId", "payrollMasterComponentId");

-- AddForeignKey
ALTER TABLE "PayrollComponentMaster" ADD CONSTRAINT "PayrollComponentMaster_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayStructureComponent" ADD CONSTRAINT "PayStructureComponent_payrollMasterComponentId_fkey" FOREIGN KEY ("payrollMasterComponentId") REFERENCES "PayrollComponentMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employeePayrollComponent" ADD CONSTRAINT "employeePayrollComponent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employeePayrollComponent" ADD CONSTRAINT "employeePayrollComponent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employeePayrollComponent" ADD CONSTRAINT "employeePayrollComponent_payrollMasterComponentId_fkey" FOREIGN KEY ("payrollMasterComponentId") REFERENCES "PayrollComponentMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
