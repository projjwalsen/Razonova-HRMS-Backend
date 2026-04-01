/*
  Warnings:

  - The values [REJECTED] on the enum `OnboardingInviteStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "OnboardingInviteStatus_new" AS ENUM ('PENDING', 'ACCEPTED', 'CANCELLED', 'EXPIRED');
ALTER TABLE "public"."OnboardingInvite" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "OnboardingInvite" ALTER COLUMN "status" TYPE "OnboardingInviteStatus_new" USING ("status"::text::"OnboardingInviteStatus_new");
ALTER TYPE "OnboardingInviteStatus" RENAME TO "OnboardingInviteStatus_old";
ALTER TYPE "OnboardingInviteStatus_new" RENAME TO "OnboardingInviteStatus";
DROP TYPE "public"."OnboardingInviteStatus_old";
ALTER TABLE "OnboardingInvite" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterTable
ALTER TABLE "EmployeeProfile" ALTER COLUMN "employeeCode" DROP NOT NULL;
