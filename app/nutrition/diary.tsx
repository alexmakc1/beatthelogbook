import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as nutritionService from '../../services/nutritionService';
import { COLORS } from '../../services/colors';

interface FoodDiaryScreenProps {
  date: string;
  diaryData: nutritionService.DailyDiary | null;
  onDataChange: () => void;
}

export function FoodDiaryScreen({ date, diaryData, onDataChange }: FoodDiaryScreenProps) {
  const [isLoading, setIsLoading] = useState(false);
  
  // Define meal types
  const mealTypes: Array<{ id: 'breakfast' | 'lunch' | 'dinner' | 'snack', name: string }> = [
    { id: 'breakfast', name: 'Breakfast' },
    { id: 'lunch', name: 'Lunch' },
    { id: 'dinner', name: 'Dinner' },
    { id: 'snack', name: 'Snack' }
  ];

  // Filter entries by meal type
  const getEntriesByMeal = (mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack') => {
    if (!diaryData || !diaryData.entries) return [];
    return diaryData.entries.filter(entry => entry.meal === mealType);
  };

  // Calculate totals for a specific meal
  const getMealTotals = (mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack') => {
    const entries = getEntriesByMeal(mealType);
    return entries.reduce((acc, entry) => {
      return {
        calories: acc.calories + entry.calories,
        protein: acc.protein + entry.protein,
        carbs: acc.carbs + entry.carbs,
        fat: acc.fat + entry.fat
      };
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
  };

  // Handle removing food from diary
  const handleRemoveFood = async (entryId: string) => {
    Alert.alert(
      'Remove Food',
      'Are you sure you want to remove this food from your diary?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              await nutritionService.removeFromDiary(date, entryId);
              onDataChange(); // Notify parent to refresh data
            } catch (error) {
              console.error('Error removing food:', error);
              Alert.alert('Error', 'Failed to remove food from diary');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  // Render a food entry item
  const renderFoodItem = ({ item }: { item: nutritionService.DiaryEntry }) => {
    return (
      <View style={styles.foodItem}>
        <View style={styles.foodDetails}>
          <Text style={styles.foodName}>{item.food.name}</Text>
          <Text style={styles.portionText}>{item.quantity}g</Text>
          <View style={styles.nutritionInfo}>
            <Text style={styles.nutritionText}>
              {item.calories} kcal • {item.protein}g protein • {item.carbs}g carbs • {item.fat}g fat
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => handleRemoveFood(item.id)} style={styles.deleteButton}>
          <Ionicons name="trash-outline" size={20} color={COLORS.accent} />
        </TouchableOpacity>
      </View>
    );
  };

  // Render a meal section
  const renderMealSection = (mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack', mealName: string) => {
    const entries = getEntriesByMeal(mealType);
    const totals = getMealTotals(mealType);

    return (
      <View style={styles.mealSection}>
        <View style={styles.mealHeader}>
          <Text style={styles.mealTitle}>{mealName}</Text>
          <Text style={styles.mealCalories}>{totals.calories} kcal</Text>
        </View>

        {entries.length > 0 ? (
          <FlatList
            data={entries}
            keyExtractor={(item) => item.id}
            renderItem={renderFoodItem}
            scrollEnabled={false}
          />
        ) : (
          <View style={styles.emptyMeal}>
            <Text style={styles.emptyText}>No foods logged</Text>
          </View>
        )}

        {entries.length > 0 && (
          <View style={styles.mealTotals}>
            <Text style={styles.totalsText}>
              P: {totals.protein}g • C: {totals.carbs}g • F: {totals.fat}g
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text>Updating diary...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Day Summary</Text>
        {diaryData && diaryData.totals ? (
          <View style={styles.summaryContent}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Calories</Text>
              <Text style={styles.summaryValue}>{diaryData.totals.calories}</Text>
            </View>
            <View style={styles.macroSummary}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Protein</Text>
                <Text style={styles.summaryValue}>{diaryData.totals.protein}g</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Carbs</Text>
                <Text style={styles.summaryValue}>{diaryData.totals.carbs}g</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Fat</Text>
                <Text style={styles.summaryValue}>{diaryData.totals.fat}g</Text>
              </View>
            </View>
          </View>
        ) : (
          <Text style={styles.emptyText}>No data for this day</Text>
        )}
      </View>

      {mealTypes.map(meal => renderMealSection(meal.id, meal.name))}
      
      <View style={styles.spacer} />
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 15,
    margin: 10,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: COLORS.text,
  },
  summaryContent: {
    marginTop: 5,
  },
  summaryItem: {
    marginBottom: 5,
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  macroSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  mealSection: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 15,
    margin: 10,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  mealTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  mealCalories: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  emptyMeal: {
    padding: 15,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  foodItem: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  foodDetails: {
    flex: 1,
  },
  foodName: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
  },
  portionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  nutritionInfo: {
    marginTop: 3,
  },
  nutritionText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  deleteButton: {
    justifyContent: 'center',
    padding: 10,
  },
  mealTotals: {
    marginTop: 10,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  totalsText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'right',
  },
  spacer: {
    height: 30,
  }
});

// Add default export
export default FoodDiaryScreen; 