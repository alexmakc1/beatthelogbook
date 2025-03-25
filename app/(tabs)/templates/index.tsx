import { StyleSheet, View } from 'react-native';
import TemplatesScreen from '../../templates';

export default function TemplatesTab() {
  return (
    <View style={styles.container}>
      <TemplatesScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
}); 