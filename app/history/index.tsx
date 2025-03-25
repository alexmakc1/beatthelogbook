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
import { Swipeable } from 'react-native-gesture-handler';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
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

  const handleLongPress = () => {
    setSelectMode(true);
  };

  const handleCancelSelection = () => {
    setSelectMode(false);
    setSelectedWorkouts([]);
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
    const isSelected = selectedWorkouts.includes(item.id);

    const renderRightActions = () => (
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteSelected()}
      >
        <MaterialIcons name="delete" size={24} color="#fff" />
      </TouchableOpacity>
    );

    return (
      <Swipeable
        renderRightActions={renderRightActions}
        rightThreshold={40}
        overshootRight={false}
      >
        <TouchableOpacity
          style={[
            styles.workoutItem,
            isSelected && styles.selectedWorkoutItem
          ]}
          onPress={() => handleWorkoutPress(item)}
          onLongPress={handleLongPress}
        >
          <View style={styles.workoutInfo}>
            <Text style={styles.workoutDate}>{formatDate(item.date)}</Text>
            <Text style={styles.workoutName}>
              {item.exercises.length} exercise{item.exercises.length !== 1 ? 's' : ''}
            </Text>
          </View>
          {isSelected && (
            <View style={styles.checkmark}>
              <FontAwesome5 name="check-circle" size={24} color={COLORS.primary} />
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
              style={[styles.actionButton, styles.deleteButton]}
            >
              <Text style={styles.actionButtonText}>
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
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.background,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    marginLeft: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  deleteButton: {
    backgroundColor: COLORS.error,
  },
  list: {
    padding: 16,
  },
  workoutItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  selectedWorkoutItem: {
    backgroundColor: COLORS.primaryLight,
  },
  workoutInfo: {
    flex: 1,
  },
  workoutDate: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  workoutName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  checkmark: {
    marginLeft: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
}); 