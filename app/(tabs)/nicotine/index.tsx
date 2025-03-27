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
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as nicotineService from '../../../services/nicotineService';
import { COLORS } from '../../../services/colors';
import { format, addDays, subDays, isToday, isSameDay } from 'date-fns';
import UsageBarChart from './components/UsageBarChart';

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
  const [usageData, setUsageData] = useState<{
    date: string;
    total: number;
    count: number;
  }[]>([]);
  const [chartPeriod, setChartPeriod] = useState<7 | 30>(7);
  const [loadingChart, setLoadingChart] = useState(false);
  const [activeView, setActiveView] = useState<'chart' | 'history'>('chart');

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
      
      // Also refresh chart data
      loadUsageData();
    } catch (error) {
      console.error('Error loading nicotine data:', error);
      Alert.alert('Error', 'Failed to load nicotine data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadUsageData = async () => {
    try {
      setLoadingChart(true);
      const data = await nicotineService.getDailyUsageData(chartPeriod);
      setUsageData(data);
    } catch (error) {
      console.error('Error loading usage data:', error);
    } finally {
      setLoadingChart(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  useEffect(() => {
    loadUsageData();
  }, [chartPeriod]);

  useEffect(() => {
    if (entries.length > 0 && selectedDate && isToday(selectedDate)) {
      setActiveView('history');
    }
  }, [entries, selectedDate]);

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

  const renderEntry = ({ item }: { item: nicotineService.NicotineEntry }) => {
    const formattedTime = format(new Date(item.timestamp), 'h:mm a');
    const dailyPercentage = settings?.dailyGoal ? ((item.amount / settings.dailyGoal) * 100).toFixed(1) : '0';

    return (
      <View style={styles.entryItem}>
        <View style={styles.entryInfo}>
          <View style={styles.entryHeader}>
            <Text style={styles.entryAmount}>{item.amount} mg</Text>
            <Text style={styles.entryTime}>{formattedTime}</Text>
          </View>
          <View style={styles.entryDetails}>
            <Text style={styles.entryDetail}>
              {dailyPercentage}% of daily goal
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => handleDeleteEntry(item.id)}
          style={styles.deleteButton}
        >
          <Ionicons name="trash-outline" size={20} color={COLORS.error} />
        </TouchableOpacity>
      </View>
    );
  };

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

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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

        <View style={styles.viewToggleContainer}>
          <TouchableOpacity
            style={[
              styles.viewToggleButton,
              activeView === 'chart' && styles.viewToggleButtonActive,
            ]}
            onPress={() => setActiveView('chart')}
          >
            <Ionicons
              name="bar-chart-outline"
              size={18}
              color={activeView === 'chart' ? '#fff' : COLORS.text}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.viewToggleButtonText,
                activeView === 'chart' && styles.viewToggleButtonTextActive,
              ]}
            >
              Chart
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.viewToggleButton,
              activeView === 'history' && styles.viewToggleButtonActive,
            ]}
            onPress={() => setActiveView('history')}
          >
            <Ionicons
              name="list-outline"
              size={18}
              color={activeView === 'history' ? '#fff' : COLORS.text}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.viewToggleButtonText,
                activeView === 'history' && styles.viewToggleButtonTextActive,
              ]}
            >
              History
            </Text>
          </TouchableOpacity>
        </View>

        {activeView === 'chart' && (
          <View style={styles.chartContainer}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>Usage Trend</Text>
              <View style={styles.chartPeriodToggle}>
                <TouchableOpacity
                  style={[
                    styles.periodButton,
                    chartPeriod === 7 && styles.periodButtonActive,
                  ]}
                  onPress={() => setChartPeriod(7)}
                >
                  <Text
                    style={[
                      styles.periodButtonText,
                      chartPeriod === 7 && styles.periodButtonTextActive,
                    ]}
                  >
                    7 Days
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.periodButton,
                    chartPeriod === 30 && styles.periodButtonActive,
                  ]}
                  onPress={() => setChartPeriod(30)}
                >
                  <Text
                    style={[
                      styles.periodButtonText,
                      chartPeriod === 30 && styles.periodButtonTextActive,
                    ]}
                  >
                    30 Days
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            {loadingChart ? (
              <View style={styles.chartLoading}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : (
              <UsageBarChart
                data={usageData}
                trackingMode={settings?.trackingMode || 'mg'}
                dailyGoal={settings?.dailyGoal || 0}
              />
            )}
          </View>
        )}

        {activeView === 'history' && (
          <View style={styles.entriesContainer}>
            <Text style={styles.sectionTitle}>Today's Entries</Text>
            {entries.length === 0 ? (
              <View style={styles.emptyEntriesContainer}>
                <Text style={styles.emptyEntriesText}>
                  No entries for {isToday(selectedDate) ? 'today' : format(selectedDate, 'MMM d, yyyy')}
                </Text>
              </View>
            ) : (
              <FlatList
                data={entries}
                renderItem={renderEntry}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.entriesList}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={loadData} />
                }
                nestedScrollEnabled={true}
              />
            )}
          </View>
        )}
      </ScrollView>
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
  viewToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    marginHorizontal: 15,
  },
  viewToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginHorizontal: 5,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  viewToggleButtonActive: {
    backgroundColor: COLORS.primary,
  },
  viewToggleButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  viewToggleButtonTextActive: {
    color: '#fff',
  },
  chartContainer: {
    marginTop: 20,
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: 15,
    marginHorizontal: 15,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    maxHeight: '65%',
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  chartPeriodToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 6,
    padding: 2,
  },
  periodButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  periodButtonActive: {
    backgroundColor: COLORS.primary,
  },
  periodButtonText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  periodButtonTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  chartLoading: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  entriesContainer: {
    flex: 1,
    marginTop: 20,
    marginHorizontal: 15,
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: 15,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    maxHeight: '65%',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 10,
  },
  emptyEntriesContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyEntriesText: {
    color: COLORS.textSecondary,
  },
  entriesList: {
    flexGrow: 1,
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
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  entryDetails: {
    marginTop: 5,
  },
  entryDetail: {
    fontSize: 12,
    color: COLORS.textSecondary,
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
  scrollContent: {
    paddingBottom: 20,
  },
}); 