import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  Button, 
  StyleSheet, 
  TextInput, 
  ScrollView, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator,
  Alert,
  Modal,
  AppState,
  Platform,
  BackHandler
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as storageService from '../../services/storageService';
import * as settingsService from '../../services/settingsService';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS } from '../../services/colors';

// Generate a unique ID
const generateId = () => {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
};

type Exercise = storageService.Exercise;
type Set = storageService.Set;

// Add new types for the best performance data
interface ExerciseSet {
  id: string;
  reps: string;
  weight: string;
  unit?: string;
}

interface BestPerformance {
  workoutId: string;
  date: string;
  weight: string;
  reps: string;
  volume: number;
  setIndex: number;
  allSets: ExerciseSet[];
  weightUnit: string;
}

// Define interface for exercise stats
interface WorkoutStat {
  id: string;
  date: string;
  sets: ExerciseSet[];
  weightUnit?: string;
}

interface BestSet {
  reps: number;
  weight: number;
  unit?: string;
}

interface PersonalBest {
  weight: number;
  reps: number;
  date?: string;
  unit?: string;
}

interface ExerciseStats {
  bestSet?: BestSet;
  bestSetDate?: string;
  estimatedOneRepMax?: number;
  personalBests?: {
    [key: string]: PersonalBest;
  };
  workouts?: WorkoutStat[];
}

export default function WorkoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ exercises?: string, restore?: string }>();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [exerciseStats, setExerciseStats] = useState<ExerciseStats | null>(null);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [hasActiveWorkout, setHasActiveWorkout] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoringWorkout, setRestoringWorkout] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [workoutStarted, setWorkoutStarted] = useState(false);
  const [workoutStartTime, setWorkoutStartTime] = useState<Date | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [bestPerformance, setBestPerformance] = useState<BestPerformance | null>(null);
  const [historyDays, setHistoryDays] = useState(settingsService.DEFAULT_HISTORY_DAYS);
  const [suggestedReps, setSuggestedReps] = useState(settingsService.DEFAULT_SUGGESTED_REPS);
  const [weightUnit, setWeightUnit] = useState<settingsService.WeightUnit>(settingsService.DEFAULT_WEIGHT_UNIT);
  const [forceRefreshKey, setForceRefreshKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'best' | 'suggested'>('history');

  // Save active workout when exercises change
  useEffect(() => {
    if (exercises.length > 0) {
      console.log("Saving active workout from exercises change useEffect");
      // Use timestamp from state if available
      const timestamp = workoutStartTime ? workoutStartTime.toISOString() : new Date().toISOString();
      storageService.saveActiveWorkout(exercises, weightUnit, timestamp).catch(error => {
      console.error('Error saving active workout:', error);
    });
    
      // Start timer when exercises are added and timer not running
      if (!workoutStarted) {
        console.log("Starting timer from exercises change useEffect");
      startWorkoutTimer();
      }
    }
  }, [exercises, weightUnit]);
  
  // Handle hardware back button
  useEffect(() => {
    const backAction = () => {
      if (exercises.length > 0) {
        setShowCancelModal(true);
        return true; // Prevent default behavior
      }
      return false; // Allow default behavior
    };
    
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );
    
    return () => backHandler.remove();
  }, [exercises]);

  // Load settings when component mounts
  useEffect(() => {
    loadSettings();
  }, []);
  
  // Check for active workout when the component mounts
  useEffect(() => {
    const checkActiveWorkout = async () => {
      console.log("Checking for active workout, restore param:", params.restore);
      try {
        const activeWorkout = await storageService.getActiveWorkout();
        console.log("Active workout check result:", 
          activeWorkout ? `Found with ${activeWorkout.exercises?.length || 0} exercises` : "Not found");
        
        if (activeWorkout && activeWorkout.exercises && activeWorkout.exercises.length > 0) {
          setHasActiveWorkout(true);
          
          // If we were directed here from the active workout bar, auto-restore
          if (params.restore === 'true') {
            console.log("Auto-restoring workout from bar click");
            restoreActiveWorkout();
          } else {
            console.log("Showing restore modal");
            setShowRestoreModal(true);
          }
        }
      } catch (error) {
        console.error('Error checking for active workout:', error);
      }
    };

    // Only check for active workout if not loading from template
    if (!params.exercises) {
      checkActiveWorkout();
    } else {
      console.log("Loading from template, not checking active workout");
    }
  }, [params.exercises, params.restore]);

  // Start workout timer with more safeguards
  const startWorkoutTimer = () => {
    console.log("Starting workout timer", { 
      workoutStarted, 
      hasTimer: !!timerIntervalRef.current, 
      existingStartTime: workoutStartTime?.toISOString() 
    });
    
    // Clear any existing timer
    if (timerIntervalRef.current) {
      console.log("Clearing existing timer");
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    
    // Create start time if not already set
    let startTime = workoutStartTime;
    if (!startTime) {
      console.log("Creating new start time");
      startTime = new Date();
      setWorkoutStartTime(startTime);
      setElapsedTime(0);
    } else {
      console.log("Using existing start time", startTime.toISOString());
      // Calculate elapsed time from existing start time
      const now = new Date();
      const initialElapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      setElapsedTime(initialElapsed);
    }
    
    // Start the timer
    setWorkoutStarted(true);
    
    // Create a new timer interval
    console.log("Creating new timer interval");
    timerIntervalRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    
    // Update state in storage with timestamp
    if (exercises.length > 0) {
      console.log("Saving active workout with timestamp", startTime.toISOString());
      storageService.saveActiveWorkout(exercises, weightUnit, startTime.toISOString());
    }
  };

  // Restore active workout
  const restoreActiveWorkout = async () => {
    console.log("Starting workout restoration");
    try {
      setRestoringWorkout(true);
      const activeWorkout = await storageService.getActiveWorkout();
      console.log("Active workout to restore:", 
        activeWorkout ? `Found with ${activeWorkout.exercises?.length || 0} exercises` : "Not found");
      
      if (activeWorkout && activeWorkout.exercises && activeWorkout.exercises.length > 0) {
        // First, set exercises to ensure they're loaded even if other parts fail
        console.log("Setting exercises from active workout");
        setExercises(activeWorkout.exercises);
        
        // Also restore the timer state if we have timestamp
        if (activeWorkout.timestamp) {
          console.log("Restoring timer state from timestamp:", activeWorkout.timestamp);
          const startTime = new Date(activeWorkout.timestamp);
          setWorkoutStartTime(startTime);
          setWorkoutStarted(true);
          
          // Calculate elapsed time
          const now = new Date();
          const initialElapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
          setElapsedTime(initialElapsed);
          
          // Start the timer
          console.log("Starting timer for restored workout");
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
          }
          
          timerIntervalRef.current = setInterval(() => {
            setElapsedTime(prev => prev + 1);
          }, 1000);
        } else {
          // If no timestamp, still start the timer for the restored workout
          console.log("No timestamp found, starting new timer for restored workout");
          startWorkoutTimer();
        }
        
        // Handle weight unit - if different from current, ask if user wants to convert
        if (activeWorkout.weightUnit && activeWorkout.weightUnit !== weightUnit) {
          console.log("Weight unit mismatch:", activeWorkout.weightUnit, "vs", weightUnit);
          Alert.alert(
            'Weight Unit Mismatch',
            `This workout was created using ${activeWorkout.weightUnit.toUpperCase()}. Your current setting is ${weightUnit.toUpperCase()}. Would you like to convert the weights?`,
            [
              {
                text: 'Convert',
                onPress: () => {
                  // Convert weights from saved unit to current unit
                  console.log("Converting weights between units");
                  const convertedExercises = activeWorkout.exercises.map(exercise => ({
                    ...exercise,
                    sets: exercise.sets.map(set => {
                      const numWeight = parseFloat(set.weight) || 0;
                      if (numWeight > 0) {
                        const convertedWeight = settingsService.convertWeight(
                          numWeight, 
                          activeWorkout.weightUnit as settingsService.WeightUnit, 
                          weightUnit
                        );
                        return { ...set, weight: convertedWeight.toString() };
                      }
                      return set;
                    })
                  }));
                  setExercises(convertedExercises);
                  
                  // Save the workout with new units
                  storageService.saveActiveWorkout(convertedExercises, weightUnit, activeWorkout.timestamp);
                }
              },
              {
                text: 'Keep Original',
                onPress: () => {
                  // Just set as is without conversion
                  console.log("Keeping original weight units");
                  setExercises(activeWorkout.exercises);
                  // Save with the original timestamp to keep consistency
                  storageService.saveActiveWorkout(activeWorkout.exercises, weightUnit, activeWorkout.timestamp);
                }
              }
            ]
          );
        }
      } else {
        // If no active workout or empty exercises, show a message
        console.warn('No active workout found or workout has no exercises');
        Alert.alert(
          'No Active Workout',
          'No active workout was found or the workout has no exercises.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error restoring active workout:', error);
      Alert.alert(
        'Error',
        'Failed to restore the active workout. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setRestoringWorkout(false);
      setShowRestoreModal(false);
    }
  };

  // Discard active workout
  const discardActiveWorkout = async () => {
    try {
      await storageService.clearActiveWorkout();
      setShowRestoreModal(false);
    } catch (error) {
      console.error('Error discarding active workout:', error);
    }
  };

  // Load exercise history on mount
  useEffect(() => {
    const loadSuggestions = async () => {
      if (newExerciseName.trim().length > 0) {
        const results = await storageService.searchExercises(newExerciseName);
        setSuggestions(results);
      } else {
        setSuggestions([]);
      }
    };

    loadSuggestions();
  }, [newExerciseName]);

  // Check for exercises from template
  useEffect(() => {
    const loadTemplateExercises = async () => {
      if (params.exercises && typeof params.exercises === 'string') {
        try {
          const templateExercises = JSON.parse(params.exercises);
          
          // For each exercise in the template, get its most recent data
          const populatedExercises = await Promise.all(
            templateExercises.map(async (exercise: Exercise) => {
              const recentData = await storageService.getMostRecentExerciseData(exercise.name);
              if (recentData) {
                // If we have recent data, update the first set
                if (exercise.sets.length > 0) {
                  exercise.sets[0] = {
                    ...exercise.sets[0],
                    reps: recentData.reps,
                    weight: recentData.weight
                  };
                } else {
                  // If no sets exist, create one with the recent data
                  exercise.sets = [{
                    id: generateId(),
                    reps: recentData.reps,
                    weight: recentData.weight
                  }];
                }
              }
              return exercise;
            })
          );
          
          setExercises(populatedExercises);
        } catch (e) {
          console.error('Error parsing exercises from template:', e);
        }
      }
    };

    loadTemplateExercises();
  }, [params.exercises]);

  // Handle exercise name input changes
  const handleExerciseNameChange = (text: string) => {
    setNewExerciseName(text);
    setShowSuggestions(text.trim().length > 0);
  };

  // Select a suggestion
  const selectSuggestion = (suggestion: string) => {
    setNewExerciseName(suggestion);
    setShowSuggestions(false);
  };

  // Add a new exercise
  const addExercise = async () => {
    if (!newExerciseName.trim()) return;
    
    // Get the most recent data for this exercise
    const recentData = await storageService.getMostRecentExerciseData(newExerciseName);
    
    const newExercise: Exercise = {
      id: generateId(),
      name: newExerciseName,
      sets: recentData ? [{
        id: generateId(),
        reps: recentData.reps,
        weight: recentData.weight
      }] : []
    };
    
    setExercises(prev => [...prev, newExercise]);
    setNewExerciseName('');
    setShowSuggestions(false);
  };

  // Add a new set to an exercise
  const addSet = async (exerciseId: string) => {
    // Find the exercise name
    const exercise = exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;

    // Get the most recent data for this exercise
    const recentData = await storageService.getMostRecentExerciseData(exercise.name);
    
    const newSet: Set = {
      id: generateId(),
      reps: recentData?.reps || '',
      weight: recentData?.weight || ''
    };
    
    setExercises(prev => 
      prev.map(ex => ex.id === exerciseId ? { ...ex, sets: [...ex.sets, newSet] } : ex)
    );
  };

  // Update the reps for a set
  const updateReps = (exerciseId: string, setId: string, reps: string) => {
    setExercises(exercises.map(exercise => 
      exercise.id === exerciseId 
        ? {
            ...exercise,
            sets: exercise.sets.map(set => 
              set.id === setId 
                ? { ...set, reps }
                : set
            )
          }
        : exercise
    ));
  };

  // Update the weight for a set
  const updateWeight = (exerciseId: string, setId: string, weight: string) => {
    setExercises(exercises.map(exercise => 
      exercise.id === exerciseId 
        ? {
            ...exercise,
            sets: exercise.sets.map(set => 
              set.id === setId 
                ? { ...set, weight }
                : set
            )
          }
        : exercise
    ));
  };

  // Delete an exercise from the workout
  const deleteExercise = (exerciseId: string) => {
    setExercises(exercises.filter(exercise => exercise.id !== exerciseId));
  };

  // Delete a set from an exercise
  const deleteSet = (exerciseId: string, setId: string) => {
    setExercises(exercises.map(exercise => 
      exercise.id === exerciseId 
        ? {
            ...exercise,
            sets: exercise.sets.filter(set => set.id !== setId)
          }
        : exercise
    ));
  };

  // Start timer when component mounts
  useEffect(() => {
    // Start the timer when the screen is first loaded
    startWorkoutTimer();
    
    // Cleanup interval on unmount
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  // Handle workflow cancel with confirmation
  const handleCancelWorkout = () => {
    setShowCancelModal(true);
  };

  // Confirm cancellation
  const confirmCancelWorkout = async () => {
    try {
      // Clear active workout in storage
      await storageService.clearActiveWorkout();
      
      // Reset form state
      setExercises([]);
      setWorkoutStarted(false);
      
      // Close modal
      setShowCancelModal(false);
      
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      
      // Navigate back to home screen
      router.replace("/");
    } catch (error) {
      console.error('Error cancelling workout:', error);
      Alert.alert('Error', 'Failed to cancel workout');
    }
  };
  
  // Format time as HH:MM:SS
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ].join(':');
  };
  
  // Save workout function with time tracking
  const handleSaveWorkout = async () => {
    try {
      setSaving(true);
      
      // Calculate workout duration in seconds
      const duration = elapsedTime;
      
      const workoutId = await storageService.saveWorkout(exercises, {
        startTime: workoutStartTime ? workoutStartTime.toISOString() : new Date().toISOString(),
        duration: duration
      }, weightUnit); // Pass the current weight unit to store
      
      // Clear the active workout
      await storageService.clearActiveWorkout();
      
      setSaving(false);
      setWorkoutStarted(false);
      setWorkoutStartTime(null);
      setElapsedTime(0);
      
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }

      // Use replace instead of push to prevent going back to the workout screen
      // @ts-ignore - Suppressing type error for navigation path
      router.replace({
        pathname: "/workout-details/[id]",
        params: { id: workoutId }
      });
    } catch (error) {
      console.error('Error saving workout:', error);
      Alert.alert('Error', 'Failed to save workout');
      setSaving(false);
    }
  };

  // Load settings when component mounts
  const loadSettings = async () => {
    try {
      const days = await settingsService.getHistoryDays();
      setHistoryDays(days);
      
      const reps = await settingsService.getSuggestedReps();
      setSuggestedReps(reps);
      
      const unit = await settingsService.getWeightUnit();
      setWeightUnit(unit);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };
  
  // Calculate estimated one rep max using the formula: weight / (1.0278 - 0.0278 × reps)
  const calculateOneRepMax = (weight: number, reps: number): number => {
    if (weight <= 0 || reps <= 0) return 0;
    return weight / (1.0278 - 0.0278 * reps);
  };
  
  // Calculate suggested weight for target reps based on 1RM
  const calculateSuggestedWeight = (oneRepMax: number, targetReps: number): number => {
    if (oneRepMax <= 0 || targetReps <= 0) return 0;
    return oneRepMax * (1.0278 - 0.0278 * targetReps);
  };

  // Format weight with appropriate unit
  const formatWeight = (weight: string | number): string => {
    if (typeof weight === 'string') {
      weight = parseFloat(weight) || 0;
    }
    return `${weight.toFixed(1)} ${weightUnit}`;
  };
  
  // Convert weight for display if needed
  const displayWeight = (weight: string | number, workoutWeightUnit?: string): number => {
    let numWeight: number;
    if (typeof weight === 'string') {
      numWeight = parseFloat(weight) || 0;
    } else {
      numWeight = weight;
    }
    
    // No conversion needed if workout was stored in current unit
    if (!workoutWeightUnit || workoutWeightUnit === weightUnit) {
      return numWeight;
    }
    
    // Convert from workout's unit to display unit
    return settingsService.convertWeight(
      numWeight, 
      workoutWeightUnit as settingsService.WeightUnit, 
      weightUnit
    );
  };

  // View exercise history - updated to match exercise history page
  const viewExerciseHistory = async (exerciseName: string) => {
    setSelectedExercise(exerciseName);
    setLoading(true);
    
    console.log(`Loading exercise history for: ${exerciseName}`);
    
    try {
      // Get exercise stats from workouts
      const workoutStats = await storageService.getExerciseStatsByWorkout(exerciseName, historyDays);
      console.log(`Found ${workoutStats.length} workout stats`);
      
      // Get best performance (highest volume)
      const best = await storageService.getBestPerformance(exerciseName, historyDays);
      console.log('Best performance:', best ? 'Found' : 'None found');
      
      // Create new exerciseStats object with the same structure as the main exercise history page
      const stats: ExerciseStats = { workouts: workoutStats };
      
      if (best) {
        // Ensure weightUnit has a default value
        const bestWithWeightUnit = {
          ...best,
          weightUnit: best.weightUnit || 'kg'
        };
        setBestPerformance(bestWithWeightUnit);
        
        // Add best set to stats
        stats.bestSet = {
          reps: parseFloat(best.reps),
          weight: parseFloat(best.weight),
          unit: best.weightUnit || 'kg'
        };
        stats.bestSetDate = best.date;
        
        // Calculate estimated 1RM
        const oneRepMax = calculateOneRepMax(parseFloat(best.weight), parseFloat(best.reps));
        stats.estimatedOneRepMax = oneRepMax;
        
        // Process personal bests by rep ranges
        const personalBests: { [key: string]: PersonalBest } = {};
        for (const workout of workoutStats) {
          for (const set of workout.sets) {
            const reps = set.reps;
            const weight = parseFloat(set.weight);
            
            if (!personalBests[reps] || weight > personalBests[reps].weight) {
              personalBests[reps] = {
                weight: weight,
                reps: parseFloat(reps),
                date: workout.date,
                unit: workout.weightUnit || 'kg'
              };
            }
          }
        }
        stats.personalBests = personalBests;
      } else {
        setBestPerformance(null);
      }
      
      // Set the exerciseStats state with our properly structured data
      setExerciseStats(stats);
      
      // Show the modal
      setShowStatsModal(true);
    } catch (error) {
      console.error('Error getting exercise stats:', error);
      Alert.alert('Error', 'Failed to load exercise history');
    } finally {
      setLoading(false);
    }
  };

  // Navigate to full exercise history screen
  const navigateToExerciseHistory = (exerciseName: string) => {
    // Navigate to exercise history screen with the selected exercise
    // @ts-ignore - Suppressing type error for navigation path
    router.push(`/exercise-history?selectedExercise=${encodeURIComponent(exerciseName)}`);
  };

  // Format date for stats
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Use focus effect to force reload the workout when screen is focused
  useFocusEffect(
    useCallback(() => {
      console.log("Screen focused, checking if restore needed");
      if (params.restore === 'true') {
        console.log("Force restoring workout from focus effect");
        forceRestoreWorkout();
      }
      
      return () => {
        // Cleanup on unfocus if needed
      };
    }, [params.restore])
  );

  // Force restore the active workout regardless of current state
  const forceRestoreWorkout = async () => {
    console.log("Force restoring workout");
    try {
      const activeWorkout = await storageService.getActiveWorkout();
      console.log("Force restore: active workout found:", 
        activeWorkout ? `Found with ${activeWorkout.exercises?.length || 0} exercises` : "Not found");
      
      if (activeWorkout && activeWorkout.exercises && activeWorkout.exercises.length > 0) {
        // First reset all related state
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        
        // Set exercises from active workout
        setExercises(activeWorkout.exercises);
        
        // Restore timer state
        if (activeWorkout.timestamp) {
          console.log("Force restore: Setting timer from timestamp:", activeWorkout.timestamp);
          const startTime = new Date(activeWorkout.timestamp);
          setWorkoutStartTime(startTime);
          setWorkoutStarted(true);
          
          // Calculate elapsed time
          const now = new Date();
          const initialElapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
          setElapsedTime(initialElapsed);
          
          // Start a new timer
          timerIntervalRef.current = setInterval(() => {
            setElapsedTime(prev => prev + 1);
          }, 1000);
        } else {
          // Start a new timer if no timestamp
          const now = new Date();
          setWorkoutStartTime(now);
          setWorkoutStarted(true);
          setElapsedTime(0);
          
          timerIntervalRef.current = setInterval(() => {
            setElapsedTime(prev => prev + 1);
          }, 1000);
          
          // Save with the new timestamp
          storageService.saveActiveWorkout(activeWorkout.exercises, weightUnit, now.toISOString());
        }
        
        // Force a re-render by changing the key
        setForceRefreshKey(prev => prev + 1);
      } else {
        console.warn('No active workout found to force restore');
      }
    } catch (error) {
      console.error('Error force restoring workout:', error);
    }
  };

  // Function to handle going back to the main screen
  const handleBack = () => {
    // If there's an active workout, confirm before navigating away
    if (exercises.length > 0) {
      setShowCancelModal(true);
    } else {
      router.back();
    }
  };

  // Save the active workout with current timer state
  const saveActiveWorkoutState = async () => {
    // If workout has exercises and timer is running, save with timestamp
    if (exercises.length > 0) {
      try {
        // If timer is running, make sure we have a start time
        if (workoutStarted && !workoutStartTime) {
          const now = new Date();
          setWorkoutStartTime(now);
          await storageService.saveActiveWorkout(exercises, weightUnit, now.toISOString());
        } else if (workoutStarted && workoutStartTime) {
          // Timer is running and we have a start time
          await storageService.saveActiveWorkout(exercises, weightUnit, workoutStartTime.toISOString());
        } else {
          // No timer but we have exercises
          await storageService.saveActiveWorkout(exercises, weightUnit);
        }
        
        console.log('Workout state saved successfully with timestamp');
      } catch (error) {
        console.error('Error saving workout state:', error);
      }
    }
  };

  // Use effect to autosave the workout state every minute
  useEffect(() => {
    // Set up autosave interval
    const autosaveInterval = setInterval(() => {
      if (exercises.length > 0) {
        saveActiveWorkoutState();
      }
    }, 60000); // Save every minute
    
    return () => {
      clearInterval(autosaveInterval);
    };
  }, [exercises, workoutStarted, workoutStartTime, weightUnit]);

  // Use effect to save when exercises change
  useEffect(() => {
    // Don't save if exercises are empty (e.g., just initialized)
    if (exercises.length > 0) {
      saveActiveWorkoutState();
    }
  }, [exercises]);

  // Handle back button press
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (exercises.length > 0) {
        setShowCancelModal(true);
        return true; // Prevent default behavior
      }
      return false; // Allow default behavior
    });
    
    return () => backHandler.remove();
  }, [exercises]);
  
  // Continue workout without canceling
  const continueWorkout = () => {
    setShowCancelModal(false);
  };
  
  return (
    <View style={styles.container} key={`workout-container-${forceRefreshKey}`}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Workout</Text>
        <View style={styles.headerRight} />
      </View>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <Text style={styles.title}>Workout Session</Text>
        
        {workoutStarted && (
          <View style={styles.timerContainer}>
            <Text style={styles.timerLabel}>Workout Time</Text>
            <Text style={styles.timerDisplay}>{formatTime(elapsedTime)}</Text>
          </View>
        )}
      
        <View style={styles.addExerciseContainer}>
          <View style={styles.autocompleteContainer}>
            <TextInput
              style={styles.input}
              placeholder="Enter exercise name"
              value={newExerciseName}
              onChangeText={handleExerciseNameChange}
              onFocus={() => setShowSuggestions(newExerciseName.trim().length > 0)}
            />
            
            {showSuggestions && suggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                <FlatList
                  data={suggestions}
                  keyExtractor={(item) => item}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.suggestionItem}
                      onPress={() => selectSuggestion(item)}
                    >
                      <Text>{item}</Text>
                    </TouchableOpacity>
                  )}
                  style={styles.suggestionsList}
                />
              </View>
            )}
          </View>
          
          <TouchableOpacity 
            style={styles.addButton}
            onPress={addExercise}
          >
            <Text style={styles.buttonText}>Add</Text>
          </TouchableOpacity>
        </View>
        
        {exercises.map(exercise => (
          <View key={exercise.id} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseName}>{exercise.name}</Text>
              <View style={styles.exerciseActions}>
                <TouchableOpacity
                  style={styles.historyButton}
                  onPress={() => viewExerciseHistory(exercise.name)}
                >
                  <Text style={styles.historyButtonText}>View History</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteExercise(exercise.id)}
                >
                  <Text style={styles.deleteButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            {exercise.sets.map((set, index) => (
              <View key={set.id} style={styles.setContainer}>
                <View style={styles.setHeader}>
                  <Text style={styles.setText}>Set {index + 1}</Text>
                  <TouchableOpacity
                    style={styles.deleteSetButton}
                    onPress={() => deleteSet(exercise.id, set.id)}
                  >
                    <Text style={styles.deleteButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.inputRow}>
                  <TextInput
                    style={[styles.input, styles.smallInput]}
                    placeholder="Reps"
                    keyboardType="numeric"
                    value={set.reps}
                    onChangeText={(text) => updateReps(exercise.id, set.id, text)}
                  />
                  <TextInput
                    style={[styles.input, styles.smallInput]}
                    placeholder="Weight"
                    keyboardType="numeric"
                    value={set.weight}
                    onChangeText={(text) => updateWeight(exercise.id, set.id, text)}
                  />
                </View>
              </View>
            ))}
            
            <TouchableOpacity 
              style={styles.addSetButton}
              onPress={() => addSet(exercise.id)}
            >
              <Text style={styles.buttonText}>Add Set</Text>
            </TouchableOpacity>
          </View>
        ))}
        
        {exercises.length > 0 && (
          <TouchableOpacity 
            style={styles.completeButton}
            onPress={handleSaveWorkout}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.buttonText}>Complete Workout</Text>
            )}
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancelWorkout}
        >
          <Text style={styles.cancelButtonText}>Cancel Workout</Text>
        </TouchableOpacity>
      </ScrollView>
      
      {/* Cancel Workout Confirmation */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showCancelModal}
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContent}>
            <Text style={styles.confirmModalTitle}>Workout in Progress</Text>
            <Text style={styles.confirmModalText}>
              What would you like to do with your current workout?
            </Text>
            
            <View style={styles.confirmButtonColumn}>
              <TouchableOpacity 
                style={styles.continueButton}
                onPress={continueWorkout}
              >
                <Text style={styles.continueButtonText}>Continue Workout</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.saveButton}
                onPress={() => {
                  setShowCancelModal(false);
                  handleSaveWorkout();
                }}
              >
                <Text style={styles.saveButtonText}>Save and Complete</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.saveExitButton}
                onPress={() => {
                  setShowCancelModal(false);
                  router.back();
                }}
              >
                <Text style={styles.saveExitButtonText}>Save and Exit</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.discardButton}
                onPress={confirmCancelWorkout}
              >
                <Text style={styles.discardButtonText}>Discard Workout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Restore Workout Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showRestoreModal}
        onRequestClose={() => setShowRestoreModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Resume Workout</Text>
            <Text style={styles.modalSubtitle}>
              You have an unfinished workout. Would you like to resume where you left off?
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.discardButton}
                onPress={discardActiveWorkout}
                disabled={restoringWorkout}
              >
                <Text style={styles.discardButtonText}>Discard</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.resumeButton}
                onPress={restoreActiveWorkout}
                disabled={restoringWorkout}
              >
                {restoringWorkout ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.resumeButtonText}>Resume</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Exercise Stats Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showStatsModal}
        onRequestClose={() => setShowStatsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%', height: '90%' }]}>
            <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
                {selectedExercise}
            </Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowStatsModal(false)}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            {/* Tabs */}
            <View style={styles.tabsContainer}>
              {(['history', 'best', 'suggested'] as Array<'history' | 'best' | 'suggested'>).map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[
                    styles.tab,
                    activeTab === tab ? styles.activeTab : null
                  ]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Ionicons 
                    name={tab === 'history' ? 'time-outline' : tab === 'best' ? 'trophy-outline' : 'analytics-outline'} 
                    size={20} 
                    color={activeTab === tab ? '#fff' : '#757575'} 
                    style={styles.tabIcon}
                  />
                  <Text 
                    style={[
                      styles.tabText,
                      activeTab === tab ? styles.activeTabText : null
                    ]}
                  >
                    {tab === 'history' ? 'History' : tab === 'best' ? 'Personal Records' : 'Suggested Weights'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Tab Content */}
            <View style={{ flex: 1, padding: 0 }}>
              {loading ? (
                <ActivityIndicator size="large" color="#1E88E5" style={{ marginTop: 40 }} />
              ) : !exerciseStats ? (
                <View style={styles.emptyTabContainer}>
                  <Text style={styles.noStatsText}>
                    {selectedExercise ? 'No data available' : 'No exercise selected'}
                  </Text>
                </View>
              ) : (
                <>
                  {activeTab === 'history' && (
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 15 }}>
                      {exerciseStats.workouts && exerciseStats.workouts.length > 0 ? (
                        exerciseStats.workouts.map((workout, workoutIndex) => (
                          <View key={`workout-${workoutIndex}`} style={styles.workoutContainer}>
                            <View style={styles.workoutHeader}>
                              <Text style={styles.workoutDate}>
                                {new Date(workout.date).toLocaleDateString()}
                              </Text>
                            </View>
                            
                            <View style={styles.statsHeader}>
                              <Text style={styles.statsHeaderText}>Set</Text>
                              <Text style={styles.statsHeaderText}>Reps</Text>
                              <Text style={styles.statsHeaderText}>Weight</Text>
                            </View>
                            
                            {workout.sets.map((set, setIndex) => (
                              <View 
                                key={`set-${setIndex}`} 
                                style={styles.statsRow}
                              >
                                <Text style={styles.statsCell}>{setIndex + 1}</Text>
                                <Text style={styles.statsCell}>{set.reps || '-'}</Text>
                                <Text style={styles.statsCell}>
                                  {set.weight} {workout.weightUnit || 'kg'}
                                </Text>
                              </View>
                            ))}
                          </View>
                        ))
                      ) : (
                        <View style={styles.emptyTabContainer}>
                          <Ionicons name="time-outline" size={60} color="#E3F2FD" />
                          <Text style={styles.noStatsText}>No workout history found</Text>
                          <Text style={styles.emptyListSubtext}>
                            Complete workouts with this exercise to see your history
                          </Text>
                        </View>
                      )}
                    </ScrollView>
                  )}
                  
                  {activeTab === 'best' && (
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 15 }}>
                      {exerciseStats.bestSet ? (
                        <>
              <View style={styles.bestPerformanceContainer}>
                            <View style={styles.bestPerformanceBadge}>
                              <Ionicons name="trophy" size={16} color="#fff" />
                              <Text style={styles.bestPerformanceBadgeText}>PERSONAL BEST</Text>
                            </View>
                            
                            <Text style={styles.bestPerformanceTitle}>Best Overall Set</Text>
                            {exerciseStats.bestSetDate && (
                <Text style={styles.bestPerformanceDate}>
                                {new Date(exerciseStats.bestSetDate).toLocaleDateString()}
                </Text>
                            )}
                
                <View style={styles.bestPerformanceTable}>
                  <View style={styles.bestPerformanceTableHeader}>
                    <Text style={styles.bestPerformanceHeaderCell}>Set</Text>
                    <Text style={styles.bestPerformanceHeaderCell}>Reps</Text>
                    <Text style={styles.bestPerformanceHeaderCell}>Weight</Text>
                    <Text style={styles.bestPerformanceHeaderCell}>Volume</Text>
                  </View>
                  
                              <View style={[styles.bestPerformanceRow, styles.bestPerformanceHighlight]}>
                                <Text style={styles.bestPerformanceCell}>1</Text>
                                <Text style={styles.bestPerformanceCell}>{exerciseStats.bestSet.reps}</Text>
                        <Text style={styles.bestPerformanceCell}>
                                  {exerciseStats.bestSet.weight}{exerciseStats.bestSet.unit}
                        </Text>
                                <Text style={styles.bestPerformanceCell}>
                                  {(exerciseStats.bestSet.reps * exerciseStats.bestSet.weight).toFixed(1)}
                                  {exerciseStats.bestSet.unit}
                                </Text>
                      </View>
                </View>
                
                            <Text style={styles.bestPerformanceNote}>
                              This is your highest volume set (weight × reps)
                        </Text>
                      </View>
                      
                          {exerciseStats.estimatedOneRepMax && exerciseStats.estimatedOneRepMax > 0 && (
                            <View style={styles.oneRepMaxContainer}>
                              <Text style={styles.oneRepMaxTitle}>Estimated 1-Rep Max</Text>
                              <Text style={styles.oneRepMaxValue}>
                                {exerciseStats.estimatedOneRepMax.toFixed(1)}{exerciseStats.bestSet.unit || 'kg'}
                        </Text>
                              <Text style={styles.oneRepMaxDescription}>
                                Based on your best set using the Brzycki formula
                        </Text>
                      </View>
                          )}

                          {exerciseStats.personalBests && Object.keys(exerciseStats.personalBests).length > 0 && (
                            <View style={styles.bestPerformanceContainer}>
                              <Text style={styles.bestPerformanceTitle}>Best Lifts By Rep Range</Text>
                              
                              <View style={styles.bestPerformanceTable}>
                                <View style={styles.bestPerformanceTableHeader}>
                                  <Text style={styles.bestPerformanceHeaderCell}>Reps</Text>
                                  <Text style={styles.bestPerformanceHeaderCell}>Weight</Text>
                                  <Text style={styles.bestPerformanceHeaderCell}>Date</Text>
                    </View>
                                
                                {Object.entries(exerciseStats.personalBests)
                                  .sort(([repsA], [repsB]) => parseInt(repsA) - parseInt(repsB))
                                  .map(([reps, best]) => (
                                    <View key={reps} style={styles.bestPerformanceRow}>
                                      <Text style={styles.bestPerformanceCell}>{reps}</Text>
                                      <Text style={styles.bestPerformanceCell}>
                                        {best.weight.toFixed(1)}{best.unit}
                                      </Text>
                                      <Text style={styles.bestPerformanceCell}>
                                        {best.date ? new Date(best.date).toLocaleDateString() : 'N/A'}
                </Text>
              </View>
                                  ))}
                              </View>
                            </View>
                          )}
                        </>
                      ) : (
                        <View style={styles.emptyTabContainer}>
                          <Ionicons name="trophy-outline" size={60} color="#E3F2FD" />
                          <Text style={styles.noStatsText}>No personal records yet</Text>
                          <Text style={styles.emptyListSubtext}>
                            Complete more workouts with this exercise to see your best lifts
                          </Text>
                        </View>
                      )}
                    </ScrollView>
                  )}
                  
                  {activeTab === 'suggested' && (
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 15 }}>
                      {exerciseStats.estimatedOneRepMax && exerciseStats.estimatedOneRepMax > 0 ? (
                        <>
                          <View style={styles.oneRepMaxContainer}>
                            <Text style={styles.oneRepMaxTitle}>Estimated 1-Rep Max</Text>
                            <Text style={styles.oneRepMaxValue}>
                              {exerciseStats.estimatedOneRepMax.toFixed(1)}
                              {exerciseStats.bestSet?.unit || 'kg'}
                            </Text>
                            <Text style={styles.oneRepMaxDescription}>
                              Based on your best performance using the Brzycki formula
                      </Text>
                    </View>
                    
                          <View style={styles.suggestedWeightsContainer}>
                            <Text style={styles.suggestedWeightsTitle}>Suggested Weights</Text>
                            <Text style={styles.suggestedWeightsDescription}>
                              Based on your estimated 1-rep max
                            </Text>
                            
                            <View style={styles.suggestedWeightsTable}>
                              <View style={styles.suggestedWeightsHeader}>
                                <Text style={styles.suggestedWeightsHeaderCell}>Reps</Text>
                                <Text style={styles.suggestedWeightsHeaderCell}>
                                  Weight ({exerciseStats.bestSet?.unit || 'kg'})
                                </Text>
                                <Text style={styles.suggestedWeightsHeaderCell}>% of 1RM</Text>
                    </View>
                    
                              {[1, 2, 3, 5, 8, 10, 12, 15].map(reps => {
                                const suggestedWeight = calculateSuggestedWeight(
                                  exerciseStats.estimatedOneRepMax || 0, 
                                  reps
                                );
                                const percentage = (suggestedWeight / (exerciseStats.estimatedOneRepMax || 1)) * 100;
                      
                      return (
                                  <View key={`reps-${reps}`} style={styles.suggestedWeightsRow}>
                                    <Text style={styles.suggestedWeightsCell}>{reps}</Text>
                                    <Text style={styles.suggestedWeightsCell}>
                                      {suggestedWeight.toFixed(1)}
                                    </Text>
                                    <Text style={styles.suggestedWeightsCell}>
                                      {percentage.toFixed(0)}%
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                            
                            <Text style={styles.suggestedWeightsNote}>
                              These are theoretical values and may vary based on individual factors.
                              Always start with a weight you can safely handle.
                            </Text>
                          </View>
                        </>
                      ) : (
                        <View style={styles.emptyTabContainer}>
                          <Ionicons name="analytics-outline" size={60} color="#E3F2FD" />
                          <Text style={styles.noStatsText}>No data available for suggestions</Text>
                          <Text style={styles.emptyListSubtext}>
                            Complete more workouts with this exercise
                          </Text>
                        </View>
                      )}
              </ScrollView>
            )}
            
            <TouchableOpacity 
              style={styles.viewFullHistoryButton}
              onPress={() => {
                setShowStatsModal(false);
                navigateToExerciseHistory(selectedExercise);
              }}
            >
              <Text style={styles.viewFullHistoryButtonText}>View Full History</Text>
            </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingBottom: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    zIndex: 10,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  timerContainer: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  timerLabel: {
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 5,
  },
  timerDisplay: {
    color: COLORS.primary,
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  contentContainer: {
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: COLORS.text,
  },
  addExerciseContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'center',
  },
  autocompleteContainer: {
    flex: 1,
    position: 'relative',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    marginRight: 10,
    backgroundColor: COLORS.card,
    color: COLORS.text,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 45,
    left: 0,
    right: 10,
    zIndex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    maxHeight: 150,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  suggestionsList: {
    width: '100%',
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  smallInput: {
    flex: 1,
    marginRight: 5,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    padding: 12,
    borderRadius: 8,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  exerciseCard: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    color: COLORS.text,
  },
  exerciseActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  historyButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 82, 82, 0.1)',
  },
  deleteButtonText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: 'bold',
  },
  setContainer: {
    marginBottom: 10,
  },
  setHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  setText: {
    fontSize: 16,
    flex: 1,
    color: COLORS.text,
  },
  deleteSetButton: {
    padding: 6,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 82, 82, 0.1)',
  },
  inputRow: {
    flexDirection: 'row',
  },
  addSetButton: {
    backgroundColor: COLORS.primaryDark,
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 5,
  },
  completeButton: {
    backgroundColor: COLORS.success,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 20,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  cancelButton: {
    backgroundColor: COLORS.background,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelButtonText: {
    color: COLORS.textSecondary,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 20,
    width: '85%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 15,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 5,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  activeTab: {
    backgroundColor: COLORS.primary,
  },
  tabIcon: {
    marginRight: 6,
  },
  tabText: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    color: COLORS.textSecondary,
  },
  activeTabText: {
    color: COLORS.card,
  },
  emptyTabContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noStatsText: {
    textAlign: 'center',
    padding: 20,
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  emptyListSubtext: {
    textAlign: 'center',
    padding: 20,
    color: COLORS.textSecondary,
  },
  workoutContainer: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: COLORS.card,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  workoutHeader: {
    backgroundColor: COLORS.primaryLight,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  workoutDate: {
    fontWeight: 'bold',
    fontSize: 14,
    color: COLORS.text,
  },
  statsHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.primaryLight,
    paddingVertical: 12,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  statsHeaderText: {
    flex: 1,
    fontWeight: 'bold',
    textAlign: 'center',
    color: COLORS.secondary,
  },
  statsRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statsCell: {
    flex: 1,
    textAlign: 'center',
    color: COLORS.text,
  },
  bestPerformanceContainer: {
    marginVertical: 15,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  bestPerformanceBadge: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    alignSelf: 'center',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginBottom: 15,
    alignItems: 'center',
  },
  bestPerformanceBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.card,
    marginLeft: 6,
  },
  bestPerformanceTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: COLORS.primary,
    textAlign: 'center',
  },
  bestPerformanceDate: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  bestPerformanceTable: {
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  bestPerformanceTableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.primaryLight,
    paddingVertical: 12,
  },
  bestPerformanceHeaderCell: {
    flex: 1,
    fontWeight: 'bold',
    textAlign: 'center',
    color: COLORS.secondary,
  },
  bestPerformanceRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  bestPerformanceHighlight: {
    backgroundColor: 'rgba(30, 136, 229, 0.1)',
  },
  bestPerformanceCell: {
    flex: 1,
    textAlign: 'center',
    color: COLORS.text,
  },
  bestPerformanceNote: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 10,
  },
  oneRepMaxContainer: {
    marginTop: 15,
    padding: 20,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  oneRepMaxTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: COLORS.secondary,
  },
  oneRepMaxValue: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    color: COLORS.primary,
  },
  oneRepMaxDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  suggestedWeightsContainer: {
    marginVertical: 15,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  suggestedWeightsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: COLORS.primary,
    textAlign: 'center',
  },
  suggestedWeightsDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 15,
  },
  suggestedWeightsTable: {
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  suggestedWeightsHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.primaryLight,
    paddingVertical: 12,
    paddingHorizontal: 5,
  },
  suggestedWeightsHeaderCell: {
    flex: 1,
    fontWeight: 'bold',
    textAlign: 'center',
    color: COLORS.secondary,
  },
  suggestedWeightsRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  suggestedWeightsCell: {
    flex: 1,
    textAlign: 'center',
    color: COLORS.text,
  },
  suggestedWeightsNote: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 15,
    fontStyle: 'italic',
  },
  viewFullHistoryButton: {
    backgroundColor: COLORS.primary,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    marginHorizontal: 20,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  viewFullHistoryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  confirmModalContent: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 20,
    width: '85%',
    maxWidth: 400,
  },
  confirmModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: COLORS.text,
  },
  confirmModalText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    color: COLORS.textSecondary,
  },
  confirmButtonColumn: {
    alignItems: 'stretch',
  },
  continueButton: {
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  continueButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: COLORS.success,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  saveExitButton: {
    backgroundColor: COLORS.secondary,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  saveExitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  discardButton: {
    backgroundColor: '#f8f8f8',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  discardButtonText: {
    color: 'red',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 15,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
  },
  resumeButton: {
    backgroundColor: COLORS.primary,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    width: '48%',
  },
  resumeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
}); 