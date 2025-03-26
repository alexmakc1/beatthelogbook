import { registerRootComponent } from 'expo';
import { ExpoRoot } from 'expo-router';

// We're using expo-router now, so we don't need this file for navigation anymore
export default function App() {
  return <ExpoRoot context={require.context('./app')} />;
}

registerRootComponent(App); 