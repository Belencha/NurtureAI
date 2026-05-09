
import { Diet, FoodLog, ExerciseLog, InBodyReport } from '../types';

// Simple localStorage based mock DB to satisfy multi-user demonstration while real Firebase provisions
const getStorageKey = (userId: string, collection: string) => `mock_db_${userId}_${collection}`;

export const mockDb = {
  save: (userId: string, collection: string, id: string, data: any) => {
    const key = getStorageKey(userId, collection);
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const index = existing.findIndex((item: any) => item.id === id);
    if (index >= 0) {
      existing[index] = { ...existing[index], ...data };
    } else {
      existing.push({ ...data, id });
    }
    localStorage.setItem(key, JSON.stringify(existing));
  },
  
  delete: (userId: string, collection: string, id: string) => {
    const key = getStorageKey(userId, collection);
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const filtered = existing.filter((item: any) => item.id !== id);
    localStorage.setItem(key, JSON.stringify(filtered));
  },
  
  subscribe: (userId: string, collection: string, callback: (data: any[]) => void) => {
    const key = getStorageKey(userId, collection);
    const poller = setInterval(() => {
      const data = JSON.parse(localStorage.getItem(key) || '[]');
      callback(data);
    }, 1000);
    
    // Initial call
    callback(JSON.parse(localStorage.getItem(key) || '[]'));
    
    return () => clearInterval(poller);
  }
};
