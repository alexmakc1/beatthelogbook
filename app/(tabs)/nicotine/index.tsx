import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  TextInput,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as nicotineService from '../../../services/nicotineService';
import { COLORS } from '../../../services/colors';
import { format, addDays, subDays, isToday, isSameDay } from 'date-fns';

const CIRCLE_SIZE = 120;
const CIRCLE_STROKE_WIDTH = 12;
const CIRCLE_RADIUS = (CIRCLE_SIZE - CIRCLE_STROKE_WIDTH) / 2;
const CIRCLE_CENTER = CIRCLE_SIZE / 2;

export default function NicotineScreen() {
  const router = useRouter();
  const [entries, setEntries] = useState<nicotineService.NicotineEntry[]>([]);
  const [stats, setStats] = useState<nicotineService.NicotineStats | null>(null);
  const [settings, setSettings] = useState<nicotineService.NicotineSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [amount, setAmount] = useState('3');
  const [selectedDate, setSelectedDate] = useState(new Date());

  const loadData = async () => {
    try {
      setLoading(true);
      const [entriesData, statsData, settingsData] = await Promise.all([
        nicotineService.getEntries(selectedDate),
        nicotineService.getStats(selectedDate),
        nicotineService.getNicotineSettings(),
      ]);
      setEntries(entriesData);
      setStats(statsData);
      setSettings(settingsData);
    } catch (error) {
      console.error('Error loading nicotine data:', error);
      Alert.alert('Error', 'Failed to load nicotine data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const handleAddEntry = async () => {
    try {
      const mgAmount = parseFloat(amount);
      if (isNaN(mgAmount) || mgAmount <= 0) {
        Alert.alert('Invalid Amount', 'Please enter a valid amount in mg');
        return;
      }

      const success = await nicotineService.addEntry(mgAmount);
      if (success) {
        loadData();
        setAmount('3');
      } else {
        Alert.alert('Error', 'Failed to add nicotine entry');
      }
    } catch (error) {
      console.error('Error adding nicotine entry:', error);
      Alert.alert('Error', 'Failed to add nicotine entry');
    }
  };

  const handleDeleteEntry = async (id: string) => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await nicotineService.deleteEntry(id);
              if (success) {
                loadData();
              } else {
                Alert.alert('Error', 'Failed to delete entry');
              }
            } catch (error) {
              console.error('Error deleting nicotine entry:', error);
              Alert.alert('Error', 'Failed to delete entry');
            }
          },
        },
      ]
    );
  };

  const handleDateChange = (days: number) => {
    setSelectedDate(prevDate => {
      const newDate = days > 0 ? addDays(prevDate, days) : subDays(prevDate, -days);
      return newDate;
    });
  };

  const renderEntry = ({ item }: { item: nicotineService.NicotineEntry }) => (
    <View style={styles.entryItem}>
      <View style={styles.entryInfo}>
        <Text style={styles.entryAmount}>{item.amount} mg</Text>
        <Text style={styles.entryTime}>
          {format(new Date(item.timestamp), 'h:mm a')}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => handleDeleteEntry(item.id)}
        style={styles.deleteButton}
      >
        <Ionicons name="trash-outline" size={20} color={COLORS.error} />
      </TouchableOpacity>
    </View>
  );

  const calculateProgress = () => {
    if (!settings) return 0;
    const current = settings.trackingMode === 'mg' 
      ? (stats?.todayTotal || 0)
      : entries.length;
    const goal = settings.dailyGoal || 1;
    return Math.min(current / goal, 1);
  };

  const progress = calculateProgress();
  const progressColor = progress >= 1 ? COLORS.error : COLORS.primary;

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
          style={styles.settingsButton}
          onPress={() => router.push('../settings')}
        >
          <Ionicons name="settings-outline" size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.dateNavigation}>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => handleDateChange(-1)}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.dateText}>
          {isToday(selectedDate)
            ? 'Today'
            : format(selectedDate, 'MMM d, yyyy')}
        </Text>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => handleDateChange(1)}
          disabled={isToday(selectedDate)}
        >
          <Ionicons
            name="chevron-forward"
            size={24}
            color={isToday(selectedDate) ? COLORS.textSecondary : COLORS.text}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.circleContainer}>
          <View style={styles.circleBackground}>
            <View style={[
              styles.circleProgress,
              {
                backgroundColor: progressColor,
                transform: [{ scale: progress }],
              }
            ]} />
            <View style={styles.circleTextContainer}>
              <Text style={styles.circleValue}>
                {settings?.trackingMode === 'mg'
                  ? `${stats?.todayTotal || 0}`
                  : `${entries.length}`}
              </Text>
              <Text style={styles.circleLabel}>
                {settings?.trackingMode === 'mg' ? 'mg' : 'times'}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Today's Usage</Text>
            <Text style={styles.statValue}>{stats?.todayTotal || 0} mg</Text>
            <Text style={styles.statSubValue}>{entries.length} times</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Daily Goal</Text>
            <Text style={styles.statValue}>
              {settings?.trackingMode === 'mg'
                ? `${settings?.dailyGoal || 0} mg`
                : `${settings?.dailyGoal || 0} times`}
            </Text>
            <Text style={styles.statSubValue}>
              {settings?.trackingMode === 'mg'
                ? `${Math.round((settings?.dailyGoal || 0) / (settings?.defaultAmount || 1))} times`
                : `${Math.round((settings?.dailyGoal || 0) * (settings?.defaultAmount || 1))} mg`}
            </Text>
          </View>
        </View>
      </View>

      {isToday(selectedDate) && (
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="Amount (mg)"
            placeholderTextColor={COLORS.textSecondary}
          />
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddEntry}
          >
            <Text style={styles.addButtonText}>Add Entry</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={entries}
        renderItem={renderEntry}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
            colors={[COLORS.primary]}
          />
        }
      />
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
    backgroundColor: COLORS.card,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  settingsButton: {
    padding: 8,
  },
  dateNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dateButton: {
    padding: 8,
  },
  dateText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  progressContainer: {
    padding: 16,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  circleContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  circleBackground: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  circleProgress: {
    position: 'absolute',
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    opacity: 0.2,
  },
  circleTextContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  circleLabel: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statSubValue: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  input: {
    flex: 1,
    height: 48,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    color: COLORS.text,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  list: {
    padding: 16,
  },
  entryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  entryInfo: {
    flex: 1,
  },
  entryAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  entryTime: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  deleteButton: {
    padding: 8,
  },
}); 