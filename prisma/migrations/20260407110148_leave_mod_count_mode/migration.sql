-- AlterTable
ALTER TABLE "LeavePolicyRule" ADD COLUMN     "countMode" "LeaveCountMode" NOT NULL DEFAULT 'WORKING_DAYS';
