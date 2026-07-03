/**
 * PropertyVerse
 * Voice-first lead capture for real estate agents.
 *
 * @format
 */

import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { colors } from './src/theme';

// Fallback metrics so SafeAreaProvider renders immediately on web (where it
// would otherwise show nothing until it measures insets).
const fallbackMetrics = {
  frame: { x: 0, y: 0, width: 0, height: 0 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function App() {
  // The app is always light-themed (warm off-white background), so the status
  // bar must ALWAYS use dark icons — regardless of the device's dark mode — or
  // the clock/battery icons turn white and disappear against our light header.
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics ?? fallbackMetrics}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} translucent={false} />
      <RootNavigator />
    </SafeAreaProvider>
  );
}

export default App;
