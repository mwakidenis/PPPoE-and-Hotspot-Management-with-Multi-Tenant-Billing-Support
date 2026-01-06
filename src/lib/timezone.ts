/**
 * Timezone Utilities for AIBILL KE
 * 
 * CRITICAL RULES:
 * 1. ALL dates in database are stored as UTC
 * 2. ALL dates displayed to users are in Nairobi Time (Africa/Nairobi)
 * 3. Use these functions consistently everywhere
 */

import { 
  format, 
  formatDistanceToNow, 
  differenceInDays,
  addDays,
  startOfDay,
  endOfDay,
  isBefore,
  isAfter,
} from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { enUS as localeEn } from 'date-fns/locale';

// Constants
export const NAIROBI_TIMEZONE = 'Africa/Nairobi';
export const NAIROBI_OFFSET = '+03:00';

/**
 * Convert UTC date from database to Nairobi for display
 */
export function toNairobi(utc: Date | string | null | undefined): Date | null {
  if (!utc) return null;
  try {
    const date = typeof utc === 'string' ? new Date(utc) : utc;
    return toZonedTime(date, NAIROBI_TIMEZONE);
  } catch (error) {
    console.error('toNairobi error:', error);
    return null;
  }
}

/**
 * Convert Nairobi date to UTC for database storage
 */
export function toUTCFromNairobi(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  return fromZonedTime(d, NAIROBI_TIMEZONE);
}

/**
 * Format UTC date as Nairobi string
 */
export function formatNairobi(
  utc: Date | string | null | undefined,
  formatStr: string = 'dd MMM yyyy HH:mm'
): string {
  const nairobi = toNairobi(utc);
  if (!nairobi) return '-';
  
  try {
    return format(nairobi, formatStr, { locale: localeEn });
  } catch (error) {
    console.error('formatNairobi error:', error);
    return '-';
  }
}

/**
 * Relative time from now in Nairobi
 */
export function relativeNairobi(utc: Date | string | null | undefined): string {
  const nairobi = toNairobi(utc);
  if (!nairobi) return '-';
  
  try {
    return formatDistanceToNow(nairobi, { addSuffix: true, locale: localeEn });
  } catch (error) {
    console.error('relativeNairobi error:', error);
    return '-';
  }
}

/**
 * Check if UTC date is expired (compared to current Nairobi time)
 */
export function isExpiredNairobi(utc: Date | string | null | undefined): boolean {
  const nairobi = toNairobi(utc);
  if (!nairobi) return false;
  const nowInNairobi = nowNairobi();
  return isBefore(nairobi, nowInNairobi);
}

/**
 * Days until expiry (negative if expired)
 */
export function daysUntilExpiryNairobi(utc: Date | string | null | undefined): number | null {
  const nairobi = toNairobi(utc);
  if (!nairobi) return null;
  return differenceInDays(nairobi, new Date());
}

/**
 * Get current time in Nairobi
 */
export function nowNairobi(): Date {
  return toZonedTime(new Date(), NAIROBI_TIMEZONE);
}

/**
 * Add days to UTC date (returns UTC)
 */
export function addDaysToUTC(utc: Date | string, days: number): Date {
  const date = typeof utc === 'string' ? new Date(utc) : utc;
  return addDays(date, days);
}

/**
 * Start of day in Nairobi, return UTC
 */
export function startOfDayNairobiToUTC(date: Date | string = new Date()): Date {
  const nairobi = toNairobi(date);
  if (!nairobi) return new Date();
  return toUTCFromNairobi(startOfDay(nairobi));
}

/**
 * End of day in Nairobi, return UTC
 */
export function endOfDayNairobiToUTC(date: Date | string = new Date()): Date {
  const nairobi = toNairobi(date);
  if (!nairobi) return new Date();
  return toUTCFromNairobi(endOfDay(nairobi));
}

/**
 * Format for datetime-local input (Nairobi)
 */
export function toDatetimeLocalNairobi(utc: Date | string | null | undefined): string {
  if (!utc) return '';
  return formatNairobi(utc, "yyyy-MM-dd'T'HH:mm");
}

/**
 * Parse datetime-local input (Nairobi) to UTC
 */
export function fromDatetimeLocalNairobi(datetimeLocal: string): Date {
  return toUTCFromNairobi(new Date(datetimeLocal));
}

/**
 * Get timezone info
 */
export function getTimezoneInfo() {
  return {
    timezone: NAIROBI_TIMEZONE,
    offset: NAIROBI_OFFSET,
    name: 'East Africa Time (EAT)',
    abbreviation: 'EAT',
  };
}

/**
 * Format date with status color
 */
export function formatDateWithStatusNairobi(date: Date | string | null) {
  if (!date) return { text: '-', color: 'gray' as const };
  
  const days = daysUntilExpiryNairobi(date);
  if (days === null) return { text: '-', color: 'gray' as const };
  
  const formatted = formatNairobi(date, 'dd MMM yyyy');
  
  if (days < 0) return { text: `${formatted} (Late ${Math.abs(days)} days)`, color: 'red' };
  if (days === 0) return { text: `${formatted} (Today!)`, color: 'orange' };
  if (days <= 3) return { text: `${formatted} (${days} days left)`, color: 'yellow' };
  return { text: formatted, color: 'green' };
}
