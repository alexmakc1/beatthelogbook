import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import * as storageService from '../../services/storageService';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../services/colors';

type Workout = storageService.Workout;

export default function HistoryScreen() {
  const router = useRouter();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedWorkouts, setSelectedWorkouts] = useState<string[]>([]);

  useEffect(() => {
    loadWorkouts();
  }, []);

  const loadWorkouts = async () => {
    try {
      setLoading(true);
      const data = await storageService.getWorkouts();
      // Sort by date (newest first)
      const sortedData = [...data].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setWorkouts(sortedData);
    } catch (error) {
      console.error('Error loading workouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      
      if (isNaN(date.getTime())) {
        return "Invalid Date";
      }
      
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return "Invalid Date";
    }
  };
  
  // Format duration from seconds to HH:MM:SS
  const formatDuration = (seconds: number) => {
    if (!seconds) return '00:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m ${secs}s`;
    }
  };

  const handleWorkoutPress = (workout: Workout) => {
    if (selectMode) {
      setSelectedWorkouts(prev => {
        if (prev.includes(workout.id)) {
          return prev.filter(id => id !== workout.id);
        } else {
          return [...prev, workout.id];
        }
      });
    } else {
      router.push(`/workout-details/${workout.id}`);
    }
  };

  const handleLongPress = (workout: Workout) => {
    setSelectMode(true);
    setSelectedWorkouts([workout.id]);
  };

  const handleCancelSelection = () => {
    setSelectMode(false);
    setSelectedWorkouts([]);
  };
  
  const handleDeleteWorkout = (id: string) => {
    Alert.alert(
      'Delete Workout',
      'Are you sure you want to delete this workout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await storageService.deleteWorkout(id);
              loadWorkouts();
            } catch (error) {
              console.error('Error deleting workout:', error);
              Alert.alert('Error', 'Failed to delete workout');
            }
          },
        },
      ]
    );
  };

  const handleDeleteSelected = async () => {
    Alert.alert(
      'Delete Workouts',
      `Are you sure you want to delete ${selectedWorkouts.length} workout${selectedWorkouts.length > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all(
                selectedWorkouts.map(id => storageService.deleteWorkout(id))
              );
              setSelectedWorkouts([]);
              setSelectMode(false);
              loadWorkouts();
            } catch (error) {
              console.error('Error deleting workouts:', error);
              Alert.alert('Error', 'Failed to delete workouts');
            }
          },
        },
      ]
    );
  };

  const renderWorkoutItem = ({ item }: { item: Workout }) => {
    const workoutDate = new Date(item.date).toLocaleDateString();
    const exerciseCount = item.exercises?.length || 0;
    const totalSets = item.exercises?.reduce((acc, exercise) => acc + (exercise.sets?.length || 0), 0) || 0;
    const workoutName = exerciseCount > 0 
      ? item.exercises[0].name 
      : "Workout";

    return (
      <Swipeable
        renderRightActions={() => (
          <TouchableOpacity 
            style={styles.deleteButton} 
            onPress={() => handleDeleteWorkout(item.id)}
          >
            <Ionicons name="trash-outline" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      >
        <TouchableOpacity
          style={[
            styles.workoutItem,
            selectedWorkouts.includes(item.id) && styles.selectedWorkoutItem,
          ]}
          onPress={() => handleWorkoutPress(item)}
          onLongPress={() => handleLongPress(item)}
        >
          <View style={styles.workoutInfo}>
            <Text style={styles.workoutDate}>{workoutDate}</Text>
            <Text style={styles.workoutName}>{workoutName}</Text>
            
            <View style={styles.workoutStats}>
              <Text style={styles.workoutStat}>
                {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'} • {totalSets} {totalSets === 1 ? 'set' : 'sets'}
              </Text>
              {item.duration && item.duration > 0 && (
                <Text style={styles.workoutStat}>
                  Duration: {formatDuration(item.duration)}
                </Text>
              )}
            </View>
            
            {exerciseCount > 0 && (
              <View style={styles.exerciseList}>
                {item.exercises.slice(0, 3).map((exercise, index) => (
                  <Text key={index} style={styles.exerciseItem}>
                    • {exercise.name} ({exercise.sets?.length || 0} {exercise.sets?.length === 1 ? 'set' : 'sets'})
                  </Text>
                ))}
                {exerciseCount > 3 && (
                  <Text style={styles.moreText}>+{exerciseCount - 3} more...</Text>
                )}
              </View>
            )}
          </View>
          
          {selectMode && (
            <View style={styles.checkmark}>
              <Ionicons
                name={selectedWorkouts.includes(item.id) ? "checkmark-circle" : "ellipse-outline"}
                size={24}
                color={selectedWorkouts.includes(item.id) ? COLORS.primary : COLORS.textSecondary}
              />
            </View>
          )}
        </TouchableOpacity>
      </Swipeable>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Workout History</Text>
        {selectMode && (
          <View style={styles.selectionActions}>
            <TouchableOpacity
              onPress={handleCancelSelection}
              style={styles.actionButton}
            >
              <Text style={styles.actionButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDeleteSelected}
              style={[styles.actionButton, { backgroundColor: COLORS.error }]}
            >
              <Text style={[styles.actionButtonText, { color: '#fff' }]}>
                Delete ({selectedWorkouts.length})
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {workouts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No workouts found</Text>
        </View>
      ) : (
        <FlatList
          data={workouts}
          renderItem={renderWorkoutItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  list: {
    flexGrow: 1,
  },
  workoutItem: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selectedWorkoutItem: {
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    borderColor: COLORS.primary,
  },
  workoutInfo: {
    flex: 1,
  },
  workoutDate: {
    fontSize: 14,
    color: COLORS.primary,
    marginBottom: 4,
    fontWeight: '500',
  },
  workoutName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  workoutStats: {
    marginBottom: 10,
  },
  workoutStat: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  exerciseList: {
    marginTop: 6,
  },
  exerciseItem: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  moreText: {
    fontSize: 14,
    color: COLORS.primary,
    marginTop: 4,
    fontWeight: '500',
  },
  checkmark: {
    marginLeft: 12,
  },
  deleteButton: {
    backgroundColor: COLORS.error,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    marginHorizontal: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    backgroundColor: COLORS.card,
  },
  actionButtonText: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
}); 