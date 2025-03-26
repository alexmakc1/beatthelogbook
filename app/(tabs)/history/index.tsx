import { StyleSheet, View } from 'react-native';
import HistoryScreen from '../../history';

export default function HistoryTab() {
  return (
    <View style={styles.container}>
      <HistoryScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
}); 