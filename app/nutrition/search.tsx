import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator, 
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as nutritionService from '../../services/nutritionService';
import { COLORS } from '../../services/colors';

// Define the props for our FoodSearchScreen component
interface FoodSearchScreenProps {
  onAddFoodToDiary: (
    food: nutritionService.NutritionItem, 
    meal: 'breakfast' | 'lunch' | 'dinner' | 'snack',
    quantity: number
  ) => void;
}

export function FoodSearchScreen({ onAddFoodToDiary }: FoodSearchScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<nutritionService.NutritionItem[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<nutritionService.NutritionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFood, setSelectedFood] = useState<nutritionService.NutritionItem | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('breakfast');
  const [quantity, setQuantity] = useState('100');
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Load recent searches and favorites on component mount
  useEffect(() => {
    loadRecentSearches();
    loadFavorites();
  }, []);
  
  // Load recent searches from storage
  const loadRecentSearches = async () => {
    try {
      const searches = await nutritionService.getRecentSearches();
      setRecentSearches(searches);
    } catch (error) {
      console.error('Error loading recent searches:', error);
    }
  };
  
  // Load favorite foods from storage
  const loadFavorites = async () => {
    try {
      const favs = await nutritionService.getFavoriteFoods();
      setFavorites(favs);
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  };
  
  // Handle search submission
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      return;
    }
    
    setIsLoading(true);
    try {
      const results = await nutritionService.searchNutrition(searchQuery.trim());
      setSearchResults(results);
      
      // Check if results are likely from local database (small set)
      if (results.length > 0 && results.length <= 20 && !results[0].food_id) {
        // Show a notice that we're using local data
        Alert.alert(
          'Using Local Database', 
          'API access is limited. Showing results from local database instead. Search functionality is limited to common foods.',
          [{ text: 'OK' }],
          { cancelable: true }
        );
      }
      
      // Refresh recent searches list
      loadRecentSearches();
    } catch (error: any) {
      console.error('Error searching for food:', error);
      // Display the specific error message from the API if available
      const errorMessage = error.message || 'Failed to search for food. Please try again.';
      Alert.alert('Search Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle pressing a recent search item
  const handleRecentSearchPress = (query: string) => {
    setSearchQuery(query);
    // Execute search with a slight delay to allow UI update
    setTimeout(() => {
      handleSearch();
    }, 100);
  };
  
  // Open the add to diary modal
  const openAddToDiaryModal = (food: nutritionService.NutritionItem) => {
    setSelectedFood(food);
    setShowAddModal(true);
  };
  
  // Add selected food to diary
  const addFoodToDiary = () => {
    if (!selectedFood) return;
    
    // Validate quantity
    const quantityNum = parseFloat(quantity);
    if (isNaN(quantityNum) || quantityNum <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid quantity.');
      return;
    }
    
    // Call the onAddFoodToDiary function passed from parent
    onAddFoodToDiary(selectedFood, selectedMeal, quantityNum);
    
    // Reset the modal state
    setShowAddModal(false);
    setSelectedFood(null);
    setQuantity('100');
    setSelectedMeal('breakfast');
  };
  
  // Toggle a food as favorite
  const toggleFavorite = async (food: nutritionService.NutritionItem) => {
    try {
      const isFavorite = await nutritionService.isFavoriteFood(food.name);
      
      if (isFavorite) {
        await nutritionService.removeFavoriteFood(food.name);
        Alert.alert('Removed', `${food.name} removed from favorites.`);
      } else {
        await nutritionService.saveFavoriteFood(food);
        Alert.alert('Added', `${food.name} added to favorites.`);
      }
      
      // Refresh favorites list
      loadFavorites();
    } catch (error) {
      console.error('Error toggling favorite:', error);
      Alert.alert('Error', 'Failed to update favorites.');
    }
  };
  
  // Render a food item in the list
  const renderFoodItem = ({ item }: { item: nutritionService.NutritionItem }) => {
    const formattedName = item.brand_name 
      ? `${item.name} (${item.brand_name})` 
      : item.name;

    return (
      <View style={styles.foodItem}>
        <View style={styles.foodDetails}>
          <Text style={styles.foodName}>{formattedName}</Text>
          <Text style={styles.foodCalories}>{item.calories} kcal per {item.serving_size_g}g</Text>
          <View style={styles.macros}>
            <Text style={styles.macroText}>Protein: {item.protein_g}g</Text>
            <Text style={styles.macroText}>Carbs: {item.carbohydrates_total_g}g</Text>
            <Text style={styles.macroText}>Fat: {item.fat_total_g}g</Text>
          </View>
        </View>
        
        <View style={styles.foodActions}>
          <TouchableOpacity onPress={() => toggleFavorite(item)} style={styles.favoriteButton}>
            <Ionicons 
              name="heart" 
              size={24} 
              color={favorites.some(f => f.name === item.name) ? COLORS.accent : COLORS.textSecondary} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => openAddToDiaryModal(item)} style={styles.addButton}>
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };
  
  // Render a recent search item
  const renderRecentSearchItem = ({ item }: { item: string }) => {
    return (
      <TouchableOpacity 
        style={styles.recentSearchItem} 
        onPress={() => handleRecentSearchPress(item)}
      >
        <Ionicons name="time-outline" size={20} color={COLORS.textSecondary} />
        <Text style={styles.recentSearchText}>{item}</Text>
      </TouchableOpacity>
    );
  };
  
  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <View style={styles.localDataNotice}>
        <Text style={styles.localDataNoticeText}>
          Using FatSecret API with OAuth 1.0 authentication. Searches will first try the API, then fall back to local database if needed.
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search foods (e.g., 'chicken breast', 'apple')"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Ionicons name="search" size={24} color="white" />
        </TouchableOpacity>
      </View>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text>Searching for foods...</Text>
        </View>
      ) : (
        <FlatList
          data={searchResults.length > 0 ? searchResults : []}
          keyExtractor={(item, index) => `${item.name}-${item.food_id || index}`}
          renderItem={renderFoodItem}
          ListHeaderComponent={
            searchResults.length === 0 ? (
              <View>
                {recentSearches.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Recent Searches</Text>
                    <FlatList
                      data={recentSearches}
                      keyExtractor={(item, index) => `recent-${item}-${index}`}
                      renderItem={renderRecentSearchItem}
                      horizontal={false}
                      nestedScrollEnabled={true}
                    />
                  </View>
                )}
                
                {favorites.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Favorites</Text>
                    <FlatList
                      data={favorites}
                      keyExtractor={(item, index) => `favorite-${item.name}-${item.food_id || index}`}
                      renderItem={renderFoodItem}
                      nestedScrollEnabled={true}
                    />
                  </View>
                )}
                
                {recentSearches.length === 0 && favorites.length === 0 && (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="search" size={50} color={COLORS.textSecondary} />
                    <Text style={styles.emptyText}>Search for foods to add to your diary</Text>
                    <Text style={styles.emptySubtext}>
                      Try searching for foods like "chicken", "apple", or "pizza"
                    </Text>
                  </View>
                )}
              </View>
            ) : null
          }
          ListEmptyComponent={
            searchQuery && !isLoading && searchResults.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={50} color={COLORS.textSecondary} />
                <Text style={styles.emptyText}>No results found</Text>
                <Text style={styles.emptySubtext}>
                  Try a different search term or check your spelling
                </Text>
              </View>
            ) : null
          }
        />
      )}
      
      {/* Add to Diary Modal */}
      {showAddModal && selectedFood && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add to Diary</Text>
            <Text style={styles.selectedFoodName}>
              {selectedFood.brand_name 
                ? `${selectedFood.name} (${selectedFood.brand_name})` 
                : selectedFood.name}
            </Text>
            
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Quantity (g):</Text>
              <TextInput
                style={styles.quantityInput}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
                placeholder="Quantity in grams"
              />
            </View>
            
            <View style={styles.mealSelector}>
              <Text style={styles.inputLabel}>Meal:</Text>
              <View style={styles.mealOptions}>
                {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((meal) => (
                  <TouchableOpacity
                    key={meal}
                    style={[
                      styles.mealOption,
                      selectedMeal === meal && styles.selectedMealOption
                    ]}
                    onPress={() => setSelectedMeal(meal)}
                  >
                    <Text 
                      style={[
                        styles.mealOptionText,
                        selectedMeal === meal && styles.selectedMealOptionText
                      ]}
                    >
                      {meal.charAt(0).toUpperCase() + meal.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={styles.nutritionPreview}>
              <Text style={styles.previewTitle}>Nutrition (per {quantity}g):</Text>
              <View style={styles.macros}>
                <Text style={styles.macroText}>
                  Calories: {Math.round(selectedFood.calories * (parseFloat(quantity) / selectedFood.serving_size_g))} kcal
                </Text>
                <Text style={styles.macroText}>
                  Protein: {Math.round(selectedFood.protein_g * (parseFloat(quantity) / selectedFood.serving_size_g))}g
                </Text>
                <Text style={styles.macroText}>
                  Carbs: {Math.round(selectedFood.carbohydrates_total_g * (parseFloat(quantity) / selectedFood.serving_size_g))}g
                </Text>
                <Text style={styles.macroText}>
                  Fat: {Math.round(selectedFood.fat_total_g * (parseFloat(quantity) / selectedFood.serving_size_g))}g
                </Text>
              </View>
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.addModalButton]} 
                onPress={addFoodToDiary}
              >
                <Text style={styles.addButtonText}>Add to Diary</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: COLORS.card,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 5,
    paddingHorizontal: 10,
    backgroundColor: 'white',
  },
  searchButton: {
    width: 40,
    height: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 5,
    marginLeft: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 50,
  },
  emptyText: {
    fontSize: 18,
    color: COLORS.text,
    marginTop: 10,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 5,
    textAlign: 'center',
  },
  section: {
    marginVertical: 10,
    padding: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: COLORS.text,
  },
  recentSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  recentSearchText: {
    marginLeft: 10,
    fontSize: 16,
    color: COLORS.text,
  },
  foodItem: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  foodDetails: {
    flex: 1,
  },
  foodName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  foodCalories: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  macros: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
  },
  macroText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginRight: 10,
  },
  foodActions: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteButton: {
    padding: 5,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 5,
    marginTop: 5,
  },
  addButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
    color: COLORS.text,
  },
  selectedFoodName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: COLORS.primary,
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 16,
    color: COLORS.text,
    width: 100,
  },
  quantityInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 5,
    paddingHorizontal: 10,
    backgroundColor: 'white',
  },
  mealSelector: {
    marginBottom: 15,
  },
  mealOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  mealOption: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    marginRight: 10,
    marginBottom: 10,
  },
  selectedMealOption: {
    backgroundColor: COLORS.primary,
  },
  mealOptionText: {
    color: COLORS.textSecondary,
  },
  selectedMealOptionText: {
    color: 'white',
    fontWeight: 'bold',
  },
  nutritionPreview: {
    backgroundColor: COLORS.primaryLight,
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
    color: COLORS.text,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.primaryLight,
    marginRight: 10,
  },
  cancelButtonText: {
    color: COLORS.textSecondary,
  },
  addModalButton: {
    backgroundColor: COLORS.primary,
  },
  localDataNotice: {
    backgroundColor: COLORS.primaryLight,
    padding: 10,
    margin: 10,
    borderRadius: 5,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  localDataNoticeText: {
    fontSize: 12,
    color: COLORS.text,
    textAlign: 'center',
  },
});

export default FoodSearchScreen; 