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
// Format: "MMM YYYY" (e.g., "Jan 2024")
export const getNextMonthNames = (lastMonthStr, count) => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const date = new Date(lastMonthStr);
  if (isNaN(date.getTime())) return Array(count).fill('Future');

  let currentMonthIndex = date.getMonth();
  let currentYear = date.getFullYear();

  const result = [];
  for (let i = 0; i < count; i++) {
    currentMonthIndex++;
    if (currentMonthIndex > 11) {
      currentMonthIndex = 0;
      currentYear++;
    }
    result.push(`${months[currentMonthIndex]} ${currentYear}`);
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
