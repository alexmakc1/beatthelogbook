import { StyleSheet, View } from 'react-native';
import NutritionScreen from '../../nutrition';

export default function NutritionTab() {
  return (
    <View style={styles.container}>
      <NutritionScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
}); 