import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../services/colors';
import * as nutritionService from '../../services/nutritionService';
import { FoodDiaryScreen } from './diary';
import { FoodSearchScreen } from './search';
import { NutritionTrendsScreen } from './trends';
import { NutritionItem } from '../../services/nutritionService';

type ActiveTab = 'diary' | 'search' | 'trends';
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export function NutritionScreen() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('diary');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [diaryData, setDiaryData] = useState<nutritionService.DailyDiary | null>(null);

  useEffect(() => {
    loadDiaryData();
  }, [currentDate]);

  const loadDiaryData = async () => {
    try {
      const dateString = nutritionService.formatDateToYYYYMMDD(currentDate);
      const data = await nutritionService.getDiaryForDate(dateString);
      setDiaryData(data);
    } catch (error) {
      console.error('Error loading diary data:', error);
    }
  };

  const changeDate = (direction: 'next' | 'prev') => {
    const newDate = new Date(currentDate);
    if (direction === 'next') {
      newDate.setDate(newDate.getDate() + 1);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  };

  const formatDate = (date: Date): string => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return date.toLocaleDateString(undefined, options);
  };

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
  };

  const handleAddFood = (food: nutritionService.NutritionItem, meal: MealType) => {
    // This function will be passed to the search component
    // to allow adding food directly to the diary
    setActiveTab('diary');
  };

  const getTabStyle = (tab: ActiveTab): StyleProp<ViewStyle> => {
    return [
      styles.tabItem,
      activeTab === tab && styles.activeTabItem
    ];
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'diary':
        return (
          <FoodDiaryScreen 
            date={nutritionService.formatDateToYYYYMMDD(currentDate)} 
            diaryData={diaryData}
            onDataChange={loadDiaryData}
          />
        );
      case 'search':
        return (
          <FoodSearchScreen 
            onAddFoodToDiary={(food: NutritionItem, meal: MealType, quantity: number) => {
              // Add food to diary and switch back to diary tab
              const dateString = nutritionService.formatDateToYYYYMMDD(currentDate);
              nutritionService.addToDiary(dateString, meal, food, quantity)
                .then(() => {
                  loadDiaryData();
                  setActiveTab('diary');
                })
                .catch(error => {
                  console.error('Error adding food to diary:', error);
                });
            }}
          />
        );
      case 'trends':
        return <NutritionTrendsScreen />;
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Nutrition Tracker</Text>
        
        {activeTab === 'diary' && (
          <View style={styles.dateSelector}>
            <TouchableOpacity style={styles.dateArrow} onPress={() => changeDate('prev')}>
              <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
            </TouchableOpacity>
            
            <Text style={styles.dateText}>{formatDate(currentDate)}</Text>
            
            <TouchableOpacity 
              style={styles.dateArrow}
              onPress={() => changeDate('next')}
              disabled={new Date().setHours(0, 0, 0, 0) === currentDate.setHours(0, 0, 0, 0)}
            >
              <Ionicons 
                name="chevron-forward" 
                size={24} 
                color={new Date().setHours(0, 0, 0, 0) === currentDate.setHours(0, 0, 0, 0) 
                  ? COLORS.textSecondary 
                  : COLORS.primary} 
              />
            </TouchableOpacity>
          </View>
        )}
      </View>
      
      <View style={styles.content}>
        {renderContent()}
      </View>
      
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={getTabStyle('diary')}
          onPress={() => handleTabChange('diary')}
        >
          <View style={styles.tabContent}>
            <Ionicons 
              name={activeTab === 'diary' ? 'book' : 'book-outline'} 
              size={24} 
              color={activeTab === 'diary' ? COLORS.primary : COLORS.textSecondary} 
            />
            <Text style={[
              styles.tabText,
              activeTab === 'diary' && styles.activeTabText
            ]}>
              Diary
            </Text>
          </View>
          {activeTab === 'diary' && <View style={styles.activeIndicator} />}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={getTabStyle('search')}
          onPress={() => handleTabChange('search')}
        >
          <View style={styles.tabContent}>
            <Ionicons 
              name={activeTab === 'search' ? 'search' : 'search-outline'} 
              size={24} 
              color={activeTab === 'search' ? COLORS.primary : COLORS.textSecondary} 
            />
            <Text style={[
              styles.tabText,
              activeTab === 'search' && styles.activeTabText
            ]}>
              Search
            </Text>
          </View>
          {activeTab === 'search' && <View style={styles.activeIndicator} />}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={getTabStyle('trends')}
          onPress={() => handleTabChange('trends')}
        >
          <View style={styles.tabContent}>
            <Ionicons 
              name={activeTab === 'trends' ? 'trending-up' : 'trending-up-outline'} 
              size={24} 
              color={activeTab === 'trends' ? COLORS.primary : COLORS.textSecondary} 
            />
            <Text style={[
              styles.tabText,
              activeTab === 'trends' && styles.activeTabText
            ]}>
              Trends
            </Text>
          </View>
          {activeTab === 'trends' && <View style={styles.activeIndicator} />}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    padding: 16,
    paddingBottom: 12,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.primary,
    textAlign: 'center',
  },
  dateSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 10,
  },
  dateArrow: {
    padding: 5,
    borderRadius: 20,
  },
  dateText: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.card,
    height: 60,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabContent: {
    alignItems: 'center',
  },
  activeTabItem: {
    backgroundColor: COLORS.card,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    width: '50%',
    height: 3,
    backgroundColor: COLORS.primary,
    borderRadius: 1.5,
  },
  tabText: {
    fontSize: 12,
    marginTop: 2,
    color: COLORS.textSecondary,
  },
  activeTabText: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
});

export default NutritionScreen; 