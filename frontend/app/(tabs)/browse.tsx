import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Animated,
  SafeAreaView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useDebouncedCallback } from 'use-debounce';
import type { Product, ProductCategory } from '@/types/product';
import { productApi } from '@/services/api';
import { useAuth } from '@/app/_layout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface CategoryData {
  category: ProductCategory;
  brands: {
    id: string;
    name: string;
  }[];
}

export default function BrowseScreen() {
  const { isOffline, checkAuthStatus } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [isAnimatedValuesInitialized, setIsAnimatedValuesInitialized] = useState(false);
  const animatedHeights = useRef<Animated.Value[]>([]);
  const chevronRotations = useRef<Animated.Value[]>([]);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryTimeout, setRetryTimeout] = useState(0);
  const retryTimerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!isOffline) {
      fetchCategoriesAndBrands();
    }
  }, [isOffline]);

  useEffect(() => {
    if (categories.length > 0) {
      animatedHeights.current = categories.map(() => new Animated.Value(0));
      chevronRotations.current = categories.map(() => new Animated.Value(0));
      setIsAnimatedValuesInitialized(true);
    }
  }, [categories]);

  useEffect(() => {
    const initializeFromParams = async () => {
      if (params.category && params.brandId) {
        const category = params.category as ProductCategory;
        const brandId = params.brandId as string;
        await handleBrandSelect(category, brandId);
      } else if (params.searchQuery) {
        // Handle search query from home page
        const query = params.searchQuery as string;
        setSearchQuery(query);
        debouncedSearch(query);
      }
    };

    initializeFromParams();
  }, [params.category, params.brandId, params.searchQuery]);

  useEffect(() => {
    // Clear timeout when component unmounts
    return () => {
      if (retryTimerRef.current) {
        clearInterval(retryTimerRef.current);
      }
    };
  }, []);

  const fetchCategoriesAndBrands = async () => {
    try {
      const data = await productApi.getCategoriesAndBrands();
      const formattedData: CategoryData[] = data.map((cat) => ({
        category: cat.category,
        brands: cat.brands,
      }));
      setCategories(formattedData);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      setError('Failed to load categories');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCategory = (index: number) => {
    const isCurrentlyExpanded = index === expandedIndex;
    
    if (expandedIndex !== null && !isCurrentlyExpanded) {
      Animated.parallel([
        Animated.timing(animatedHeights.current[expandedIndex], {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(chevronRotations.current[expandedIndex], {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        })
      ]).start();
    }

    if (!isCurrentlyExpanded) {
      const brandsCount = categories[index].brands.length;
      const targetHeight = brandsCount * 44 + 16;

      Animated.parallel([
        Animated.timing(animatedHeights.current[index], {
          toValue: targetHeight,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(chevronRotations.current[index], {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        })
      ]).start();
      setExpandedIndex(index);
    } else {
      Animated.parallel([
        Animated.timing(animatedHeights.current[index], {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(chevronRotations.current[index], {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        })
      ]).start(() => {
        setExpandedIndex(null);
      });
    }
  };

  const handleBrandSelect = async (category: ProductCategory, brandId: string) => {
    try {
      console.log('handleBrandSelect called with:', { category, brandId });
      setIsLoading(true);
      setSelectedCategory(category);
      setSelectedBrand(brandId);
      setSearchQuery('');
      setSearchResults([]);

      console.log('Fetching products...');
      const response = await productApi.getProducts({
        category,
        brandId,
        limit: 50
      });
      console.log('API Response:', response);

      const filtered = response.products.filter(product => {
        console.log('Checking product:', {
          id: product._id,
          category: product.category,
          brandId: product.brand?.id,
          matches: product.category === category && product.brand?.id === brandId
        });
        return product.category === category && product.brand?.id === brandId;
      });
      
      console.log('Filtered products:', filtered);
      setFilteredProducts(filtered);
    } catch (error) {
      console.error('Error fetching products:', error);
      setError('Failed to load products');
      setFilteredProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const debouncedSearch = useDebouncedCallback(
    async (text: string) => {
      console.log('Search triggered with query:', text);
      if (text.length < 1) {
        console.log('Query empty, clearing results');
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      setError(null);

      try {
        console.log('Making API call with:', { query: text, category: selectedCategory });
        const results = await productApi.search({
          query: text,
          category: selectedCategory || undefined,
          limit: 20
        });
        console.log('Search results:', results);
        setSearchResults(results);
      } catch (error) {
        console.error('Search error:', error);
        setError('Failed to search products. Please try again.');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    300
  );

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    debouncedSearch(text);
  };

  const handleProductSelect = (product: Product) => {
    router.push({
      pathname: "/product/[id]",
      params: { id: product._id }
    });
  };

  const renderSearchResult = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => handleProductSelect(item)}
    >
      <View style={styles.resultContent}>
        <Text style={styles.productName}>{item.title}</Text>
        <View style={styles.productMeta}>
          <Text style={styles.brandText}>{item.brand?.name}</Text>
          <Text style={styles.categoryText}>{item.category}</Text>
        </View>
        {item.shortDescription && (
          <Text style={styles.description} numberOfLines={2}>
            {item.shortDescription}
          </Text>
        )}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={24} color="#666666" />
    </TouchableOpacity>
  );

  const renderFilteredResult = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => handleProductSelect(item)}
    >
      <View style={styles.resultContent}>
        <Text style={styles.productName}>{item.title}</Text>
        <View style={styles.productMeta}>
          <Text style={styles.brandText}>{item.brand?.name}</Text>
          <Text style={styles.categoryText}>{item.category}</Text>
        </View>
        {item.shortDescription && (
          <Text style={styles.description} numberOfLines={2}>
            {item.shortDescription}
          </Text>
        )}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={24} color="#fff" opacity={0.7} />
    </TouchableOpacity>
  );

  const renderCategory = ({ item, index }: { item: CategoryData; index: number }) => {
    if (!isAnimatedValuesInitialized) return null;

    const rotateZ = chevronRotations.current[index].interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '180deg']
    });

    return (
      <View style={styles.categoryContainer}>
        <TouchableOpacity 
          style={styles.categoryHeader}
          onPress={() => toggleCategory(index)}
        >
          <Text style={styles.categoryTitle}>{item.category}</Text>
          <Animated.View style={{ transform: [{ rotateZ }] }}>
            <MaterialCommunityIcons 
              name="chevron-down"
              size={24} 
              color="#fff" 
            />
          </Animated.View>
        </TouchableOpacity>
        <Animated.View style={[
          styles.brandsContainer,
          {
            height: animatedHeights.current[index],
            overflow: 'hidden',
          }
        ]}>
          {item.brands.map(brand => (
            <TouchableOpacity
              key={brand.id}
              style={styles.brandItem}
              onPress={() => handleBrandSelect(item.category, brand.id)}
            >
              <Text style={styles.brandText}>{brand.name}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#fff" opacity={0.7} />
            </TouchableOpacity>
          ))}
        </Animated.View>
      </View>
    );
  };

  const handleRetryConnection = async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    setRetryTimeout(30);

    try {
      await checkAuthStatus();
    } catch (error) {
      console.error('Retry failed:', error);
    }

    // Start countdown
    const countdownInterval = setInterval(() => {
      setRetryTimeout((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          setIsRetrying(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    retryTimerRef.current = countdownInterval;
  };

  const renderContent = () => {
    console.log('renderContent called with state:', {
      isLoading,
      error,
      isOffline,
      searchQuery: searchQuery.length,
      selectedCategory,
      selectedBrand,
      filteredProducts: filteredProducts.length
    });

    if (isOffline) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.offlineContainer}>
            <View style={styles.welcomeContainer}>
              <MaterialCommunityIcons 
                name="wifi-off" 
                size={48} 
                color="#fff" 
                style={styles.offlineIcon} 
              />
              <Text style={styles.emptyText}>
                Product browsing is unavailable while offline. Please check your internet connection and try again.
              </Text>
              <TouchableOpacity 
                style={[
                  styles.retryButton,
                  isRetrying && styles.retryButtonDisabled
                ]}
                onPress={handleRetryConnection}
                disabled={isRetrying}
              >
                <View style={styles.retryButtonContent}>
                  <MaterialCommunityIcons 
                    name="refresh" 
                    size={20} 
                    color="#fff" 
                    style={[
                      styles.retryIcon,
                      isRetrying && styles.retryIconSpinning
                    ]} 
                  />
                  <Text style={styles.retryButtonText}>
                    {isRetrying 
                      ? `Retry in ${retryTimeout}s` 
                      : 'Retry Connection'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      );
    }

    if (isLoading) {
      console.log('Showing loading state');
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      );
    }

    if (error) {
      console.log('Showing error state:', error);
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      );
    }

    if (searchQuery.length > 0) {
      console.log('Showing search results');
      if (isSearching) {
        return (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        );
      }

      if (searchResults.length > 0) {
        return (
          <FlatList
            data={searchResults}
            renderItem={renderSearchResult}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.resultsList}
          />
        );
      }

      return (
        <View style={styles.noResultsContainer}>
          <Text style={styles.noResultsText}>No products found</Text>
        </View>
      );
    }

    if (selectedCategory && selectedBrand && filteredProducts.length > 0) {
      console.log('Showing filtered results:', {
        category: selectedCategory,
        brand: selectedBrand,
        count: filteredProducts.length
      });
      return (
        <FlatList
          data={filteredProducts}
          renderItem={renderFilteredResult}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.resultsList}
          ListHeaderComponent={() => (
            <View style={styles.filterHeader}>
              <Text style={styles.filterHeaderText}>
                {selectedCategory} - {filteredProducts[0]?.brand?.name}
              </Text>
              <TouchableOpacity 
                style={styles.clearFilterButton}
                onPress={() => {
                  setSelectedCategory(null);
                  setSelectedBrand(null);
                  setFilteredProducts([]);
                }}
              >
                <MaterialCommunityIcons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        />
      );
    }

    console.log('Showing initial state / categories list');
    return (
      <>
        <View style={styles.initialStateContainer}>
          <Text style={styles.initialStateText}>
            Search for doors, gates, motors, or control systems
          </Text>
        </View>
        <FlatList
          data={categories}
          renderItem={renderCategory}
          keyExtractor={(item) => item.category}
          contentContainerStyle={styles.categoriesList}
        />
      </>
    );
  };

  return (
    <SafeAreaView style={[
      styles.container,
      isOffline && { paddingTop: 36 }
    ]}>
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={24} color="#666666" />
          <TextInput
            style={[styles.searchInput, isOffline && styles.inputDisabled]}
            placeholder="Search by product name or brand..."
            value={searchQuery}
            onChangeText={handleSearch}
            placeholderTextColor="#666666"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isOffline}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')} disabled={isOffline}>
              <MaterialCommunityIcons name="close" size={24} color="#666666" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      {renderContent()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#8B0000',
  },
  searchContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#fff',
    backgroundColor: '#8B0000',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#333333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultsList: {
    padding: 16,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 8,
    borderRadius: 8,
  },
  resultContent: {
    flex: 1,
    marginRight: 16,
  },
  productName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 4,
  },
  productMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  brandText: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
    marginRight: 8,
  },
  categoryText: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  description: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.7,
    lineHeight: 20,
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  noResultsText: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.7,
    textAlign: 'center',
  },
  initialStateContainer: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  initialStateText: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.7,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 16,
    color: '#FF6B6B',
    textAlign: 'center',
  },
  categoriesList: {
    padding: 16,
  },
  categoryContainer: {
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  brandsContainer: {
    paddingVertical: 8,
  },
  brandItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 8,
    borderRadius: 8,
  },
  filterHeaderText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  clearFilterButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
  },
  emptySubText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  offlineContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
  },
  welcomeContainer: {
    padding: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    margin: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  offlineIcon: {
    marginBottom: 16,
    opacity: 0.7,
    alignSelf: 'center',
  },
  retryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 24,
    alignSelf: 'center',
  },
  retryButtonDisabled: {
    opacity: 0.5,
  },
  retryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  retryIcon: {
    marginRight: 8,
  },
  retryIconSpinning: {
    transform: [{ rotate: '45deg' }],
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
}); 