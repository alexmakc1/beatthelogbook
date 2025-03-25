import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { COLORS } from '../../services/colors';
import * as storageService from '../../services/storageService';

type Workout = storageService.Workout;

interface WorkoutCalendarViewProps {
  workouts: Workout[];
  onDayPress?: (date: string) => void;
}

export default function WorkoutCalendarView({ workouts, onDayPress }: WorkoutCalendarViewProps) {
  const markedDates = workouts.reduce((acc, workout) => {
    const date = workout.date.split('T')[0];
    acc[date] = {
      marked: true,
      dotColor: COLORS.primary
    };
    return acc;
  }, {} as { [key: string]: { marked: boolean; dotColor: string } });

  return (
    <View style={styles.container}>
      <Calendar
        markedDates={markedDates}
        onDayPress={(day: { dateString: string }) => onDayPress?.(day.dateString)}
        theme={{
          todayTextColor: COLORS.primary,
          selectedDayBackgroundColor: COLORS.primary,
          selectedDayTextColor: '#ffffff',
          monthTextColor: COLORS.text,
          textMonthFontSize: 16,
          textDayHeaderFontSize: 14,
          textDayFontSize: 14,
          dotColor: COLORS.primary,
          arrowColor: COLORS.primary,
        }}
        hideArrows={false}
        hideExtraDays={true}
        disableMonthChange={false}
        firstDay={1}
        showWeekNumbers={false}
        disableArrowLeft={false}
        disableArrowRight={false}
        disableAllTouchEventsForDisabledDays={true}
        enableSwipeMonths={true}
        enableSwipeDays={false}
        disableWeekScroll={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 10,
    margin: 10,
  },
}); 