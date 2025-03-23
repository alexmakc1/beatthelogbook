import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../../services/colors';

export default function LogScreen() {
  const router = useRouter();
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Log Your Workout</Text>
      <Text style={styles.subtitle}>Record your sets and reps here</Text>
      
      <Button
        title="Go Back to Workout"
        onPress={() => router.back()}
        color={COLORS.secondary}
      />
      
      <Button
        title="Go to Home"
        onPress={() => router.push('/')}
        color={COLORS.primary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.background,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
    color: COLORS.textSecondary,
  }
}); 