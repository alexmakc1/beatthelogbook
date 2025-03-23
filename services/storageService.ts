import AsyncStorage from '@react-native-async-storage/async-storage';
import * as healthService from './healthService';
import { Platform } from 'react';

// Types
export interface Exercise {
  id: string;
  name: string;
  sets: Set[];
}

export interface Set {
  id: string;
  reps: string;
  weight: string;
}

export interface Workout {
  id: string;
  date: string;
  exercises: Exercise[];
  startTime?: string;
  duration?: number;
  weightUnit?: string; // Track which unit was used to store weights
}

// Keys
const WORKOUTS_KEY = 'workouts';
const EXERCISE_HISTORY_KEY = 'exerciseHistory';
const TEMPLATES_KEY = 'workoutTemplates';
const ACTIVE_WORKOUT_KEY = 'activeWorkout';

// Save a completed workout
export const saveWorkout = async (
  exercises: Exercise[], 
  timeInfo?: { startTime: string; duration: number },
  weightUnit?: string // Add weightUnit parameter
): Promise<string> => {
  try {
    // Create workout object
    const workout: Workout = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      exercises,
      startTime: timeInfo?.startTime || new Date().toISOString(),
      duration: timeInfo?.duration || 0,
      weightUnit: weightUnit || 'kg' // Store the unit used (default to kg for compatibility)
    };

    // Get existing workouts
    const existingWorkouts = await getWorkouts();
    
    // Add new workout
    const updatedWorkouts = [workout, ...existingWorkouts];
    
    // Save to storage
    await AsyncStorage.setItem(WORKOUTS_KEY, JSON.stringify(updatedWorkouts));
    
    // Update exercise history
    await updateExerciseHistory(exercises);
    
    // Sync to Apple Health if on iOS
    syncWorkoutToHealth(workout).catch(err => 
      console.error('Health sync error:', err)
    );
    
    return workout.id;
  } catch (error) {
    console.error('Error saving workout:', error);
    throw error;
  }
};

// Save a workout as a template
export const saveWorkoutAsTemplate = async (workout: Workout, templateName: string): Promise<boolean> => {
  try {
    // Get existing templates
    const templates = await getWorkoutTemplates();
    
    // Create template object (without date)
    const template = {
      id: workout.id + '_template_' + Date.now().toString(),
      name: templateName,
      exercises: workout.exercises
    };
    
    // Add to templates list
    templates.push(template);
    
    // Save to storage
    await AsyncStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
    
    return true;
  } catch (error) {
    console.error('Error saving workout template:', error);
    return false;
  }
};

// Get all workouts
export const getWorkouts = async (): Promise<Workout[]> => {
  try {
    const workoutsJson = await AsyncStorage.getItem(WORKOUTS_KEY);
    return workoutsJson ? JSON.parse(workoutsJson) : [];
  } catch (error) {
    console.error('Error getting workouts:', error);
    return [];
  }
};

// Get a specific workout by ID
export const getWorkoutById = async (id: string): Promise<Workout | null> => {
  try {
    const workouts = await getWorkouts();
    return workouts.find(workout => workout.id === id) || null;
  } catch (error) {
    console.error('Error getting workout by ID:', error);
    return null;
  }
};

// Update exercise history
export const updateExerciseHistory = async (exercises: Exercise[]) => {
  try {
    // Get exercise names from this workout
    const exerciseNames = exercises.map(ex => ex.name);
    
    // Get existing history
    const existingHistory = await getExerciseHistory();
    
    // Create updated history with unique names
    const updatedHistory = Array.from(new Set([...existingHistory, ...exerciseNames]));
    
    // Save to storage
    await AsyncStorage.setItem(EXERCISE_HISTORY_KEY, JSON.stringify(updatedHistory));
  } catch (error) {
    console.error('Error updating exercise history:', error);
  }
};

// Get exercise history for autocomplete
export const getExerciseHistory = async (): Promise<string[]> => {
  try {
    const historyJson = await AsyncStorage.getItem(EXERCISE_HISTORY_KEY);
    return historyJson ? JSON.parse(historyJson) : [];
  } catch (error) {
    console.error('Error getting exercise history:', error);
    return [];
  }
};

// Search for exercises in history
export const searchExercises = async (query: string): Promise<string[]> => {
  try {
    if (!query.trim()) return [];
    
    const history = await getExerciseHistory();
    const lowerQuery = query.toLowerCase();
    
    return history.filter(name => 
      name.toLowerCase().includes(lowerQuery)
    ).sort((a, b) => {
      // Prioritize exercises that start with the query
      const aStartsWith = a.toLowerCase().startsWith(lowerQuery);
      const bStartsWith = b.toLowerCase().startsWith(lowerQuery);
      
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      return a.localeCompare(b);
    });
  } catch (error) {
    console.error('Error searching exercises:', error);
    return [];
  }
};

// Clear all data (for testing/debugging)
export const clearAllData = async () => {
  try {
    await AsyncStorage.removeItem(WORKOUTS_KEY);
    await AsyncStorage.removeItem(EXERCISE_HISTORY_KEY);
  } catch (error) {
    console.error('Error clearing data:', error);
  }
};

// Update an existing workout
export async function updateWorkout(workout: Workout, newWeightUnit?: string): Promise<boolean> {
  try {
    // Get all workouts
    const workouts = await getWorkouts();
    
    // Find the workout to update
    const index = workouts.findIndex(w => w.id === workout.id);
    if (index === -1) return false;
    
    // Update the workout with new weight unit if provided
    workouts[index] = {
      ...workout,
      weightUnit: newWeightUnit || workout.weightUnit || 'kg'
    };
    
    // Save the updated workouts
    await AsyncStorage.setItem(WORKOUTS_KEY, JSON.stringify(workouts));
    
    // Update exercise history with any new exercises
    await updateExerciseHistory(workout.exercises);
    
    return true;
  } catch (error) {
    console.error('Error updating workout:', error);
    return false;
  }
}

// Delete a workout by ID
export const deleteWorkout = async (workoutId: string): Promise<boolean> => {
  try {
    // Get all workouts
    const workouts = await getWorkouts();
    
    // Filter out the workout to delete
    const updatedWorkouts = workouts.filter(workout => workout.id !== workoutId);
    
    // If no workout was deleted (lengths are the same), return false
    if (updatedWorkouts.length === workouts.length) {
      console.error('Workout not found for deletion');
      return false;
    }
    
    // Save updated workouts back to storage
    await AsyncStorage.setItem(WORKOUTS_KEY, JSON.stringify(updatedWorkouts));
    
    return true;
  } catch (error) {
    console.error('Error deleting workout:', error);
    return false;
  }
};

// Get all workout templates
export const getWorkoutTemplates = async (): Promise<any[]> => {
  try {
    const templatesJson = await AsyncStorage.getItem(TEMPLATES_KEY);
    return templatesJson ? JSON.parse(templatesJson) : [];
  } catch (error) {
    console.error('Error getting workout templates:', error);
    return [];
  }
};

// Delete a workout template
export const deleteWorkoutTemplate = async (templateId: string): Promise<boolean> => {
  try {
    // Get all templates
    const templates = await getWorkoutTemplates();
    
    // Filter out the template to delete
    const updatedTemplates = templates.filter(template => template.id !== templateId);
    
    // If no template was deleted (lengths are the same), return false
    if (updatedTemplates.length === templates.length) {
      console.error('Template not found for deletion');
      return false;
    }
    
    // Save updated templates back to storage
    await AsyncStorage.setItem(TEMPLATES_KEY, JSON.stringify(updatedTemplates));
    
    return true;
  } catch (error) {
    console.error('Error deleting workout template:', error);
    return false;
  }
};

// Get exercise history statistics
export const getExerciseStats = async (exerciseName: string): Promise<any[]> => {
  try {
    const workouts = await getWorkouts();
    const stats = [];
    
    // Find all sets for this exercise across all workouts
    for (const workout of workouts) {
      for (const exercise of workout.exercises) {
        if (exercise.name.toLowerCase() === exerciseName.toLowerCase()) {
          // Add each set with the workout date
          for (const set of exercise.sets) {
            stats.push({
              date: workout.date,
              reps: set.reps,
              weight: set.weight
            });
          }
        }
      }
    }
    
    // Sort by date (newest first)
    return stats.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error('Error getting exercise stats:', error);
    return [];
  }
};

// Save active workout for resuming later
export const saveActiveWorkout = async (
  exercises: Exercise[],
  weightUnit?: string
): Promise<boolean> => {
  try {
    // If exercises is empty, clear the active workout
    if (!exercises || exercises.length === 0) {
      await AsyncStorage.removeItem(ACTIVE_WORKOUT_KEY);
      return true;
    }
    
    const activeWorkout = {
      exercises,
      timestamp: new Date().toISOString(),
      weightUnit: weightUnit || 'kg'
    };
    
    await AsyncStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify(activeWorkout));
    return true;
  } catch (error) {
    console.error('Error saving active workout:', error);
    return false;
  }
};

// Get active workout
export const getActiveWorkout = async (): Promise<{ exercises: Exercise[], weightUnit: string, timestamp?: string } | null> => {
  try {
    const json = await AsyncStorage.getItem(ACTIVE_WORKOUT_KEY);
    if (!json) return null;
    
    const data = JSON.parse(json);
    
    // Handle both old and new format
    if (Array.isArray(data)) {
      // Old format: just an array of exercises
      return data.length > 0 ? { exercises: data, weightUnit: 'kg' } : null;
    } else {
      // New format: object with exercises and weightUnit
      return data.exercises.length > 0 ? data : null;
    }
  } catch (error) {
    console.error('Error getting active workout:', error);
    return null;
  }
};

// Clear active workout
export const clearActiveWorkout = async (): Promise<boolean> => {
  try {
    await AsyncStorage.removeItem(ACTIVE_WORKOUT_KEY);
    return true;
  } catch (error) {
    console.error('Error clearing active workout:', error);
    return false;
  }
};

/**
 * Get a list of all unique exercises from the exercise history
 */
export async function getAllExercises(): Promise<string[]> {
  try {
    // Get exercise history directly
    return await getExerciseHistory();
  } catch (error) {
    console.error('Error getting all exercises:', error);
    return [];
  }
}

// Get exercise history statistics grouped by workout
export const getExerciseStatsByWorkout = async (exerciseName: string, historyDays?: number): Promise<any[]> => {
  try {
    const workouts = await getWorkouts();
    const workoutStats = [];
    
    // Calculate cutoff date if history days is provided
    let cutoffDate = null;
    if (historyDays) {
      cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - historyDays);
    }
    
    for (const workout of workouts) {
      const workoutDate = new Date(workout.date);
      
      // Skip workouts older than the cutoff date
      if (cutoffDate && workoutDate < cutoffDate) {
        continue;
      }
      
      for (const exercise of workout.exercises) {
        if (exercise.name.toLowerCase() === exerciseName.toLowerCase()) {
          // If we found the exercise in this workout, add the workout to our stats
          workoutStats.push({
            id: workout.id,
            date: workout.date,
            sets: [...exercise.sets], // Copy the sets
            weightUnit: workout.weightUnit || 'kg' // Include weight unit
          });
          break; // Break after finding the exercise in this workout
        }
      }
    }
    
    // Sort by date (newest first)
    return workoutStats.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error('Error getting exercise stats by workout:', error);
    return [];
  }
};

// Get the best performance for an exercise
export const getBestPerformance = async (exerciseName: string, historyDays?: number): Promise<{
  workoutId: string;
  date: string;
  weight: string;
  reps: string;
  volume: number;
  setIndex: number;
  allSets: Set[];
  weightUnit?: string; // Add weight unit to return type
} | null> => {
  try {
    const workoutStats = await getExerciseStatsByWorkout(exerciseName, historyDays);
    
    if (workoutStats.length === 0) {
      return null;
    }
    
    let bestPerformance = null;
    let highestVolume = 0;
    let bestWorkoutWeightUnit = null;
    
    // Get all workouts to find the weight unit for each workout
    const allWorkouts = await getWorkouts();
    
    // Find the set with the highest volume (weight * reps)
    for (const workout of workoutStats) {
      // Find the original workout to get its weight unit
      const originalWorkout = allWorkouts.find(w => w.id === workout.id);
      const workoutWeightUnit = originalWorkout?.weightUnit || 'kg';
      
      for (let i = 0; i < workout.sets.length; i++) {
        const set = workout.sets[i];
        const weight = parseFloat(set.weight) || 0;
        const reps = parseFloat(set.reps) || 0;
        const volume = weight * reps;
        
        // Update best performance if this set has higher volume
        if (volume > highestVolume && weight > 0 && reps > 0) {
          highestVolume = volume;
          bestPerformance = {
            workoutId: workout.id,
            date: workout.date,
            weight: set.weight,
            reps: set.reps,
            volume: volume,
            setIndex: i,
            allSets: workout.sets,
            weightUnit: workoutWeightUnit // Include the workout's weight unit
          };
          bestWorkoutWeightUnit = workoutWeightUnit;
        }
      }
    }
    
    return bestPerformance;
  } catch (error) {
    console.error('Error getting best performance:', error);
    return null;
  }
};

// Save a list of workouts directly (used for imports)
export const saveWorkoutsList = async (workouts: Workout[]): Promise<boolean> => {
  try {
    await AsyncStorage.setItem(WORKOUTS_KEY, JSON.stringify(workouts));
    return true;
  } catch (error) {
    console.error('Error saving workouts list:', error);
    return false;
  }
};

// Get the maximum weight used for an exercise
export const getMaxWeight = async (exerciseName: string, historyDays?: number): Promise<{
  workoutId: string;
  date: string;
  weight: string;
  reps: string;
  setIndex: number;
  allSets: Set[];
  weightUnit: string;
} | null> => {
  try {
    const workoutStats = await getExerciseStatsByWorkout(exerciseName, historyDays);
    
    if (workoutStats.length === 0) {
      return null;
    }
    
    let maxWeightPerformance = null;
    let maxWeight = 0;
    
    // Get all workouts to find the weight unit for each workout
    const allWorkouts = await getWorkouts();
    
    // Find the set with the highest weight
    for (const workout of workoutStats) {
      // Find the original workout to get its weight unit
      const originalWorkout = allWorkouts.find(w => w.id === workout.id);
      const workoutWeightUnit = originalWorkout?.weightUnit || 'kg';
      
      for (let i = 0; i < workout.sets.length; i++) {
        const set = workout.sets[i];
        const weightValue = parseFloat(set.weight) || 0;
        const reps = parseFloat(set.reps) || 0;
        
        // Convert weight to kg for comparison if needed
        let normalizedWeight = weightValue;
        if (workoutWeightUnit === 'lbs') {
          normalizedWeight = weightValue * 0.453592; // Convert lbs to kg for comparison
        }
        
        // Update max weight performance if this set has a higher weight
        if (normalizedWeight > maxWeight && weightValue > 0 && reps > 0) {
          maxWeight = normalizedWeight;
          maxWeightPerformance = {
            workoutId: workout.id,
            date: workout.date,
            weight: set.weight,
            reps: set.reps,
            setIndex: i,
            allSets: workout.sets,
            weightUnit: workoutWeightUnit
          };
        }
      }
    }
    
    return maxWeightPerformance;
  } catch (error) {
    console.error('Error getting max weight performance:', error);
    return null;
  }
};

// Sync a workout to Apple Health (if available)
export const syncWorkoutToHealth = async (workout: Workout): Promise<boolean> => {
  try {
    // Skip health sync on web platform
    if (Platform.OS === 'web') {
      return false;
    }
    
    // Check if health sync is enabled
    const isSyncEnabled = await healthService.isSyncEnabled();
    if (!isSyncEnabled) {
      return false;
    }
    
    // Attempt to save to health
    return await healthService.saveWorkoutToHealth(workout);
  } catch (error) {
    console.error('Error syncing to health:', error);
    return false;
  }
}; 