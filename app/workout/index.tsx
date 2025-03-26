import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS } from '../../services/colors';
import { Swipeable, PanGestureHandler, LongPressGestureHandler, State } from 'react-native-gesture-handler';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring, 
  useAnimatedGestureHandler,
  runOnJS
} from 'react-native-reanimated';

// Constants for array sizing
const MAX_EXERCISES = 30; // Choose a reasonable upper limit for exercises
const MAX_SETS_PER_EXERCISE = 30; // Maximum sets per exercise

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

// Add completed field to the Set type if it doesn't exist
interface SetWithCompletion extends storageService.Set {
  completed?: boolean;
}

// Create a separate component for each exercise to avoid hooks in loops
const ExerciseItem = React.memo(({ 
  exercise, 
  exerciseIndex, 
  deleteExercise,
  viewExerciseHistory,
  addSet,
  deleteSet,
  updateWeight,
  updateReps,
  toggleSetCompletion,
  handleSwipeableRef,
  moveExerciseUp,
  moveExerciseDown,
  isFirst,
  isLast
}: { 
  exercise: Exercise;
  exerciseIndex: number;
  deleteExercise: (id: string) => void;
  viewExerciseHistory: (name: string) => void;
  addSet: (exerciseId: string) => void;
  deleteSet: (exerciseId: string, setId: string) => void;
  updateWeight: (exerciseId: string, setId: string, weight: string) => void;
  updateReps: (exerciseId: string, setId: string, reps: string) => void;
  toggleSetCompletion: (exerciseId: string, setId: string) => void;
  handleSwipeableRef: (ref: Swipeable | null, exerciseIndex: number, setIndex: number) => void;
  moveExerciseUp: (exerciseIndex: number) => void;
  moveExerciseDown: (exerciseIndex: number) => void;
  isFirst: boolean;
  isLast: boolean;
}) => {
  // Render a set row with swipe-to-delete
  const renderSet = (set: SetWithCompletion, index: number) => {
    const isCompleted = set.completed;
    
    // Add swipe-to-delete functionality for sets
    const renderRightActions = () => (
      <TouchableOpacity
        style={styles.deleteSetAction}
        onPress={() => deleteSet(exercise.id, set.id)}
      >
        <Text style={styles.deleteSetActionText}>Delete</Text>
      </TouchableOpacity>
    );
    
    return (
      <Swipeable
        key={set.id}
        ref={ref => handleSwipeableRef(ref, exerciseIndex, index)}
        renderRightActions={renderRightActions}
        overshootRight={false}
      >
        <View style={[
          styles.setContainer,
          isCompleted && styles.completedSetContainer
        ]}>
          <View style={styles.inputRow}>
            <Text style={styles.setText}>Set {index + 1}</Text>
            <TextInput
              style={[
                styles.input, 
                styles.smallInput,
                isCompleted && styles.disabledInput
              ]}
              placeholder="Weight"
              keyboardType="numeric"
              value={set.weight}
              onChangeText={(text) => updateWeight(exercise.id, set.id, text)}
              editable={!isCompleted}
            />
            <TextInput
              style={[
                styles.input, 
                styles.smallInput,
                isCompleted && styles.disabledInput
              ]}
              placeholder="Reps"
              keyboardType="numeric"
              value={set.reps}
              onChangeText={(text) => updateReps(exercise.id, set.id, text)}
              editable={!isCompleted}
            />
            <TouchableOpacity
              style={[
                styles.completionCheckbox,
                isCompleted && styles.completionCheckboxChecked
              ]}
              onPress={() => toggleSetCompletion(exercise.id, set.id)}
            >
              {isCompleted && (
                <Ionicons name="checkmark" size={14} color="#FFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Swipeable>
    );
  };

  return (
    <View 
      key={exercise.id} 
      style={styles.exerciseCard}
    >
      <View style={styles.exerciseHeader}>
        <View style={styles.exerciseNameContainer}>
          <Text style={styles.exerciseName}>{exercise.name}</Text>
        </View>
        
        <View style={styles.exerciseActions}>
          <View style={styles.orderButtonsContainer}>
            <TouchableOpacity
              style={[styles.orderButton, isFirst && styles.orderButtonDisabled]}
              onPress={() => !isFirst && moveExerciseUp(exerciseIndex)}
              disabled={isFirst}
            >
              <Ionicons name="chevron-up" size={16} color={isFirst ? COLORS.border : COLORS.primary} />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.orderButton, isLast && styles.orderButtonDisabled]}
              onPress={() => !isLast && moveExerciseDown(exerciseIndex)}
              disabled={isLast}
            >
              <Ionicons name="chevron-down" size={16} color={isLast ? COLORS.border : COLORS.primary} />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => viewExerciseHistory(exercise.name)}
          >
            <Text style={styles.historyButtonText}>History</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => deleteExercise(exercise.id)}
          >
            <Text style={styles.deleteButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.setsContainer}>
        {exercise.sets.map((set, index) => renderSet(set as SetWithCompletion, index))}
      </View>
      
      <TouchableOpacity 
        style={styles.addSetButton}
        onPress={() => addSet(exercise.id)}
      >
        <Text style={styles.buttonText}>Add Set</Text>
      </TouchableOpacity>
    </View>
  );
});

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
  
  // Remove all the drag-and-drop related state and refs
  const swipeableRefs = useRef<Array<Swipeable | null>>([]);
  
  // Reset swipeable refs array when exercises change
  useEffect(() => {
    // Initialize swipeableRefs array
    if (!swipeableRefs.current) {
      swipeableRefs.current = [];
    }
    // Pre-populate with enough elements for all possible exercise-set combinations
    const totalNeeded = MAX_EXERCISES * MAX_SETS_PER_EXERCISE;
    while (swipeableRefs.current.length < totalNeeded) {
      swipeableRefs.current.push(null);
    }
  }, [exercises.length]);
  
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
  const addSet = (exerciseId: string) => {
    setExercises(exercises.map(exercise => 
      exercise.id === exerciseId 
        ? {
            ...exercise,
            sets: [
              ...exercise.sets,
              { id: generateId(), reps: '', weight: '', completed: false }
            ]
          }
        : exercise
    ));
  };

  // Update the reps for a set
  const updateReps = (exerciseId: string, setId: string, value: string) => {
    setExercises(exercises.map(exercise => 
      exercise.id === exerciseId 
        ? {
            ...exercise,
            sets: exercise.sets.map(set => 
              set.id === setId 
                ? { ...set, reps: value }
                : set
            )
          }
        : exercise
    ));
  };

  // Update the weight for a set
  const updateWeight = (exerciseId: string, setId: string, value: string) => {
    setExercises(exercises.map(exercise => 
      exercise.id === exerciseId 
        ? {
            ...exercise,
            sets: exercise.sets.map(set => 
              set.id === setId 
                ? { ...set, weight: value }
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

  // Add a function to toggle completion status of a set
  const toggleSetCompletion = (exerciseId: string, setId: string) => {
    setExercises(exercises.map(exercise => 
      exercise.id === exerciseId 
        ? {
            ...exercise,
            sets: exercise.sets.map(set => 
              set.id === setId 
                ? { ...set, completed: !(set as SetWithCompletion).completed }
                : set
            )
          }
        : exercise
    ));
  };

  // Add functions to move exercises up and down
  const moveExerciseUp = (exerciseIndex: number) => {
    if (exerciseIndex <= 0) return;
    
    const newExercises = [...exercises];
    const temp = newExercises[exerciseIndex];
    newExercises[exerciseIndex] = newExercises[exerciseIndex - 1];
    newExercises[exerciseIndex - 1] = temp;
    
    setExercises(newExercises);
  };
  
  const moveExerciseDown = (exerciseIndex: number) => {
    if (exerciseIndex >= exercises.length - 1) return;
    
    const newExercises = [...exercises];
    const temp = newExercises[exerciseIndex];
    newExercises[exerciseIndex] = newExercises[exerciseIndex + 1];
    newExercises[exerciseIndex + 1] = temp;
    
    setExercises(newExercises);
  };

  // Create a callback for handling swipeable refs  
  const handleSwipeableRef = useCallback((ref: Swipeable | null, exerciseIndex: number, setIndex: number) => {
    if (!swipeableRefs.current) {
      swipeableRefs.current = [];
    }
    
    // Calculate a unique index for this exercise-set combination
    const swipeableIndex = exerciseIndex * MAX_SETS_PER_EXERCISE + setIndex;
    
    // Ensure array is large enough
    while (swipeableRefs.current.length <= swipeableIndex) {
      swipeableRefs.current.push(null);
    }
    
    // Store the ref
    swipeableRefs.current[swipeableIndex] = ref;
  }, []);

  return (
    <View style={styles.container} key={`workout-container-${forceRefreshKey}`}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <View style={styles.topSection}>
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
        </View>
        
        {exercises.length === 0 && (
          <View style={styles.emptyWorkoutContainer}>
            <Ionicons name="barbell-outline" size={60} color={COLORS.primaryLight} />
            <Text style={styles.emptyWorkoutText}>
              Your workout is empty. Add exercises to get started.
            </Text>
          </View>
        )}
        
        <View style={styles.exercisesContainer}>
          {exercises.map((exercise, exerciseIndex) => (
            <ExerciseItem 
              key={exercise.id}
              exercise={exercise}
              exerciseIndex={exerciseIndex}
              deleteExercise={deleteExercise}
              viewExerciseHistory={viewExerciseHistory}
              addSet={addSet}
              deleteSet={deleteSet}
              updateWeight={updateWeight}
              updateReps={updateReps}
              toggleSetCompletion={toggleSetCompletion}
              handleSwipeableRef={handleSwipeableRef}
              moveExerciseUp={moveExerciseUp}
              moveExerciseDown={moveExerciseDown}
              isFirst={exerciseIndex === 0}
              isLast={exerciseIndex === exercises.length - 1}
            />
          ))}
        </View>
        
        {exercises.length > 0 && (
          <View style={styles.actionContainer}>
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
            
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelWorkout}
            >
              <Text style={styles.cancelButtonText}>Cancel Workout</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
      
      {/* ... rest of the component ... */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentContainer: {
    padding: 12,
    paddingTop: 4,
  },
  topSection: {
    marginBottom: 10,
  },
  timerContainer: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  timerLabel: {
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 5,
  },
  timerDisplay: {
    color: COLORS.primary,
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  exercisesContainer: {
    marginBottom: 10,
  },
  addExerciseContainer: {
    flexDirection: 'row',
    marginBottom: 10,
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
    padding: 10,
    marginRight: 10,
    backgroundColor: COLORS.card,
    color: COLORS.text,
    fontSize: 14,
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
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  smallInput: {
    flex: 1,
    marginHorizontal: 4,
    padding: 6,
    fontSize: 14,
    minWidth: 50,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    padding: 10,
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
    fontSize: 14,
  },
  exerciseCard: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  exerciseNameContainer: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  exerciseActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderButtonsContainer: {
    flexDirection: 'column',
    marginRight: 6,
  },
  orderButton: {
    padding: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(30, 136, 229, 0.1)',
    marginVertical: 1,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderButtonDisabled: {
    backgroundColor: 'rgba(200, 200, 200, 0.1)',
  },
  historyButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  historyButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  deleteButton: {
    padding: 6,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 82, 82, 0.1)',
  },
  deleteButtonText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: 'bold',
  },
  setsContainer: {
    marginBottom: 6,
  },
  setContainer: {
    marginBottom: 6,
    borderRadius: 6,
  },
  completedSetContainer: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)', // Light green for completed sets
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.3)',
  },
  setText: {
    fontSize: 14,
    color: COLORS.text,
    width: 40,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  addSetButton: {
    backgroundColor: COLORS.primaryDark,
    padding: 6,
    borderRadius: 6,
    alignItems: 'center',
  },
  completeButton: {
    backgroundColor: COLORS.success,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  cancelButton: {
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelButtonText: {
    color: COLORS.textSecondary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 20,
  },
  completionCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginLeft: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
  },
  completionCheckboxChecked: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  deleteSetAction: {
    backgroundColor: COLORS.error,
    justifyContent: 'center',
    alignItems: 'center',
    width: 70,
    height: '100%',
  },
  deleteSetActionText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  emptyWorkoutContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    backgroundColor: 'rgba(30, 136, 229, 0.05)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(30, 136, 229, 0.2)',
    marginBottom: 15,
  },
  emptyWorkoutText: {
    marginTop: 15,
    fontSize: 14,
    textAlign: 'center',
    color: COLORS.textSecondary,
  },
  disabledInput: {
    backgroundColor: 'rgba(200, 200, 200, 0.3)',
    color: COLORS.textSecondary,
    borderColor: 'rgba(200, 200, 200, 0.5)',
  },
}); 