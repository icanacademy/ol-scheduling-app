/**
 * Utility functions for week-based scheduling
 */

/**
 * All 7 day names used as the "week"
 */
export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Get short day names
 */
export const SHORT_DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Get the week range - now simply returns all day names
 * Kept for backward compatibility with code that calls getWeekRange()
 * @param {string} dateString - Ignored (kept for API compat)
 * @returns {Object} - { startDate, endDate, dates: [7 day names] }
 */
export function getWeekRange(dateString) {
  return {
    startDate: 'Monday',
    endDate: 'Sunday',
    dates: DAY_NAMES
  };
}

/**
 * Format date for display - now just returns the day name
 * @param {string} dateString - Day name string
 * @returns {string} - The day name itself
 */
export function formatDateForDisplay(dateString) {
  return dateString;
}
