/*
  Warnings:

  - A unique constraint covering the columns `[scope,module,action]` on the table `Permission` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Permission_name_key";

-- AlterTable
ALTER TABLE "Permission" ADD COLUMN     "scope" "RoleType" NOT NULL DEFAULT 'SYSTEM';

-- CreateIndex
CREATE UNIQUE INDEX "Permission_scope_module_action_key" ON "Permission"("scope", "module", "action");
