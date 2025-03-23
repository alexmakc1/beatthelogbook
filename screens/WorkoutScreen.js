import React from 'react';
import { View, Text, Button } from 'react-native';

export default function WorkoutScreen({ navigation }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Workout Session</Text>
      <Button
        title="Log Workout"
        onPress={() => navigation.navigate('Log')}
      />
    </View>
  );
} 