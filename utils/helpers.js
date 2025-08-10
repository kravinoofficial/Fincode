function getCurrentMonth() {
  const date = new Date();
  const currentDate = date.getDate(); // Get the current day of the month
  
  // If the current day is before the 15th, we use the previous month's period
  if (currentDate < 15) {
    // Set the date to 15th of the previous month
    date.setMonth(date.getMonth() - 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-15 to ${date.getFullYear()}-${String(date.getMonth() + 2).padStart(2, '0')}-15`;
  } else {
    // Set the date to 15th of the current month
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-15 to ${date.getFullYear()}-${String(date.getMonth() + 2).padStart(2, '0')}-15`;
  }
}

module.exports = { getCurrentMonth };
