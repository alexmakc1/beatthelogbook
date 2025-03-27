import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, startOfDay, endOfDay, subDays, isSameDay } from 'date-fns';

// Types
export type NicotineEntry = {
  id: string;
  amount: number; // mg per use
  timestamp: string;
};

export type NicotineStats = {
  todayTotal: number;
  weeklyAverage: number;
  monthlyAverage: number;
};

export type NicotineSettings = {
  trackingMode: 'mg' | 'frequency';
  dailyGoal: number; // either mg or frequency count
  defaultAmount: number; // default mg per use
};

export const DEFAULT_NICOTINE_SETTINGS: NicotineSettings = {
  trackingMode: 'mg',
  dailyGoal: 24,
  defaultAmount: 3,
};

// Storage Keys
const STORAGE_KEYS = {
  ENTRIES: 'nicotine_entries',
  SETTINGS: 'nicotine_settings',
};

// Get all entries
export const getEntries = async (date?: Date): Promise<NicotineEntry[]> => {
  try {
    const entriesJson = await AsyncStorage.getItem(STORAGE_KEYS.ENTRIES);
    if (!entriesJson) return [];

    const entries: NicotineEntry[] = JSON.parse(entriesJson);
    
    // Sort all entries by timestamp (newest first)
    const sortedEntries = entries.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      return sortedEntries.filter(entry => {
        const entryDate = new Date(entry.timestamp);
        return entryDate >= startOfDay && entryDate <= endOfDay;
      });
    }
    
    return sortedEntries;
  } catch (error) {
    console.error('Error getting nicotine entries:', error);
    return [];
  }
};

// Add a new entry
export const addEntry = async (amount: number): Promise<boolean> => {
  try {
    const entries = await getEntries();
    const newEntry: NicotineEntry = {
      id: Date.now().toString(),
      amount,
      timestamp: new Date().toISOString(),
    };
    
    entries.push(newEntry);
    await AsyncStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(entries));
    return true;
  } catch (error) {
    console.error('Error adding nicotine entry:', error);
    return false;
  }
};

// Delete an entry
export const deleteEntry = async (id: string): Promise<boolean> => {
  try {
    const entries = await getEntries();
    const filteredEntries = entries.filter(entry => entry.id !== id);
    await AsyncStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(filteredEntries));
    return true;
  } catch (error) {
    console.error('Error deleting nicotine entry:', error);
    return false;
  }
};

// Get nicotine settings
export const getNicotineSettings = async (): Promise<NicotineSettings> => {
  try {
    const settingsJson = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!settingsJson) {
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_NICOTINE_SETTINGS));
      return DEFAULT_NICOTINE_SETTINGS;
    }
    return JSON.parse(settingsJson);
  } catch (error) {
    console.error('Error getting nicotine settings:', error);
    return DEFAULT_NICOTINE_SETTINGS;
  }
};

// Update nicotine settings
export const updateNicotineSettings = async (settings: NicotineSettings): Promise<boolean> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.error('Error updating nicotine settings:', error);
    return false;
  }
};

// Calculate stats
export const getStats = async (date?: Date): Promise<NicotineStats> => {
  try {
    const entries = await getEntries(date);
    const todayTotal = entries.reduce((sum, entry) => sum + entry.amount, 0);

    // Get weekly average
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weeklyEntries = await getEntries();
    const weeklyTotal = weeklyEntries
      .filter(entry => new Date(entry.timestamp) >= weekAgo)
      .reduce((sum, entry) => sum + entry.amount, 0);
    const weeklyAverage = weeklyTotal / 7;

    // Get monthly average
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const monthlyTotal = weeklyEntries
      .filter(entry => new Date(entry.timestamp) >= monthAgo)
      .reduce((sum, entry) => sum + entry.amount, 0);
    const monthlyAverage = monthlyTotal / 30;

    return {
      todayTotal,
      weeklyAverage,
      monthlyAverage,
    };
  } catch (error) {
    console.error('Error calculating nicotine stats:', error);
    return {
      todayTotal: 0,
      weeklyAverage: 0,
      monthlyAverage: 0,
    };
  }
};

export const getDailyStats = async (date: Date = new Date()): Promise<{
  total: number;
  count: number;
  remaining: number;
}> => {
  try {
    const entries = await getEntries(date);
    const settings = await getNicotineSettings();
    
    const total = entries.reduce((sum, entry) => sum + entry.amount, 0);
    const count = entries.length;
    
    let remaining = 0;
    if (settings.trackingMode === 'mg') {
      remaining = settings.dailyGoal - total;
    } else {
      remaining = settings.dailyGoal - count;
    }
    
    return {
      total,
      count,
      remaining: Math.max(0, remaining),
    };
  } catch (error) {
    console.error('Error getting daily stats:', error);
    return {
      total: 0,
      count: 0,
      remaining: 0,
    };
  }
};

export const getAvailableDates = async (): Promise<Date[]> => {
  try {
    const entries = await AsyncStorage.getItem(STORAGE_KEYS.ENTRIES);
    if (!entries) return [];
    
    const allEntries: NicotineEntry[] = JSON.parse(entries);
    const uniqueDates = new Set<string>();
    
    allEntries.forEach(entry => {
      const date = format(new Date(entry.timestamp), 'yyyy-MM-dd');
      uniqueDates.add(date);
    });
    
    return Array.from(uniqueDates)
      .map(date => new Date(date))
      .sort((a, b) => b.getTime() - a.getTime());
  } catch (error) {
    console.error('Error getting available dates:', error);
    return [];
  }
};

// Get daily usage data for the past days
export const getDailyUsageData = async (days: 7 | 30 = 7): Promise<{
  date: string;
  total: number;
  count: number;
}[]> => {
  try {
    const entries = await getEntries();
    const result: { date: string; total: number; count: number }[] = [];

    // Generate dates for the past N days
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateString = format(date, 'yyyy-MM-dd');
      
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      
      // Filter entries for this day
      const dayEntries = entries.filter(entry => {
        const entryDate = new Date(entry.timestamp);
        return entryDate >= dayStart && entryDate <= dayEnd;
      });
      
      const total = dayEntries.reduce((sum, entry) => sum + entry.amount, 0);
      
      result.push({
        date: format(date, 'MMM dd'),
        total,
        count: dayEntries.length,
      });
    }
    
    // Reverse so dates are in ascending order
    return result.reverse();
  } catch (error) {
    console.error('Error getting daily usage data:', error);
    return [];
  }
}; 