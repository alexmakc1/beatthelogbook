import { StyleSheet, View } from 'react-native';
import ExerciseHistoryScreen from '../../exercise-history';

export default function ExerciseHistoryTab() {
  return (
    <View style={styles.container}>
      <ExerciseHistoryScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
}); 