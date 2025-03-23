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
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as storageService from '../../services/storageService';
import * as settingsService from '../../services/settingsService';

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

export default function WorkoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ exercises?: string, restore?: string }>();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [exerciseStats, setExerciseStats] = useState<any[]>([]);
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

  // Save active workout when exercises change
  useEffect(() => {
    storageService.saveActiveWorkout(exercises, weightUnit).catch(error => {
      console.error('Error saving active workout:', error);
    });
    
    // Start timer when exercises are added
    if (exercises.length > 0 && !workoutStarted) {
      startWorkoutTimer();
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
      try {
        const activeWorkout = await storageService.getActiveWorkout();
        if (activeWorkout && activeWorkout.exercises.length > 0) {
          setHasActiveWorkout(true);
          
          // If we were directed here from the active workout bar, auto-restore
          if (params.restore === 'true') {
            restoreActiveWorkout();
          } else {
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
    }
  }, [params.exercises, params.restore]);

  // Restore active workout
  const restoreActiveWorkout = async () => {
    try {
      setRestoringWorkout(true);
      const activeWorkout = await storageService.getActiveWorkout();
      if (activeWorkout) {
        // Also restore the timer state if we have timestamp
        if (activeWorkout.timestamp) {
          const startTime = new Date(activeWorkout.timestamp);
          setWorkoutStartTime(startTime);
          setWorkoutStarted(true);
          
          // Calculate elapsed time
          const now = new Date();
          const initialElapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
          setElapsedTime(initialElapsed);
          
          // Start the timer
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
          }
          
          timerIntervalRef.current = setInterval(() => {
            setElapsedTime(prev => prev + 1);
          }, 1000);
        }
        
        setExercises(activeWorkout.exercises);
        
        // Handle weight unit - if different from current, ask if user wants to convert
        if (activeWorkout.weightUnit !== weightUnit) {
          Alert.alert(
            'Weight Unit Mismatch',
            `This workout was created using ${activeWorkout.weightUnit.toUpperCase()}. Your current setting is ${weightUnit.toUpperCase()}. Would you like to convert the weights?`,
            [
              {
                text: 'Convert',
                onPress: () => {
                  // Convert weights from saved unit to current unit
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
                }
              },
              {
                text: 'Keep Original',
                onPress: () => {
                  // Just set as is without conversion
                  setExercises(activeWorkout.exercises);
                }
              }
            ]
          );
        }
      }
    } catch (error) {
      console.error('Error restoring active workout:', error);
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
    if (params.exercises && typeof params.exercises === 'string') {
      try {
        const templateExercises = JSON.parse(params.exercises);
        setExercises(templateExercises);
      } catch (e) {
        console.error('Error parsing exercises from template:', e);
      }
    }
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
  const addExercise = () => {
    if (!newExerciseName.trim()) return;
    
    const newExercise: Exercise = {
      id: generateId(),
      name: newExerciseName,
      sets: []
    };
    
    setExercises(prev => [...prev, newExercise]);
    setNewExerciseName('');
    setShowSuggestions(false);
  };

  // Add a new set to an exercise
  const addSet = (exerciseId: string) => {
    const newSet: Set = {
      id: generateId(),
      reps: '',
      weight: ''
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

  // Make sure startWorkoutTimer doesn't depend on workoutStarted
  const startWorkoutTimer = () => {
    // Initialize workout time if not already started
    if (!workoutStarted) {
      const startTime = new Date();
      setWorkoutStartTime(startTime);
      setWorkoutStarted(true);
      setElapsedTime(0);
    }
    
    // Clear any existing interval
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    
    // Set interval to update timer every second
    timerIntervalRef.current = setInterval(() => {
      setElapsedTime(prev => {
        if (workoutStartTime) {
          const now = new Date();
          return Math.floor((now.getTime() - workoutStartTime.getTime()) / 1000);
        }
        return prev + 1; // Fallback increment if workoutStartTime is null
      });
    }, 1000);
  };

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

      // Navigate to workout details with the corrected path
      // @ts-ignore - Suppressing type error for navigation path
      router.push({
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
    
    try {
      // Get exercise stats from workouts
      const stats = await storageService.getExerciseStatsByWorkout(exerciseName, historyDays);
      setExerciseStats(stats);
      
      // Get best performance (highest volume)
      const best = await storageService.getBestPerformance(exerciseName, historyDays);
      
      if (best) {
        // Ensure weightUnit has a default value
        const bestWithWeightUnit = {
          ...best,
          weightUnit: best.weightUnit || 'kg'
        };
        setBestPerformance(bestWithWeightUnit);
      } else {
        setBestPerformance(null);
      }
      
      setShowStatsModal(true);
    } catch (error) {
      console.error('Error getting exercise stats:', error);
      Alert.alert('Error', 'Failed to load exercise history');
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
  
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <Text style={styles.title}>Workout Session</Text>
        
        {workoutStarted && (
          <View style={styles.timerContainer}>
            <Text style={styles.timerLabel}>Workout Time</Text>
            <Text style={styles.timerText}>{formatTime(elapsedTime)}</Text>
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
            <Text style={styles.confirmModalTitle}>Cancel Workout?</Text>
            <Text style={styles.confirmModalText}>
              Are you sure you want to cancel this workout? All progress will be lost.
            </Text>
            
            <View style={styles.confirmButtonRow}>
              <TouchableOpacity 
                style={styles.cancelConfirmButton}
                onPress={() => setShowCancelModal(false)}
              >
                <Text style={styles.cancelConfirmButtonText}>Keep Workout</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.confirmButton}
                onPress={confirmCancelWorkout}
              >
                <Text style={styles.confirmButtonText}>Yes, Cancel</Text>
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
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {selectedExercise} History
            </Text>
            
            {/* Best Performance Section with 1RM */}
            {bestPerformance ? (
              <View style={styles.bestPerformanceContainer}>
                <Text style={styles.bestPerformanceTitle}>Best Performance</Text>
                <Text style={styles.bestPerformanceDate}>
                  {formatDate(bestPerformance.date)}
                </Text>
                
                <View style={styles.bestPerformanceTable}>
                  <View style={styles.bestPerformanceTableHeader}>
                    <Text style={styles.bestPerformanceHeaderCell}>Set</Text>
                    <Text style={styles.bestPerformanceHeaderCell}>Reps</Text>
                    <Text style={styles.bestPerformanceHeaderCell}>Weight</Text>
                    <Text style={styles.bestPerformanceHeaderCell}>Volume</Text>
                  </View>
                  
                  {bestPerformance.allSets.map((set, index) => {
                    const reps = parseFloat(set.reps) || 0;
                    const rawWeight = parseFloat(set.weight) || 0;
                    const weight = displayWeight(rawWeight, bestPerformance.weightUnit);
                    const volume = weight * reps;
                    
                    return (
                      <View 
                        key={`best-set-${index}`} 
                        style={[
                          styles.bestPerformanceRow,
                          index === bestPerformance.setIndex ? styles.bestPerformanceHighlight : null
                        ]}
                      >
                        <Text style={styles.bestPerformanceCell}>{index + 1}</Text>
                        <Text style={styles.bestPerformanceCell}>{set.reps || '-'}</Text>
                        <Text style={styles.bestPerformanceCell}>
                          {weight > 0 ? `${weight.toFixed(1)} ${weightUnit}` : '-'}
                        </Text>
                        <Text style={styles.bestPerformanceCell}>{volume.toFixed(1)}</Text>
                      </View>
                    );
                  })}
                </View>
                
                {/* One Rep Max Estimation */}
                {(() => {
                  const bestReps = parseFloat(bestPerformance.reps) || 0;
                  const rawWeight = parseFloat(bestPerformance.weight) || 0;
                  const bestWeight = displayWeight(rawWeight, bestPerformance.weightUnit);
                  const oneRepMax = calculateOneRepMax(bestWeight, bestReps);
                  const suggestedWeight = calculateSuggestedWeight(oneRepMax, suggestedReps);
                  
                  return (
                    <View style={styles.estimationContainer}>
                      <View style={styles.estimationCard}>
                        <Text style={styles.estimationTitle}>Estimated 1RM</Text>
                        <Text style={styles.estimationValue}>
                          {oneRepMax > 0 ? `${oneRepMax.toFixed(1)} ${weightUnit}` : '-'} 
                        </Text>
                        <Text style={styles.estimationLabel}>
                          Based on {bestWeight.toFixed(1)} {weightUnit} × {bestReps} reps
                        </Text>
                      </View>
                      
                      <View style={styles.estimationCard}>
                        <Text style={styles.estimationTitle}>Suggested Weight</Text>
                        <Text style={styles.estimationValue}>
                          {suggestedWeight > 0 ? `${suggestedWeight.toFixed(1)} ${weightUnit}` : '-'}
                        </Text>
                        <Text style={styles.estimationLabel}>
                          For {suggestedReps} reps
                        </Text>
                      </View>
                    </View>
                  );
                })()}
                
                <Text style={styles.bestPerformanceNote}>
                  Based on data from the last {historyDays} days
                </Text>
              </View>
            ) : (
              <Text style={styles.noStatsText}>No performance data found</Text>
            )}
            
            <Text style={styles.sectionTitle}>Workout History</Text>
            
            {exerciseStats.length === 0 ? (
              <Text style={styles.noStatsText}>No history found for this exercise</Text>
            ) : (
              <ScrollView style={styles.statsList}>
                {exerciseStats.map((workout, workoutIndex) => (
                  <View key={`workout-${workoutIndex}`} style={styles.workoutContainer}>
                    <View style={styles.workoutHeader}>
                      <Text style={styles.workoutDate}>
                        {formatDate(workout.date)}
                      </Text>
                    </View>
                    
                    <View style={styles.statsHeader}>
                      <Text style={styles.statsHeaderText}>Set</Text>
                      <Text style={styles.statsHeaderText}>Reps</Text>
                      <Text style={styles.statsHeaderText}>Weight</Text>
                    </View>
                    
                    {workout.sets.map((set: ExerciseSet, setIndex: number) => {
                      const rawWeight = parseFloat(set.weight) || 0;
                      const weight = displayWeight(rawWeight, workout.weightUnit);
                      
                      return (
                        <View 
                          key={`set-${setIndex}`} 
                          style={[
                            styles.statsRow,
                            // Highlight the best performance set
                            bestPerformance && 
                            bestPerformance.workoutId === workout.id && 
                            bestPerformance.setIndex === setIndex 
                              ? styles.bestPerformanceHighlight 
                              : null
                          ]}
                        >
                          <Text style={styles.statsCell}>{setIndex + 1}</Text>
                          <Text style={styles.statsCell}>{set.reps || '-'}</Text>
                          <Text style={styles.statsCell}>
                            {weight > 0 ? `${weight.toFixed(1)} ${weightUnit}` : '-'}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </ScrollView>
            )}
            
            <TouchableOpacity 
              style={styles.closeModalButton}
              onPress={() => setShowStatsModal(false)}
            >
              <Text style={styles.closeModalButtonText}>Close</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.viewFullHistoryButton}
              onPress={() => {
                setShowStatsModal(false);
                navigateToExerciseHistory(selectedExercise);
              }}
            >
              <Text style={styles.viewFullHistoryButtonText}>View Full History</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
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
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginRight: 10,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 45,
    left: 0,
    right: 10,
    zIndex: 1,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    maxHeight: 150,
  },
  suggestionsList: {
    width: '100%',
  },
  suggestionItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  smallInput: {
    flex: 1,
    marginRight: 5,
  },
  addButton: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 5,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  exerciseCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#eee',
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
  },
  exerciseActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyButton: {
    backgroundColor: '#007BFF',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  historyButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 5,
    backgroundColor: '#ffebee',
  },
  deleteButtonText: {
    color: '#f44336',
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
  },
  deleteSetButton: {
    padding: 6,
    borderRadius: 5,
    backgroundColor: '#ffebee',
  },
  inputRow: {
    flexDirection: 'row',
  },
  addSetButton: {
    backgroundColor: '#2196F3',
    padding: 8,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 5,
  },
  completeButton: {
    backgroundColor: '#FF9800',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginVertical: 20,
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
  },
  discardButton: {
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    width: '48%',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  resumeButton: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    width: '48%',
  },
  discardButtonText: {
    color: '#666',
    fontWeight: 'bold',
  },
  resumeButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  noStatsText: {
    textAlign: 'center',
    padding: 20,
    color: '#888',
  },
  statsContainer: {
    height: 300,
    marginBottom: 15,
  },
  statsHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    paddingVertical: 10,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    marginBottom: 5,
  },
  statsHeaderText: {
    flex: 1,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  statsList: {
    maxHeight: 300,
  },
  statsRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  statsCell: {
    flex: 1,
    textAlign: 'center',
  },
  closeModalButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 5,
    marginTop: 10,
    alignSelf: 'center',
  },
  closeModalButtonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  confirmModalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  confirmModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  confirmModalText: {
    textAlign: 'center',
    marginBottom: 20,
    color: '#555',
  },
  confirmButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  cancelConfirmButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
    marginRight: 10,
  },
  cancelConfirmButtonText: {
    color: '#555',
    fontWeight: 'bold',
  },
  confirmButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  confirmButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  timerContainer: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 10,
    marginBottom: 20,
    alignItems: 'center',
  },
  timerLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginBottom: 4,
  },
  timerText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  bestPerformanceContainer: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 15,
    backgroundColor: '#f9f9f9',
  },
  bestPerformanceTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#4CAF50',
  },
  bestPerformanceDate: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#666',
  },
  bestPerformanceTable: {
    marginBottom: 10,
  },
  bestPerformanceTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    paddingVertical: 10,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    marginBottom: 5,
  },
  bestPerformanceHeaderCell: {
    flex: 1,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  bestPerformanceRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  bestPerformanceHighlight: {
    backgroundColor: '#e0f2f1',
  },
  bestPerformanceCell: {
    flex: 1,
    textAlign: 'center',
  },
  bestPerformanceNote: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 5,
  },
  estimationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 15,
    paddingHorizontal: 5,
  },
  estimationCard: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  estimationTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#4CAF50',
  },
  estimationValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  estimationLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 10,
    color: '#333',
  },
  workoutContainer: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
  },
  workoutHeader: {
    backgroundColor: '#e0f2f1',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  workoutDate: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  viewFullHistoryButton: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  viewFullHistoryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
}); 