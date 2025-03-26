import { StyleSheet, View } from 'react-native';
import HomeScreen from '../index';

export default function HomeTab() {
  return (
    <View style={styles.container}>
      <HomeScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
}); 