import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTitle: 'Settings',
      }}
    />
  );
} 