import React, { useState, useEffect } from 'react';
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
  Alert
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as storageService from '../../services/storageService';
import * as settingsService from '../../services/settingsService';

// Define types for exercise stats
interface ExerciseSet {
  id: string;
  reps: string;
  weight: string;
}

interface WorkoutStat {
  id: string;
  date: string;
  sets: ExerciseSet[];
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
      <Text style={[styles.axisLabel, { top: 5, right: 5 }]}>{maxValue}</Text>
      <Text style={[styles.axisLabel, { bottom: 5, right: 5 }]}>{minValue}</Text>
      
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
                  width: points[i + 1].x - point.x,
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

export default function ExerciseHistoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [exercises, setExercises] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [exerciseStats, setExerciseStats] = useState<WorkoutStat[]>([]);
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
  
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth * 0.85;
  const chartHeight = 200;

  useEffect(() => {
    loadSettings();
    loadExercises();
  }, []);
  
  useEffect(() => {
    // Check if an exercise was passed as a parameter
    if (params.selectedExercise && typeof params.selectedExercise === 'string') {
      handleExercisePress(params.selectedExercise);
    }
  }, [params.selectedExercise, exercises]);

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
    setSelectedExercise(exerciseName);
    setLoading(true);
    
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
        
        // Prepare graph data
        prepareGraphData();
      } else {
        setBestPerformance(null);
      }
    } catch (error) {
      console.error('Error loading exercise stats:', error);
      Alert.alert('Error', 'Failed to load exercise stats');
    } finally {
      setLoading(false);
      setShowStatsModal(true);
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
    if (!exerciseStats || exerciseStats.length === 0) return;

    // Sort by date
    const sortedStats = [...exerciseStats].sort((a, b) => 
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
    return weight / (1.0278 - 0.0278 * reps);
  };
  
  // Calculate suggested weight for target reps based on 1RM
  const calculateSuggestedWeight = (oneRepMax: number, targetReps: number): number => {
    if (oneRepMax <= 0 || targetReps <= 0) return 0;
    return oneRepMax * (1.0278 - 0.0278 * targetReps);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Exercise History</Text>
      
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search exercises..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" color="#4CAF50" style={styles.loader} />
      ) : (
        <FlatList
          data={filteredExercises}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.exerciseItem}
              onPress={() => handleExercisePress(item)}
            >
              <Text style={styles.exerciseName}>{item}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyListText}>
              {searchQuery ? 'No exercises match your search.' : 'No exercises found.'}
            </Text>
          }
        />
      )}
      
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
                        {formatDate(workout.date)} - {formatTime(workout.date)}
                      </Text>
                    </View>
                    
                    <View style={styles.statsHeader}>
                      <Text style={styles.statsHeaderText}>Set</Text>
                      <Text style={styles.statsHeaderText}>Reps</Text>
                      <Text style={styles.statsHeaderText}>Weight</Text>
                    </View>
                    
                    {workout.sets.map((set: ExerciseSet, setIndex: number) => (
                      <View 
                        key={`set-${setIndex}`} 
                        style={[
                          styles.statsRow,
                          // Highlight the best performance set
                          bestPerformance && 
                          bestPerformance.workoutId === workout.id && 
                          bestPerformance.setIndex === setIndex 
                            ? styles.bestPerformanceRow 
                            : null
                        ]}
                      >
                        <Text style={styles.statsCell}>{setIndex + 1}</Text>
                        <Text style={styles.statsCell}>{set.reps || '-'}</Text>
                        <Text style={styles.statsCell}>{set.weight || '-'}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </ScrollView>
            )}
            
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity 
                style={styles.graphsButton}
                onPress={prepareGraphData}
                disabled={exerciseStats.length === 0}
              >
                <Text style={styles.graphsButtonText}>View Graphs</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.closeModalButton}
                onPress={() => setShowStatsModal(false)}
              >
                <Text style={styles.closeModalButtonText}>Close</Text>
              </TouchableOpacity>
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
            <Text style={styles.modalTitle}>
              {selectedExercise} Graphs
            </Text>
            
            <ScrollView style={styles.graphsContainer}>
              <View style={styles.graphSection}>
                <Text style={styles.graphTitle}>Best Set (Weight)</Text>
                <LineChart 
                  data={graphData.bestSet}
                  width={chartWidth}
                  height={chartHeight}
                  color="#4CAF50"
                />
              </View>
              
              <View style={styles.graphSection}>
                <Text style={styles.graphTitle}>Total Volume (Weight × Reps)</Text>
                <LineChart 
                  data={graphData.totalVolume}
                  width={chartWidth}
                  height={chartHeight}
                  color="#FF9800"
                />
              </View>
              
              <View style={styles.graphSection}>
                <Text style={styles.graphTitle}>Max Reps</Text>
                <LineChart 
                  data={graphData.maxReps}
                  width={chartWidth}
                  height={chartHeight}
                  color="#2196F3"
                />
              </View>
            </ScrollView>
            
            <TouchableOpacity 
              style={styles.closeModalButton}
              onPress={() => setShowGraphsModal(false)}
            >
              <Text style={styles.closeModalButtonText}>Close</Text>
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
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  searchContainer: {
    marginBottom: 20,
  },
  searchInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  loader: {
    marginTop: 50,
  },
  exerciseItem: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '500',
  },
  emptyListText: {
    textAlign: 'center',
    marginTop: 50,
    color: '#888',
    fontSize: 16,
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
    width: '100%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
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
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  graphsButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 5,
    flex: 1,
    marginRight: 10,
  },
  graphsButtonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  closeModalButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 5,
    flex: 1,
  },
  closeModalButtonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  graphsContainer: {
    marginBottom: 15,
  },
  graphSection: {
    marginBottom: 20,
  },
  graphTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  chart: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#eee',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  axisLabel: {
    position: 'absolute',
    fontSize: 10,
    color: '#666',
  },
  noDataText: {
    color: '#888',
    fontSize: 14,
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
  bestPerformanceContainer: {
    marginBottom: 20,
  },
  bestPerformanceTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  bestPerformanceDate: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
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
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
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
}); 