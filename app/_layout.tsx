import React, { useState, useEffect } from "react";
import { Stack, usePathname } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StyleSheet, View, Modal, Text, TouchableOpacity, Platform } from "react-native";
import ActiveWorkoutBanner from "./components/ActiveWorkoutBanner";
import * as storageService from "../services/storageService";

export default function RootLayout() {
  const [hasActiveWorkout, setHasActiveWorkout] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const pathname = usePathname();
  const isWorkoutScreen = pathname === "/workout";

  useEffect(() => {
    // Check for active workout on component mount
    checkActiveWorkout();
    
    // Set up interval to periodically check for active workout
    const intervalId = setInterval(checkActiveWorkout, 10000);
    
    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, []);
  
  const checkActiveWorkout = async () => {
    try {
      const activeWorkout = await storageService.getActiveWorkout();
      setHasActiveWorkout(!!activeWorkout && activeWorkout.exercises.length > 0);
    } catch (error) {
      console.error("Error checking for active workout:", error);
    }
  };
  
  const discardWorkout = async () => {
    try {
      await storageService.clearActiveWorkout();
      setHasActiveWorkout(false);
      setShowDiscardModal(false);
    } catch (error) {
      console.error("Error discarding workout:", error);
    }
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Show active workout banner if there's an active workout and not on workout screen */}
      {hasActiveWorkout && !isWorkoutScreen && (
        <ActiveWorkoutBanner 
          onClose={() => setShowDiscardModal(true)} 
        />
      )}
      
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
      
      {/* Discard workout confirmation modal */}
      <Modal
        visible={showDiscardModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDiscardModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Discard Workout?</Text>
            <Text style={styles.modalText}>
              Are you sure you want to discard your active workout? This action cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowDiscardModal(false)}
              >
                <Text style={styles.cancelButtonText}>Keep Workout</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.discardButton]}
                onPress={discardWorkout}
              >
                <Text style={styles.discardButtonText}>Discard</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bannerContainer: {
    position: 'absolute', 
    top: Platform.OS === 'ios' ? 90 : 0, 
    left: 0, 
    right: 0,
    zIndex: 1000,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  modalText: {
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    padding: 10,
    borderRadius: 5,
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#333',
  },
  discardButton: {
    backgroundColor: '#ff3b30',
  },
  discardButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});
