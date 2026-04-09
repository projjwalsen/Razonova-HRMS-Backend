/*
  Warnings:

  - A unique constraint covering the columns `[tenantId]` on the table `AttendanceConfig` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "AttendanceConfig_tenantId_key" ON "AttendanceConfig"("tenantId");
