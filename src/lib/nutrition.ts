import { FoodLog } from '../types';

export interface NutritionStats {
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
}

/**
 * Calculates total nutrition for a specific day.
 * @param logs List of food logs
 * @param date The date to calculate for (defaults to today)
 */
export const calculateDailyStats = (logs: FoodLog[], date: Date = new Date()): NutritionStats => {
  const dateString = date.toDateString();
  
  const totals = logs.reduce((acc, log) => {
    const logDate = log.timestamp ? new Date(log.timestamp).toDateString() : null;
    if (logDate === dateString) {
      return {
        protein: acc.protein + (Number(log.nutrients?.protein) || 0),
        carbs: acc.carbs + (Number(log.nutrients?.carbs) || 0),
        fat: acc.fat + (Number(log.nutrients?.fat) || 0),
        calories: acc.calories + (Number(log.nutrients?.calories) || 0),
      };
    }
    return acc;
  }, { protein: 0, carbs: 0, fat: 0, calories: 0 });

  return {
    protein: Math.round(totals.protein),
    carbs: Math.round(totals.carbs),
    fat: Math.round(totals.fat),
    calories: Math.round(totals.calories),
  };
};

/**
 * Calculates total nutrition for a specific month.
 * @param logs List of food logs
 * @param month Month index (0-11)
 * @param year Full year (e.g. 2026)
 */
export const calculateMonthlyStats = (logs: FoodLog[], month: number, year: number): NutritionStats => {
  const totals = logs.reduce((acc, log) => {
    if (!log.timestamp) return acc;
    const d = new Date(log.timestamp);
    if (d.getMonth() === month && d.getFullYear() === year) {
      return {
        protein: acc.protein + (Number(log.nutrients?.protein) || 0),
        carbs: acc.carbs + (Number(log.nutrients?.carbs) || 0),
        fat: acc.fat + (Number(log.nutrients?.fat) || 0),
        calories: acc.calories + (Number(log.nutrients?.calories) || 0),
      };
    }
    return acc;
  }, { protein: 0, carbs: 0, fat: 0, calories: 0 });

  return {
    protein: Math.round(totals.protein),
    carbs: Math.round(totals.carbs),
    fat: Math.round(totals.fat),
    calories: Math.round(totals.calories),
  };
};

/**
 * Returns progress information for the current month.
 */
export const getMonthProgress = (date: Date = new Date()) => {
  const totalDays = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const elapsedDays = date.getDate();
  return { 
    elapsedDays, 
    totalDays, 
    percentage: (elapsedDays / totalDays) * 100 
  };
};

/**
 * Validates if the diet plan string contains at least one markdown table.
 */
export const validateDietTable = (content: string): boolean => {
  if (!content) return false;
  // Improved regex for markdown table separators: |---|--- or ---|--- or |---|
  const tableSeparatorRegex = /\|?\s*:?-+:?\s*\|(\s*:?-+:?(\s*\|)?)+/;
  return tableSeparatorRegex.test(content);
};
