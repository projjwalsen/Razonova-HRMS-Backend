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
export function getDayDiffInclusiveTZ(start: Date, end: Date, timezone: string) {
  const startDay = getStartOfDay(start, timezone);
  const endDay = getEndOfDay(end, timezone);

  const ms = endDay.getTime() - startDay.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
}

export const getPayrollMonthStart = (month: number, year: number, timezone: string) => {
  // Create a date in UTC first
  const utcDate = new Date(Date.UTC(year, month - 1, 1));

  // Convert to tenant timezone
  const zoned = toZonedTime(utcDate, timezone);

  // Start of month in tenant timezone
  const startZoned = new Date(
    zoned.getFullYear(),
    zoned.getMonth(),
    1,
    0, 0, 0, 0
  );

  // Convert back to UTC for DB query
  return fromZonedTime(startZoned, timezone);
};

export const getPayrollMonthEnd = (month: number, year: number, timezone: string) => {
  const utcDate = new Date(Date.UTC(year, month - 1, 1));
  const zoned = toZonedTime(utcDate, timezone);

  // Last day of month
  const endZoned = new Date(
    zoned.getFullYear(),
    zoned.getMonth() + 1,
    0,
    23, 59, 59, 999
  );

  return fromZonedTime(endZoned, timezone);
};

export const getDaysInMonth = (month: number, year: number, timezone: string) => {
  const utcDate = new Date(Date.UTC(year, month - 1, 1));
  const zoned = toZonedTime(utcDate, timezone);

  return new Date(
    zoned.getFullYear(),
    zoned.getMonth() + 1,
    0
  ).getDate();
};

export function getYearRangeForTimezone(timezone: string, now: Date = new Date()) {
  const zonedNow = toZonedTime(now, timezone);
  const currentYear = zonedNow.getFullYear();
  return {
    fromYear : currentYear - 5,
    toYear: currentYear
  };
}

export function isFirstDayOfYearInTimezone(timezone: string, now: Date = new Date()) {
  const zoned = toZonedTime(now, timezone);
  return zoned.getMonth() === 0 && zoned.getDate() === 1;
}