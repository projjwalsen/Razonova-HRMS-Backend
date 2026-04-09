/*
  Warnings:

  - The `accrualFrequency` column on the `LeavePolicyRule` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "LeaveAccrualFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');

-- AlterTable
ALTER TABLE "LeavePolicyRule" DROP COLUMN "accrualFrequency",
ADD COLUMN     "accrualFrequency" "LeaveAccrualFrequency";

-- DropEnum
DROP TYPE "LeaveAccuralFrequency";
