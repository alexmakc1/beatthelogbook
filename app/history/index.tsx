import React, { useState, useEffect, useMemo } from 'react';
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
import { Calendar, DateData } from 'react-native-calendars';

type Workout = storageService.Workout;

// Define view modes
type ViewMode = 'list' | 'calendar';

// Define our own MarkedDates type
type MarkedDates = {
  [date: string]: {
    marked?: boolean;
    dotColor?: string;
    selected?: boolean;
    selectedColor?: string;
  };
};

export default function HistoryScreen() {
  const router = useRouter();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  // Add state for selection mode
  const [selectMode, setSelectMode] = useState(false);
  const [selectedWorkouts, setSelectedWorkouts] = useState<string[]>([]);
  // Add state for view mode
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  // Add state for selected date on calendar
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  
  // Filtered workouts based on selected date
  const filteredWorkouts = useMemo(() => {
    if (!selectedDate || viewMode !== 'calendar') {
      return workouts;
    }
    
    try {
      return workouts.filter(workout => {
        if (!workout.date) return false;
        
        // Convert both dates to their local date strings (YYYY-MM-DD)
        // This normalizes the dates and removes time/timezone complications
        const workoutDate = new Date(workout.date);
        const workoutDateStr = workoutDate.toISOString().split('T')[0];
        
        // Selected date is already in YYYY-MM-DD format, so use it directly
        return workoutDateStr === selectedDate;
      });
    } catch (err) {
      console.error('Error filtering workouts by date:', err);
      return [];
    }
  }, [workouts, selectedDate, viewMode]);

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
    } catch (err) {
      console.error('Error formatting date:', err);
      return "Error formatting date";
    }
  };

  // Navigate to workout details
  const navigateToWorkoutDetails = (workoutId: string) => {
    if (selectMode) {
      toggleWorkoutSelection(workoutId);
      return;
    }
    
    // @ts-ignore
    router.push({
      pathname: "/workout-details/[id]",
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
  
  // Toggle workout selection
  const toggleWorkoutSelection = (workoutId: string) => {
    setSelectedWorkouts(prev => {
      if (prev.includes(workoutId)) {
        return prev.filter(id => id !== workoutId);
      } else {
        return [...prev, workoutId];
      }
    });
  };
  
  // Delete selected workouts
  const deleteSelectedWorkouts = () => {
    if (selectedWorkouts.length === 0) return;
    
    Alert.alert(
      "Delete Selected Workouts",
      `Are you sure you want to delete ${selectedWorkouts.length} workout(s)?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              // Create a new array without the deleted workouts
              const updatedWorkouts = workouts.filter(workout => !selectedWorkouts.includes(workout.id));
              
              // Update state immediately for better UX
              setWorkouts(updatedWorkouts);
              
              // Delete each workout from storage
              for (const workoutId of selectedWorkouts) {
                await storageService.deleteWorkout(workoutId);
              }
              
              // Clear selection mode and selected workouts
              setSelectMode(false);
              setSelectedWorkouts([]);
            } catch (error) {
              console.error('Error deleting workouts:', error);
              Alert.alert('Error', 'Failed to delete workouts');
              // Reload workouts if delete failed
              loadWorkouts();
            }
          }
        }
      ]
    );
  };
  
  // Create a ref outside the render function 
  const swipeableRefs = React.useRef<{[key: string]: Swipeable | null}>({});
  
  const closeSwipeable = (id: string) => {
    if (swipeableRefs.current[id]) {
      swipeableRefs.current[id]?.close();
    }
  };
  
  // Render each workout item
  const renderWorkoutItem = ({ item }: { item: Workout }) => {
    const isSelected = selectedWorkouts.includes(item.id);
    
    const renderRightActions = () => {
      return (
        <TouchableOpacity
          style={styles.deleteAction}
          onPress={() => {
            closeSwipeable(item.id);
            deleteWorkout(item.id);
          }}
        >
          <Text style={styles.deleteActionText}>Delete</Text>
        </TouchableOpacity>
      );
    };
    
    return (
      <Swipeable
        ref={ref => {
          if (ref) {
            swipeableRefs.current[item.id] = ref;
          }
        }}
        renderRightActions={renderRightActions}
        enabled={!selectMode}
      >
        <TouchableOpacity
          onPress={() => navigateToWorkoutDetails(item.id)}
          onLongPress={() => {
            if (!selectMode) {
              setSelectMode(true);
              setSelectedWorkouts([item.id]);
            }
          }}
          style={[
            styles.workoutCard,
            isSelected && styles.selectedWorkoutCard
          ]}
        >
          {selectMode && (
            <View style={[styles.checkbox, isSelected && styles.checkedCheckbox]}>
              {isSelected && <Text style={styles.checkmark}>✓</Text>}
            </View>
          )}
          
          <View style={selectMode ? styles.workoutContentWithCheckbox : styles.workoutContent}>
            <Text style={styles.dateText}>{formatDate(item.date)}</Text>
            
            <Text style={styles.exerciseCount}>
              {item.exercises.length} exercise{item.exercises.length !== 1 ? 's' : ''}
            </Text>
            
            <View style={styles.exerciseList}>
              {item.exercises.slice(0, 3).map((exercise, index) => (
                <Text key={index} style={styles.exerciseItem}>
                  • {exercise.name} ({exercise.sets.length} sets)
                </Text>
              ))}
              
              {item.exercises.length > 3 && (
                <Text style={styles.moreText}>
                  +{item.exercises.length - 3} more...
                </Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  };
  
  // Generate marked dates for the calendar
  const getMarkedDates = () => {
    const markedDates: MarkedDates = {};
    
    // Group workouts by date
    const workoutCounts: {[key: string]: number} = {};
    
    workouts.forEach(workout => {
      if (!workout.date) return;
      
      const date = new Date(workout.date);
      // Use the ISO date string (YYYY-MM-DD) to be consistent with filtering
      const dateString = date.toISOString().split('T')[0];
      workoutCounts[dateString] = (workoutCounts[dateString] || 0) + 1;
    });
    
    // Mark dates with workouts
    Object.keys(workoutCounts).forEach(dateString => {
      markedDates[dateString] = {
        marked: true,
        dotColor: COLORS.primary
      };
    });
    
    // Add selected date styling if in calendar view
    if (selectedDate && viewMode === 'calendar') {
      markedDates[selectedDate] = {
        ...markedDates[selectedDate],
        marked: true,
        dotColor: COLORS.success,
        selected: true
      };
    }
    
    return markedDates;
  };
  
  // Handle date selection on calendar
  const onDayPress = (day: DateData) => {
    setSelectedDate(day.dateString);
  };
  
  // Render content based on view mode
  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={{ marginTop: 10, color: COLORS.textSecondary }}>Loading workout history...</Text>
        </View>
      );
    }
    
    if (viewMode === 'list') {
      return (
        <>
          <View style={styles.header}>
            <Text style={styles.title}>Workout History</Text>
            
            {selectMode ? (
              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity
                  onPress={() => {
                    setSelectMode(false);
                    setSelectedWorkouts([]);
                  }}
                  style={{ marginRight: 10 }}
                >
                  <Text style={{ color: COLORS.primary }}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={deleteSelectedWorkouts}
                  disabled={selectedWorkouts.length === 0}
                >
                  <Text style={{ 
                    color: selectedWorkouts.length > 0 ? COLORS.accent : COLORS.textSecondary 
                  }}>
                    Delete ({selectedWorkouts.length})
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  setSelectMode(true);
                }}
              >
                <Text style={{ color: COLORS.primary }}>Select</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {workouts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No workout history yet</Text>
            </View>
          ) : (
            <FlatList
              data={workouts}
              renderItem={renderWorkoutItem}
              keyExtractor={item => item.id}
              contentContainerStyle={{ paddingBottom: 80 }}
            />
          )}
          
          {!selectMode && (
            <TouchableOpacity 
              style={styles.startButton}
              onPress={() => {
                // @ts-ignore - Suppressing type error for navigation path
                router.push("workout");
              }}
            >
              <Text style={styles.buttonText}>Start New Workout</Text>
            </TouchableOpacity>
          )}
        </>
      );
    } else {
      // Calendar view
      return (
        <View style={{ flex: 1 }}>
          <View style={styles.header}>
            <Text style={styles.title}>Workout Calendar</Text>
            <Text style={{ fontSize: 14, color: COLORS.textSecondary }}>Select a date to view workouts</Text>
          </View>
          
          <Calendar
            style={styles.calendar}
            current={selectedDate || undefined}
            initialDate={new Date().toISOString().split('T')[0]}
            theme={{
              calendarBackground: COLORS.card,
              textSectionTitleColor: COLORS.text,
              dayTextColor: COLORS.text,
              todayTextColor: COLORS.primary,
              selectedDayTextColor: COLORS.card,
              selectedDayBackgroundColor: COLORS.primary,
              indicatorColor: COLORS.primary,
              monthTextColor: COLORS.text,
              textDisabledColor: COLORS.textSecondary,
              arrowColor: COLORS.primary,
            }}
            markedDates={getMarkedDates()}
            onDayPress={onDayPress}
            enableSwipeMonths={true}
            hideExtraDays={false}
          />
          
          <View style={[styles.calendarWorkoutsContainer, { flex: 1 }]}>
            <Text style={styles.calendarSectionTitle}>
              {selectedDate 
                ? `Workouts on ${new Date(selectedDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}` 
                : 'Select a date to view workouts'}
            </Text>
            
            {selectedDate && filteredWorkouts.length === 0 && (
              <Text style={styles.emptyText}>No workouts on this date</Text>
            )}
            
            {selectedDate && filteredWorkouts.length > 0 && (
              <FlatList
                data={filteredWorkouts}
                renderItem={renderWorkoutItem}
                keyExtractor={item => item.id}
                contentContainerStyle={{ paddingBottom: 20 }}
                initialNumToRender={5}
                maxToRenderPerBatch={10}
                windowSize={5}
              />
            )}
          </View>
          
          <TouchableOpacity 
            style={styles.startButton}
            onPress={() => {
              // @ts-ignore - Suppressing type error for navigation path
              router.push("workout");
            }}
          >
            <Text style={styles.buttonText}>Start New Workout</Text>
          </TouchableOpacity>
        </View>
      );
    }
  };

  // Function to handle going back
  const handleBack = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Workout History</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')}>
            <MaterialIcons 
              name={viewMode === 'list' ? 'calendar-today' : 'list'} 
              size={24} 
              color={COLORS.primary} 
            />
          </TouchableOpacity>
        </View>
      </View>

      {renderContent()}
      
      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={[styles.navButton, viewMode === 'list' && styles.activeNavButton]}
          onPress={() => {
            setViewMode('list');
            setSelectedDate(null);
          }}
        >
          <MaterialIcons 
            name="list" 
            size={24} 
            color={viewMode === 'list' ? COLORS.primary : COLORS.textSecondary} 
          />
          <Text style={[styles.navButtonText, viewMode === 'list' && styles.activeNavButtonText]}>
            List View
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.navButton, viewMode === 'calendar' && styles.activeNavButton]}
          onPress={() => {
            setViewMode('calendar');
            setSelectMode(false);
            setSelectedWorkouts([]);
          }}
        >
          <MaterialIcons 
            name="calendar-today" 
            size={22} 
            color={viewMode === 'calendar' ? COLORS.primary : COLORS.textSecondary} 
          />
          <Text style={[styles.navButtonText, viewMode === 'calendar' && styles.activeNavButtonText]}>
            Calendar
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 50,
    paddingBottom: 0, // Remove bottom padding since we have the nav bar now
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
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'left',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 20,
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
    marginVertical: 20,
  },
  workoutCard: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    flexDirection: 'row',
  },
  selectedWorkoutCard: {
    borderColor: COLORS.primary,
    borderWidth: 2,
    backgroundColor: COLORS.primaryLight,
  },
  workoutContent: {
    flex: 1,
  },
  workoutContentWithCheckbox: {
    flex: 1,
    marginLeft: 10,
  },
  dateText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    color: COLORS.text,
  },
  exerciseCount: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 10,
  },
  exerciseList: {
    marginTop: 5,
  },
  exerciseItem: {
    fontSize: 14,
    marginBottom: 3,
    color: COLORS.text,
  },
  moreText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  startButton: {
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 70, // Add bottom margin to not overlap with nav bar
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  buttonText: {
    color: COLORS.card,
    fontWeight: 'bold',
    fontSize: 16,
  },
  deleteAction: {
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '91%',
    marginBottom: 15,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
  },
  deleteActionText: {
    color: COLORS.card,
    fontWeight: 'bold',
    fontSize: 16,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: COLORS.card,
  },
  checkedCheckbox: {
    backgroundColor: COLORS.primary,
  },
  checkmark: {
    color: COLORS.card,
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Bottom Navigation Bar Styles
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    height: 60,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 20 : 0, // Add extra padding for iOS home indicator
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  navButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
  },
  activeNavButton: {
    borderTopWidth: 2,
    borderTopColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  navButtonText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  activeNavButtonText: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  // Calendar view styles
  calendar: {
    marginHorizontal: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    marginBottom: 15,
  },
  calendarWorkoutsContainer: {
    flex: 1,
    padding: 10,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    marginHorizontal: 5,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'hidden',  // This prevents content from overflowing
  },
  calendarSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: COLORS.text,
    textAlign: 'center',
  },
}); 