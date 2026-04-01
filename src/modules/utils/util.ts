import { prisma } from "../../config/db/prisma";
import { fromZonedTime, toZonedTime } from "date-fns-tz"

export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match;
  });
}

export const getStartOfDay = (date: Date, timezone: string) => {
  const zoned = toZonedTime(date, timezone);

  const startZoned = new Date(zoned.getFullYear(), zoned.getMonth(), zoned.getDate(), 0, 0, 0, 0);
  return fromZonedTime(startZoned, timezone)
};

export const getEndOfDay = (date: Date, timezone: string) => {
  const zoned = toZonedTime(date, timezone);
  const endZoned = new Date(zoned.getFullYear(), zoned.getMonth(), zoned.getDate(), 23, 59, 59, 999);

  return fromZonedTime(endZoned, timezone)
}

export function parseTimeToDate(baseDate: Date, time: string, timezone: string) {
  const zoned = toZonedTime(baseDate, timezone);
  const [hours, minutes] = time.split(':').map(Number);
  const zonedDateTime = new Date(zoned.getFullYear(), zoned.getMonth(), zoned.getDate(), hours, minutes, 0, 0);
  return fromZonedTime(zonedDateTime, timezone);
}

export function diffInMinutes(start: Date, end: Date) {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));
}

export async function getTenantTimezone(tenantId: string) {
  const settings = await prisma.setting.findFirst({
    where: {
      tenantId,
      key: {
        in: ["ORG_GENERAL", "general"]
      }
    }
  });
  const value = settings?.value as any;
  return value?.timezone || "UTC";
}