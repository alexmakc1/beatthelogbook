import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { searchLocalFoods } from './commonFoods';
import crypto from 'crypto-js';

// API constants
const FATSECRET_API_BASE_URL = 'https://platform.fatsecret.com/rest/server.api';

// OAuth 1.0 credentials - these should be stored in environment variables in production
const FATSECRET_CONSUMER_KEY = 'f45e56444b9e4bbabdbe80b6b6ba1725';  
const FATSECRET_CONSUMER_SECRET = '94ebd77b8baa4c6cbea00bd401dc2ca2';

// Types
export interface FatSecretFood {
  food_id: string;
  food_name: string;
  food_type: string;
  food_url: string;
  brand_name?: string;
}

export interface FatSecretServing {
  serving_id: string;
  serving_description: string;
  serving_url: string;
  metric_serving_amount?: string;
  metric_serving_unit?: string;
  number_of_units?: string;
  measurement_description?: string;
  is_default?: string;
  calories: string;
  carbohydrate: string;
  protein: string;
  fat: string;
  saturated_fat?: string;
  polyunsaturated_fat?: string;
  monounsaturated_fat?: string;
  trans_fat?: string;
  cholesterol?: string;
  sodium?: string;
  potassium?: string;
  fiber?: string;
  sugar?: string;
  vitamin_a?: string;
  vitamin_c?: string;
  calcium?: string;
  iron?: string;
}

export interface FatSecretFoodDetails {
  food_id: string;
  food_name: string;
  food_type: string;
  food_url: string;
  brand_name?: string;
  servings: {
    serving: FatSecretServing | FatSecretServing[];
  };
}

// Converted format to match our app's needs
export interface NutritionItem {
  name: string;
  calories: number;
  serving_size_g: number;
  fat_total_g: number;
  fat_saturated_g: number;
  protein_g: number;
  sodium_mg: number;
  potassium_mg: number;
  cholesterol_mg: number;
  carbohydrates_total_g: number;
  fiber_g: number;
  sugar_g: number;
  food_id?: string; // Added for FatSecret
  brand_name?: string; // Added for FatSecret
}

export interface DiaryEntry {
  id: string;
  date: string;
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  food: NutritionItem;
  quantity: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface DailyDiary {
  date: string;
  entries: DiaryEntry[];
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

// Storage keys
const FAVORITES_STORAGE_KEY = 'nutrition_favorites';
const DIARY_STORAGE_KEY = 'nutrition_diary';
const RECENT_SEARCHES_KEY = 'nutrition_recent_searches';

// Helper function to format date as YYYY-MM-DD
export const formatDateToYYYYMMDD = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Generate OAuth 1.0 signature
const generateOAuthSignature = (
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string
): string => {
  // Sort parameters alphabetically
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc: Record<string, string>, key) => {
      acc[key] = params[key];
      return acc;
    }, {});

  // Create parameter string
  const paramString = Object.entries(sortedParams)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  // Create signature base string
  const signatureBaseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(paramString)
  ].join('&');

  // Create signing key (consumer secret + '&')
  const signingKey = `${encodeURIComponent(consumerSecret)}&`;

  // Generate signature
  const signature = crypto.HmacSHA1(signatureBaseString, signingKey).toString(crypto.enc.Base64);

  return signature;
};

// Create OAuth 1.0 parameters
const createOAuthParams = (additionalParams: Record<string, string> = {}): Record<string, string> => {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = Math.random().toString(36).substring(2) + timestamp;

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: FATSECRET_CONSUMER_KEY,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_version: '1.0',
    format: 'json',
    ...additionalParams
  };

  // Generate signature
  const signature = generateOAuthSignature(
    'POST',
    FATSECRET_API_BASE_URL,
    oauthParams,
    FATSECRET_CONSUMER_SECRET
  );

  // Add signature to params
  oauthParams.oauth_signature = signature;

  return oauthParams;
};

// Convert FatSecret serving data to our NutritionItem format
const convertToNutritionItem = (food: FatSecretFood, serving: FatSecretServing): NutritionItem => {
  // Default serving size to 100g if not specified
  const servingSize = serving.metric_serving_amount 
    ? parseFloat(serving.metric_serving_amount) 
    : 100;
  
  return {
    name: food.food_name,
    food_id: food.food_id,
    brand_name: food.brand_name,
    calories: parseInt(serving.calories) || 0,
    serving_size_g: servingSize,
    fat_total_g: parseFloat(serving.fat) || 0,
    fat_saturated_g: parseFloat(serving.saturated_fat || '0') || 0,
    protein_g: parseFloat(serving.protein) || 0,
    sodium_mg: parseFloat(serving.sodium || '0') || 0,
    potassium_mg: parseFloat(serving.potassium || '0') || 0,
    cholesterol_mg: parseFloat(serving.cholesterol || '0') || 0,
    carbohydrates_total_g: parseFloat(serving.carbohydrate) || 0,
    fiber_g: parseFloat(serving.fiber || '0') || 0,
    sugar_g: parseFloat(serving.sugar || '0') || 0,
  };
};

// Search for nutrition information
export const searchNutrition = async (query: string): Promise<NutritionItem[]> => {
  try {
    // Create OAuth parameters
    const params = createOAuthParams({
      method: 'foods.search',
      search_expression: query,
      max_results: '50'
    });

    // Convert params to URLSearchParams
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, value);
    });

    // Make API request
    const response = await axios({
      method: 'post',
      url: FATSECRET_API_BASE_URL,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: searchParams.toString(),
      timeout: 10000, // Add timeout to prevent long hanging requests
    });

    // Save to recent searches
    await saveRecentSearch(query);
    
    const results = response.data;
    
    // Handle no results case
    if (!results.foods || !results.foods.food) {
      return [];
    }
    
    // Convert to array if single result
    const foodItems = Array.isArray(results.foods.food) 
      ? results.foods.food 
      : [results.foods.food];
    
    // Get detailed nutrition for each food
    const nutritionItems: NutritionItem[] = [];
    
    // Process each food item (we'll get details as needed when user selects a food)
    for (const food of foodItems) {
      try {
        const details = await getFoodDetails(food.food_id);
        nutritionItems.push(details);
      } catch (error) {
        console.error(`Error getting details for food ${food.food_id}:`, error);
        // Skip this food item
      }
    }
    
    return nutritionItems;
  } catch (error: any) {
    console.error('Error searching nutrition:', error);
    
    // Fall back to local database
    console.log('Falling back to local food database');
    
    // Save to recent searches anyway
    await saveRecentSearch(query);
    
    // Return results from local database
    return searchLocalFoods(query);
  }
};

// Get food details by ID
export const getFoodDetails = async (foodId: string): Promise<NutritionItem> => {
  try {
    // Create OAuth parameters
    const params = createOAuthParams({
      method: 'food.get',
      food_id: foodId
    });

    // Convert params to URLSearchParams
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, value);
    });

    // Make API request
    const response = await axios({
      method: 'post',
      url: FATSECRET_API_BASE_URL,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: searchParams.toString(),
      timeout: 10000, // Add timeout to prevent long hanging requests
    });
    
    const foodData = response.data.food as FatSecretFoodDetails;
    
    // Get the default serving or first serving
    let servingData: FatSecretServing;
    
    if (Array.isArray(foodData.servings.serving)) {
      // Find the default serving or use the first one
      const defaultServing = foodData.servings.serving.find(s => s.is_default === "1");
      servingData = defaultServing || foodData.servings.serving[0];
    } else {
      servingData = foodData.servings.serving;
    }
    
    // Convert to our format
    return convertToNutritionItem(foodData, servingData);
  } catch (error) {
    console.error('Error getting food details:', error);
    throw new Error('Failed to fetch food details');
  }
};

// Save a search query to recent searches
export const saveRecentSearch = async (query: string) => {
  try {
    // Get existing recent searches
    const recentSearchesJson = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
    const recentSearches = recentSearchesJson ? JSON.parse(recentSearchesJson) : [];
    
    // Add the new search to the beginning if it doesn't exist
    if (!recentSearches.includes(query)) {
      recentSearches.unshift(query);
      
      // Limit to 10 recent searches
      const limitedSearches = recentSearches.slice(0, 10);
      
      // Save back to storage
      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(limitedSearches));
    }
  } catch (error) {
    console.error('Error saving recent search:', error);
  }
};

// Get recent searches
export const getRecentSearches = async (): Promise<string[]> => {
  try {
    const recentSearchesJson = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
    return recentSearchesJson ? JSON.parse(recentSearchesJson) : [];
  } catch (error) {
    console.error('Error getting recent searches:', error);
    return [];
  }
};

// Save a favorite food
export const saveFavoriteFood = async (food: NutritionItem): Promise<void> => {
  try {
    const favoritesJson = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
    const favorites = favoritesJson ? JSON.parse(favoritesJson) : [];
    
    // Check if food already exists in favorites
    const exists = favorites.some((f: NutritionItem) => f.name === food.name);
    
    if (!exists) {
      favorites.push(food);
      await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
    }
  } catch (error) {
    console.error('Error saving favorite food:', error);
    throw new Error('Failed to save favorite food');
  }
};

// Remove a favorite food
export const removeFavoriteFood = async (foodName: string): Promise<void> => {
  try {
    const favoritesJson = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!favoritesJson) return;
    
    const favorites = JSON.parse(favoritesJson);
    const updatedFavorites = favorites.filter((food: NutritionItem) => food.name !== foodName);
    
    await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(updatedFavorites));
  } catch (error) {
    console.error('Error removing favorite food:', error);
    throw new Error('Failed to remove favorite food');
  }
};

// Get all favorite foods
export const getFavoriteFoods = async (): Promise<NutritionItem[]> => {
  try {
    const favoritesJson = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
    return favoritesJson ? JSON.parse(favoritesJson) : [];
  } catch (error) {
    console.error('Error getting favorite foods:', error);
    return [];
  }
};

// Check if a food is a favorite
export const isFavoriteFood = async (foodName: string): Promise<boolean> => {
  try {
    const favorites = await getFavoriteFoods();
    return favorites.some((food: NutritionItem) => food.name === foodName);
  } catch (error) {
    console.error('Error checking if food is favorite:', error);
    return false;
  }
};

// Add food to diary
export const addToDiary = async (
  date: string,
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack',
  food: NutritionItem,
  quantity: number
): Promise<void> => {
  try {
    // Generate a unique ID for this entry
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Calculate the nutritional values based on quantity
    const factor = quantity / food.serving_size_g;
    const calories = Math.round(food.calories * factor);
    const protein = Math.round(food.protein_g * factor);
    const carbs = Math.round(food.carbohydrates_total_g * factor);
    const fat = Math.round(food.fat_total_g * factor);
    
    // Create the diary entry
    const entry: DiaryEntry = {
      id,
      date,
      meal,
      food,
      quantity,
      calories,
      protein,
      carbs,
      fat
    };
    
    // Get existing diary data
    const diaryJson = await AsyncStorage.getItem(DIARY_STORAGE_KEY);
    const diary = diaryJson ? JSON.parse(diaryJson) : {};
    
    // Initialize the date entry if it doesn't exist
    if (!diary[date]) {
      diary[date] = {
        date,
        entries: [],
        totals: { calories: 0, protein: 0, carbs: 0, fat: 0 }
      };
    }
    
    // Add the entry
    diary[date].entries.push(entry);
    
    // Update totals
    diary[date].totals.calories += calories;
    diary[date].totals.protein += protein;
    diary[date].totals.carbs += carbs;
    diary[date].totals.fat += fat;
    
    // Save back to storage
    await AsyncStorage.setItem(DIARY_STORAGE_KEY, JSON.stringify(diary));
  } catch (error) {
    console.error('Error adding to diary:', error);
    throw new Error('Failed to add food to diary');
  }
};

// Remove food from diary
export const removeFromDiary = async (date: string, entryId: string): Promise<void> => {
  try {
    // Get existing diary data
    const diaryJson = await AsyncStorage.getItem(DIARY_STORAGE_KEY);
    if (!diaryJson) return;
    
    const diary = JSON.parse(diaryJson);
    if (!diary[date]) return;
    
    // Find the entry to remove
    const entryIndex = diary[date].entries.findIndex((e: DiaryEntry) => e.id === entryId);
    if (entryIndex === -1) return;
    
    const entry = diary[date].entries[entryIndex];
    
    // Update totals
    diary[date].totals.calories -= entry.calories;
    diary[date].totals.protein -= entry.protein;
    diary[date].totals.carbs -= entry.carbs;
    diary[date].totals.fat -= entry.fat;
    
    // Remove the entry
    diary[date].entries.splice(entryIndex, 1);
    
    // Save back to storage
    await AsyncStorage.setItem(DIARY_STORAGE_KEY, JSON.stringify(diary));
  } catch (error) {
    console.error('Error removing from diary:', error);
    throw new Error('Failed to remove food from diary');
  }
};

// Get diary data for a specific date
export const getDiaryForDate = async (date: string): Promise<DailyDiary | null> => {
  try {
    const diaryJson = await AsyncStorage.getItem(DIARY_STORAGE_KEY);
    if (!diaryJson) return null;
    
    const diary = JSON.parse(diaryJson);
    return diary[date] || null;
  } catch (error) {
    console.error('Error getting diary for date:', error);
    return null;
  }
};

// Get all diary entries for a date range
export const getDiaryEntriesForDateRange = async (startDate: string, endDate: string): Promise<DiaryEntry[]> => {
  try {
    const diaryJson = await AsyncStorage.getItem(DIARY_STORAGE_KEY);
    if (!diaryJson) return [];
    
    const diary = JSON.parse(diaryJson);
    const allEntries: DiaryEntry[] = [];
    
    // Start date and end date as Date objects for comparison
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Loop through each date in the diary
    Object.keys(diary).forEach(dateStr => {
      const date = new Date(dateStr);
      
      // Check if the date is within the range
      if (date >= start && date <= end) {
        // Add all entries for this date
        allEntries.push(...diary[dateStr].entries);
      }
    });
    
    return allEntries;
  } catch (error) {
    console.error('Error getting diary entries for date range:', error);
    return [];
  }
};

// Get nutrition trends for the date range
export const getNutritionTrends = async (startDate: string, endDate: string): Promise<{ date: string; totals: { calories: number; protein: number; carbs: number; fat: number; } }[]> => {
  try {
    const diaryJson = await AsyncStorage.getItem(DIARY_STORAGE_KEY);
    if (!diaryJson) return [];
    
    const diary = JSON.parse(diaryJson);
    const trends: { date: string; totals: { calories: number; protein: number; carbs: number; fat: number; } }[] = [];
    
    // Start date and end date as Date objects for comparison
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Loop through each date in the diary
    Object.keys(diary).forEach(dateStr => {
      const date = new Date(dateStr);
      
      // Check if the date is within the range
      if (date >= start && date <= end) {
        // Add the date with its totals
        trends.push({
          date: dateStr,
          totals: diary[dateStr].totals
        });
      }
    });
    
    return trends;
  } catch (error) {
    console.error('Error getting nutrition trends:', error);
    return [];
  }
};

// Calculate daily nutrition from diary data
export const calculateDailyNutrition = (diary: DailyDiary | null): { 
  calories: number; 
  protein: number; 
  carbs: number; 
  fat: number;
} => {
  if (!diary) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  }
  
  return diary.totals;
};

// Update diary entry
export const updateDiaryEntry = async (
  date: string,
  entryId: string,
  updates: { quantity?: number }
): Promise<void> => {
  try {
    // Get existing diary data
    const diaryJson = await AsyncStorage.getItem(DIARY_STORAGE_KEY);
    if (!diaryJson) return;
    
    const diary = JSON.parse(diaryJson);
    if (!diary[date]) return;
    
    // Find the entry to update
    const entryIndex = diary[date].entries.findIndex((e: DiaryEntry) => e.id === entryId);
    if (entryIndex === -1) return;
    
    const entry = diary[date].entries[entryIndex];
    const oldCalories = entry.calories;
    const oldProtein = entry.protein;
    const oldCarbs = entry.carbs;
    const oldFat = entry.fat;
    
    // Update quantity if provided
    if (updates.quantity !== undefined) {
      const factor = updates.quantity / entry.food.serving_size_g;
      entry.quantity = updates.quantity;
      entry.calories = Math.round(entry.food.calories * factor);
      entry.protein = Math.round(entry.food.protein_g * factor);
      entry.carbs = Math.round(entry.food.carbohydrates_total_g * factor);
      entry.fat = Math.round(entry.food.fat_total_g * factor);
    }
    
    // Update the diary totals
    diary[date].totals.calories += (entry.calories - oldCalories);
    diary[date].totals.protein += (entry.protein - oldProtein);
    diary[date].totals.carbs += (entry.carbs - oldCarbs);
    diary[date].totals.fat += (entry.fat - oldFat);
    
    // Save back to storage
    await AsyncStorage.setItem(DIARY_STORAGE_KEY, JSON.stringify(diary));
  } catch (error) {
    console.error('Error updating diary entry:', error);
    throw new Error('Failed to update diary entry');
  }
}; 