import * as storageService from './storageService';
import * as settingsService from './settingsService';
import { Exercise, Set, Workout } from './storageService';

interface StrongWorkoutRow {
  Date: string;
  'Workout Name': string;
  Duration: string;
  'Exercise Name': string;
  'Set Order': string;
  Weight: string;
  Reps: string;
  Distance: string;
  Seconds: string;
  Notes: string;
  'Workout Notes': string;
  RPE: string;
}

// Parse a Strong CSV duration like "1h 7m" to minutes
const parseDuration = (durationStr: string): number => {
  const hours = durationStr.match(/(\d+)h/);
  const minutes = durationStr.match(/(\d+)m/);
  
  const hoursValue = hours ? parseInt(hours[1], 10) : 0;
  const minutesValue = minutes ? parseInt(minutes[1], 10) : 0;
  
  return (hoursValue * 60 + minutesValue) * 60; // Convert to seconds
};

// Convert a Strong CSV date string to ISO format
const formatDate = (dateStr: string): string => {
  try {
    // First check if it's a valid date string
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
    
    // If not, try to parse it manually (format: YYYY-MM-DD HH:MM:SS)
    const [datePart, timePart] = dateStr.split(' ');
    if (datePart && timePart) {
      const [year, month, day] = datePart.split('-').map(Number);
      const [hour, minute, second] = timePart.split(':').map(Number);
      
      // Month is 0-indexed in JavaScript Date
      const parsedDate = new Date(year, month - 1, day, hour, minute, second);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString();
      }
    }
    
    // Fall back to current date if parsing fails
    console.warn(`Could not parse date: ${dateStr}, using current date instead`);
    return new Date().toISOString();
  } catch (error) {
    console.error(`Error formatting date: ${dateStr}`, error);
    return new Date().toISOString();
  }
};

// Parse CSV data
const parseCSV = (csvText: string): StrongWorkoutRow[] => {
  const lines = csvText.split('\n');
  const headers = lines[0].split(',').map(header => header.replace(/"/g, ''));
  
  const rows: StrongWorkoutRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    // Handle commas within quoted fields
    let currentLine = lines[i];
    const processedValues: string[] = [];
    let inQuotes = false;
    let currentValue = '';
    
    for (let j = 0; j < currentLine.length; j++) {
      const char = currentLine[j];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        processedValues.push(currentValue);
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    
    // Add the last value
    processedValues.push(currentValue);
    
    // Create an object with the headers as keys
    const rowObj: any = {};
    headers.forEach((header, index) => {
      rowObj[header] = processedValues[index] || '';
    });
    
    rows.push(rowObj as StrongWorkoutRow);
  }
  
  return rows;
};

// Group data by workout
const groupByWorkout = (rows: StrongWorkoutRow[]): Map<string, StrongWorkoutRow[]> => {
  const workoutMap = new Map<string, StrongWorkoutRow[]>();
  
  rows.forEach(row => {
    const key = `${row.Date}_${row['Workout Name']}`;
    
    if (!workoutMap.has(key)) {
      workoutMap.set(key, []);
    }
    
    workoutMap.get(key)?.push(row);
  });
  
  return workoutMap;
};

// Convert Strong workout to app workout format
const convertToAppWorkout = async (
  workoutRows: StrongWorkoutRow[], 
  weightUnit: settingsService.WeightUnit
): Promise<Workout> => {
  if (workoutRows.length === 0) throw new Error('No workout data to convert');
  
  const firstRow = workoutRows[0];
  
  // Create a map of exercises
  const exercisesMap = new Map<string, Exercise>();
  
  // Process all rows
  workoutRows.forEach(row => {
    const exerciseName = row['Exercise Name'];
    
    if (!exercisesMap.has(exerciseName)) {
      exercisesMap.set(exerciseName, {
        id: Date.now() + Math.random().toString(36).substring(2, 9),
        name: exerciseName,
        sets: []
      });
    }
    
    const exercise = exercisesMap.get(exerciseName)!;
    
    // Add the set to the exercise
    exercise.sets.push({
      id: Date.now() + Math.random().toString(36).substring(2, 9),
      weight: row.Weight || '0',
      reps: row.Reps || '0'
    });
  });
  
  // Convert exercises map to array
  const exercises = Array.from(exercisesMap.values());
  
  // Format the date
  const formattedDate = formatDate(firstRow.Date);
  
  // Create the workout
  const workout: Workout = {
    id: Date.now() + Math.random().toString(36).substring(2, 9),
    date: formattedDate,
    exercises,
    startTime: formattedDate,
    duration: parseDuration(firstRow.Duration),
    weightUnit: 'lbs' // Always set to lbs (standardized)
  };
  
  return workout;
};

// Import data from Strong CSV
export const importFromStrongCSV = async (csvText: string): Promise<number> => {
  try {
    const rows = parseCSV(csvText);
    const workoutGroups = groupByWorkout(rows);
    const weightUnit = await settingsService.getWeightUnit();
    
    let importedCount = 0;
    
    // Convert each workout group to an app workout
    for (const [_, workoutRows] of workoutGroups) {
      const workout = await convertToAppWorkout(workoutRows, weightUnit);
      
      // Get existing workouts
      const existingWorkouts = await storageService.getWorkouts();
      
      // Check if we already have a workout with this exact date
      const alreadyExists = existingWorkouts.some(
        w => new Date(w.date).getTime() === new Date(workout.date).getTime()
      );
      
      if (!alreadyExists) {
        // Add workout to storage
        const workouts = [...existingWorkouts, workout];
        await storageService.saveWorkoutsList(workouts);
        importedCount++;
        
        // Update exercise history with all exercise names
        for (const exercise of workout.exercises) {
          await storageService.updateExerciseHistory([exercise]);
        }
      }
    }
    
    return importedCount;
  } catch (error) {
    console.error('Error importing from Strong CSV:', error);
    throw error;
  }
}; 