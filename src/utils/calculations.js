// Calculate linear regression forecast for next N periods
// Uses least squares method to find best-fit line through historical data
// Returns array of predicted values for demand/capacity planning
export const calculateLinearForecast = (dataPoints, periodsToForecast = 2) => {
  if (!dataPoints || dataPoints.length < 3) return [];

  const n = dataPoints.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

  dataPoints.forEach((point, i) => {
    sumX += i;
    sumY += point;
    sumXY += i * point;
    sumXX += i * i;
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const forecast = [];
  for (let i = 1; i <= periodsToForecast; i++) {
    const nextIndex = n - 1 + i;
    const predictedValue = slope * nextIndex + intercept;
    forecast.push(Math.max(0, Math.round(predictedValue)));
  }
  return forecast;
};

// Generate next N month names from a given month
// Format: "MMM-YY" (e.g., "Jan-25") for input and output
export const getNextMonthNames = (lastMonthStr, count) => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Parse "MMM-YY" format (e.g., "Aug-25")
  const parts = lastMonthStr.split('-');
  if (parts.length !== 2) return Array(count).fill('Future');

  const monthName = parts[0];
  const yearShort = parts[1];

  let currentMonthIndex = months.indexOf(monthName);
  if (currentMonthIndex === -1) return Array(count).fill('Future');

  // Convert 2-digit year to 4-digit (assuming 2000s)
  let currentYear = 2000 + parseInt(yearShort, 10);

  const result = [];
  for (let i = 0; i < count; i++) {
    currentMonthIndex++;
    if (currentMonthIndex > 11) {
      currentMonthIndex = 0;
      currentYear++;
    }
    // Return in same "MMM-YY" format
    result.push(`${months[currentMonthIndex]}-${String(currentYear).slice(-2)}`);
  }
  return result;
};

// Detect if a staff member is a GP based on their name
// Looks for "Dr" prefix or "locum" in name
export const isGP = (name) => {
  if (!name) return false;
  const n = name.trim();
  return n.includes('Dr') || n.toLowerCase().includes('locum');
};
