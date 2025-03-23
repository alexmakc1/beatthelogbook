import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="workout/index"
        options={{
          title: 'Workout',
        }}
      />
      <Tabs.Screen
        name="templates/index"
        options={{
          title: 'Templates',
        }}
      />
      <Tabs.Screen
        name="history/index"
        options={{
          title: 'History',
        }}
      />
      <Tabs.Screen
        name="exercise-history/index"
        options={{
          title: 'Exercise History',
        }}
      />
      <Tabs.Screen
        name="nutrition/index"
        options={{
          title: 'Nutrition',
        }}
      />
    </Tabs>
  );
} 