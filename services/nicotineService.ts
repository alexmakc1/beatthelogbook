import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
export interface NicotineEntry {
  id: string;
  amount: number;
  type: 'cigarette' | 'vape' | 'other';
  timestamp: string;
}

export interface NicotineStats {
  todayTotal: number;
  weeklyAverage: number;
  monthlyTotal: number;
  savingsThisMonth: number;
}

export interface NicotineSettings {
  dailyLimit: number;
  strength: number;
  cost: number;
  trackingMode: 'simple' | 'detailed';
}

export const DEFAULT_NICOTINE_SETTINGS: NicotineSettings = {
  dailyLimit: 20,
  strength: 12,
  cost: 10,
  trackingMode: 'simple'
};

// Storage Keys
const ENTRIES_KEY = 'nicotine_entries';
const SETTINGS_KEY = 'nicotine_settings';

// Get all entries
export const getEntries = async (): Promise<NicotineEntry[]> => {
  try {
    const entriesJson = await AsyncStorage.getItem(ENTRIES_KEY);
    return entriesJson ? JSON.parse(entriesJson) : [];
  } catch (error) {
    console.error('Error getting nicotine entries:', error);
    return [];
  }
};

// Add a new entry
export const addEntry = async (entry: Omit<NicotineEntry, 'id'>): Promise<boolean> => {
  try {
    const entries = await getEntries();
    const newEntry: NicotineEntry = {
      ...entry,
      id: Date.now().toString()
    };
    
    const updatedEntries = [newEntry, ...entries];
    await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(updatedEntries));
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
    const updatedEntries = entries.filter(entry => entry.id !== id);
    await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(updatedEntries));
    return true;
  } catch (error) {
    console.error('Error deleting nicotine entry:', error);
    return false;
  }
};

// Get nicotine settings
export const getNicotineSettings = async (): Promise<NicotineSettings> => {
  try {
    const settingsJson = await AsyncStorage.getItem(SETTINGS_KEY);
    return settingsJson ? JSON.parse(settingsJson) : DEFAULT_NICOTINE_SETTINGS;
  } catch (error) {
    console.error('Error getting nicotine settings:', error);
    return DEFAULT_NICOTINE_SETTINGS;
  }
};

// Update nicotine settings
export const updateNicotineSettings = async (settings: NicotineSettings): Promise<boolean> => {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.error('Error updating nicotine settings:', error);
    return false;
  }
};

// Calculate stats
export const getStats = async (): Promise<NicotineStats> => {
  try {
    const entries = await getEntries();
    const settings = await getNicotineSettings();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Calculate today's total
    const todayTotal = entries
      .filter(entry => new Date(entry.timestamp) >= today)
      .reduce((sum, entry) => sum + entry.amount, 0);

    // Calculate weekly average
    const weekEntries = entries.filter(entry => new Date(entry.timestamp) >= weekAgo);
    const weeklyTotal = weekEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const weeklyAverage = weeklyTotal / 7;

    // Calculate monthly total
    const monthEntries = entries.filter(entry => new Date(entry.timestamp) >= monthStart);
    const monthlyTotal = monthEntries.reduce((sum, entry) => sum + entry.amount, 0);

    // Calculate savings (based on cost per unit and monthly usage)
    const savingsThisMonth = monthEntries.length * settings.cost;

    return {
      todayTotal,
      weeklyAverage,
      monthlyTotal,
      savingsThisMonth
    };
  } catch (error) {
    console.error('Error calculating nicotine stats:', error);
    return {
      todayTotal: 0,
      weeklyAverage: 0,
      monthlyTotal: 0,
      savingsThisMonth: 0
    };
  }
}; 