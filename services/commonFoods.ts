// This file contains a database of common food items to use as a fallback
// when the API is unavailable or hits premium subscription limitations

import { NutritionItem } from './nutritionService';

// Common food items with nutritional data
export const commonFoods: NutritionItem[] = [
  {
    name: "apple",
    calories: 52,
    serving_size_g: 100,
    fat_total_g: 0.2,
    fat_saturated_g: 0,
    protein_g: 0.3,
    sodium_mg: 1,
    potassium_mg: 107,
    cholesterol_mg: 0,
    carbohydrates_total_g: 14,
    fiber_g: 2.4,
    sugar_g: 10.3
  },
  {
    name: "banana",
    calories: 89,
    serving_size_g: 100,
    fat_total_g: 0.3,
    fat_saturated_g: 0.1,
    protein_g: 1.1,
    sodium_mg: 1,
    potassium_mg: 358,
    cholesterol_mg: 0,
    carbohydrates_total_g: 22.8,
    fiber_g: 2.6,
    sugar_g: 12.2
  },
  {
    name: "orange",
    calories: 47,
    serving_size_g: 100,
    fat_total_g: 0.1,
    fat_saturated_g: 0,
    protein_g: 0.9,
    sodium_mg: 0,
    potassium_mg: 181,
    cholesterol_mg: 0,
    carbohydrates_total_g: 11.8,
    fiber_g: 2.4,
    sugar_g: 9.4
  },
  {
    name: "chicken breast",
    calories: 165,
    serving_size_g: 100,
    fat_total_g: 3.6,
    fat_saturated_g: 1,
    protein_g: 31,
    sodium_mg: 74,
    potassium_mg: 256,
    cholesterol_mg: 85,
    carbohydrates_total_g: 0,
    fiber_g: 0,
    sugar_g: 0
  },
  {
    name: "rice",
    calories: 130,
    serving_size_g: 100,
    fat_total_g: 0.3,
    fat_saturated_g: 0.1,
    protein_g: 2.7,
    sodium_mg: 1,
    potassium_mg: 35,
    cholesterol_mg: 0,
    carbohydrates_total_g: 28.2,
    fiber_g: 0.4,
    sugar_g: 0.1
  },
  {
    name: "bread",
    calories: 265,
    serving_size_g: 100,
    fat_total_g: 3.2,
    fat_saturated_g: 0.7,
    protein_g: 9.4,
    sodium_mg: 495,
    potassium_mg: 126,
    cholesterol_mg: 0,
    carbohydrates_total_g: 49,
    fiber_g: 2.7,
    sugar_g: 5.1
  },
  {
    name: "milk",
    calories: 42,
    serving_size_g: 100,
    fat_total_g: 1,
    fat_saturated_g: 0.6,
    protein_g: 3.4,
    sodium_mg: 43,
    potassium_mg: 150,
    cholesterol_mg: 5,
    carbohydrates_total_g: 5,
    fiber_g: 0,
    sugar_g: 5.1
  },
  {
    name: "egg",
    calories: 155,
    serving_size_g: 100,
    fat_total_g: 11,
    fat_saturated_g: 3.3,
    protein_g: 13,
    sodium_mg: 124,
    potassium_mg: 126,
    cholesterol_mg: 373,
    carbohydrates_total_g: 1.1,
    fiber_g: 0,
    sugar_g: 1.1
  },
  {
    name: "beef",
    calories: 250,
    serving_size_g: 100,
    fat_total_g: 15,
    fat_saturated_g: 6,
    protein_g: 26,
    sodium_mg: 72,
    potassium_mg: 318,
    cholesterol_mg: 90,
    carbohydrates_total_g: 0,
    fiber_g: 0,
    sugar_g: 0
  },
  {
    name: "salmon",
    calories: 208,
    serving_size_g: 100,
    fat_total_g: 13,
    fat_saturated_g: 3.1,
    protein_g: 20,
    sodium_mg: 59,
    potassium_mg: 363,
    cholesterol_mg: 55,
    carbohydrates_total_g: 0,
    fiber_g: 0,
    sugar_g: 0
  },
  {
    name: "broccoli",
    calories: 34,
    serving_size_g: 100,
    fat_total_g: 0.4,
    fat_saturated_g: 0.1,
    protein_g: 2.8,
    sodium_mg: 33,
    potassium_mg: 316,
    cholesterol_mg: 0,
    carbohydrates_total_g: 6.6,
    fiber_g: 2.6,
    sugar_g: 1.7
  },
  {
    name: "carrot",
    calories: 41,
    serving_size_g: 100,
    fat_total_g: 0.2,
    fat_saturated_g: 0,
    protein_g: 0.9,
    sodium_mg: 69,
    potassium_mg: 320,
    cholesterol_mg: 0,
    carbohydrates_total_g: 9.6,
    fiber_g: 2.8,
    sugar_g: 4.7
  },
  {
    name: "potato",
    calories: 77,
    serving_size_g: 100,
    fat_total_g: 0.1,
    fat_saturated_g: 0,
    protein_g: 2,
    sodium_mg: 6,
    potassium_mg: 421,
    cholesterol_mg: 0,
    carbohydrates_total_g: 17,
    fiber_g: 2.2,
    sugar_g: 0.8
  },
  {
    name: "pasta",
    calories: 158,
    serving_size_g: 100,
    fat_total_g: 0.9,
    fat_saturated_g: 0.2,
    protein_g: 5.8,
    sodium_mg: 1,
    potassium_mg: 58,
    cholesterol_mg: 0,
    carbohydrates_total_g: 31,
    fiber_g: 1.8,
    sugar_g: 0.6
  },
  {
    name: "spinach",
    calories: 23,
    serving_size_g: 100,
    fat_total_g: 0.4,
    fat_saturated_g: 0.1,
    protein_g: 2.9,
    sodium_mg: 79,
    potassium_mg: 558,
    cholesterol_mg: 0,
    carbohydrates_total_g: 3.6,
    fiber_g: 2.2,
    sugar_g: 0.4
  },
  {
    name: "avocado",
    calories: 160,
    serving_size_g: 100,
    fat_total_g: 14.7,
    fat_saturated_g: 2.1,
    protein_g: 2,
    sodium_mg: 7,
    potassium_mg: 485,
    cholesterol_mg: 0,
    carbohydrates_total_g: 8.5,
    fiber_g: 6.7,
    sugar_g: 0.7
  },
  {
    name: "yogurt",
    calories: 59,
    serving_size_g: 100,
    fat_total_g: 0.4,
    fat_saturated_g: 0.1,
    protein_g: 10,
    sodium_mg: 36,
    potassium_mg: 141,
    cholesterol_mg: 5,
    carbohydrates_total_g: 3.6,
    fiber_g: 0,
    sugar_g: 3.2
  },
  {
    name: "oatmeal",
    calories: 68,
    serving_size_g: 100,
    fat_total_g: 1.4,
    fat_saturated_g: 0.2,
    protein_g: 2.4,
    sodium_mg: 2,
    potassium_mg: 61,
    cholesterol_mg: 0,
    carbohydrates_total_g: 12,
    fiber_g: 1.7,
    sugar_g: 0.5
  },
  {
    name: "peanut butter",
    calories: 588,
    serving_size_g: 100,
    fat_total_g: 50,
    fat_saturated_g: 10,
    protein_g: 25,
    sodium_mg: 426,
    potassium_mg: 649,
    cholesterol_mg: 0,
    carbohydrates_total_g: 20,
    fiber_g: 6,
    sugar_g: 9
  },
  {
    name: "almonds",
    calories: 579,
    serving_size_g: 100,
    fat_total_g: 49.9,
    fat_saturated_g: 3.8,
    protein_g: 21.2,
    sodium_mg: 1,
    potassium_mg: 733,
    cholesterol_mg: 0,
    carbohydrates_total_g: 21.6,
    fiber_g: 12.5,
    sugar_g: 4.4
  }
];

// Function to search the local database
export const searchLocalFoods = (query: string): NutritionItem[] => {
  const normalizedQuery = query.toLowerCase().trim();
  
  // Match foods that include the query string
  return commonFoods.filter(food => 
    food.name.toLowerCase().includes(normalizedQuery)
  );
}; 