import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../services/colors';
import * as nutritionService from '../../services/nutritionService';

// Mock data for visualization
interface NutritionTrend {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function NutritionTrendsScreen() {
  const [trends, setTrends] = useState<NutritionTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'week' | 'month'>('week');
  const [selectedNutrient, setSelectedNutrient] = useState<'calories' | 'protein' | 'carbs' | 'fat'>('calories');

  useEffect(() => {
    loadTrends();
  }, [activeTab]);

  const loadTrends = async () => {
    setLoading(true);
    try {
      // Get the end date (today)
      const endDate = new Date();
      
      // Calculate the start date based on active tab
      const startDate = new Date();
      if (activeTab === 'week') {
        startDate.setDate(endDate.getDate() - 7);
      } else {
        startDate.setDate(endDate.getDate() - 30);
      }
      
      // Format dates for storage
      const startFormatted = formatDateToYYYYMMDD(startDate);
      const endFormatted = formatDateToYYYYMMDD(endDate);
      
      // Load diary entries for date range
      const entries = await nutritionService.getDiaryEntriesForDateRange(startFormatted, endFormatted);
      
      // Process entries into daily summaries
      const dailySummaries: Record<string, NutritionTrend> = {};
      
      // Create a record for each day in the range
      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateString = formatDateToYYYYMMDD(currentDate);
        dailySummaries[dateString] = {
          date: dateString,
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0
        };
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // Fill in actual data
      for (const entry of entries) {
        const date = entry.date;
        if (dailySummaries[date]) {
          dailySummaries[date].calories += entry.calories;
          dailySummaries[date].protein += entry.protein;
          dailySummaries[date].carbs += entry.carbs;
          dailySummaries[date].fat += entry.fat;
        }
      }
      
      // Convert to array and sort by date
      const trendsArray = Object.values(dailySummaries).sort((a, b) => 
        a.date.localeCompare(b.date)
      );
      
      setTrends(trendsArray);
    } catch (error) {
      console.error('Error loading nutrition trends:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateToYYYYMMDD = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateDisplay = (dateString: string): string => {
    const date = new Date(dateString);
    const month = date.toLocaleString('default', { month: 'short' });
    const day = date.getDate();
    return `${month} ${day}`;
  };

  const getMaxValue = (): number => {
    if (trends.length === 0) return 100;
    
    let max = 0;
    trends.forEach(day => {
      const value = day[selectedNutrient];
      if (value > max) max = value;
    });
    
    // Round up to the nearest 100 for calories, 10 for macros
    if (selectedNutrient === 'calories') {
      return Math.ceil(max / 100) * 100;
    } else {
      return Math.ceil(max / 10) * 10;
    }
  };

  const calculateBarHeight = (value: number): number => {
    const maxValue = getMaxValue();
    // Max height for the bar in pixels
    const MAX_HEIGHT = 150;
    
    return (value / maxValue) * MAX_HEIGHT;
  };

  const getNutrientColor = () => {
    switch (selectedNutrient) {
      case 'calories': return COLORS.primary;
      case 'protein': return '#FF5252';
      case 'carbs': return '#4CAF50';
      case 'fat': return '#FFC107';
      default: return COLORS.primary;
    }
  };

  const renderTabs = () => (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'week' && styles.activeTab]}
        onPress={() => setActiveTab('week')}
      >
        <Text style={[styles.tabText, activeTab === 'week' && styles.activeTabText]}>
          Last 7 Days
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'month' && styles.activeTab]}
        onPress={() => setActiveTab('month')}
      >
        <Text style={[styles.tabText, activeTab === 'month' && styles.activeTabText]}>
          Last 30 Days
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderNutrientTabs = () => (
    <View style={styles.nutrientTabContainer}>
      <TouchableOpacity
        style={[styles.nutrientTab, selectedNutrient === 'calories' && styles.activeNutrientTab]}
        onPress={() => setSelectedNutrient('calories')}
      >
        <Text style={styles.nutrientTabText}>Calories</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.nutrientTab, selectedNutrient === 'protein' && styles.activeNutrientTab]}
        onPress={() => setSelectedNutrient('protein')}
      >
        <Text style={styles.nutrientTabText}>Protein</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.nutrientTab, selectedNutrient === 'carbs' && styles.activeNutrientTab]}
        onPress={() => setSelectedNutrient('carbs')}
      >
        <Text style={styles.nutrientTabText}>Carbs</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.nutrientTab, selectedNutrient === 'fat' && styles.activeNutrientTab]}
        onPress={() => setSelectedNutrient('fat')}
      >
        <Text style={styles.nutrientTabText}>Fat</Text>
      </TouchableOpacity>
    </View>
  );

  const renderChart = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      );
    }

    if (trends.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="nutrition-outline" size={50} color={COLORS.textSecondary} />
          <Text style={styles.emptyText}>No nutrition data available</Text>
        </View>
      );
    }

    return (
      <View style={styles.chartContainer}>
        <View style={styles.yAxisLabels}>
          <Text style={styles.yAxisLabel}>{getMaxValue()}</Text>
          <Text style={styles.yAxisLabel}>{Math.floor(getMaxValue() / 2)}</Text>
          <Text style={styles.yAxisLabel}>0</Text>
        </View>
        
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chartContent}
        >
          <View style={styles.horizontalLine} />
          <View style={[styles.horizontalLine, { bottom: 75 }]} />
          <View style={[styles.horizontalLine, { bottom: 150 }]} />
          
          {trends.map((day, index) => (
            <View key={day.date} style={styles.barContainer}>
              <View style={styles.barValueContainer}>
                <Text style={styles.barValue}>
                  {Math.round(day[selectedNutrient])}
                </Text>
              </View>
              <View 
                style={[
                  styles.bar, 
                  { 
                    height: calculateBarHeight(day[selectedNutrient]),
                    backgroundColor: getNutrientColor() 
                  }
                ]} 
              />
              <Text style={styles.barLabel}>{formatDateDisplay(day.date)}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderSummary = () => {
    if (loading || trends.length === 0) return null;

    // Calculate averages
    const sum = trends.reduce(
      (acc, day) => ({
        calories: acc.calories + day.calories,
        protein: acc.protein + day.protein,
        carbs: acc.carbs + day.carbs,
        fat: acc.fat + day.fat
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    const count = trends.length;
    const averages = {
      calories: Math.round(sum.calories / count),
      protein: Math.round(sum.protein / count),
      carbs: Math.round(sum.carbs / count),
      fat: Math.round(sum.fat / count)
    };

    return (
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>Average Daily Nutrition</Text>
        
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Calories</Text>
            <Text style={styles.summaryValue}>{averages.calories}</Text>
          </View>
          
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Protein</Text>
            <Text style={styles.summaryValue}>{averages.protein}g</Text>
          </View>
        </View>
        
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Carbs</Text>
            <Text style={styles.summaryValue}>{averages.carbs}g</Text>
          </View>
          
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Fat</Text>
            <Text style={styles.summaryValue}>{averages.fat}g</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {renderTabs()}
      {renderNutrientTabs()}
      {renderChart()}
      {renderSummary()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentContainer: {
    padding: 16,
  },
  loadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 10,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  activeTabText: {
    color: 'white',
  },
  nutrientTabContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  nutrientTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeNutrientTab: {
    borderBottomColor: COLORS.primary,
  },
  nutrientTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  chartContainer: {
    flexDirection: 'row',
    height: 220,
    marginBottom: 20,
  },
  chartContent: {
    alignItems: 'flex-end',
    paddingBottom: 30,
    paddingLeft: 10,
    paddingRight: 10,
  },
  yAxisLabels: {
    width: 40,
    height: 150,
    justifyContent: 'space-between',
    marginRight: 10,
  },
  yAxisLabel: {
    textAlign: 'right',
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  horizontalLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#E0E0E0',
    bottom: 0,
  },
  barContainer: {
    alignItems: 'center',
    marginHorizontal: 8,
    width: 40,
  },
  barValueContainer: {
    height: 20,
  },
  barValue: {
    fontSize: 12,
    color: COLORS.text,
  },
  bar: {
    width: 20,
    borderRadius: 3,
    marginBottom: 5,
  },
  barLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 5,
  },
  summaryContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: COLORS.text,
  },
  summaryRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 5,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
});

export default NutritionTrendsScreen; 