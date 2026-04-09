/*
  Warnings:

  - You are about to drop the column `attachmentUrl` on the `LeaveRequest` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "LeaveRequest" DROP COLUMN "attachmentUrl",
ADD COLUMN     "attachmentUrls" TEXT[];
