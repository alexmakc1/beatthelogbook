import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
  ActivityIndicator,
  TouchableWithoutFeedback,
  GestureResponderEvent,
  Alert,
  Switch
} from 'react-native';
import { useRouter } from 'expo-router';
import * as settingsService from '../services/settingsService';
import * as storageService from '../services/storageService';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import * as importService from '../services/importService';
import { COLORS } from '../services/colors';

// Custom slider component interface
interface SimpleSliderProps {
  value: number;
  minimumValue: number;
  maximumValue: number;
  onValueChange: (value: number) => void;
  step?: number;
  minimumTrackColor?: string;
  maximumTrackColor?: string;
}

// Custom slider component
const SimpleSlider = ({ 
  value, 
  minimumValue, 
  maximumValue, 
  onValueChange,
  step = 1,
  minimumTrackColor = COLORS.primary,
  maximumTrackColor = COLORS.border
}: SimpleSliderProps) => {
  const [sliderWidth, setSliderWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  // Calculate the position for the thumb
  const thumbPosition = () => {
    if (maximumValue === minimumValue) return 0;
    const range = maximumValue - minimumValue;
    const normalizedValue = value - minimumValue;
    return (normalizedValue / range) * sliderWidth;
  };
  
  // Calculate value from position
  const getValueFromPosition = (positionX: number) => {
    if (sliderWidth === 0) return value;
    
    const range = maximumValue - minimumValue;
    let newValue = (positionX / sliderWidth) * range + minimumValue;
    
    // Apply step if provided
    if (step) {
      newValue = Math.round(newValue / step) * step;
    }
    
    // Ensure value is within range
    return Math.max(minimumValue, Math.min(maximumValue, newValue));
  };
  
  // Handle press start (for dragging)
  const handlePressIn = () => {
    setIsDragging(true);
  };
  
  // Handle move while pressing
  const handleMove = (event: GestureResponderEvent) => {
    if (!isDragging) return;
    
    const { locationX } = event.nativeEvent;
    const newValue = getValueFromPosition(locationX);
    onValueChange(newValue);
  };
  
  // Handle press end
  const handlePressOut = () => {
    setIsDragging(false);
  };
  
  // Handle tap on slider
  const handlePress = (event: GestureResponderEvent) => {
    const { locationX } = event.nativeEvent;
    const newValue = getValueFromPosition(locationX);
    onValueChange(newValue);
  };
  
  return (
    <View 
      style={styles.sliderContainer}
      onLayout={(event) => setSliderWidth(event.nativeEvent.layout.width)}
    >
      <View style={styles.sliderTrack}>
        {/* Minimum track (filled part) */}
        <View 
          style={[
            styles.sliderMinTrack, 
            { 
              width: thumbPosition(),
              backgroundColor: minimumTrackColor
            }
          ]} 
        />
        
        {/* Maximum track (unfilled part) */}
        <View 
          style={[
            styles.sliderMaxTrack,
            {
              width: sliderWidth - thumbPosition(),
              backgroundColor: maximumTrackColor
            }
          ]} 
        />
      </View>
      
      {/* Thumb - with touch handlers */}
      <TouchableWithoutFeedback
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
      >
        <View 
          style={[
            styles.sliderThumb,
            { left: thumbPosition() - 10 }
          ]}
        />
      </TouchableWithoutFeedback>
      
      {/* Touchable area - handle dragging */}
      <View 
        style={styles.sliderTouchArea}
        onTouchStart={handlePressIn}
        onTouchMove={handleMove}
        onTouchEnd={handlePressOut}
      />
    </View>
  );
};

export default function HomeScreen() {
  const router = useRouter();
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [historyDays, setHistoryDays] = useState(settingsService.DEFAULT_HISTORY_DAYS);
  const [historyDaysInput, setHistoryDaysInput] = useState('');
  const [suggestedReps, setSuggestedReps] = useState(settingsService.DEFAULT_SUGGESTED_REPS);
  const [suggestedRepsInput, setSuggestedRepsInput] = useState('');
  const [weightUnit, setWeightUnit] = useState<settingsService.WeightUnit>(settingsService.DEFAULT_WEIGHT_UNIT);
  const [healthSyncEnabled, setHealthSyncEnabled] = useState(Platform.OS === 'ios');
  const [savingSettings, setSavingSettings] = useState(false);
  
  // Active workout state
  const [hasActiveWorkout, setHasActiveWorkout] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [workoutStartTime, setWorkoutStartTime] = useState<Date | null>(null);

  // Import state
  const [importLoading, setImportLoading] = useState(false);

  // Load settings and check for active workout on mount
  useEffect(() => {
    loadSettings();
    checkActiveWorkout();
    
    // Cleanup timer on unmount
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  const loadSettings = async () => {
    try {
      const days = await settingsService.getHistoryDays();
      setHistoryDays(days);
      setHistoryDaysInput(days.toString());
      
      const reps = await settingsService.getSuggestedReps();
      setSuggestedReps(reps);
      setSuggestedRepsInput(reps.toString());
      
      const unit = await settingsService.getWeightUnit();
      setWeightUnit(unit);
      
      if (Platform.OS === 'ios') {
        const syncEnabled = await settingsService.getHealthSyncEnabled();
        setHealthSyncEnabled(syncEnabled);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };
  
  // Format elapsed time as HH:MM:SS
  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    const pad = (num: number) => num.toString().padStart(2, '0');
    
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  };
  
  // Check for active workout
  const checkActiveWorkout = async () => {
    try {
      const activeWorkout = await storageService.getActiveWorkout();
      if (activeWorkout && activeWorkout.exercises.length > 0) {
        setHasActiveWorkout(true);
        
        // If we have a timestamp, calculate elapsed time
        if (activeWorkout.timestamp) {
          const startTime = new Date(activeWorkout.timestamp);
          setWorkoutStartTime(startTime);
          
          // Start timer
          startTimer(startTime);
        }
      }
    } catch (error) {
      console.error('Error checking for active workout:', error);
    }
  };
  
  // Start the timer
  const startTimer = (startTime: Date) => {
    // Clear any existing timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    
    // Calculate initial elapsed time
    const now = new Date();
    const initialElapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
    setElapsedTime(initialElapsed);
    
    // Set interval to update timer every second
    timerIntervalRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
  };
  
  // Return to active workout
  const returnToWorkout = () => {
    // @ts-ignore - Suppressing type error for navigation path
    router.push({
      pathname: "/workout",
      params: { restore: 'true' }
    });
  };

  const saveSettings = async () => {
    try {
      setSavingSettings(true);
      
      // Parse and validate days input
      const days = parseInt(historyDaysInput, 10);
      const validDays = isNaN(days) ? historyDays : // Use current value if invalid
                        days < 7 ? 7 :              // Minimum 7 days
                        days > 365 ? 365 :          // Maximum 365 days
                        days;
      
      setHistoryDays(validDays);
      setHistoryDaysInput(validDays.toString());
      
      // Parse and validate reps input
      const reps = parseInt(suggestedRepsInput, 10);
      const validReps = isNaN(reps) ? suggestedReps : // Use current value if invalid
                        reps < 1 ? 1 :                // Minimum 1 rep
                        reps > 20 ? 20 :              // Maximum 20 reps
                        reps;
      
      setSuggestedReps(validReps);
      setSuggestedRepsInput(validReps.toString());
      
      // Save all settings
      await settingsService.setHistoryDays(validDays);
      await settingsService.setSuggestedReps(validReps);
      await settingsService.setWeightUnit(weightUnit);
      
      if (Platform.OS === 'ios') {
        await settingsService.setHealthSyncEnabled(healthSyncEnabled);
      }
      
      setShowSettingsModal(false);
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setSavingSettings(false);
    }
  };
  
  const toggleWeightUnit = () => {
    setWeightUnit(prev => prev === 'kg' ? 'lbs' : 'kg');
  };

  const importFromCSV = async () => {
    try {
      if (Platform.OS === 'web') {
        // Web implementation using HTML input element
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,text/csv';
        
        // Create a promise to handle the file selection
        const filePromise = new Promise<File>((resolve, reject) => {
          input.onchange = (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files && files.length > 0) {
              resolve(files[0]);
            } else {
              reject(new Error('No file selected'));
            }
          };
        });
        
        // Trigger click on the input element
        input.click();
        
        try {
          // Wait for user to select a file
          setImportLoading(true);
          const file = await filePromise;
          
          // Read the file content using FileReader API
          const fileContent = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = reject;
            reader.readAsText(file);
          });
          
          // Import the data
          const importCount = await importService.importFromStrongCSV(fileContent);
          
          setImportLoading(false);
          
          // Show success message
          Alert.alert(
            'Import Complete',
            `Successfully imported ${importCount} workouts from Strong.`,
            [{ text: 'OK' }]
          );
        } catch (error) {
          console.error('Error reading CSV file:', error);
          setImportLoading(false);
          Alert.alert('Error', 'Failed to process the CSV file.');
        }
      } else {
        // Native implementation (existing code)
        // Pick a document (limited to CSV files)
        const result = await DocumentPicker.getDocumentAsync({
          type: 'text/comma-separated-values',
          copyToCacheDirectory: true
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const file = result.assets[0];
          
          // Show loading indicator
          setImportLoading(true);
          
          // Read the file content
          try {
            // Read the file content
            const fileContent = await FileSystem.readAsStringAsync(file.uri);
            
            // Import the data
            const importCount = await importService.importFromStrongCSV(fileContent);
            
            setImportLoading(false);
            
            // Show success message
            Alert.alert(
              'Import Complete',
              `Successfully imported ${importCount} workouts from Strong.`,
              [{ text: 'OK' }]
            );
          } catch (error) {
            console.error('Error reading CSV file:', error);
            setImportLoading(false);
            Alert.alert('Error', 'Failed to process the CSV file.');
          }
        }
      }
    } catch (error) {
      console.error('Error picking CSV file:', error);
      setImportLoading(false);
      Alert.alert('Error', 'Failed to pick CSV file');
    }
  };

  return (
    <View style={styles.container}>
      {/* Active Workout Bar */}
      {hasActiveWorkout && (
        <TouchableOpacity 
          style={styles.activeWorkoutBar}
          onPress={returnToWorkout}
        >
          <View style={styles.activeWorkoutContent}>
            <Ionicons name="time-outline" size={18} color="white" />
            <Text style={styles.activeWorkoutText}>Active Workout: {formatTime(elapsedTime)}</Text>
          </View>
          <Text style={styles.continueText}>Tap to continue</Text>
        </TouchableOpacity>
      )}
      
      {/* Settings button */}
      <TouchableOpacity 
        style={[
          styles.settingsButton,
          hasActiveWorkout && styles.settingsButtonWithBar
        ]}
        onPress={() => setShowSettingsModal(true)}
      >
        <View style={styles.settingsButtonInner}>
          <Ionicons name="settings-outline" size={22} color={COLORS.card} />
        </View>
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.title}>Beat the Logbook</Text>
        <Text style={styles.subtitle}>Track your workouts and progress</Text>
        
        <View style={styles.buttonsContainer}>
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: COLORS.success }]}
            onPress={() => {
              // @ts-ignore - Suppressing type error for navigation path
              router.push("workout");
            }}
          >
            <View style={styles.buttonContent}>
              <Ionicons name="fitness-outline" size={22} color={COLORS.card} style={styles.buttonIcon} />
              <Text style={styles.buttonText}>Start Workout</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: COLORS.primary }]}
            onPress={() => {
              // @ts-ignore - Suppressing type error for navigation path
              router.push("templates");
            }}
          >
            <View style={styles.buttonContent}>
              <Ionicons name="copy-outline" size={22} color={COLORS.card} style={styles.buttonIcon} />
              <Text style={styles.buttonText}>Workout Templates</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: COLORS.primaryDark }]}
            onPress={() => {
              // @ts-ignore - Suppressing type error for navigation path
              router.push("history");
            }}
          >
            <View style={styles.buttonContent}>
              <Ionicons name="time-outline" size={22} color={COLORS.card} style={styles.buttonIcon} />
              <Text style={styles.buttonText}>View Workout History</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: COLORS.secondary }]}
            onPress={() => {
              // @ts-ignore - Suppressing type error for navigation path
              router.push("exercise-history");
            }}
          >
            <View style={styles.buttonContent}>
              <Ionicons name="stats-chart-outline" size={22} color={COLORS.card} style={styles.buttonIcon} />
              <Text style={styles.buttonText}>Exercise History & Stats</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Settings Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showSettingsModal}
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Settings</Text>
            
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>History Range (Days)</Text>
              <TextInput
                style={styles.settingInput}
                value={historyDaysInput}
                onChangeText={setHistoryDaysInput}
                keyboardType="numeric"
                maxLength={3}
              />
            </View>
            <Text style={styles.settingDescription}>
              Number of days to look back for exercise history (7-365)
            </Text>
            
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Target Reps</Text>
              <TextInput
                style={styles.settingInput}
                value={suggestedRepsInput}
                onChangeText={setSuggestedRepsInput}
                keyboardType="numeric"
                maxLength={2}
              />
            </View>
            <Text style={styles.settingDescription}>
              Target reps for suggested weight calculation (1-20)
            </Text>
            
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Weight Unit</Text>
              <TouchableOpacity
                style={styles.unitToggleButton}
                onPress={toggleWeightUnit}
              >
                <Text style={styles.unitToggleText}>
                  {weightUnit.toUpperCase()}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.settingDescription}>
              Unit for displaying and recording weights (kg/lbs)
            </Text>
            
            {/* Only show Apple Health sync option on iOS (not on web) */}
            {Platform.OS === 'ios' && (
              <>
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Sync with Apple Health</Text>
                  <Switch
                    value={healthSyncEnabled}
                    onValueChange={setHealthSyncEnabled}
                    trackColor={{ false: COLORS.border, true: COLORS.primary }}
                    thumbColor={COLORS.card}
                  />
                </View>
                <Text style={styles.settingDescription}>
                  Automatically sync workouts to Apple Health
                </Text>
              </>
            )}
            
            <View style={styles.divider} />
            
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Import Data</Text>
              <TouchableOpacity
                style={styles.importDataButton}
                onPress={() => {
                  setShowSettingsModal(false);
                  
                  // Import from CSV file
                  Alert.alert(
                    'Import from Strong App',
                    'This will import your workout data from a Strong app CSV export file. Continue?',
                    [
                      {
                        text: 'Cancel',
                        style: 'cancel'
                      },
                      {
                        text: 'Continue',
                        onPress: () => importFromCSV()
                      }
                    ]
                  );
                }}
                disabled={importLoading}
              >
                {importLoading ? (
                  <ActivityIndicator size="small" color={COLORS.success} />
                ) : (
                  <Text style={styles.importDataButtonText}>Import from CSV</Text>
                )}
              </TouchableOpacity>
            </View>
            <Text style={styles.settingDescription}>
              Import workout history from other fitness apps (Strong)
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowSettingsModal(false)}
                disabled={savingSettings}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.saveButton}
                onPress={saveSettings}
                disabled={savingSettings}
              >
                {savingSettings ? (
                  <ActivityIndicator size="small" color={COLORS.card} />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
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
    backgroundColor: COLORS.background,
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  header: {
    marginTop: 30,
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    marginBottom: 30,
  },
  buttonsContainer: {
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
    marginTop: 10,
  },
  button: {
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonIcon: {
    marginRight: 10,
  },
  buttonText: {
    color: COLORS.card,
    fontWeight: 'bold',
    fontSize: 17,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: `${COLORS.shadow.slice(0, -4)}0.5)`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: COLORS.text,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 10,
    color: COLORS.text,
  },
  settingInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
    backgroundColor: COLORS.card,
    color: COLORS.text,
  },
  settingDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    backgroundColor: COLORS.background,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 5,
    flex: 1,
    marginRight: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelButtonText: {
    color: COLORS.textSecondary,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 5,
    flex: 1,
  },
  saveButtonText: {
    color: COLORS.card,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  sliderContainer: {
    height: 40,
    position: 'relative',
    flex: 1,
    marginHorizontal: 10,
    justifyContent: 'center',
  },
  sliderTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    flexDirection: 'row',
    position: 'relative',
  },
  sliderMinTrack: {
    height: '100%',
    borderTopLeftRadius: 2,
    borderBottomLeftRadius: 2,
    position: 'absolute',
    left: 0,
  },
  sliderMaxTrack: {
    height: '100%',
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    position: 'absolute',
    right: 0,
  },
  sliderThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    position: 'absolute',
    top: 10,
    marginTop: -10,
    elevation: 3,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    zIndex: 2,
  },
  sliderTouchArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  unitToggleButton: {
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 5,
    backgroundColor: COLORS.card,
    minWidth: 60,
    alignItems: 'center',
  },
  unitToggleText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  activeWorkoutBar: {
    backgroundColor: COLORS.success,
    paddingVertical: 10,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  activeWorkoutContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeWorkoutText: {
    color: COLORS.card,
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 5,
  },
  continueText: {
    color: COLORS.card,
    fontSize: 14,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 10,
  },
  importDataButton: {
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 5,
    backgroundColor: COLORS.card,
    minWidth: 60,
    alignItems: 'center',
  },
  importDataButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  settingsButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 30,
    right: 20,
    zIndex: 10,
    padding: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 30,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  settingsButtonInner: {
    padding: 6,
  },
  settingsButtonWithBar: {
    top: Platform.OS === 'ios' ? 100 : 70,
  },
});
