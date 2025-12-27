/**
 * Date utility functions for handling UTC to local timezone conversions
 */

/**
 * Parses a UTC date/timestamp string and returns a Date object in local timezone.
 * 
 * For date-only strings (e.g., "2025-12-27"), treats them as local dates.
 * For timestamps with time (e.g., "2025-12-27T16:25:41.392213"), converts from UTC to local time.
 * 
 * @param dateStr - ISO 8601 date or timestamp string
 * @returns Date object in local timezone
 */
export const parseUTCDate = (dateStr: string): Date => {
  // Check if it's a date-only string (no time component)
  if (!dateStr.includes('T') || dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    // Date-only: treat as local date
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  
  // Has time component: parse as UTC and convert to local
  // The Date constructor will automatically convert UTC to local timezone
  return new Date(dateStr);
};

/**
 * Formats a date range for display
 * @param startDate - Start date string (optional)
 * @param endDate - End date string (optional)
 * @param format - Format function from date-fns
 * @returns Formatted date range string or null
 */
export const formatDateRange = (
  startDate: string | undefined,
  endDate: string | undefined,
  format: (date: Date, formatStr: string) => string,
  emptyText: string | null = null
): string | null => {
  if (!startDate && !endDate) return emptyText;
  if (startDate && !endDate) return `From ${format(parseUTCDate(startDate), 'MMM d, yyyy')}`;
  if (!startDate && endDate) return `Until ${format(parseUTCDate(endDate), 'MMM d, yyyy')}`;
  return `${format(parseUTCDate(startDate!), 'MMM d')} - ${format(parseUTCDate(endDate!), 'MMM d, yyyy')}`;
};
