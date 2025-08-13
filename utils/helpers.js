/**
 * Get the current month's payment period in the format of a date range string
 * Payment period is from 15th of previous month to 15th of current month
 * @returns {string} Current payment period as a date range string
 */
function getCurrentMonth() {
  const date = new Date();
  const currentDate = date.getDate();
  let year = date.getFullYear();
  let month = date.getMonth() + 1; // JavaScript months are 0-indexed
  
  // If the current day is before the 15th, we use the period ending previous month
  if (currentDate < 15) {
    // Adjust for two months ago to previous month
    if (month === 1) {
      month = 12;
      year--;
    } else {
      month--;
    }
    return `${year}-${String(month).padStart(2, '0')}-15 to ${year}-${String(month + 1).padStart(2, '0')}-15`;
  } else {
    // Use previous month to current month
    return `${year}-${String(month).padStart(2, '0')}-15 to ${year}-${String(month + 1).padStart(2, '0')}-15`;
  }
}

/**
 * Get the current payment period in YYYY-MM format based on 15th to 15th rule
 * If date is between 15th of one month to 14th of next month, it's considered one payment period
 * @returns {string} Payment period in YYYY-MM format
 */
function getPaymentPeriod() {
  const date = new Date();
  const currentDate = date.getDate();
  let year = date.getFullYear();
  let month = date.getMonth() + 1; // JavaScript months are 0-indexed
  
  // If date is between 1st and 14th, the payment period is previous month
  if (currentDate < 15) {
    // Adjust for previous month
    if (month === 1) {
      month = 12;
      year--;
    } else {
      month--;
    }
  }
  // If date is 15th or later, use current month
  
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Get the date range for payment period based on 15th to 15th rule
 * Returns range from previous month's 15th to current month's 15th
 * @returns {string} Date range string
 */
function getPaymentPeriodRange() {
  const date = new Date();
  const currentDate = date.getDate();
  let year = date.getFullYear();
  let month = date.getMonth() + 1; // JavaScript months are 0-indexed
  
  // Calculate previous month for the range start
  let prevMonth = month === 1 ? 12 : month - 1;
  let prevYear = month === 1 ? year - 1 : year;
  
  // If date is between 1st and 14th, adjust current month/year to previous month
  if (currentDate < 15) {
    if (month === 1) {
      month = 12;
      year--;
    } else {
      month--;
    }
    
    // Recalculate previous month for range start
    prevMonth = month === 1 ? 12 : month - 1;
    prevYear = month === 1 ? year - 1 : year;
  }
  
  return `${prevYear}-${String(prevMonth).padStart(2, '0')}-15 to ${year}-${String(month).padStart(2, '0')}-15`;
}

module.exports = { getCurrentMonth, getPaymentPeriod, getPaymentPeriodRange };