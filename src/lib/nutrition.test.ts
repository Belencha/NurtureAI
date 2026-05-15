import { describe, it, expect } from 'vitest';
import { calculateDailyStats, calculateMonthlyStats, getMonthProgress, validateDietTable } from './nutrition';
import { FoodLog } from '../types';

describe('Nutrition Utility', () => {
  const mockLogs: FoodLog[] = [
    {
      id: '1',
      timestamp: new Date('2026-05-15T12:00:00').getTime(),
      foodName: 'Chicken Breast',
      nutrients: { protein: 31, carbs: 0, fat: 3.6, calories: 165 }
    },
    {
      id: '2',
      timestamp: new Date('2026-05-15T18:00:00').getTime(),
      foodName: 'Rice',
      nutrients: { protein: 4, carbs: 45, fat: 0.5, calories: 205 }
    },
    {
      id: '3',
      timestamp: new Date('2026-05-14T12:00:00').getTime(), // Yesterday
      foodName: 'Oats',
      nutrients: { protein: 10, carbs: 60, fat: 7, calories: 350 }
    }
  ];

  describe('calculateDailyStats', () => {
    it('should correctly sum nutrition for a specific day', () => {
      const targetDate = new Date('2026-05-15');
      const stats = calculateDailyStats(mockLogs, targetDate);
      
      expect(stats.protein).toBe(35); // 31 + 4
      expect(stats.carbs).toBe(45);   // 0 + 45
      expect(stats.calories).toBe(370); // 165 + 205
    });

    it('should return zeros if no logs for that day', () => {
      const emptyDate = new Date('2026-06-01');
      const stats = calculateDailyStats(mockLogs, emptyDate);
      expect(stats.calories).toBe(0);
    });
  });

  describe('calculateMonthlyStats', () => {
    it('should sum nutrition for the entire month', () => {
      const stats = calculateMonthlyStats(mockLogs, 4, 2026); // May
      expect(stats.protein).toBe(45); // 31 + 4 + 10
      expect(stats.calories).toBe(720); // 165 + 205 + 350
    });

    it('should skip logs from other months', () => {
      const stats = calculateMonthlyStats(mockLogs, 5, 2026); // June
      expect(stats.calories).toBe(0);
    });
  });

  describe('getMonthProgress', () => {
    it('should calculate progress correctly for mid-month', () => {
      const date = new Date('2026-05-15'); // May has 31 days
      const progress = getMonthProgress(date);
      expect(progress.elapsedDays).toBe(15);
      expect(progress.totalDays).toBe(31);
      expect(progress.percentage).toBeCloseTo(48.38, 1);
    });

    it('should handle leap years (Feb 2024)', () => {
      const date = new Date('2024-02-15');
      const progress = getMonthProgress(date);
      expect(progress.totalDays).toBe(29);
    });
  });

  describe('validateDietTable', () => {
    it('should return true for a valid markdown table', () => {
      const validTable = `
| Food | Calories |
|------|----------|
| Egg  | 70       |
      `;
      expect(validateDietTable(validTable)).toBe(true);
    });

    it('should return false if there is no table separator', () => {
      const noTable = "This is just text without a table.";
      expect(validateDietTable(noTable)).toBe(false);
    });

    it('should handle tables without leading/trailing pipes', () => {
      const simpleTable = "Food | Calories\n---|---\nEgg | 70";
      expect(validateDietTable(simpleTable)).toBe(true);
    });
  });
});
