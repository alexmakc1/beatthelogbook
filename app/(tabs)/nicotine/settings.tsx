import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView, Platform } from 'react-native';
import { COLORS } from '../../../services/colors';
import { Ionicons } from '@expo/vector-icons';
import * as nicotineService from '../../../services/nicotineService';

interface NicotineSettingsProps {
  onClose: () => void;
}

const NicotineSettings: React.FC<NicotineSettingsProps> = ({ onClose }) => {
  const [showModal, setShowModal] = useState(false);
  const [settings, setSettings] = useState(nicotineService.DEFAULT_NICOTINE_SETTINGS);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const nicotineSettings = await nicotineService.getNicotineSettings();
      setSettings(nicotineSettings);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async () => {
    try {
      await nicotineService.updateNicotineSettings({
        dailyUsageGoal: parseFloat(settings.dailyUsageGoal.toString()),
        dailyFrequencyGoal: parseInt(settings.dailyFrequencyGoal.toString()),
        trackingMode: settings.trackingMode,
        defaultDosage: parseFloat(settings.defaultDosage.toString()),
      });
      setShowModal(false);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const handleSettingChange = (key: keyof nicotineService.NicotineSettings, value: any) => {
    setSettings(prevSettings => ({
      ...prevSettings,
      [key]: value,
    }));
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.settingsButton}
        onPress={() => setShowModal(true)}
      >
        <Ionicons name="settings-outline" size={24} color={COLORS.text} />
      </TouchableOpacity>

      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nicotine Tracker Settings</Text>
              <TouchableOpacity
                onPress={() => setShowModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollContent}>
              <View style={styles.settingGroup}>
                <Text style={styles.settingLabel}>Daily Usage Goal (mg)</Text>
                <TextInput
                  style={styles.input}
                  value={settings.dailyUsageGoal.toString()}
                  onChangeText={(value) => handleSettingChange('dailyUsageGoal', parseFloat(value) || 0)}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.settingGroup}>
                <Text style={styles.settingLabel}>Daily Frequency Goal</Text>
                <TextInput
                  style={styles.input}
                  value={settings.dailyFrequencyGoal.toString()}
                  onChangeText={(value) => handleSettingChange('dailyFrequencyGoal', parseInt(value) || 0)}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.settingGroup}>
                <Text style={styles.settingLabel}>Default Dosage (mg)</Text>
                <TextInput
                  style={styles.input}
                  value={settings.defaultDosage.toString()}
                  onChangeText={(value) => handleSettingChange('defaultDosage', parseFloat(value) || 0)}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.settingGroup}>
                <Text style={styles.settingLabel}>Tracking Mode</Text>
                <View style={styles.trackingModeOptions}>
                  {(['usage', 'frequency', 'both'] as const).map((mode) => (
                    <TouchableOpacity
                      key={mode}
                      style={[
                        styles.trackingModeOption,
                        settings.trackingMode === mode && styles.trackingModeSelected,
                      ]}
                      onPress={() => handleSettingChange('trackingMode', mode)}
                    >
                      <Text
                        style={[
                          styles.trackingModeText,
                          settings.trackingMode === mode && styles.trackingModeTextSelected,
                        ]}
                      >
                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={saveSettings}
            >
              <Text style={styles.saveButtonText}>Save Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  settingsButton: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  closeButton: {
    padding: 5,
  },
  modalScrollContent: {
    flexGrow: 1,
  },
  settingGroup: {
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
  trackingModeOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trackingModeOption: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  trackingModeSelected: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  trackingModeText: {
    color: COLORS.text,
  },
  trackingModeTextSelected: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default NicotineSettings; 