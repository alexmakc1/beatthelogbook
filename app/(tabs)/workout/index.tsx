import { StyleSheet, View } from 'react-native';
import WorkoutScreen from '../../workout';

export default function WorkoutTab() {
  return (
    <View style={styles.container}>
      <WorkoutScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
}); 