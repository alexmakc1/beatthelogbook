import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  SafeAreaView,
  RefreshControl,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { useRouter } from 'expo-router';
import * as nicotineService from '../../../services/nicotineService';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../services/colors';

export default function NicotineScreen() {
  const router = useRouter();
  const [entries, setEntries] = useState<nicotineService.NicotineEntry[]>([]);
  const [stats, setStats] = useState<nicotineService.NicotineStats | null>(null);
  const [settings, setSettings] = useState<nicotineService.NicotineSettings>(nicotineService.DEFAULT_NICOTINE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEntryAmount, setNewEntryAmount] = useState('');
  const [newEntryType, setNewEntryType] = useState<'cigarette' | 'vape' | 'other'>('cigarette');

  // Load data when component is focused
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [entriesData, statsData, settingsData] = await Promise.all([
        nicotineService.getEntries(),
        nicotineService.getStats(),
        nicotineService.getNicotineSettings()
      ]);
      setEntries(entriesData);
      setStats(statsData);
      setSettings(settingsData);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load nicotine data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleAddEntry = async () => {
    if (!newEntryAmount) {
      Alert.alert('Error', 'Please enter an amount');
      return;
    }

    try {
      const amount = parseFloat(newEntryAmount);
      if (isNaN(amount) || amount <= 0) {
        Alert.alert('Error', 'Please enter a valid amount');
        return;
      }

      await nicotineService.addEntry({
        amount,
        type: newEntryType,
        timestamp: new Date().toISOString()
      });

      setNewEntryAmount('');
      setShowAddModal(false);
      loadData();
    } catch (error) {
      console.error('Error adding entry:', error);
      Alert.alert('Error', 'Failed to add nicotine entry');
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      await nicotineService.deleteEntry(id);
      loadData();
    } catch (error) {
      console.error('Error deleting entry:', error);
      Alert.alert('Error', 'Failed to delete nicotine entry');
    }
  };

  const handleSaveSettings = async () => {
    try {
      await nicotineService.updateNicotineSettings(settings);
      setShowSettingsModal(false);
      loadData();
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const renderEntry = ({ item }: { item: nicotineService.NicotineEntry }) => (
    <View style={styles.entryItem}>
      <View style={styles.entryInfo}>
        <Text style={styles.entryAmount}>{item.amount} mg</Text>
        <Text style={styles.entryType}>{item.type}</Text>
        <Text style={styles.entryTime}>
          {new Date(item.timestamp).toLocaleString()}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => handleDeleteEntry(item.id)}
        style={styles.deleteButton}
      >
        <Ionicons name="trash-outline" size={24} color={COLORS.error} />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Nicotine Tracker</Text>
        <TouchableOpacity
          onPress={() => setShowSettingsModal(true)}
          style={styles.settingsButton}
        >
          <Ionicons name="settings-outline" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Today's Total</Text>
          <Text style={styles.statValue}>{stats?.todayTotal || 0} mg</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Weekly Average</Text>
          <Text style={styles.statValue}>{stats?.weeklyAverage || 0} mg</Text>
        </View>
      </View>

      <FlatList
        data={entries}
        renderItem={renderEntry}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        style={styles.list}
      />

      <TouchableOpacity
        onPress={() => setShowAddModal(true)}
        style={styles.addButton}
      >
        <Ionicons name="add" size={24} color="#fff" />
        <Text style={styles.addButtonText}>Add Entry</Text>
      </TouchableOpacity>

      {/* Add Entry Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Nicotine Entry</Text>
            <TouchableOpacity
              onPress={() => setShowAddModal(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Amount (mg)</Text>
              <TextInput
                style={styles.input}
                value={newEntryAmount}
                onChangeText={setNewEntryAmount}
                keyboardType="numeric"
                placeholder="Enter amount"
              />
            </View>

            <View style={styles.typeContainer}>
              <Text style={styles.inputLabel}>Type</Text>
              <View style={styles.typeButtons}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    newEntryType === 'cigarette' && styles.typeButtonActive
                  ]}
                  onPress={() => setNewEntryType('cigarette')}
                >
                  <Text style={[
                    styles.typeButtonText,
                    newEntryType === 'cigarette' && styles.typeButtonTextActive
                  ]}>Cigarette</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    newEntryType === 'vape' && styles.typeButtonActive
                  ]}
                  onPress={() => setNewEntryType('vape')}
                >
                  <Text style={[
                    styles.typeButtonText,
                    newEntryType === 'vape' && styles.typeButtonTextActive
                  ]}>Vape</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    newEntryType === 'other' && styles.typeButtonActive
                  ]}
                  onPress={() => setNewEntryType('other')}
                >
                  <Text style={[
                    styles.typeButtonText,
                    newEntryType === 'other' && styles.typeButtonTextActive
                  ]}>Other</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleAddEntry}
              style={styles.saveButton}
            >
              <Text style={styles.saveButtonText}>Save Entry</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Settings Modal */}
      <Modal
        visible={showSettingsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nicotine Settings</Text>
            <TouchableOpacity
              onPress={() => setShowSettingsModal(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Daily Usage Goal (mg)</Text>
              <TextInput
                style={styles.input}
                value={(settings?.dailyLimit ?? 0).toString()}
                onChangeText={(text) => setSettings({ ...settings, dailyLimit: parseFloat(text) || 0 })}
                keyboardType="numeric"
                placeholder="Enter daily limit"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Nicotine Strength (mg)</Text>
              <TextInput
                style={styles.input}
                value={(settings?.strength ?? 0).toString()}
                onChangeText={(text) => setSettings({ ...settings, strength: parseFloat(text) || 0 })}
                keyboardType="numeric"
                placeholder="Enter nicotine strength"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Cost per Unit ($)</Text>
              <TextInput
                style={styles.input}
                value={(settings?.cost ?? 0).toString()}
                onChangeText={(text) => setSettings({ ...settings, cost: parseFloat(text) || 0 })}
                keyboardType="numeric"
                placeholder="Enter cost per unit"
              />
            </View>

            <TouchableOpacity
              onPress={handleSaveSettings}
              style={styles.saveButton}
            >
              <Text style={styles.saveButtonText}>Save Settings</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.background,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  settingsButton: {
    padding: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    backgroundColor: COLORS.background,
  },
  statCard: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 150,
  },
  statLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  list: {
    flex: 1,
  },
  entryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.card,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
  },
  entryInfo: {
    flex: 1,
  },
  entryAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  entryType: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  entryTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  deleteButton: {
    padding: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    padding: 16,
    margin: 16,
    borderRadius: 12,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 20,
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    top: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.text,
  },
  typeContainer: {
    marginBottom: 20,
  },
  typeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  typeButton: {
    flex: 1,
    backgroundColor: COLORS.card,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: COLORS.primary,
  },
  typeButtonText: {
    color: COLORS.text,
    fontSize: 14,
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 