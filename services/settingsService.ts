import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Keys for AsyncStorage
const HISTORY_DAYS_KEY = 'historyDays';
const SUGGESTED_REPS_KEY = 'suggestedReps';
const WEIGHT_UNIT_KEY = 'weightUnit';
const HEALTH_SYNC_KEY = 'healthSync';

// Types
export type WeightUnit = 'kg' | 'lbs';

// Default values
export const DEFAULT_HISTORY_DAYS = 30;
export const DEFAULT_SUGGESTED_REPS = 8;
export const DEFAULT_WEIGHT_UNIT: WeightUnit = 'kg';
export const DEFAULT_HEALTH_SYNC = Platform.OS === 'ios'; // Default to true on iOS

// Storage keys
const SETTINGS_KEY = 'appSettings';

// Settings interface
export interface AppSettings {
  historyDays: number; // Number of days to look back for stats
  suggestedReps: number; // Target reps for suggested weight calculation
  weightUnit: WeightUnit; // Weight unit (kg or lbs)
  healthSync: boolean; // HealthKit sync enabled
}

// Default settings
export const DEFAULT_SETTINGS: AppSettings = {
  historyDays: DEFAULT_HISTORY_DAYS,
  suggestedReps: DEFAULT_SUGGESTED_REPS,
  weightUnit: DEFAULT_WEIGHT_UNIT,
  healthSync: DEFAULT_HEALTH_SYNC
};

// Get all settings
export const getSettings = async (): Promise<AppSettings> => {
  try {
    const settingsJson = await AsyncStorage.getItem(SETTINGS_KEY);
    const savedSettings = settingsJson ? JSON.parse(settingsJson) : {};
    
    // Merge saved settings with defaults to ensure all properties exist
    return { ...DEFAULT_SETTINGS, ...savedSettings };
  } catch (error) {
    console.error('Error getting settings:', error);
    return DEFAULT_SETTINGS;
  }
};

// Update settings
export const updateSettings = async (newSettings: Partial<AppSettings>): Promise<boolean> => {
  try {
    // Get current settings
    const currentSettings = await getSettings();
    
    // Merge with new settings
    const updatedSettings = { ...currentSettings, ...newSettings };
    
    // Save to storage
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updatedSettings));
    return true;
  } catch (error) {
    console.error('Error updating settings:', error);
    return false;
  }
};

// Get/set history days
export const getHistoryDays = async (): Promise<number> => {
  try {
    const value = await AsyncStorage.getItem(HISTORY_DAYS_KEY);
    return value ? parseInt(value) : DEFAULT_HISTORY_DAYS;
  } catch (error) {
    console.error('Error getting history days:', error);
    return DEFAULT_HISTORY_DAYS;
  }
};

export const setHistoryDays = async (days: number): Promise<void> => {
  try {
    await AsyncStorage.setItem(HISTORY_DAYS_KEY, days.toString());
  } catch (error) {
    console.error('Error setting history days:', error);
  }
};

// Get/set suggested reps
export const getSuggestedReps = async (): Promise<number> => {
  try {
    const value = await AsyncStorage.getItem(SUGGESTED_REPS_KEY);
    return value ? parseInt(value) : DEFAULT_SUGGESTED_REPS;
  } catch (error) {
    console.error('Error getting suggested reps:', error);
    return DEFAULT_SUGGESTED_REPS;
  }
};

export const setSuggestedReps = async (reps: number): Promise<void> => {
  try {
    await AsyncStorage.setItem(SUGGESTED_REPS_KEY, reps.toString());
  } catch (error) {
    console.error('Error setting suggested reps:', error);
  }
};

// Get/set weight unit
export const getWeightUnit = async (): Promise<WeightUnit> => {
  try {
    const value = await AsyncStorage.getItem(WEIGHT_UNIT_KEY);
    // Normalize to lowercase to ensure consistency
    if (value) {
      const normalizedValue = value.toLowerCase();
      return (normalizedValue === 'kg' || normalizedValue === 'lbs') 
        ? normalizedValue as WeightUnit 
        : DEFAULT_WEIGHT_UNIT;
    }
    return DEFAULT_WEIGHT_UNIT;
  } catch (error) {
    console.error('Error getting weight unit:', error);
    return DEFAULT_WEIGHT_UNIT;
  }
};

export const setWeightUnit = async (unit: WeightUnit): Promise<void> => {
  try {
    await AsyncStorage.setItem(WEIGHT_UNIT_KEY, unit);
  } catch (error) {
    console.error('Error setting weight unit:', error);
  }
};

// Get/set health sync setting
export const getHealthSyncEnabled = async (): Promise<boolean> => {
  try {
    // Only available on iOS
    if (Platform.OS !== 'ios') {
      return false;
    }
    
    const value = await AsyncStorage.getItem(HEALTH_SYNC_KEY);
    if (value === null) {
      return DEFAULT_HEALTH_SYNC;
    }
    return value === 'true';
  } catch (error) {
    console.error('Error getting health sync setting:', error);
    return DEFAULT_HEALTH_SYNC;
  }
};

export const setHealthSyncEnabled = async (enabled: boolean): Promise<void> => {
  try {
    await AsyncStorage.setItem(HEALTH_SYNC_KEY, enabled.toString());
  } catch (error) {
    console.error('Error setting health sync setting:', error);
  }
};

// Convert weight between units
export const convertWeight = (
  weight: number, 
  fromUnit: WeightUnit, 
  toUnit: WeightUnit
): number => {
  // Normalize units to lowercase
  const fromNormalized = fromUnit.toLowerCase() as WeightUnit;
  const toNormalized = toUnit.toLowerCase() as WeightUnit;
  
  if (fromNormalized === toNormalized) {
    return weight;
  }
  
  if (fromNormalized === 'kg' && toNormalized === 'lbs') {
    return weight * 2.20462;
  } else {
    return weight / 2.20462;
  }
}; 