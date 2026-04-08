-- DropForeignKey
ALTER TABLE "LeaveApprovalPolicy" DROP CONSTRAINT "LeaveApprovalPolicy_leavePolicyId_fkey";

-- DropForeignKey
ALTER TABLE "LeaveApprovalPolicy" DROP CONSTRAINT "LeaveApprovalPolicy_leaveTypeId_fkey";

-- AlterTable
ALTER TABLE "LeaveApprovalPolicy" ALTER COLUMN "leavePolicyId" DROP NOT NULL,
ALTER COLUMN "leaveTypeId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "LeaveApprovalPolicy" ADD CONSTRAINT "LeaveApprovalPolicy_leavePolicyId_fkey" FOREIGN KEY ("leavePolicyId") REFERENCES "LeavePolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApprovalPolicy" ADD CONSTRAINT "LeaveApprovalPolicy_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
