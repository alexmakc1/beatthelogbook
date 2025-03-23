import { Alert, Platform } from 'react-native';
import { Workout, Exercise, Set } from './storageService';
import * as settingsService from './settingsService';

// Mock Health object for TypeScript since we don't have types for expo-health yet
interface HealthWorkoutData {
  startDate: Date;
  endDate: Date;
  calories: number;
  workoutType: string;
  metadata?: Record<string, any>;
}

interface HealthPermission {
  granted: boolean;
}

// Define enums for WorkoutType and PermissionKind
enum HealthWorkoutType {
  FunctionalStrengthTraining = 'functional_strength',
  TraditionalStrengthTraining = 'traditional_strength',
  CoreTraining = 'core_training',
  Running = 'running',
  Walking = 'walking',
  Cycling = 'cycling',
  Swimming = 'swimming',
  Rowing = 'rowing',
  StairClimbing = 'stair_climbing',
  Elliptical = 'elliptical'
}

enum HealthPermissionKind {
  Workout = 'workout',
  ActivitySummary = 'activity_summary'
}

// Mock Health API
const Health = {
  isAvailable: async (): Promise<boolean> => {
    return Platform.OS === 'ios';
  },
  requestPermissionsAsync: async (permissions: HealthPermissionKind[]): Promise<HealthPermission> => {
    // This is a mock that will be replaced by the actual implementation
    return { granted: true };
  },
  saveWorkoutAsync: async (data: HealthWorkoutData): Promise<void> => {
    // This is a mock that will be replaced by the actual implementation
    console.log('Saving workout to Health:', data);
  },
  WorkoutType: HealthWorkoutType,
  PermissionKind: HealthPermissionKind
};

// Check if the device supports HealthKit (iOS only)
export const isHealthAvailable = async (): Promise<boolean> => {
  // Health is only available on iOS
  if (Platform.OS !== 'ios') {
    return false;
  }

  try {
    // In a real implementation, we'd use the actual Health.isAvailable()
    return await Health.isAvailable();
  } catch (error) {
    console.error('Error checking Health availability:', error);
    return false;
  }
};

// Request permissions to read/write health data
export const requestHealthPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'ios') {
    return false;
  }

  try {
    const permissions = [
      Health.PermissionKind.Workout,
      Health.PermissionKind.ActivitySummary,
    ];
    
    const result = await Health.requestPermissionsAsync(permissions);
    return result.granted;
  } catch (error) {
    console.error('Error requesting Health permissions:', error);
    return false;
  }
};

// Get the HealthKit workout activity type based on exercise name
const getWorkoutActivityType = (exerciseName: string): HealthWorkoutType => {
  // Default to functional strength training
  let workoutType = Health.WorkoutType.FunctionalStrengthTraining;
  
  const lowerCaseName = exerciseName.toLowerCase();
  
  // Check for cardio exercises
  if (lowerCaseName.includes('run') || lowerCaseName.includes('jog')) {
    workoutType = Health.WorkoutType.Running;
  } else if (lowerCaseName.includes('walk')) {
    workoutType = Health.WorkoutType.Walking;
  } else if (lowerCaseName.includes('cycle') || lowerCaseName.includes('bike')) {
    workoutType = Health.WorkoutType.Cycling;
  } else if (lowerCaseName.includes('swim')) {
    workoutType = Health.WorkoutType.Swimming;
  } else if (lowerCaseName.includes('row')) {
    workoutType = Health.WorkoutType.Rowing;
  } else if (lowerCaseName.includes('stair') || lowerCaseName.includes('step')) {
    workoutType = Health.WorkoutType.StairClimbing;
  } else if (lowerCaseName.includes('elliptical')) {
    workoutType = Health.WorkoutType.Elliptical;
  }
  
  // Check for strength training categories
  if (
    lowerCaseName.includes('bench') || 
    lowerCaseName.includes('press') || 
    lowerCaseName.includes('chest') || 
    lowerCaseName.includes('shoulder') || 
    lowerCaseName.includes('tricep') || 
    lowerCaseName.includes('fly')
  ) {
    workoutType = Health.WorkoutType.TraditionalStrengthTraining;
  } else if (
    lowerCaseName.includes('squat') || 
    lowerCaseName.includes('leg') || 
    lowerCaseName.includes('lunge') || 
    lowerCaseName.includes('deadlift') || 
    lowerCaseName.includes('hip thrust') || 
    lowerCaseName.includes('calf')
  ) {
    workoutType = Health.WorkoutType.TraditionalStrengthTraining;
  } else if (
    lowerCaseName.includes('pull up') || 
    lowerCaseName.includes('pull-up') || 
    lowerCaseName.includes('chin up') || 
    lowerCaseName.includes('row') || 
    lowerCaseName.includes('curl') || 
    lowerCaseName.includes('bicep')
  ) {
    workoutType = Health.WorkoutType.TraditionalStrengthTraining;
  } else if (
    lowerCaseName.includes('core') || 
    lowerCaseName.includes('ab') || 
    lowerCaseName.includes('plank') || 
    lowerCaseName.includes('crunch')
  ) {
    workoutType = Health.WorkoutType.CoreTraining;
  }

  return workoutType;
};

// Calculate total calories burned (rough estimate)
const calculateCalories = (duration: number, exerciseCount: number): number => {
  // This is a very rough estimate - HealthKit will refine this based on user data
  const baseMET = 3.5; // Base Metabolic Equivalent of Task for moderate exercise
  const avgWeight = 70; // kg, average weight (HealthKit will use actual weight if available)
  const caloriesPerMinute = baseMET * 3.5 * avgWeight / 200; // Rough calories per minute formula
  
  // Add a multiplier based on exercise count to account for workout intensity
  const intensityMultiplier = 1 + (exerciseCount * 0.05);
  
  // Convert duration from seconds to minutes
  const durationMinutes = duration / 60;
  
  return Math.round(caloriesPerMinute * durationMinutes * intensityMultiplier);
};

// Parse workout duration number to seconds
const parseDuration = (duration: number): number => {
  // Duration is already in seconds
  return duration;
};

// Save a workout to Apple Health
export const saveWorkoutToHealth = async (workout: Workout): Promise<boolean> => {
  if (Platform.OS !== 'ios') {
    return false;
  }

  try {
    // Check if Health is available
    const available = await isHealthAvailable();
    if (!available) {
      console.log('HealthKit is not available on this device');
      return false;
    }

    // Request permissions if needed
    const hasPermissions = await requestHealthPermissions();
    if (!hasPermissions) {
      console.log('HealthKit permissions not granted');
      return false;
    }

    // Get duration in seconds
    let durationInSeconds = workout.duration || 0;

    // If we have a specific start time, use it, otherwise use the date
    const startDate = workout.startTime 
      ? new Date(workout.startTime) 
      : new Date(workout.date);
    
    // End time is start time + duration
    const endDate = new Date(startDate.getTime() + (durationInSeconds * 1000));
    
    // Determine the primary workout type based on exercises
    // For now, we'll use a generic strength training type
    let workoutType = Health.WorkoutType.FunctionalStrengthTraining;
    
    // Calculate approximate calories (rough estimate)
    const calories = calculateCalories(durationInSeconds, workout.exercises.length);
    
    // Save the workout to HealthKit
    await Health.saveWorkoutAsync({
      startDate,
      endDate,
      calories,
      workoutType,
      metadata: {
        workoutId: workout.id,
        workoutName: 'Beat the Logbook Workout',
        exercises: JSON.stringify(workout.exercises.map(ex => ex.name)),
      }
    });
    
    return true;
  } catch (error) {
    console.error('Error saving workout to HealthKit:', error);
    Alert.alert(
      'Health Sync Failed',
      'Unable to save workout to Apple Health. Please check your permissions.'
    );
    return false;
  }
};

// Function to check if sync is enabled in settings
export const isSyncEnabled = async (): Promise<boolean> => {
  return await settingsService.getHealthSyncEnabled();
}; 