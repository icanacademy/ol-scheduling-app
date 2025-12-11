/**
 * Utility functions for week-based scheduling
 */

/**
 * Get the start and end dates for a given week
 * @param {string} dateString - Any date within the week (YYYY-MM-DD)
 * @returns {Object} - { startDate, endDate, dates: [7 dates] }
 */
export function getWeekRange(dateString) {
  const date = new Date(dateString + 'T00:00:00.000Z');
  const dayOfWeek = date.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Calculate start of week (Monday)
  const startDate = new Date(date);
  startDate.setUTCDate(date.getUTCDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  
  // Calculate end of week (Sunday)
  const endDate = new Date(startDate);
  endDate.setUTCDate(startDate.getUTCDate() + 6);
  
  // Generate array of all 7 dates in the week
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const currentDate = new Date(startDate);
    currentDate.setUTCDate(startDate.getUTCDate() + i);
    dates.push(currentDate.toISOString().split('T')[0]);
  }
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    dates
  };
}

/**
 * Get day names for the week
 */
export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Get short day names
 */
export const SHORT_DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Format date for display
 * @param {string} dateString - Date string (YYYY-MM-DD)
 * @returns {string} - Formatted date (e.g., "Nov 18")
 */
export function formatDateForDisplay(dateString) {
  const date = new Date(dateString + 'T00:00:00.000Z');
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    timeZone: 'UTC'
  });
}