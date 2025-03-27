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
  BackHandler,
  StatusBar
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as storageService from '../../services/storageService';
import * as settingsService from '../../services/settingsService';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../services/colors';
import { Swipeable, PanGestureHandler, LongPressGestureHandler, State } from 'react-native-gesture-handler';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring, 
  useAnimatedGestureHandler,
  runOnJS
} from 'react-native-reanimated';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

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
  weightUnit?: string;
}

// Define interface for exercise stats
interface WorkoutStat {
  id: string;
  date: string;
  sets: ExerciseSet[];
  weightUnit?: string;
  totalVolume?: number;
  maxWeight?: number;
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
  addSet,
  deleteSet,
  updateWeight,
  updateReps,
  toggleSetCompletion,
  handleSwipeableRef,
  moveExerciseUp,
  moveExerciseDown,
  isFirst,
  isLast,
  onViewHistory
}: { 
  exercise: Exercise;
  exerciseIndex: number;
  deleteExercise: (id: string) => void;
  addSet: (exerciseId: string) => Promise<void>;
  deleteSet: (exerciseId: string, setId: string) => void;
  updateWeight: (exerciseId: string, setId: string, weight: string) => void;
  updateReps: (exerciseId: string, setId: string, reps: string) => void;
  toggleSetCompletion: (exerciseId: string, setId: string) => void;
  handleSwipeableRef: (ref: Swipeable | null, exerciseIndex: number, setIndex: number) => void;
  moveExerciseUp: (exerciseIndex: number) => void;
  moveExerciseDown: (exerciseIndex: number) => void;
  isFirst: boolean;
  isLast: boolean;
  onViewHistory: (exerciseName: string) => void;
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
              selectTextOnFocus={true}
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
              selectTextOnFocus={true}
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
          
          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => {
              console.log(`Button pressed for ${exercise.name}`);
              onViewHistory(exercise.name);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="time-outline" size={12} color="#fff" style={{ marginRight: 4 }} />
            <Text style={styles.historyButtonText}>History</Text>
          </TouchableOpacity>
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
        onPress={() => {
          addSet(exercise.id).catch(error => 
            console.error(`Error adding set to ${exercise.name}:`, error)
          );
        }}
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
  const [hasActiveWorkout, setHasActiveWorkout] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoringWorkout, setRestoringWorkout] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [workoutStarted, setWorkoutStarted] = useState(false);
  const [workoutStartTime, setWorkoutStartTime] = useState<Date | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [historyDays, setHistoryDays] = useState(settingsService.DEFAULT_HISTORY_DAYS);
  const [suggestedReps, setSuggestedReps] = useState(settingsService.DEFAULT_SUGGESTED_REPS);
  const [weightUnit, setWeightUnit] = useState<settingsService.WeightUnit>(settingsService.DEFAULT_WEIGHT_UNIT);
  const [forceRefreshKey, setForceRefreshKey] = useState(0);
  
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
          
          // For each exercise in the template, populate with best sets
          const populatedExercises = await Promise.all(
            templateExercises.map(async (exercise: Exercise) => {
              // First try to get best performance data
              const bestPerformance = await storageService.getBestPerformance(exercise.name, historyDays);
              
              // Create new sets array to replace template's empty sets
              const newSets: SetWithCompletion[] = [];
              
              if (bestPerformance && bestPerformance.allSets && bestPerformance.allSets.length > 0) {
                // Use best sets data to populate exercise sets
                console.log(`Using best sets data for template exercise: ${exercise.name}`);
                
                // Take the number of sets from template, or use all best sets if template had no sets
                const setsToCreate = Math.max(exercise.sets.length, bestPerformance.allSets.length);
                
                // Create each set from best performance data
                for (let i = 0; i < setsToCreate; i++) {
                  if (i < bestPerformance.allSets.length) {
                    // If we have data for this set in best performance, use it
                    const bestSet = bestPerformance.allSets[i];
                    newSets.push({
                      id: generateId(),
                      reps: bestSet.reps,
                      weight: bestSet.weight,
                      completed: false
                    });
                  } else {
                    // Otherwise add an empty set
                    newSets.push({
                      id: generateId(),
                      reps: '',
                      weight: '',
                      completed: false
                    });
                  }
                }
              } else {
                // Fall back to most recent data if no best performance
                const recentData = await storageService.getMostRecentExerciseData(exercise.name);
                
                if (recentData) {
                  // If we have at least some recent data, use it for the first set
                  newSets.push({
                    id: generateId(),
                    reps: recentData.reps,
                    weight: recentData.weight,
                    completed: false
                  });
                  
                  // Add remaining empty sets if template had more than one
                  for (let i = 1; i < exercise.sets.length; i++) {
                    newSets.push({
                      id: generateId(),
                      reps: '',
                      weight: '',
                      completed: false
                    });
                  }
                } else {
                  // If no data at all, create empty sets based on template
                  for (let i = 0; i < Math.max(1, exercise.sets.length); i++) {
                    newSets.push({
                      id: generateId(),
                      reps: '',
                      weight: '',
                      completed: false
                    });
                  }
                }
              }
              
              // Return updated exercise with populated sets
              return {
                ...exercise,
                sets: newSets
              };
            })
          );
          
          setExercises(populatedExercises);
        } catch (e) {
          console.error('Error parsing exercises from template:', e);
        }
      }
    };

    loadTemplateExercises();
  }, [params.exercises, historyDays]);

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
    
    // Try to get the best performance data for this exercise
    const bestPerformance = await storageService.getBestPerformance(newExerciseName, historyDays);
    
    // Initialize new exercise
    const newExercise: Exercise = {
      id: generateId(),
      name: newExerciseName,
      sets: []
    };
    
    // If we have best performance data, use the first set
    if (bestPerformance && bestPerformance.allSets && bestPerformance.allSets.length > 0) {
      const bestSet = bestPerformance.allSets[0];
      if (bestSet) {
        console.log(`Using best set data for new exercise: ${bestSet.weight}x${bestSet.reps}`);
        newExercise.sets.push({
          id: generateId(),
          reps: bestSet.reps,
          weight: bestSet.weight,
          completed: false
        });
      }
    } else {
      // Fall back to getting most recent data if best performance isn't available
      const recentData = await storageService.getMostRecentExerciseData(newExerciseName);
      if (recentData) {
        newExercise.sets.push({
          id: generateId(),
          reps: recentData.reps,
          weight: recentData.weight,
          completed: false
        });
      }
    }
    
    // If we still have no sets, add an empty one
    if (newExercise.sets.length === 0) {
      newExercise.sets.push({
        id: generateId(),
        reps: '',
        weight: '',
        completed: false
      });
    }
    
    setExercises(prev => [...prev, newExercise]);
    setNewExerciseName('');
    setShowSuggestions(false);
  };

  // Add a new set to an exercise with data from best set if available
  const addSet = async (exerciseId: string) => {
    try {
      // Find the exercise we're adding a set to
      const exercise = exercises.find(ex => ex.id === exerciseId);
      if (!exercise) return;
      
      // Get the current set count - we'll use this to determine which set from best performance to use
      const currentSetCount = exercise.sets.length;
      
      // Get the best performance data for this exercise
      const bestPerformance = await storageService.getBestPerformance(exercise.name, historyDays);
      
      // Create a new set
      let newSet: SetWithCompletion = {
        id: generateId(),
        reps: '',
        weight: '',
        completed: false
      };
      
      // If we have best performance data and it has enough sets, copy the data
      if (bestPerformance && bestPerformance.allSets && bestPerformance.allSets.length > currentSetCount) {
        const bestSet = bestPerformance.allSets[currentSetCount];
        if (bestSet) {
          console.log(`Using best set data for set ${currentSetCount + 1}: ${bestSet.weight}x${bestSet.reps}`);
          newSet.weight = bestSet.weight;
          newSet.reps = bestSet.reps;
        }
      }
      
      // Update exercises state
      setExercises(exercises.map(exercise => 
        exercise.id === exerciseId 
          ? {
              ...exercise,
              sets: [
                ...exercise.sets,
                newSet
              ]
            }
          : exercise
      ));
    } catch (error) {
      console.error('Error adding set with best data:', error);
      // Fall back to adding an empty set
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
    }
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

  // Handle cancel button press
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

  // Add a function to save workout progress and exit without completing
  const saveAndExit = async () => {
    try {
      // Current workout is already being saved automatically when exercises change
      // So we just need to navigate back
      router.replace("/");
    } catch (error) {
      console.error('Error saving workout:', error);
      Alert.alert('Error', 'Failed to save workout progress');
    }
  };

  // Add the function to handle going back to the main screen
  const handleBack = () => {
    console.log('Back button pressed, exercises:', exercises.length);
    
    // If there's an active workout, show options
    if (exercises.length > 0) {
      console.log('Showing workout options');
      Alert.alert(
        'Workout in Progress',
        'What would you like to do?',
        [
          {
            text: 'Save & Exit',
            style: 'default',
            onPress: saveAndExit
          },
          {
            text: 'Complete Workout',
            style: 'default',
            onPress: handleSaveWorkout
          },
          {
            text: 'Cancel Workout',
            style: 'destructive',
            onPress: () => setShowCancelModal(true)
          },
          {
            text: 'Continue Workout',
            style: 'cancel'
          },
        ]
      );
    } else {
      console.log('No exercises, navigating to home');
      router.replace("/");
    }
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

  // 1. Add state for modal at the top of WorkoutScreen
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedHistoryExercise, setSelectedHistoryExercise] = useState('');
  const [historyData, setHistoryData] = useState<WorkoutStat[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'best' | 'suggested'>('history');
  const [bestPerformance, setBestPerformance] = useState<BestPerformance | null>(null);

  // 2. Replace the navigateToExerciseHistory function with a direct modal approach
  const showExerciseHistory = useCallback(async (exerciseName: string) => {
    console.log(`Opening modal for: ${exerciseName}`);
    setSelectedHistoryExercise(exerciseName);
    setHistoryLoading(true);
    setShowHistoryModal(true);
    setActiveTab('history');
    
    try {
      // Fetch history data
      const workoutStats = await storageService.getExerciseStatsByWorkout(exerciseName, historyDays);
      console.log(`Found ${workoutStats.length} workout stats for ${exerciseName}`);
      
      // Add total volume to each workout for display
      const enhancedStats = workoutStats.map(workout => {
        // Calculate total volume
        const totalVolume = workout.sets.reduce((sum: number, set: ExerciseSet) => {
          return sum + (parseFloat(set.weight) || 0) * (parseFloat(set.reps) || 0);
        }, 0);
        
        // Find max weight
        const maxWeight = workout.sets.reduce((max: number, set: ExerciseSet) => {
          const weight = parseFloat(set.weight) || 0;
          return weight > max ? weight : max;
        }, 0);
        
        return {
          ...workout,
          totalVolume: totalVolume,
          maxWeight: maxWeight
        };
      });
      
      setHistoryData(enhancedStats);
      
      // Fetch best performance data
      const best = await storageService.getBestPerformance(exerciseName, historyDays);
      setBestPerformance(best);
    } catch (error) {
      console.error('Error loading history:', error);
      setHistoryData([]);
      setBestPerformance(null);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyDays]);

  return (
    <>
      <StatusBar 
        barStyle="dark-content" 
        backgroundColor="#fff"
        translucent={Platform.OS === 'android'}
      />
      <View style={[
        styles.container,
        Platform.OS === 'android' && { paddingTop: StatusBar.currentHeight || 0 }
      ]} key={`workout-container-${forceRefreshKey}`}>
        <TouchableOpacity 
          onPress={handleBack} 
          style={styles.backButtonTop}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        
        <ScrollView contentContainerStyle={styles.contentContainer}>
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
                onViewHistory={showExerciseHistory}
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
      </View>
      
      {/* Cancel workout confirmation modal */}
      <Modal
        visible={showCancelModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={{fontSize: 18, fontWeight: 'bold', marginBottom: 15}}>Cancel Workout</Text>
            <Text style={{marginBottom: 20}}>Are you sure you want to cancel this workout? All progress will be lost.</Text>
            
            <View style={{flexDirection: 'row', justifyContent: 'flex-end'}}>
              <TouchableOpacity 
                style={{padding: 10, marginRight: 15}}
                onPress={() => setShowCancelModal(false)}
              >
                <Text style={{color: COLORS.primary}}>No, Keep Working Out</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={{
                  backgroundColor: COLORS.error,
                  paddingVertical: 10,
                  paddingHorizontal: 15,
                  borderRadius: 5
                }}
                onPress={confirmCancelWorkout}
              >
                <Text style={{color: '#fff'}}>Yes, Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Exercise history modal */}
      {showHistoryModal && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.8)',
          zIndex: 9999,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <View style={{
            width: '90%',
            backgroundColor: 'white',
            padding: 20,
            borderRadius: 10,
            maxHeight: '80%',
          }}>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 15,
              borderBottomWidth: 1,
              borderBottomColor: COLORS.border,
              paddingBottom: 10,
            }}>
              <Text style={{fontSize: 20, fontWeight: 'bold', color: COLORS.text}}>{selectedHistoryExercise}</Text>
              <TouchableOpacity 
                onPress={() => {
                  console.log('Closing modal');
                  setShowHistoryModal(false);
                }}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            
            {/* Tabs */}
            <View style={{
              flexDirection: 'row',
              borderBottomWidth: 1,
              borderBottomColor: COLORS.border,
              marginBottom: 15,
            }}>
              <TouchableOpacity 
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: 'center',
                  borderBottomWidth: 2,
                  borderBottomColor: activeTab === 'history' ? COLORS.primary : 'transparent',
                }}
                onPress={() => setActiveTab('history')}
              >
                <Text style={{
                  color: activeTab === 'history' ? COLORS.primary : COLORS.textSecondary,
                  fontWeight: activeTab === 'history' ? 'bold' : 'normal',
                }}>History</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: 'center',
                  borderBottomWidth: 2,
                  borderBottomColor: activeTab === 'best' ? COLORS.primary : 'transparent',
                }}
                onPress={() => setActiveTab('best')}
              >
                <Text style={{
                  color: activeTab === 'best' ? COLORS.primary : COLORS.textSecondary,
                  fontWeight: activeTab === 'best' ? 'bold' : 'normal',
                }}>Best Set</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: 'center',
                  borderBottomWidth: 2,
                  borderBottomColor: activeTab === 'suggested' ? COLORS.primary : 'transparent',
                }}
                onPress={() => setActiveTab('suggested')}
              >
                <Text style={{
                  color: activeTab === 'suggested' ? COLORS.primary : COLORS.textSecondary,
                  fontWeight: activeTab === 'suggested' ? 'bold' : 'normal',
                }}>Suggested</Text>
              </TouchableOpacity>
            </View>
            
            {historyLoading ? (
              <View style={{alignItems: 'center', justifyContent: 'center', padding: 20}}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={{marginTop: 10, fontSize: 16}}>Loading history...</Text>
              </View>
            ) : (
              <>
                {/* History Tab Content */}
                {activeTab === 'history' && (
                  <ScrollView style={{maxHeight: '90%'}}>
                    {historyData.length === 0 ? (
                      <View style={{alignItems: 'center', justifyContent: 'center', padding: 20}}>
                        <Ionicons name="fitness-outline" size={60} color={COLORS.border} />
                        <Text style={{fontSize: 18, fontWeight: 'bold', marginVertical: 10}}>No workout history found</Text>
                        <Text style={{textAlign: 'center', color: COLORS.textSecondary}}>
                          Complete a workout with this exercise to see your history.
                        </Text>
                      </View>
                    ) : (
                      historyData.map((workout, index) => (
                        <View key={`workout-${index}`} style={{
                          marginBottom: 15, 
                          borderWidth: 1, 
                          borderColor: COLORS.border,
                          borderRadius: 8,
                          padding: 12,
                        }}>
                          <Text style={{fontSize: 16, fontWeight: 'bold', color: COLORS.primary, marginBottom: 10}}>
                            {new Date(workout.date).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </Text>
                          
                          <View style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            backgroundColor: COLORS.primaryLight,
                            borderRadius: 8,
                            padding: 10,
                            marginBottom: 10,
                          }}>
                            <View style={{alignItems: 'center'}}>
                              <Text style={{fontSize: 12, color: COLORS.primary, marginBottom: 4}}>Total Sets</Text>
                              <Text style={{fontSize: 16, fontWeight: 'bold'}}>{workout.sets.length}</Text>
                            </View>
                            
                            <View style={{alignItems: 'center'}}>
                              <Text style={{fontSize: 12, color: COLORS.primary, marginBottom: 4}}>Total Volume</Text>
                              <Text style={{fontSize: 16, fontWeight: 'bold'}}>
                                {workout.totalVolume?.toFixed(0)} {workout.weightUnit || weightUnit}
                              </Text>
                            </View>
                            
                            <View style={{alignItems: 'center'}}>
                              <Text style={{fontSize: 12, color: COLORS.primary, marginBottom: 4}}>Max Weight</Text>
                              <Text style={{fontSize: 16, fontWeight: 'bold'}}>
                                {workout.maxWeight} {workout.weightUnit || weightUnit}
                              </Text>
                            </View>
                          </View>
                          
                          <View style={{
                            borderWidth: 1,
                            borderColor: COLORS.border,
                            borderRadius: 8,
                            overflow: 'hidden',
                          }}>
                            <View style={{
                              flexDirection: 'row',
                              backgroundColor: COLORS.primaryLight,
                              paddingVertical: 8,
                            }}>
                              <Text style={{flex: 0.5, fontWeight: 'bold', textAlign: 'center', color: COLORS.primary}}>Set</Text>
                              <Text style={{flex: 1, fontWeight: 'bold', textAlign: 'center', color: COLORS.primary}}>Weight</Text>
                              <Text style={{flex: 1, fontWeight: 'bold', textAlign: 'center', color: COLORS.primary}}>Reps</Text>
                              <Text style={{flex: 1, fontWeight: 'bold', textAlign: 'center', color: COLORS.primary}}>Volume</Text>
                            </View>
                            
                            {workout.sets.map((set, setIndex) => {
                              const volume = (parseFloat(set.weight) || 0) * (parseFloat(set.reps) || 0);
                              return (
                                <View key={`set-${setIndex}`} style={{
                                  flexDirection: 'row',
                                  borderTopWidth: 1,
                                  borderTopColor: COLORS.border,
                                  paddingVertical: 8,
                                }}>
                                  <Text style={{flex: 0.5, textAlign: 'center'}}>{setIndex + 1}</Text>
                                  <Text style={{flex: 1, textAlign: 'center'}}>{set.weight} {workout.weightUnit || weightUnit}</Text>
                                  <Text style={{flex: 1, textAlign: 'center'}}>{set.reps}</Text>
                                  <Text style={{flex: 1, textAlign: 'center'}}>{volume.toFixed(0)}</Text>
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      ))
                    )}
                  </ScrollView>
                )}
                
                {/* Best Performance Tab Content */}
                {activeTab === 'best' && (
                  <ScrollView style={{maxHeight: '90%'}}>
                    {!bestPerformance ? (
                      <View style={{alignItems: 'center', justifyContent: 'center', padding: 20}}>
                        <Ionicons name="trophy-outline" size={60} color={COLORS.border} />
                        <Text style={{fontSize: 18, fontWeight: 'bold', marginVertical: 10}}>No performance data found</Text>
                        <Text style={{textAlign: 'center', color: COLORS.textSecondary}}>
                          Complete a workout with this exercise to see your best performance.
                        </Text>
                      </View>
                    ) : (
                      <View style={{
                        borderWidth: 1,
                        borderColor: COLORS.primary,
                        borderRadius: 8,
                        padding: 15,
                        backgroundColor: 'rgba(30, 136, 229, 0.05)',
                      }}>
                        <Text style={{fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: COLORS.primary}}>
                          Best Performance
                        </Text>
                        
                        <Text style={{fontSize: 16, marginBottom: 10}}>
                          Date: {new Date(bestPerformance.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </Text>
                        
                        <View style={{
                          backgroundColor: COLORS.primaryLight,
                          borderRadius: 8,
                          padding: 15,
                          marginBottom: 15,
                        }}>
                          <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10}}>
                            <View style={{alignItems: 'center', flex: 1}}>
                              <Text style={{fontSize: 14, color: COLORS.primary}}>Weight</Text>
                              <Text style={{fontSize: 24, fontWeight: 'bold'}}>
                                {bestPerformance.weight} {bestPerformance.weightUnit || weightUnit}
                              </Text>
                            </View>
                            
                            <View style={{alignItems: 'center', flex: 1}}>
                              <Text style={{fontSize: 14, color: COLORS.primary}}>Reps</Text>
                              <Text style={{fontSize: 24, fontWeight: 'bold'}}>{bestPerformance.reps}</Text>
                            </View>
                          </View>
                          
                          <View style={{alignItems: 'center'}}>
                            <Text style={{fontSize: 14, color: COLORS.primary}}>Total Volume</Text>
                            <Text style={{fontSize: 24, fontWeight: 'bold'}}>
                              {bestPerformance.volume.toFixed(0)} {bestPerformance.weightUnit || weightUnit}
                            </Text>
                          </View>
                        </View>
                        
                        <Text style={{fontSize: 16, fontWeight: 'bold', marginBottom: 10}}>
                          Estimated One-Rep Max:
                        </Text>
                        
                        <View style={{
                          backgroundColor: '#f0f0f0',
                          borderRadius: 8,
                          padding: 15,
                          alignItems: 'center',
                        }}>
                          <Text style={{fontSize: 20, fontWeight: 'bold', color: COLORS.text}}>
                            {calculateOneRepMax(
                              parseFloat(bestPerformance.weight), 
                              parseFloat(bestPerformance.reps)
                            ).toFixed(1)} {bestPerformance.weightUnit || weightUnit}
                          </Text>
                        </View>
                      </View>
                    )}
                  </ScrollView>
                )}
                
                {/* Suggested Weights Tab Content */}
                {activeTab === 'suggested' && (
                  <ScrollView style={{maxHeight: '90%'}}>
                    {!bestPerformance ? (
                      <View style={{alignItems: 'center', justifyContent: 'center', padding: 20}}>
                        <Ionicons name="calculator-outline" size={60} color={COLORS.border} />
                        <Text style={{fontSize: 18, fontWeight: 'bold', marginVertical: 10}}>No data to suggest weights</Text>
                        <Text style={{textAlign: 'center', color: COLORS.textSecondary}}>
                          Complete a workout with this exercise to get weight suggestions.
                        </Text>
                      </View>
                    ) : (
                      <View style={{padding: 5}}>
                        <Text style={{fontSize: 16, fontWeight: 'bold', marginBottom: 15}}>
                          Suggested weights based on your best set: {bestPerformance.weight}{bestPerformance.weightUnit || weightUnit} × {bestPerformance.reps} reps
                        </Text>
                        
                        <View style={{
                          borderWidth: 1,
                          borderColor: COLORS.border,
                          borderRadius: 8,
                          overflow: 'hidden',
                        }}>
                          <View style={{
                            flexDirection: 'row',
                            backgroundColor: COLORS.primaryLight,
                            paddingVertical: 10,
                          }}>
                            <Text style={{flex: 1, fontWeight: 'bold', textAlign: 'center', color: COLORS.primary}}>Reps</Text>
                            <Text style={{flex: 1, fontWeight: 'bold', textAlign: 'center', color: COLORS.primary}}>Weight ({bestPerformance.weightUnit || weightUnit})</Text>
                            <Text style={{flex: 1, fontWeight: 'bold', textAlign: 'center', color: COLORS.primary}}>% of 1RM</Text>
                          </View>
                          
                          {[1, 2, 3, 4, 5, 6, 8, 10, 12, 15].map(reps => {
                            const oneRepMax = calculateOneRepMax(
                              parseFloat(bestPerformance.weight), 
                              parseFloat(bestPerformance.reps)
                            );
                            const suggestedWeight = calculateSuggestedWeight(oneRepMax, reps);
                            const percentage = ((1.0278 - 0.0278 * reps) * 100).toFixed(0);
                            
                            return (
                              <View key={`reps-${reps}`} style={{
                                flexDirection: 'row',
                                borderTopWidth: 1,
                                borderTopColor: COLORS.border,
                                paddingVertical: 10,
                                backgroundColor: reps === parseInt(bestPerformance.reps) ? 'rgba(30, 136, 229, 0.1)' : 'transparent',
                              }}>
                                <Text style={{flex: 1, textAlign: 'center', fontWeight: 'bold'}}>{reps}</Text>
                                <Text style={{flex: 1, textAlign: 'center'}}>{suggestedWeight.toFixed(1)}</Text>
                                <Text style={{flex: 1, textAlign: 'center'}}>{percentage}%</Text>
                              </View>
                            );
                          })}
                        </View>
                        
                        <Text style={{fontSize: 14, color: COLORS.textSecondary, marginTop: 10, textAlign: 'center'}}>
                          Based on the formula: weight = 1RM × (1.0278 - 0.0278 × reps)
                        </Text>
                      </View>
                    )}
                  </ScrollView>
                )}
              </>
            )}
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentContainer: {
    padding: 12,
    paddingTop: Platform.OS === 'ios' ? 60 : StatusBar.currentHeight ? StatusBar.currentHeight + 50 : 60,
    paddingBottom: 40,
  },
  timerContainer: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 8,
    padding: 10,
    marginTop: 0,
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
  backButtonTop: {
    padding: 8,
    position: 'absolute',
    top: Platform.OS === 'ios' ? 10 : StatusBar.currentHeight ? StatusBar.currentHeight + 2 : 2,
    left: 16,
    zIndex: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  historyButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    width: '80%',
    padding: 20,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    flex: 1,
  },
  closeButton: {
    padding: 8,
  },
  modalContent: {
    flex: 1,
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    marginTop: 20,
  },
  noDataTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
    marginTop: 20,
    marginBottom: 10,
  },
  noDataText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  workoutCard: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: 15,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  workoutDate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primaryLight,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.primary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  setsTable: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.primaryLight,
    paddingVertical: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 8,
  },
  headerCell: {
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  tableCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    color: COLORS.text,
  },
  historyLoader: {
    marginVertical: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
}); 