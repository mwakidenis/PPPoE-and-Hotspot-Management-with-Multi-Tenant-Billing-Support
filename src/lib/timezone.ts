/**
 * Timezone Utilities for AIBILL v2
 * 
 * CRITICAL RULES:
 * 1. ALL dates in database are stored as UTC
 * 2. ALL dates displayed to users are in WIB (Asia/Jakarta)
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
import { id as localeId } from 'date-fns/locale';

// Constants
export const WIB_TIMEZONE = 'Asia/Jakarta';
export const WIB_OFFSET = '+07:00';

/**
 * Convert UTC date from database to WIB for display
 * @param utc - UTC date from database
 * @returns Date object in WIB timezone or null
 */
export function toWIB(utc: Date | string | null | undefined): Date | null {
  if (!utc) return null;
  try {
    const date = typeof utc === 'string' ? new Date(utc) : utc;
    return toZonedTime(date, WIB_TIMEZONE);
  } catch (error) {
    console.error('toWIB error:', error);
    return null;
  }
}

/**
 * Convert WIB date to UTC for database storage
 * @param wib - Date in WIB timezone
 * @returns UTC Date object
 */
export function toUTC(wib: Date | string): Date {
  const date = typeof wib === 'string' ? new Date(wib) : wib;
  return fromZonedTime(date, WIB_TIMEZONE);
}

/**
 * Format UTC date as WIB string
 * @param utc - UTC date from database
 * @param formatStr - Format string (default: 'dd MMM yyyy HH:mm')
 * @returns Formatted date string in WIB
 */
export function formatWIB(
  utc: Date | string | null | undefined,
  formatStr: string = 'dd MMM yyyy HH:mm'
): string {
  const wib = toWIB(utc);
  if (!wib) return '-';
  
  try {
    return format(wib, formatStr, { locale: localeId });
  } catch (error) {
    console.error('formatWIB error:', error);
    return '-';
  }
}

/**
 * Relative time from now in WIB (e.g., "2 jam yang lalu")
 */
export function relativeWIB(utc: Date | string | null | undefined): string {
  const wib = toWIB(utc);
  if (!wib) return '-';
  
  try {
    return formatDistanceToNow(wib, { 
      addSuffix: true, 
      locale: localeId 
    });
  } catch (error) {
    console.error('relativeWIB error:', error);
    return '-';
  }
}

/**
 * Check if UTC date is expired (compared to current WIB time)
 */
export function isExpiredWIB(utc: Date | string | null | undefined): boolean {
  const wib = toWIB(utc);
  if (!wib) return false;
  // Compare with current time IN WIB timezone, not browser timezone
  const nowInWIB = nowWIB();
  return isBefore(wib, nowInWIB);
}

/**
 * Days until expiry (negative if expired)
 */
export function daysUntilExpiry(utc: Date | string | null | undefined): number | null {
  const wib = toWIB(utc);
  if (!wib) return null;
  return differenceInDays(wib, new Date());
}

/**
 * Get current time in WIB
 */
export function nowWIB(): Date {
  return toZonedTime(new Date(), WIB_TIMEZONE);
}

/**
 * Add days to UTC date (returns UTC)
 */
export function addDaysToUTC(utc: Date | string, days: number): Date {
  const date = typeof utc === 'string' ? new Date(utc) : utc;
  return addDays(date, days);
}

/**
 * Get start of day in WIB, return as UTC
 */
export function startOfDayWIBtoUTC(date: Date | string = new Date()): Date {
  const wib = toWIB(date);
  if (!wib) return new Date();
  const startWIB = startOfDay(wib);
  return toUTC(startWIB);
}

/**
 * Get end of day in WIB, return as UTC
 */
export function endOfDayWIBtoUTC(date: Date | string = new Date()): Date {
  const wib = toWIB(date);
  if (!wib) return new Date();
  const endWIB = endOfDay(wib);
  return toUTC(endWIB);
}

/**
 * Format for datetime-local input (WIB)
 */
export function toDatetimeLocalWIB(utc: Date | string | null | undefined): string {
  if (!utc) return '';
  return formatWIB(utc, "yyyy-MM-dd'T'HH:mm");
}

/**
 * Parse datetime-local input (WIB) to UTC
 */
export function fromDatetimeLocalWIB(datetimeLocal: string): Date {
  return toUTC(new Date(datetimeLocal));
}

/**
 * Get timezone info
 */
export function getTimezoneInfo() {
  return {
    timezone: WIB_TIMEZONE,
    offset: WIB_OFFSET,
    name: 'Western Indonesia Time (WIB)',
    abbreviation: 'WIB',
  };
}

/**
 * Format date with status color indicator
 * Useful for due dates, expiry dates, etc.
 */
export function formatDateWithStatus(date: Date | string | null) {
  if (!date) return { text: '-', color: 'gray' as const };
  
  const days = daysUntilExpiry(date);
  if (days === null) return { text: '-', color: 'gray' as const };
  
  const formatted = formatWIB(date, 'dd MMM yyyy');
  
  if (days < 0) {
    return {
      text: `${formatted} (Telat ${Math.abs(days)} hari)`,
      color: 'red' as const,
    };
  } else if (days === 0) {
    return {
      text: `${formatted} (Hari ini!)`,
      color: 'orange' as const,
    };
  } else if (days <= 3) {
    return {
      text: `${formatted} (${days} hari lagi)`,
      color: 'yellow' as const,
    };
  } else {
    return {
      text: formatted,
      color: 'green' as const,
    };
  }
}
