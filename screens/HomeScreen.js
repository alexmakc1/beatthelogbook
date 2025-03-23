import React from 'react';
import { View, Text, Button } from 'react-native';

export default function HomeScreen({ navigation }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Welcome to the Workout Tracker!</Text>
      <Button
        title="Start Workout"
        onPress={() => navigation.navigate('Workout')}
      />
    </View>
  );
} 