import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as storageService from '../../../services/storageService';
import * as settingsService from '../../../services/settingsService';

type Workout = storageService.Workout;

export default function WorkoutDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [saving, setSaving] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [startTimeInput, setStartTimeInput] = useState('');
  const [durationInput, setDurationInput] = useState('');
  const [weightUnit, setWeightUnit] = useState<settingsService.WeightUnit>(settingsService.DEFAULT_WEIGHT_UNIT);

  useEffect(() => {
    loadSettings();
    loadWorkoutDetails();
  }, [id]);

  const loadSettings = async () => {
    try {
      const unit = await settingsService.getWeightUnit();
      setWeightUnit(unit);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const loadWorkoutDetails = async () => {
    try {
      setLoading(true);
      if (typeof id === 'string') {
        const data = await storageService.getWorkoutById(id);
        setWorkout(data);
        if (data) {
          // Initialize time inputs with current values
          setStartTimeInput(formatDateForInput(data.startTime || data.date));
          setDurationInput(formatDuration(data.duration || 0));
        }
      }
    } catch (error) {
      console.error('Error loading workout details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ].join(':');
  };

  const formatDateForInput = (dateString: string) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const parseDuration = (durationStr: string) => {
    const parts = durationStr.split(':').map(part => parseInt(part, 10));
    if (parts.length !== 3) return 0;
    
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  };

  const handleEditWorkout = () => {
    if (workout && typeof id === 'string') {
      // @ts-ignore - Suppressing type error for navigation path
      router.push({
        pathname: "/edit-workout/[id]/index",
        params: { id }
      });
    }
  };

  const openTimeModal = () => {
    if (!workout) return;
    
    setStartTimeInput(formatDateForInput(workout.startTime || workout.date));
    setDurationInput(formatDuration(workout.duration || 0));
    setShowTimeModal(true);
  };

  const handleSaveTimeChanges = async () => {
    if (!workout) return;
    
    try {
      setSaving(true);
      
      // Validate inputs
      const startTime = new Date(startTimeInput);
      if (isNaN(startTime.getTime())) {
        Alert.alert('Error', 'Invalid start time format');
        setSaving(false);
        return;
      }
      
      const duration = parseDuration(durationInput);
      if (isNaN(duration)) {
        Alert.alert('Error', 'Invalid duration format');
        setSaving(false);
        return;
      }
      
      // Update workout
      const updatedWorkout = {
        ...workout,
        startTime: startTime.toISOString(),
        duration: duration
      };
      
      const success = await storageService.updateWorkout(updatedWorkout);
      
      if (success) {
        setWorkout(updatedWorkout);
        setShowTimeModal(false);
        Alert.alert('Success', 'Workout time updated');
      } else {
        Alert.alert('Error', 'Failed to update workout time');
      }
    } catch (error) {
      console.error('Error updating workout time:', error);
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!workout) return;
    
    if (!templateName.trim()) {
      Alert.alert('Error', 'Please enter a name for your template');
      return;
    }
    
    try {
      setSaving(true);
      const success = await storageService.saveWorkoutAsTemplate(workout, templateName);
      
      if (success) {
        setShowTemplateModal(false);
        Alert.alert('Success', 'Workout saved as template');
      } else {
        Alert.alert('Error', 'Failed to save template');
      }
    } catch (error) {
      console.error('Error saving template:', error);
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  // Navigate to exercise history
  const navigateToExerciseHistory = (exerciseName: string) => {
    // Navigate to exercise history screen with the selected exercise
    // @ts-ignore - Suppressing type error for navigation path
    router.push(`/exercise-history?selectedExercise=${encodeURIComponent(exerciseName)}`);
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text>Loading workout details...</Text>
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
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Workout Details</Text>
        <Text style={styles.dateText}>{formatDate(workout.date)}</Text>
        
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryText}>
            {workout.exercises.length} {workout.exercises.length === 1 ? 'exercise' : 'exercises'} • 
            {workout.exercises.reduce((total, ex) => total + ex.sets.length, 0)} sets
          </Text>
        </View>
        
        <View style={styles.timeContainer}>
          <View style={styles.timeRow}>
            <Text style={styles.timeLabel}>Start Time:</Text>
            <Text style={styles.timeValue}>{formatDate(workout.startTime || workout.date)}</Text>
          </View>
          
          <View style={styles.timeRow}>
            <Text style={styles.timeLabel}>Duration:</Text>
            <Text style={styles.timeValue}>{formatDuration(workout.duration || 0)}</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.editTimeButton}
            onPress={openTimeModal}
          >
            <Text style={styles.editTimeButtonText}>Edit Time</Text>
          </TouchableOpacity>
        </View>
        
        {workout.exercises.map((exercise) => (
          <View key={exercise.id} style={styles.exerciseCard}>
            <TouchableOpacity
              onPress={() => navigateToExerciseHistory(exercise.name)}
              style={styles.exerciseNameContainer}
            >
              <Text style={styles.exerciseName}>{exercise.name}</Text>
              <Text style={styles.viewHistoryText}>View History →</Text>
            </TouchableOpacity>
            
            <View style={styles.setsContainer}>
              <View style={styles.setsHeader}>
                <Text style={styles.setsHeaderText}>Set</Text>
                <Text style={styles.setsHeaderText}>Reps</Text>
                <Text style={styles.setsHeaderText}>Weight ({weightUnit})</Text>
              </View>
              
              {exercise.sets.map((set, index) => {
                const rawWeight = parseFloat(set.weight) || 0;
                const weight = displayWeight(rawWeight, workout.weightUnit);
                
                return (
                  <View key={set.id} style={styles.setRow}>
                    <Text style={styles.setText}>{index + 1}</Text>
                    <Text style={styles.setText}>{set.reps || '-'}</Text>
                    <Text style={styles.setText}>{weight > 0 ? weight.toFixed(1) : '-'}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.saveTemplateButton}
          onPress={() => {
            setTemplateName(workout.exercises[0]?.name ? `${workout.exercises[0].name} Workout` : 'My Workout Template');
            setShowTemplateModal(true);
          }}
        >
          <Text style={styles.buttonText}>Save as Template</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.editButton}
          onPress={handleEditWorkout}
        >
          <Text style={styles.buttonText}>Edit Workout</Text>
        </TouchableOpacity>
      </View>

      <Modal
        animationType="slide"
        transparent={true}
        visible={showTemplateModal}
        onRequestClose={() => setShowTemplateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Save as Template</Text>
            <Text style={styles.modalSubtitle}>Enter a name for your workout template</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Template Name"
              value={templateName}
              onChangeText={setTemplateName}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelModalButton}
                onPress={() => setShowTemplateModal(false)}
                disabled={saving}
              >
                <Text style={styles.cancelModalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.saveModalButton}
                onPress={handleSaveAsTemplate}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.saveModalButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent={true}
        visible={showTimeModal}
        onRequestClose={() => setShowTimeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Workout Time</Text>
            
            <Text style={styles.inputLabel}>Start Time</Text>
            <TextInput
              style={styles.modalInput}
              value={startTimeInput}
              onChangeText={setStartTimeInput}
              placeholder="YYYY-MM-DDTHH:MM"
            />
            
            <Text style={styles.inputLabel}>Duration (HH:MM:SS)</Text>
            <TextInput
              style={styles.modalInput}
              value={durationInput}
              onChangeText={setDurationInput}
              placeholder="00:00:00"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelModalButton}
                onPress={() => setShowTimeModal(false)}
                disabled={saving}
              >
                <Text style={styles.cancelModalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.saveModalButton}
                onPress={handleSaveTimeChanges}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.saveModalButtonText}>Save</Text>
                )}
              </TouchableOpacity>
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
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 80, // Make room for button
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
    color: 'red',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'center',
  },
  dateText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  summaryContainer: {
    backgroundColor: '#e7f5e7',
    padding: 10,
    borderRadius: 5,
    marginBottom: 20,
  },
  summaryText: {
    fontSize: 14,
    textAlign: 'center',
  },
  exerciseCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  exerciseNameContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  setsContainer: {
    marginTop: 5,
  },
  setsHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
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
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  setText: {
    flex: 1,
    textAlign: 'center',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  editButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    flex: 1,
    marginLeft: 10,
  },
  saveTemplateButton: {
    backgroundColor: '#FF9800',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    flex: 1,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    width: '100%',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
  },
  cancelModalButton: {
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    width: '48%',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  saveModalButton: {
    backgroundColor: '#FF9800',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    width: '48%',
  },
  cancelModalButtonText: {
    color: '#666',
    fontWeight: 'bold',
  },
  saveModalButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  timeContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeLabel: {
    fontWeight: 'bold',
    marginRight: 10,
    width: 100,
  },
  timeValue: {
    flex: 1,
  },
  editTimeButton: {
    backgroundColor: '#2196F3',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  editTimeButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  inputLabel: {
    fontWeight: 'bold',
    alignSelf: 'flex-start',
    marginBottom: 5,
    marginTop: 10,
  },
  viewHistoryText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
}); 