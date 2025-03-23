import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TextInput,
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as storageService from '../../../services/storageService';
import { COLORS } from '../../../services/colors';
import { Ionicons } from '@expo/vector-icons';

type Exercise = storageService.Exercise;
type Set = storageService.Set;
type Workout = storageService.Workout;

export default function EditWorkoutScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadWorkoutDetails();
  }, [id]);

  const loadWorkoutDetails = async () => {
    try {
      setLoading(true);
      if (typeof id === 'string') {
        const data = await storageService.getWorkoutById(id);
        setWorkout(data);
        if (data) {
          // Create a deep copy to avoid modifying the original
          setExercises(JSON.parse(JSON.stringify(data.exercises)));
        }
      }
    } catch (error) {
      console.error('Error loading workout details:', error);
    } finally {
      setLoading(false);
    }
  };

  // Update exercise name
  const updateExerciseName = (exerciseId: string, name: string) => {
    setExercises(exercises.map(exercise => 
      exercise.id === exerciseId ? { ...exercise, name } : exercise
    ));
  };

  // Update set data
  const updateSet = (exerciseId: string, setId: string, field: 'reps' | 'weight', value: string) => {
    setExercises(exercises.map(exercise => 
      exercise.id === exerciseId 
        ? {
            ...exercise,
            sets: exercise.sets.map(set => 
              set.id === setId 
                ? { ...set, [field]: value }
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

  // Add a new set to an exercise
  const addSet = (exerciseId: string) => {
    setExercises(exercises.map(exercise => 
      exercise.id === exerciseId 
        ? {
            ...exercise,
            sets: [
              ...exercise.sets,
              { id: Date.now().toString(), reps: '', weight: '' }
            ]
          }
        : exercise
    ));
  };

  // Add a new exercise
  const addExercise = () => {
    const newExercise: Exercise = {
      id: Date.now().toString(),
      name: '',
      sets: [{ id: (Date.now() + 1).toString(), reps: '', weight: '' }]
    };
    setExercises([...exercises, newExercise]);
  };

  // Save the updated workout
  const saveWorkout = async () => {
    // Validate the workout data
    if (exercises.some(ex => !ex.name.trim())) {
      Alert.alert('Error', 'Please enter a name for all exercises');
      return;
    }

    try {
      setSaving(true);
      if (workout && typeof id === 'string') {
        // Create updated workout object
        const updatedWorkout: Workout = {
          ...workout,
          exercises: exercises
        };

        const success = await storageService.updateWorkout(updatedWorkout);
        
        if (success) {
          Alert.alert('Success', 'Workout updated successfully', [
            { text: 'OK', onPress: () => router.back() }
          ]);
        } else {
          Alert.alert('Error', 'Failed to update workout');
        }
      }
    } catch (error) {
      console.error('Error updating workout:', error);
      Alert.alert('Error', 'Something went wrong while saving the workout');
    } finally {
      setSaving(false);
    }
  };

  // Function to handle going back
  const handleBack = () => {
    router.back();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ color: COLORS.textSecondary }}>Loading workout...</Text>
      </View>
    );
  }

  if (!workout) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Workout not found</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Workout</Text>
        <TouchableOpacity onPress={saveWorkout} style={styles.saveButton} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Ionicons name="save" size={24} color={COLORS.primary} />
          )}
        </TouchableOpacity>
      </View>
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {exercises.map((exercise) => (
          <View key={exercise.id} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <TextInput
                style={styles.exerciseNameInput}
                value={exercise.name}
                onChangeText={(text) => updateExerciseName(exercise.id, text)}
                placeholder="Exercise name"
              />
              <TouchableOpacity
                style={styles.deleteExerciseButton}
                onPress={() => deleteExercise(exercise.id)}
              >
                <Text style={{ color: COLORS.accent }}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.setsContainer}>
              <View style={styles.setsHeader}>
                <Text style={styles.setsHeaderText}>Set</Text>
                <Text style={styles.setsHeaderText}>Reps</Text>
                <Text style={styles.setsHeaderText}>Weight</Text>
                <Text style={styles.setsHeaderText}></Text>
              </View>
              
              {exercise.sets.map((set, index) => (
                <View key={set.id} style={styles.setRow}>
                  <Text style={styles.setNumber}>{index + 1}</Text>
                  <TextInput
                    style={styles.setInput}
                    value={set.reps}
                    onChangeText={(text) => updateSet(exercise.id, set.id, 'reps', text)}
                    placeholder="Reps"
                    keyboardType="number-pad"
                  />
                  <TextInput
                    style={styles.setInput}
                    value={set.weight}
                    onChangeText={(text) => updateSet(exercise.id, set.id, 'weight', text)}
                    placeholder="Weight"
                    keyboardType="numeric"
                  />
                  <TouchableOpacity 
                    style={styles.deleteSetButton}
                    onPress={() => deleteSet(exercise.id, set.id)}
                  >
                    <Text style={styles.deleteButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              
              <TouchableOpacity 
                style={styles.addSetButton}
                onPress={() => addSet(exercise.id)}
              >
                <Text style={styles.addButtonText}>Add Set</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        
        <TouchableOpacity 
          style={styles.addExerciseButton}
          onPress={addExercise}
        >
          <Text style={styles.addButtonText}>Add Exercise</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
  saveButton: {
    padding: 8,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100, // Make room for button
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: COLORS.accent,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: COLORS.text,
  },
  exerciseCard: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  exerciseNameInput: {
    fontSize: 18,
    fontWeight: 'bold',
    padding: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 5,
    color: COLORS.text,
  },
  deleteExerciseButton: {
    padding: 8,
    borderRadius: 5,
    backgroundColor: COLORS.accent + '20', // Light version of accent color
  },
  deleteButtonText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: 'bold',
  },
  setsContainer: {
    marginTop: 5,
  },
  setsHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 8,
    marginBottom: 8,
  },
  setsHeaderText: {
    flex: 1,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  setNumber: {
    flex: 1,
    textAlign: 'center',
    color: COLORS.text,
  },
  setInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 8,
    marginHorizontal: 5,
    textAlign: 'center',
    color: COLORS.text,
  },
  deleteSetButton: {
    padding: 6,
    borderRadius: 5,
    backgroundColor: COLORS.accent + '20', // Light version of accent color
    width: 30,
    alignItems: 'center',
  },
  addSetButton: {
    backgroundColor: COLORS.success + '20', // Light version of success color
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  addExerciseButton: {
    backgroundColor: COLORS.success + '20', // Light version of success color
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 5,
    marginBottom: 20,
  },
  addButtonText: {
    color: COLORS.success,
    fontWeight: 'bold',
  },
}); 