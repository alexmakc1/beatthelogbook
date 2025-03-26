import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  Switch,
} from 'react-native';
import { COLORS } from '../../services/colors';
import * as nicotineService from '../../services/nicotineService';

export default function SettingsScreen() {
  const [nicotineSettings, setNicotineSettings] = useState<nicotineService.NicotineSettings | null>(null);
  const [dailyGoal, setDailyGoal] = useState('');
  const [defaultAmount, setDefaultAmount] = useState('');
  const [trackingMode, setTrackingMode] = useState<'mg' | 'frequency'>('mg');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const settings = await nicotineService.getNicotineSettings();
      setNicotineSettings(settings);
      setDailyGoal(settings.dailyGoal.toString());
      setDefaultAmount(settings.defaultAmount.toString());
      setTrackingMode(settings.trackingMode);
    } catch (error) {
      console.error('Error loading settings:', error);
      Alert.alert('Error', 'Failed to load settings');
      // Set default values if loading fails
      setNicotineSettings(nicotineService.DEFAULT_NICOTINE_SETTINGS);
      setDailyGoal(nicotineService.DEFAULT_NICOTINE_SETTINGS.dailyGoal.toString());
      setDefaultAmount(nicotineService.DEFAULT_NICOTINE_SETTINGS.defaultAmount.toString());
      setTrackingMode(nicotineService.DEFAULT_NICOTINE_SETTINGS.trackingMode);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      const newSettings: nicotineService.NicotineSettings = {
        trackingMode,
        dailyGoal: parseFloat(dailyGoal) || 0,
        defaultAmount: parseFloat(defaultAmount) || 0,
      };

      const success = await nicotineService.updateNicotineSettings(newSettings);
      if (success) {
        Alert.alert('Success', 'Settings saved successfully');
        setNicotineSettings(newSettings);
      } else {
        Alert.alert('Error', 'Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Nicotine Tracking</Text>
        
        <View style={styles.setting}>
          <Text style={styles.settingLabel}>Tracking Mode</Text>
          <View style={styles.trackingModeContainer}>
            <TouchableOpacity
              style={[
                styles.trackingModeButton,
                trackingMode === 'mg' && styles.trackingModeButtonActive,
              ]}
              onPress={() => setTrackingMode('mg')}
            >
              <Text style={[
                styles.trackingModeText,
                trackingMode === 'mg' && styles.trackingModeTextActive,
              ]}>Milligrams (mg)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.trackingModeButton,
                trackingMode === 'frequency' && styles.trackingModeButtonActive,
              ]}
              onPress={() => setTrackingMode('frequency')}
            >
              <Text style={[
                styles.trackingModeText,
                trackingMode === 'frequency' && styles.trackingModeTextActive,
              ]}>Frequency</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.setting}>
          <Text style={styles.settingLabel}>
            Daily Goal ({trackingMode === 'mg' ? 'mg' : 'times'})
          </Text>
          <TextInput
            style={styles.input}
            value={dailyGoal}
            onChangeText={setDailyGoal}
            keyboardType="numeric"
            placeholder="Enter daily goal"
            placeholderTextColor={COLORS.textSecondary}
          />
        </View>

        <View style={styles.setting}>
          <Text style={styles.settingLabel}>Default Amount (mg)</Text>
          <TextInput
            style={styles.input}
            value={defaultAmount}
            onChangeText={setDefaultAmount}
            keyboardType="numeric"
            placeholder="Enter default amount"
            placeholderTextColor={COLORS.textSecondary}
          />
        </View>

        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSaveSettings}
        >
          <Text style={styles.saveButtonText}>Save Settings</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.text,
  },
  section: {
    padding: 16,
    backgroundColor: COLORS.card,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 16,
  },
  setting: {
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 8,
  },
  trackingModeContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 4,
  },
  trackingModeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  trackingModeButtonActive: {
    backgroundColor: COLORS.primary,
  },
  trackingModeText: {
    fontSize: 14,
    color: COLORS.text,
  },
  trackingModeTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.text,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 