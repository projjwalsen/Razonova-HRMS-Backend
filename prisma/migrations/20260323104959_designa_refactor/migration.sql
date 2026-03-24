/*
  Warnings:

  - You are about to drop the column `roleId` on the `Designation` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Designation" DROP CONSTRAINT "Designation_roleId_fkey";

-- AlterTable
ALTER TABLE "Designation" DROP COLUMN "roleId";
