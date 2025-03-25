import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../services/colors';
import * as nutritionService from '../../services/nutritionService';
import { format, subDays, isValid, parseISO } from 'date-fns';

type TimeRange = '7days' | '14days' | '30days';
type NutrientType = 'calories' | 'protein' | 'carbs' | 'fat';

// Define structure for processed trend data
interface DayTotals {
  date: string;
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

// Mock data for visualization
interface NutritionTrend {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// Simple bar chart component
const BarChart: React.FC<{
  data: { date: string; value: number }[];
  maxValue: number;
  color: string;
  label: string;
}> = ({ data, maxValue, color, label }) => {
  const formatDate = (dateString: string) => {
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'MM/dd') : '';
  };

  if (maxValue === 0) maxValue = 1; // Prevent division by zero

  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartLabel}>{label}</Text>
      <View style={styles.chart}>
        {data.map((item, index) => (
          <View key={index} style={styles.barContainer}>
            <View style={styles.barLabelContainer}>
              <Text style={styles.barLabel}>{formatDate(item.date)}</Text>
            </View>
            <View style={[styles.bar, { backgroundColor: COLORS.primaryLight }]}>
              <View
                style={[
                  styles.barFill,
                  {
                    backgroundColor: color,
                    width: `${Math.min(100, (item.value / maxValue) * 100)}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.barValue}>{Math.round(item.value)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

export function NutritionTrendsScreen() {
  const [timeRange, setTimeRange] = useState<TimeRange>('7days');
  const [nutrientType, setNutrientType] = useState<NutrientType>('calories');
  const [trendData, setTrendData] = useState<{ date: string; value: number }[]>([]);
  const [averages, setAverages] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTrendData();
  }, [timeRange, nutrientType]);

  const loadTrendData = async () => {
    setIsLoading(true);
    try {
      // Calculate date range
      const endDate = new Date();
      let startDate;
      
      if (timeRange === '7days') {
        startDate = subDays(endDate, 6);
      } else if (timeRange === '14days') {
        startDate = subDays(endDate, 13);
      } else {
        startDate = subDays(endDate, 29);
      }

      // Format dates
      const startDateStr = format(startDate, 'yyyy-MM-dd');
      const endDateStr = format(endDate, 'yyyy-MM-dd');

      // Get nutrition data for date range
      const processedData = await nutritionService.getNutritionTrends(startDateStr, endDateStr);
      
      // Calculate daily values for selected nutrient
      const dailyValues = processedData.map((day) => ({
        date: day.date,
        value: day.totals[nutrientType] || 0
      }));

      // Sort by date
      dailyValues.sort((a, b) => a.date.localeCompare(b.date));
      
      // Calculate averages
      const totalDays = dailyValues.length || 1; // Prevent division by zero
      const totals = processedData.reduce(
        (acc, day) => {
          return {
            calories: acc.calories + (day.totals.calories || 0),
            protein: acc.protein + (day.totals.protein || 0),
            carbs: acc.carbs + (day.totals.carbs || 0),
            fat: acc.fat + (day.totals.fat || 0),
          };
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );

      const averageValues = {
        calories: totals.calories / totalDays,
        protein: totals.protein / totalDays,
        carbs: totals.carbs / totalDays,
        fat: totals.fat / totalDays,
      };

      setTrendData(dailyValues);
      setAverages(averageValues);
    } catch (error) {
      console.error('Error loading trend data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getColor = (type: NutrientType): string => {
    switch (type) {
      case 'calories':
        return COLORS.primary;
      case 'protein':
        return '#4CAF50'; // Green
      case 'carbs':
        return '#FF9800'; // Orange
      case 'fat':
        return '#9C27B0'; // Purple
      default:
        return COLORS.primary;
    }
  };

  const getLabel = (type: NutrientType): string => {
    switch (type) {
      case 'calories':
        return 'Calories (kcal)';
      case 'protein':
        return 'Protein (g)';
      case 'carbs':
        return 'Carbs (g)';
      case 'fat':
        return 'Fat (g)';
      default:
        return '';
    }
  };

  // Find max value for chart scaling
  const maxValue = trendData.length > 0
    ? Math.max(...trendData.map(item => item.value)) * 1.1 // Add 10% padding
    : 100;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Nutrition Trends</Text>
      </View>

      <View style={styles.filterContainer}>
        <View style={styles.timeRangeFilter}>
          <Text style={styles.filterLabel}>Time Range:</Text>
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[
                styles.filterButton,
                timeRange === '7days' && styles.activeFilterButton,
              ]}
              onPress={() => setTimeRange('7days')}
            >
              <Text style={timeRange === '7days' ? styles.activeFilterText : styles.filterText}>
                7 Days
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                timeRange === '14days' && styles.activeFilterButton,
              ]}
              onPress={() => setTimeRange('14days')}
            >
              <Text style={timeRange === '14days' ? styles.activeFilterText : styles.filterText}>
                14 Days
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                timeRange === '30days' && styles.activeFilterButton,
              ]}
              onPress={() => setTimeRange('30days')}
            >
              <Text style={timeRange === '30days' ? styles.activeFilterText : styles.filterText}>
                30 Days
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.nutrientFilter}>
          <Text style={styles.filterLabel}>Nutrient:</Text>
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[
                styles.filterButton,
                nutrientType === 'calories' && styles.activeFilterButton,
              ]}
              onPress={() => setNutrientType('calories')}
            >
              <Text style={nutrientType === 'calories' ? styles.activeFilterText : styles.filterText}>
                Calories
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                nutrientType === 'protein' && styles.activeFilterButton,
                nutrientType === 'protein' && { backgroundColor: '#4CAF50' },
              ]}
              onPress={() => setNutrientType('protein')}
            >
              <Text style={nutrientType === 'protein' ? styles.activeFilterText : styles.filterText}>
                Protein
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                nutrientType === 'carbs' && styles.activeFilterButton,
                nutrientType === 'carbs' && { backgroundColor: '#FF9800' },
              ]}
              onPress={() => setNutrientType('carbs')}
            >
              <Text style={nutrientType === 'carbs' ? styles.activeFilterText : styles.filterText}>
                Carbs
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                nutrientType === 'fat' && styles.activeFilterButton,
                nutrientType === 'fat' && { backgroundColor: '#9C27B0' },
              ]}
              onPress={() => setNutrientType('fat')}
            >
              <Text style={nutrientType === 'fat' ? styles.activeFilterText : styles.filterText}>
                Fat
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text>Loading nutrition data...</Text>
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Average Daily Intake</Text>
            <View style={styles.averagesContainer}>
              <View style={styles.averageItem}>
                <Text style={styles.averageLabel}>Calories</Text>
                <Text style={styles.averageValue}>{Math.round(averages.calories)} kcal</Text>
              </View>
              <View style={styles.averageItem}>
                <Text style={styles.averageLabel}>Protein</Text>
                <Text style={[styles.averageValue, { color: '#4CAF50' }]}>
                  {Math.round(averages.protein)}g
                </Text>
              </View>
              <View style={styles.averageItem}>
                <Text style={styles.averageLabel}>Carbs</Text>
                <Text style={[styles.averageValue, { color: '#FF9800' }]}>
                  {Math.round(averages.carbs)}g
                </Text>
              </View>
              <View style={styles.averageItem}>
                <Text style={styles.averageLabel}>Fat</Text>
                <Text style={[styles.averageValue, { color: '#9C27B0' }]}>
                  {Math.round(averages.fat)}g
                </Text>
              </View>
            </View>
          </View>

          {trendData.length > 0 ? (
            <BarChart
              data={trendData}
              maxValue={maxValue}
              color={getColor(nutrientType)}
              label={getLabel(nutrientType)}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No nutrition data for this period</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    padding: 15,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    padding: 10,
  },
  filterContainer: {
    padding: 10,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    margin: 10,
    marginTop: 5,
  },
  filterLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 5,
  },
  timeRangeFilter: {
    marginBottom: 10,
  },
  nutrientFilter: {
    marginBottom: 5,
  },
  buttonGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
  },
  activeFilterButton: {
    backgroundColor: COLORS.primary,
  },
  filterText: {
    color: COLORS.text,
    fontSize: 12,
  },
  activeFilterText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  summaryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: COLORS.text,
  },
  averagesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  averageItem: {
    width: '48%',
    marginBottom: 10,
  },
  averageLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  averageValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  chartContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  chartLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    color: COLORS.text,
  },
  chart: {
    marginTop: 10,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  barLabelContainer: {
    width: 40,
  },
  barLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  bar: {
    flex: 1,
    height: 20,
    borderRadius: 10,
    marginHorizontal: 10,
  },
  barFill: {
    height: '100%',
    borderRadius: 10,
  },
  barValue: {
    width: 40,
    fontSize: 12,
    textAlign: 'right',
    color: COLORS.text,
  },
  emptyContainer: {
    padding: 20,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
});

export default NutritionTrendsScreen; 