import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
  Dimensions,
  Alert,
  Platform
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as storageService from '../../services/storageService';
import * as settingsService from '../../services/settingsService';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import Icon from '@expo/vector-icons/Ionicons';
import { COLORS } from '../../services/colors';

// Define types for exercise stats
interface ExerciseSet {
  id: string;
  reps: string;
  weight: string;
  unit?: string;
}

interface WorkoutStat {
  id: string;
  date: string;
  sets: ExerciseSet[];
  weightUnit?: string;
}

interface GraphDataPoint {
  label: string;
  value: number;
}

interface GraphData {
  bestSet: GraphDataPoint[];
  totalVolume: GraphDataPoint[];
  maxReps: GraphDataPoint[];
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
  exerciseName: string;
  bestSet?: BestSet;
  bestSetDate?: string;
  estimatedOneRepMax?: number;
  personalBests?: {
    [key: string]: PersonalBest;
  };
  workouts?: WorkoutStat[];
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

// Tab type definition
type TabType = 'history' | 'best' | 'suggested';

// For line charts
const LineChart = ({ data, width, height, color }: any) => {
  // Simple line chart implementation
  if (!data || data.length === 0) {
    return (
      <View style={[styles.chart, { width, height }]}>
        <Text style={styles.noDataText}>No data available</Text>
      </View>
    );
  }

  // Need at least 2 points to draw a line
  if (data.length === 1) {
    const point = data[0];
    return (
      <View style={[styles.chart, { width, height }]}>
        <Text style={styles.axisLabel}>{point.value}</Text>
        <View 
          style={{
            position: 'absolute',
            left: width / 2 - 4,
            top: height / 2 - 4,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: color,
          }}
        />
        <Text style={[styles.axisLabel, { bottom: 5, alignSelf: 'center' }]}>
          {point.label}
        </Text>
      </View>
    );
  }

  // Get max and min values for scaling
  const maxValue = Math.max(...data.map((d: any) => d.value));
  const minValue = Math.min(...data.map((d: any) => d.value));
  const range = maxValue - minValue || 1;

  // Normalize to chart height
  const normalizeValue = (value: number) => {
    return height - (((value - minValue) / range) * (height - 40)) - 20;
  };

  // Generate path
  const points = data.map((d: any, i: number) => {
    const x = (i / (data.length - 1)) * width;
    const y = normalizeValue(d.value);
    return { x, y };
  });

  return (
    <View style={[styles.chart, { width, height }]}>
      {/* Y-axis labels */}
      <Text style={[styles.axisLabel, { top: 5, right: 5 }]}>{maxValue.toFixed(1)}</Text>
      <Text style={[styles.axisLabel, { bottom: 5, right: 5 }]}>{minValue.toFixed(1)}</Text>
      
      {/* Render data points and lines */}
      <View style={{ position: 'absolute', left: 0, top: 0, width, height }}>
        {points.map((point: any, i: number) => (
          <React.Fragment key={i}>
            {/* Draw line to next point */}
            {i < points.length - 1 && (
              <View
                style={{
                  position: 'absolute',
                  left: point.x,
                  top: point.y,
                  width: Math.sqrt(
                    Math.pow(points[i + 1].x - point.x, 2) + 
                    Math.pow(points[i + 1].y - point.y, 2)
                  ),
                  height: 2,
                  backgroundColor: color,
                  transform: [
                    { 
                      rotate: `${Math.atan2(
                        points[i + 1].y - point.y,
                        points[i + 1].x - point.x
                      )}rad` 
                    }
                  ],
                  transformOrigin: 'left',
                }}
              />
            )}
            
            {/* Draw point */}
            <View
              style={{
                position: 'absolute',
                left: point.x - 4,
                top: point.y - 4,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: color,
              }}
            />
          </React.Fragment>
        ))}
      </View>
      
      {/* X-axis labels */}
      {data.length > 0 && (
        <>
          <Text style={[styles.axisLabel, { bottom: 5, left: 5 }]}>
            {data[0].label}
          </Text>
          {data.length > 1 && (
            <Text style={[styles.axisLabel, { bottom: 5, right: 5 }]}>
              {data[data.length - 1].label}
            </Text>
          )}
        </>
      )}
    </View>
  );
};

// Update the WorkoutHistoryItem component to display more detailed information
const WorkoutHistoryItem = ({ workout, index, weightUnit }: { workout: WorkoutStat, index: number, weightUnit: settingsService.WeightUnit }) => {
  // Calculate total volume and max weight
  const totalVolume = workout.sets.reduce((sum, set) => {
    return sum + (parseFloat(set.weight) || 0) * (parseFloat(set.reps) || 0);
  }, 0);
  
  const maxWeight = workout.sets.reduce((max, set) => {
    const weight = parseFloat(set.weight) || 0;
    return weight > max ? weight : max;
  }, 0);
  
  // Format the date nicely
  const formattedDate = format(new Date(workout.date), 'EEE, MMM d, yyyy');
  
  return (
    <View style={styles.workoutHistoryItem}>
      <View style={styles.workoutHistoryHeader}>
        <Text style={styles.workoutDate}>{formattedDate}</Text>
        <View style={styles.workoutMetricsContainer}>
          <View style={styles.workoutMetric}>
            <Text style={styles.workoutMetricLabel}>Sets</Text>
            <Text style={styles.workoutMetricValue}>{workout.sets.length}</Text>
          </View>
          <View style={styles.workoutMetric}>
            <Text style={styles.workoutMetricLabel}>Volume</Text>
            <Text style={styles.workoutMetricValue}>{totalVolume.toFixed(0)} {workout.weightUnit || weightUnit}</Text>
          </View>
          <View style={styles.workoutMetric}>
            <Text style={styles.workoutMetricLabel}>Max</Text>
            <Text style={styles.workoutMetricValue}>{maxWeight} {workout.weightUnit || weightUnit}</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.setsContainer}>
        {workout.sets.map((set, setIndex) => {
          const volume = (parseFloat(set.weight) || 0) * (parseFloat(set.reps) || 0);
          return (
            <View key={`set-${setIndex}`} style={styles.setRow}>
              <View style={styles.setInfo}>
                <Text style={styles.setText}>Set {setIndex + 1}</Text>
              </View>
              <View style={styles.setValues}>
                <Text style={styles.weightValue}>{set.weight} {workout.weightUnit || weightUnit}</Text>
                <Text style={styles.multiplySymbol}> × </Text>
                <Text style={styles.repsValue}>{set.reps} reps</Text>
                <Text style={styles.volumeValue}> = {volume.toFixed(0)}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

export default function ExerciseHistoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [exercises, setExercises] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [exerciseStats, setExerciseStats] = useState<ExerciseStats | null>(null);
  const [workoutStats, setWorkoutStats] = useState<WorkoutStat[]>([]);
  const [bestPerformance, setBestPerformance] = useState<BestPerformance | null>(null);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showGraphsModal, setShowGraphsModal] = useState(false);
  const [graphData, setGraphData] = useState<GraphData>({
    bestSet: [],
    totalVolume: [],
    maxReps: []
  });
  const [historyDays, setHistoryDays] = useState(settingsService.DEFAULT_HISTORY_DAYS);
  const [suggestedReps, setSuggestedReps] = useState(settingsService.DEFAULT_SUGGESTED_REPS);
  const [weightUnit, setWeightUnit] = useState<settingsService.WeightUnit>(settingsService.DEFAULT_WEIGHT_UNIT);
  // Add active tab state
  const [activeTab, setActiveTab] = useState<TabType>('history');
  
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth * 0.85;
  const chartHeight = 200;

  useEffect(() => {
    loadSettings();
    loadExercises();
    console.log('Initial render, loading settings and exercises');
  }, []);
  
  useEffect(() => {
    console.log("Params changed:", params);
    // Check if we received exerciseName from the workout screen
    if (params.exerciseName) {
      console.log(`Got exercise name from params: "${params.exerciseName}"`);
      // Explicitly set the selected exercise to match the parameter
      const exerciseName = typeof params.exerciseName === 'string' 
        ? params.exerciseName.trim() 
        : Array.isArray(params.exerciseName) ? params.exerciseName[0].trim() : '';
      
      // Find the exact exercise in the list
      const exactMatch = exercises.find(ex => ex === exerciseName);
      if (exactMatch) {
        console.log(`Found exact match for: ${exerciseName}`);
        setSelectedExercise(exactMatch);
        loadExerciseData(exactMatch);
      } else {
        console.log(`No exact match found for: ${exerciseName}, searching for similar exercises`);
        // Try to find a similar exercise name
        const similarExercise = exercises.find(ex => 
          ex.toLowerCase().includes(exerciseName.toLowerCase()));
        
        if (similarExercise) {
          console.log(`Found similar exercise: ${similarExercise}`);
          setSelectedExercise(similarExercise);
          loadExerciseData(similarExercise);
        } else {
          console.log(`No similar exercise found for: ${exerciseName}`);
        }
      }
    }
  }, [params.exerciseName, exercises]);

  useEffect(() => {
    console.log(`Stats modal visibility changed: ${showStatsModal ? 'visible' : 'hidden'}`);
  }, [showStatsModal]);

  const loadSettings = async () => {
    try {
      const days = await settingsService.getHistoryDays();
      setHistoryDays(days);
      
      const reps = await settingsService.getSuggestedReps();
      setSuggestedReps(reps);
      
      const unit = await settingsService.getWeightUnit();
      setWeightUnit(unit);
      
      console.log(`Settings loaded: historyDays=${days}, suggestedReps=${reps}, weightUnit=${unit}`);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const loadExercises = async () => {
    try {
      setLoading(true);
      const exercisesList = await storageService.getAllExercises();
      setExercises(exercisesList);
    } catch (error) {
      console.error('Error loading exercises:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredExercises = exercises.filter(exercise => 
    exercise.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExercisePress = async (exerciseName: string) => {
    console.log(`Loading exercise history for: ${exerciseName}`);
    setSelectedExercise(exerciseName);
    setLoading(true);
    
    try {
      // First, try to get workout stats
      const workoutStats = await storageService.getExerciseStatsByWorkout(exerciseName, historyDays);
      console.log(`Found ${workoutStats.length} workout stats: ${JSON.stringify(workoutStats).substring(0, 100)}...`);
      
      // Then, try to get best performance
      const best = await storageService.getBestPerformance(exerciseName, historyDays);
      console.log('Best performance:', best ? JSON.stringify(best).substring(0, 200) : 'None found');
      
      // Create exercise stats object
      const stats: ExerciseStats = { 
        exerciseName,
        workouts: workoutStats || [] 
      };
      
      if (best) {
        // Add best set to stats
        stats.bestSet = {
          reps: parseFloat(best.reps),
          weight: parseFloat(best.weight),
          unit: best.weightUnit || weightUnit
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
                unit: workout.weightUnit || weightUnit
              };
            }
          }
        }
        stats.personalBests = personalBests;
      }
      
      console.log(`Setting exerciseStats: ${JSON.stringify(stats).substring(0, 1000)}`);
      setExerciseStats(stats);
      setWorkoutStats(workoutStats);
      setBestPerformance(best);
      setActiveTab('history'); // Ensure we start with history tab
      
      // Show the stats modal
      setShowStatsModal(true);
      
    } catch (error) {
      console.error('Error loading exercise history:', error);
      // Set empty stats with exercise name
      setExerciseStats({ 
        exerciseName,
        workouts: [] 
      });
      setWorkoutStats([]);
      setBestPerformance(null);
      
      // Still show the modal even if there's no data
      setShowStatsModal(true);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const prepareGraphData = () => {
    if (!exerciseStats || exerciseStats.workouts === undefined || exerciseStats.workouts.length === 0) return;

    // Sort by date
    const sortedStats = [...exerciseStats.workouts].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Extract best set from each workout (highest weight)
    const bestSetData = sortedStats.map(workout => {
      const bestSet = workout.sets.reduce((best: ExerciseSet, current: ExerciseSet) => {
        const currentWeight = parseFloat(current.weight) || 0;
        const bestWeight = parseFloat(best.weight) || 0;
        return currentWeight > bestWeight ? current : best;
      }, workout.sets[0] || { id: '0', weight: '0', reps: '0' });

      return {
        label: formatDate(workout.date),
        value: parseFloat(bestSet.weight) || 0
      };
    });

    // Calculate total volume for each workout (sum of weight * reps)
    const volumeData = sortedStats.map(workout => {
      const totalVolume = workout.sets.reduce((total: number, set: ExerciseSet) => {
        const weight = parseFloat(set.weight) || 0;
        const reps = parseFloat(set.reps) || 0;
        return total + (weight * reps);
      }, 0);

      return {
        label: formatDate(workout.date),
        value: totalVolume
      };
    });

    // Find max reps in each workout
    const maxRepsData = sortedStats.map(workout => {
      const maxReps = workout.sets.reduce((max: number, current: ExerciseSet) => {
        const currentReps = parseFloat(current.reps) || 0;
        return currentReps > max ? currentReps : max;
      }, 0);

      return {
        label: formatDate(workout.date),
        value: maxReps
      };
    });

    setGraphData({
      bestSet: bestSetData,
      totalVolume: volumeData,
      maxReps: maxRepsData
    });

    setShowGraphsModal(true);
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
  
  // Calculate estimated one rep max using the formula: weight / (1.0278 - 0.0278 × reps)
  const calculateOneRepMax = (weight: number, reps: number): number => {
    if (weight <= 0 || reps <= 0) return 0;
    
    // Use Brzycki formula: 1RM = weight × (36 / (37 - reps))
    return weight * (36 / (37 - Math.min(reps, 36)));
  };
  
  // Calculate suggested weight for target reps based on 1RM
  const calculateSuggestedWeight = (oneRepMax: number, targetReps: number): number => {
    if (oneRepMax <= 0 || targetReps <= 0) return 0;
    return oneRepMax * (1.0278 - 0.0278 * targetReps);
  };

  // Format tab name for display
  const formatTabName = (tab: TabType): string => {
    switch (tab) {
      case 'history':
        return 'History';
      case 'best':
        return 'Personal Records';
      case 'suggested':
        return 'Suggested Weights';
      default:
        return tab;
    }
  };

  // Get tab icon 
  const getTabIcon = (tab: TabType): any => {
    switch (tab) {
      case 'history':
        return 'time-outline';
      case 'best':
        return 'trophy-outline';
      case 'suggested':
        return 'analytics-outline';
      default:
        return 'list-outline';
    }
  };

  // Get icon for exercise type
  const getExerciseIcon = (exerciseName: string): any => {
    const lowerName = exerciseName.toLowerCase();
    
    if (lowerName.includes('bench') || lowerName.includes('press') || lowerName.includes('push')) {
      return 'fitness-outline';
    } else if (lowerName.includes('squat') || lowerName.includes('leg') || lowerName.includes('lunge')) {
      return 'body-outline';
    } else if (lowerName.includes('deadlift') || lowerName.includes('row') || lowerName.includes('pull')) {
      return 'barbell-outline';
    } else if (lowerName.includes('curl') || lowerName.includes('bicep') || lowerName.includes('tricep')) {
      return 'fitness-outline';
    } else if (lowerName.includes('shoulder') || lowerName.includes('delt')) {
      return 'expand-outline';
    } else if (lowerName.includes('cardio') || lowerName.includes('run') || lowerName.includes('bike')) {
      return 'heart-outline';
    } else {
      return 'barbell-outline';
    }
  };

  // Replace the renderHistoryTabContent function
  const renderHistoryTabContent = () => {
    if (!exerciseStats || !exerciseStats.workouts || exerciseStats.workouts.length === 0) {
      return (
        <View style={styles.noDataContainer}>
          <Ionicons name="fitness-outline" size={50} color={COLORS.border} />
          <Text style={styles.historyNoDataText}>
            No workout history for {selectedExercise}
          </Text>
          <Text style={styles.noDataSubtext}>
            Complete workouts with this exercise to build your history.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.historyListContainer}>
        {exerciseStats.workouts.map((workout, index) => (
          <WorkoutHistoryItem
            key={workout.id || `workout-${index}`}
            workout={workout}
            index={index}
            weightUnit={weightUnit}
          />
        ))}
      </View>
    );
  };

  // Render workout history tab content
  const renderBestPerformanceTab = () => {
    if (!selectedExercise || !exerciseStats) {
      return (
        <View style={styles.emptyTabContainer}>
          <Icon name="trophy-outline" size={80} color={COLORS.primaryLight} />
          <Text style={styles.emptyListText}>No performance data found</Text>
          <Text style={styles.emptyListSubtext}>Complete workouts with this exercise to see your personal records</Text>
        </View>
      );
    }

    const hasPersonalRecords = exerciseStats.bestSet || 
      (exerciseStats.personalBests && Object.keys(exerciseStats.personalBests).length > 0);

    if (!hasPersonalRecords) {
      return (
        <View style={styles.emptyTabContainer}>
          <Icon name="trophy-outline" size={80} color={COLORS.primaryLight} />
          <Text style={styles.emptyListText}>No personal records yet</Text>
          <Text style={styles.emptyListSubtext}>Complete more workouts with this exercise to see your best lifts</Text>
        </View>
      );
    }

    return (
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={styles.scrollContent}
      >
        {exerciseStats.bestSet && (
          <View style={styles.bestPerformanceContainer}>
            <View style={styles.bestPerformanceBadge}>
              <Icon name="trophy" size={16} color={COLORS.card} />
              <Text style={styles.bestPerformanceBadgeText}>PERSONAL BEST</Text>
            </View>
            
            <Text style={styles.bestPerformanceTitle}>Best Overall Set</Text>
            {exerciseStats.bestSetDate && (
              <Text style={styles.bestPerformanceDate}>
                {format(new Date(exerciseStats.bestSetDate), 'MMMM d, yyyy')}
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
                <Text style={styles.bestPerformanceCell}>{exerciseStats.bestSet.weight}{exerciseStats.bestSet.unit}</Text>
                <Text style={styles.bestPerformanceCell}>
                  {(exerciseStats.bestSet.reps * exerciseStats.bestSet.weight).toFixed(1)}{exerciseStats.bestSet.unit}
                </Text>
              </View>
            </View>
            
            <Text style={styles.bestPerformanceNote}>
              This is your highest volume set (weight × reps)
            </Text>
          </View>
        )}

        {exerciseStats.estimatedOneRepMax && exerciseStats.estimatedOneRepMax > 0 && (
          <View style={styles.oneRepMaxContainer}>
            <Text style={styles.oneRepMaxTitle}>Estimated 1-Rep Max</Text>
            <Text style={styles.oneRepMaxValue}>
              {exerciseStats.estimatedOneRepMax.toFixed(1)}{exerciseStats.bestSet?.unit || 'kg'}
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
                    <Text style={styles.bestPerformanceCell}>{best.weight.toFixed(1)}{best.unit}</Text>
                    <Text style={styles.bestPerformanceCell}>
                      {best.date ? format(new Date(best.date), 'MMM d, yyyy') : 'N/A'}
                    </Text>
                  </View>
                ))}
            </View>
          </View>
        )}
      </ScrollView>
    );
  };

  // Render suggested weights tab content
  const renderSuggestedWeightsTab = () => {
    if (!exerciseStats || !exerciseStats.estimatedOneRepMax || exerciseStats.estimatedOneRepMax <= 0) {
      return (
        <View style={styles.emptyTabContainer}>
          <Icon name="analytics-outline" size={80} color={COLORS.primaryLight} />
          <Text style={styles.emptyListText}>No data available for suggestions</Text>
          <Text style={styles.emptyListSubtext}>Complete more workouts with this exercise</Text>
        </View>
      );
    }

    const oneRepMax = exerciseStats.estimatedOneRepMax;
    const weightUnit = exerciseStats.bestSet?.unit || 'kg';

    // Define rep ranges for suggestions
    const repRanges = [1, 2, 3, 5, 8, 10, 12, 15];

    return (
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.oneRepMaxContainer}>
          <Text style={styles.oneRepMaxTitle}>Estimated 1-Rep Max</Text>
          <Text style={styles.oneRepMaxValue}>{oneRepMax.toFixed(1)}{weightUnit}</Text>
          <Text style={styles.oneRepMaxDescription}>
            Based on your estimated 1-rep max of {oneRepMax.toFixed(1)}{weightUnit}
          </Text>
        </View>

        <View style={styles.suggestedWeightsContainer}>
          <Text style={styles.suggestedWeightsTitle}>Suggested Weights</Text>
          <Text style={styles.suggestedWeightsDescription}>
            Based on your estimated 1-rep max of {oneRepMax.toFixed(1)}{weightUnit}
          </Text>
          
          <View style={styles.suggestedWeightsTable}>
            <View style={styles.suggestedWeightsHeader}>
              <Text style={styles.suggestedWeightsHeaderCell}>Reps</Text>
              <Text style={styles.suggestedWeightsHeaderCell}>Weight ({weightUnit})</Text>
              <Text style={styles.suggestedWeightsHeaderCell}>% of 1RM</Text>
            </View>
            
            {repRanges.map(reps => {
              const suggestedWeight = calculateSuggestedWeight(oneRepMax, reps);
              const percentage = (suggestedWeight / oneRepMax) * 100;
              
              return (
                <View key={`reps-${reps}`} style={styles.suggestedWeightsRow}>
                  <Text style={styles.suggestedWeightsCell}>{reps}</Text>
                  <Text style={styles.suggestedWeightsCell}>{suggestedWeight.toFixed(1)}</Text>
                  <Text style={styles.suggestedWeightsCell}>{percentage.toFixed(0)}%</Text>
                </View>
              );
            })}
          </View>
          
          <Text style={styles.suggestedWeightsNote}>
            These are theoretical values and may vary based on individual factors.
            Always start with a weight you can safely handle.
          </Text>
        </View>
        
        <View style={styles.customRepsContainer}>
          <Text style={styles.customRepsTitle}>Custom Rep Target</Text>
          <Text style={styles.customRepsValue}>
            {calculateSuggestedWeight(oneRepMax, suggestedReps).toFixed(1)}{weightUnit}
          </Text>
          <Text style={styles.customRepsDescription}>
            Suggested weight for {suggestedReps} reps
          </Text>
        </View>
      </ScrollView>
    );
  };

  // Add the renderTabContent function that was missing
  const renderTabContent = () => {
    console.log('Rendering tab content for tab:', activeTab);
    
    if (!selectedExercise) {
      console.log('No exercise selected');
      return <Text style={styles.noStatsText}>No exercise selected</Text>;
    }

    switch (activeTab) {
      case 'history':
        return renderHistoryTabContent();
      case 'best':
        return renderBestPerformanceTab();
      case 'suggested':
        return renderSuggestedWeightsTab();
      default:
        return renderHistoryTabContent();
    }
  };

  // Function to handle going back
  const handleBack = () => {
    router.back();
  };

  // Define the loadExerciseData function
  const loadExerciseData = useCallback(async (exerciseName: string) => {
    if (!exerciseName) return;
    
    console.log(`Loading history for: ${exerciseName}`);
    setLoading(true);
    
    try {
      // First, try to get workout stats
      const workoutStats = await storageService.getExerciseStatsByWorkout(exerciseName, historyDays);
      console.log(`Found ${workoutStats.length} workout stats for ${exerciseName}`);
      
      // Then, try to get best performance
      const best = await storageService.getBestPerformance(exerciseName, historyDays);
      console.log('Best performance:', best ? best.weight : 'None found');
      
      // Create exercise stats object
      const stats: ExerciseStats = { 
        exerciseName,
        workouts: workoutStats || [] 
      };
      
      if (best) {
        // Add best set to stats
        stats.bestSet = {
          reps: parseFloat(best.reps),
          weight: parseFloat(best.weight),
          unit: best.weightUnit || weightUnit
        };
        stats.bestSetDate = best.date;
        
        // Calculate estimated 1RM
        const oneRepMax = calculateOneRepMax(parseFloat(best.weight), parseFloat(best.reps));
        stats.estimatedOneRepMax = oneRepMax;
        console.log(`Calculated 1RM: ${oneRepMax} ${weightUnit}`);
        
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
                unit: workout.weightUnit || weightUnit
              };
            }
          }
        }
        stats.personalBests = personalBests;
      }
      
      setExerciseStats(stats);
      setWorkoutStats(workoutStats);
      setBestPerformance(best);
      setActiveTab('history'); // Make sure we show history tab
      
      // Show the stats modal
      setShowStatsModal(true);
      
    } catch (error) {
      console.error('Error loading exercise data:', error);
      // Set empty stats with exercise name
      setExerciseStats({ 
        exerciseName,
        workouts: [] 
      });
      
      // Still show the modal even if there's no data
      setShowStatsModal(true);
    } finally {
      setLoading(false);
    }
  }, [historyDays, weightUnit]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{selectedExercise || 'Exercise History'}</Text>
        <View style={styles.headerRight}>
          {selectedExercise && (
            <TouchableOpacity onPress={() => setShowGraphsModal(true)}>
              <Ionicons 
                name={showGraphsModal ? "stats-chart" : "stats-chart-outline"} 
                size={24} 
                color={COLORS.primary} 
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search exercises..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={COLORS.textSecondary}
          />
        </View>
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={filteredExercises}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.exerciseItem}
              onPress={() => handleExercisePress(item)}
            >
              <View style={styles.exerciseIconContainer}>
                <Ionicons name={getExerciseIcon(item)} size={22} color={COLORS.primary} />
              </View>
              <Text style={styles.exerciseName}>{item}</Text>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyListContainer}>
              <Ionicons name="search" size={50} color={COLORS.border} />
              <Text style={styles.emptyListText}>
                {searchQuery ? 'No exercises match your search.' : 'No exercises found.'}
              </Text>
              <Text style={styles.emptyListSubtext}>
                {searchQuery ? 'Try a different search term.' : 'Complete workouts to see exercise history.'}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={filteredExercises.length === 0 ? { flex: 1 } : {}}
        />
      )}
      
      {/* Exercise Stats Modal with Tabs */}
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
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            
            {/* Tabs */}
            <View style={styles.tabsContainer}>
              {(['history', 'best', 'suggested'] as TabType[]).map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[
                    styles.tab,
                    activeTab === tab ? styles.activeTab : null
                  ]}
                  onPress={() => {
                    console.log(`Switching to tab: ${tab}`);
                    setActiveTab(tab);
                  }}
                >
                  <Ionicons 
                    name={getTabIcon(tab)} 
                    size={20} 
                    color={activeTab === tab ? COLORS.card : COLORS.textSecondary} 
                    style={styles.tabIcon}
                  />
                  <Text 
                    style={[
                      styles.tabText,
                      activeTab === tab ? styles.activeTabText : null
                    ]}
                  >
                    {formatTabName(tab)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Tab Content */}
            <View style={{ flex: 1, padding: 0 }}>
              {exerciseStats ? (
                renderTabContent()
              ) : (
                <View style={styles.emptyTabContainer}>
                  <Text style={styles.noStatsText}>
                    {selectedExercise ? 'Loading data...' : 'No exercise selected'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Graphs Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showGraphsModal}
        onRequestClose={() => setShowGraphsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedExercise} Performance
              </Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowGraphsModal(false)}
              >
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.graphsContainer}>
              <View style={styles.graphSection}>
                <Text style={styles.graphTitle}>Best Set (Weight)</Text>
                <LineChart 
                  data={graphData.bestSet}
                  width={chartWidth}
                  height={chartHeight}
                  color={COLORS.primary}
                />
              </View>
              
              <View style={styles.graphSection}>
                <Text style={styles.graphTitle}>Total Volume (Weight × Reps)</Text>
                <LineChart 
                  data={graphData.totalVolume}
                  width={chartWidth}
                  height={chartHeight}
                  color={COLORS.accent}
                />
              </View>
              
              <View style={styles.graphSection}>
                <Text style={styles.graphTitle}>Max Reps</Text>
                <LineChart 
                  data={graphData.maxReps}
                  width={chartWidth}
                  height={chartHeight}
                  color={COLORS.success}
                />
              </View>
            </ScrollView>
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
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingBottom: 8,
    backgroundColor: COLORS.primary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    color: COLORS.card,
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: COLORS.text,
  },
  searchContainer: {
    marginBottom: 20,
  },
  searchInputContainer: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      },
      android: {
        elevation: 2,
      },
    }),
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
  },
  loader: {
    marginTop: 50,
  },
  exerciseItem: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    ...Platform.select({
      ios: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      },
      android: {
        elevation: 2,
      },
    }),
  },
  exerciseIconContainer: {
    marginRight: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    flex: 1,
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyListText: {
    textAlign: 'center',
    marginTop: 20,
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
  emptyListSubtext: {
    textAlign: 'center',
    marginTop: 10,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  emptyTabContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 300,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 0,
    width: '100%',
    maxHeight: '90%',
    overflow: 'hidden',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.primary,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.card,
    flex: 1,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noStatsText: {
    textAlign: 'center',
    padding: 20,
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
  statsContainer: {
    height: 300,
    marginBottom: 15,
  },
  statsHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.primaryLight,
    paddingVertical: 12,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  statsHeaderText: {
    flex: 1,
    fontWeight: 'bold',
    textAlign: 'center',
    color: COLORS.secondary,
  },
  statsList: {
    maxHeight: 300,
    padding: 10,
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  graphsButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginVertical: 15,
    marginHorizontal: 20,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  graphsButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 15,
  },
  closeModalButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 5,
    marginTop: 15,
    marginHorizontal: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  closeModalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  graphsContainer: {
    padding: 20,
  },
  graphSection: {
    marginBottom: 25,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 15,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  graphTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: COLORS.secondary,
  },
  chart: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  axisLabel: {
    position: 'absolute',
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  noDataText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  workoutContainer: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
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
    fontSize: 16,
    color: COLORS.primary,
    marginBottom: 8,
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    marginHorizontal: 20,
    color: COLORS.secondary,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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
  tabContent: {
    flex: 1,
    minHeight: 400,
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
  customRepsContainer: {
    padding: 20,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  customRepsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: COLORS.secondary,
  },
  customRepsValue: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    color: COLORS.primary,
  },
  customRepsDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  },
  workoutHistoryItem: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.card,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  workoutHistoryHeader: {
    backgroundColor: COLORS.primaryLight,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  workoutMetricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 6,
    padding: 8,
  },
  workoutMetric: {
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  workoutMetricLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  workoutMetricValue: {
    fontWeight: 'bold',
    fontSize: 16,
    color: COLORS.text,
  },
  setsContainer: {
    padding: 15,
  },
  setRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  setInfo: {
    flex: 1,
    marginRight: 10,
  },
  setText: {
    fontWeight: '500',
    color: COLORS.primary,
  },
  setValues: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 3,
  },
  weightValue: {
    fontWeight: '600',
    color: COLORS.text,
  },
  multiplySymbol: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  repsValue: {
    fontWeight: '600',
    color: COLORS.text,
  },
  volumeValue: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  historyNoDataText: {
    textAlign: 'center',
    marginTop: 20,
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
  noDataSubtext: {
    textAlign: 'center',
    marginTop: 10,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  historyListContainer: {
    padding: 15,
  },
}); 