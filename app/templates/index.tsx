import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  TextInput,
  Modal
} from 'react-native';
import { useRouter } from 'expo-router';
import * as storageService from '../../services/storageService';
import { Swipeable } from 'react-native-gesture-handler';

interface Template {
  id: string;
  name: string;
  exercises: storageService.Exercise[];
}

export default function TemplatesScreen() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [newWorkoutName, setNewWorkoutName] = useState('');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await storageService.getWorkoutTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  // Delete a template
  const deleteTemplate = async (templateId: string) => {
    Alert.alert(
      "Delete Template",
      "Are you sure you want to delete this template?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              // Create a new array without the deleted template
              const updatedTemplates = templates.filter(template => template.id !== templateId);
              
              // Update state immediately for better UX
              setTemplates(updatedTemplates);
              
              // Save the updated templates list to storage
              await storageService.deleteWorkoutTemplate(templateId);
            } catch (error) {
              console.error('Error deleting template:', error);
              Alert.alert('Error', 'Failed to delete template');
              // Reload templates if delete failed
              loadTemplates();
            }
          }
        }
      ]
    );
  };
  
  // Start a new workout from template
  const startWorkoutFromTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setNewWorkoutName(template.name); // Default to template name
    setModalVisible(true);
  };

  // Create and navigate to the new workout
  const createWorkoutFromTemplate = () => {
    if (!selectedTemplate) return;
    
    // Clone the exercises from the template
    const exercises = JSON.parse(JSON.stringify(selectedTemplate.exercises));
    
    // Reset the IDs for a new workout
    exercises.forEach((exercise: storageService.Exercise) => {
      exercise.id = Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      exercise.sets.forEach((set: storageService.Set) => {
        set.id = Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      });
    });
    
    // Close modal
    setModalVisible(false);
    
    // Navigate to workout screen with exercises
    router.push({
      pathname: '../workout',
      params: { exercises: JSON.stringify(exercises) }
    });
  };
  
  // Render right actions for swipeable
  const renderRightActions = (templateId: string) => {
    return (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => deleteTemplate(templateId)}
      >
        <Text style={styles.deleteActionText}>Delete</Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text>Loading templates...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Workout Templates</Text>
      
      {templates.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No templates saved yet</Text>
          <Text style={styles.emptySubText}>Save workouts as templates from the workout history screen</Text>
        </View>
      ) : (
        <FlatList
          data={templates}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Swipeable
              renderRightActions={() => renderRightActions(item.id)}
            >
              <TouchableOpacity 
                style={styles.templateCard}
                onPress={() => startWorkoutFromTemplate(item)}
              >
                <Text style={styles.templateName}>{item.name}</Text>
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
      
      {/* Modal for naming the workout */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Start New Workout</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Workout Name"
              value={newWorkoutName}
              onChangeText={setNewWorkoutName}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelModalButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelModalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.startModalButton]}
                onPress={createWorkoutFromTemplate}
              >
                <Text style={styles.startModalButtonText}>Start</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      <TouchableOpacity 
        style={styles.startButton}
        onPress={() => router.push('/')}
      >
        <Text style={styles.buttonText}>Back to Home</Text>
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
    fontSize: 18,
    color: '#888',
    marginBottom: 10,
  },
  emptySubText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  templateCard: {
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
  templateName: {
    fontSize: 18,
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
    marginBottom: 15,
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
  modalButton: {
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    width: '48%',
  },
  cancelModalButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  startModalButton: {
    backgroundColor: '#4CAF50',
  },
  cancelModalButtonText: {
    color: '#666',
    fontWeight: 'bold',
  },
  startModalButtonText: {
    color: 'white',
    fontWeight: 'bold',
  }
}); 