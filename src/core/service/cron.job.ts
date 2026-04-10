import cron from 'node-cron';
import { prisma } from '../../config/db/prisma';
import { getTenantTimezone, getYearRangeForTimezone, isFirstDayOfYearInTimezone } from '../../modules/utils/util';
import { LeaveService } from '../../modules/leave/leave.service';

export function LeaveCarryForwardCron() {
    cron.schedule(
        "0 * * * *",
        async() => {
            console.log("Running Leave Carry Forward Cron Job...");

            const tenants = await prisma.tenant.findMany({
                where: {
                    isActive: true
                },
                select: {
                    id: true,
                }
            });

            for(const tenant of tenants) {
                try {
                    const timezone = await getTenantTimezone(tenant.id);

                    if(!isFirstDayOfYearInTimezone(timezone)) {
                        continue;
                    }
                    const {
                        fromYear,
                        toYear
                    } = getYearRangeForTimezone(timezone);

                    await LeaveService.runYearlyCarryForward(
                        tenant.id,
                        fromYear,
                        toYear
                    );

                    console.log(`Leave Carry Forward Cron Job executed successfully for tenant ${tenant.id} for year ${fromYear} to ${toYear}`);
                } catch (error: any) {
                    console.error(`Error occurred while running Leave Carry Forward Cron Job for tenant ${tenant.id}:`, error);
                }
            }
        },
        {
            timezone: 'UTC'
        }
    )
}