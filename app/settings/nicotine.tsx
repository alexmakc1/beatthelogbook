import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../services/colors';
import * as nicotineService from '../../services/nicotineService';

export default function NicotineSettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState(nicotineService.DEFAULT_NICOTINE_SETTINGS);
  const [dailyGoal, setDailyGoal] = useState(settings.dailyGoal.toString());

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const loadedSettings = await nicotineService.getNicotineSettings();
    setSettings(loadedSettings);
    setDailyGoal(loadedSettings.dailyGoal.toString());
  };

  const handleSave = async () => {
    const newSettings = {
      ...settings,
      dailyGoal: parseInt(dailyGoal, 10),
    };
    await nicotineService.updateNicotineSettings(newSettings);
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nicotine Settings</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Daily Goal</Text>
            <TextInput
              style={styles.input}
              value={dailyGoal}
              onChangeText={setDailyGoal}
              keyboardType="numeric"
              placeholder="Enter daily goal"
            />
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Default Amount</Text>
            <TextInput
              style={styles.input}
              value={settings.defaultAmount.toString()}
              onChangeText={(value) => setSettings({ ...settings, defaultAmount: parseFloat(value) })}
              keyboardType="numeric"
              placeholder="Enter default amount"
            />
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Tracking Mode</Text>
            <View style={styles.trackingModeContainer}>
              <TouchableOpacity
                style={[
                  styles.trackingModeButton,
                  settings.trackingMode === 'mg' && styles.trackingModeButtonActive,
                ]}
                onPress={() => setSettings({ ...settings, trackingMode: 'mg' })}
              >
                <Text
                  style={[
                    styles.trackingModeButtonText,
                    settings.trackingMode === 'mg' && styles.trackingModeButtonTextActive,
                  ]}
                >
                  mg
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.trackingModeButton,
                  settings.trackingMode === 'frequency' && styles.trackingModeButtonActive,
                ]}
                onPress={() => setSettings({ ...settings, trackingMode: 'frequency' })}
              >
                <Text
                  style={[
                    styles.trackingModeButtonText,
                    settings.trackingMode === 'frequency' && styles.trackingModeButtonTextActive,
                  ]}
                >
                  frequency
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>Save Settings</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginLeft: 8,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  settingRow: {
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: COLORS.background,
    fontSize: 16,
    color: COLORS.text,
  },
  trackingModeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trackingModeButton: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  trackingModeButtonActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  trackingModeButtonText: {
    color: COLORS.text,
  },
  trackingModeButtonTextActive: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    margin: 16,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 