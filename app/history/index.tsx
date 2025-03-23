import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import * as storageService from '../../services/storageService';
import { Swipeable } from 'react-native-gesture-handler';

type Workout = storageService.Workout;

export default function HistoryScreen() {
  const router = useRouter();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);

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
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Navigate to workout details
  const navigateToWorkoutDetails = (workoutId: string) => {
    // @ts-ignore
    router.push({
      pathname: "workout-details/[id]",
      params: { id: workoutId }
    });
  };
  
  // Delete a workout
  const deleteWorkout = async (workoutId: string) => {
    Alert.alert(
      "Delete Workout",
      "Are you sure you want to delete this workout?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              // Create a new array without the deleted workout
              const updatedWorkouts = workouts.filter(workout => workout.id !== workoutId);
              
              // Update state immediately for better UX
              setWorkouts(updatedWorkouts);
              
              // Save the updated workouts list to storage
              await storageService.deleteWorkout(workoutId);
            } catch (error) {
              console.error('Error deleting workout:', error);
              Alert.alert('Error', 'Failed to delete workout');
              // Reload workouts if delete failed
              loadWorkouts();
            }
          }
        }
      ]
    );
  };
  
  // Render right actions for swipeable
  const renderRightActions = (workoutId: string) => {
    return (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => deleteWorkout(workoutId)}
      >
        <Text style={styles.deleteActionText}>Delete</Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text>Loading workouts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Workout History</Text>
      
      {workouts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No workouts recorded yet</Text>
        </View>
      ) : (
        <FlatList
          data={workouts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Swipeable
              renderRightActions={() => renderRightActions(item.id)}
            >
              <TouchableOpacity 
                style={styles.workoutCard}
                onPress={() => navigateToWorkoutDetails(item.id)}
              >
                <Text style={styles.dateText}>{formatDate(item.date)}</Text>
                <Text style={styles.exerciseCount}>
                  {item.exercises.length} {item.exercises.length === 1 ? 'exercise' : 'exercises'}
                </Text>
                <View style={styles.exerciseList}>
                  {item.exercises.slice(0, 3).map((exercise, index) => (
                    <Text key={exercise.id} style={styles.exerciseItem}>
                      • {exercise.name} ({exercise.sets.length} {exercise.sets.length === 1 ? 'set' : 'sets'})
                    </Text>
                  ))}
                  {item.exercises.length > 3 && (
                    <Text style={styles.moreText}>+ {item.exercises.length - 3} more</Text>
                  )}
                </View>
              </TouchableOpacity>
            </Swipeable>
          )}
        />
      )}
      
      <TouchableOpacity 
        style={styles.startButton}
        onPress={() => {
          // @ts-ignore
          router.push("workout");
        }}
      >
        <Text style={styles.buttonText}>Start New Workout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
  },
  workoutCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  dateText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  exerciseCount: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  exerciseList: {
    marginTop: 5,
  },
  exerciseItem: {
    fontSize: 14,
    marginBottom: 3,
  },
  moreText: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
  },
  startButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  deleteAction: {
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '91%',
    marginBottom: 15,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
  },
  deleteActionText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  }
}); 