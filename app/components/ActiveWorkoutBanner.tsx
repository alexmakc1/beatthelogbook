import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as storageService from '../../services/storageService';
import { COLORS } from '../../services/colors';

interface ActiveWorkoutBannerProps {
  onClose?: () => void;
}

const ActiveWorkoutBanner = ({ onClose }: ActiveWorkoutBannerProps) => {
  const router = useRouter();
  const [elapsedTime, setElapsedTime] = useState(0);
  const [workoutName, setWorkoutName] = useState('Workout in Progress');
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    checkActiveWorkout();

    // Clean up timer on unmount
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  const checkActiveWorkout = async () => {
    try {
      const activeWorkout = await storageService.getActiveWorkout();
      if (activeWorkout && activeWorkout.exercises.length > 0) {
        // Set workout name based on first exercise if available
        if (activeWorkout.exercises.length > 0) {
          setWorkoutName(activeWorkout.exercises[0].name + ' Workout');
        }
        
        // If we have a timestamp, calculate elapsed time
        if (activeWorkout.timestamp) {
          const startTime = new Date(activeWorkout.timestamp);
          startTimer(startTime);
        }
      }
    } catch (error) {
      console.error('Error checking for active workout:', error);
    }
  };

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

  // Format elapsed time as HH:MM:SS
  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    const pad = (num: number) => num.toString().padStart(2, '0');
    
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  };

  const returnToWorkout = () => {
    router.push({
      pathname: "/workout",
      params: { restore: 'true' }
    });
  };

  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={returnToWorkout}
      activeOpacity={0.8}
    >
      <View style={styles.content}>
        <Ionicons name="fitness-outline" size={20} color="#fff" />
        <Text style={styles.text} numberOfLines={1} ellipsizeMode="tail">
          {workoutName}
        </Text>
        <Text style={styles.timer}>{formatTime(elapsedTime)}</Text>
      </View>
      
      {onClose && (
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={20} color="#fff" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.success,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  text: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 10,
    flex: 1,
  },
  timer: {
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: 'bold',
    marginLeft: 10,
  },
  closeButton: {
    padding: 5,
  },
});

export default ActiveWorkoutBanner; 