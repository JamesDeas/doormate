import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  Platform,
  FlatList,
  Animated,
  SafeAreaView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ProductCategory } from '@/types/product';
import { useAuth } from '@/app/_layout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface BrandCard {
  id: string;
  name: string;
  logo: any;
  category: ProductCategory;
}

const brandCards: Partial<Record<ProductCategory, BrandCard[]>> = {
  'Sectional Doors': [
    {
      id: 'hormann',
      name: 'Hörmann',
      logo: require('@/assets/images/brands/hormann-logo.png'),
      category: 'Sectional Doors'
    },
    {
      id: 'dynaco',
      name: 'Dynaco',
      logo: require('@/assets/images/brands/dynaco-logo.png'),
      category: 'Sectional Doors'
    },
    {
      id: 'novoferm',
      name: 'Novoferm',
      logo: require('@/assets/images/brands/novoferm-logo.png'),
      category: 'Sectional Doors'
    }
  ],
  'Personnel Doors': [
    {
      id: 'bradbury',
      name: 'Bradbury',
      logo: require('@/assets/images/brands/bradbury-logo.png'),
      category: 'Personnel Doors'
    },
    {
      id: 'robust',
      name: 'Robust',
      logo: require('@/assets/images/brands/robust-logo.png'),
      category: 'Personnel Doors'
    },
    {
      id: 'lathams',
      name: 'Lathams',
      logo: require('@/assets/images/brands/lathams-logo.png'),
      category: 'Personnel Doors'
    }
  ],
  'Motors': [
    {
      id: 'gfa',
      name: 'GFA',
      logo: require('@/assets/images/brands/gfa-logo.png'),
      category: 'Motors'
    },
    {
      id: 'siemens',
      name: 'Siemens',
      logo: require('@/assets/images/brands/siemens-logo.png'),
      category: 'Motors'
    },
    {
      id: 'faac',
      name: 'FAAC',
      logo: require('@/assets/images/brands/faac-logo.png'),
      category: 'Motors'
    }
  ]
};

export default function HomeScreen() {
  const { isOffline, checkAuthStatus } = useAuth();
  const insets = useSafeAreaInsets();
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryTimeout, setRetryTimeout] = useState(0);
  const retryTimerRef = useRef<NodeJS.Timeout>();
  const searchAnimation = useRef(new Animated.Value(0)).current;

  const toggleSearch = (show: boolean) => {
    Animated.spring(searchAnimation, {
      toValue: show ? 1 : 0,
      useNativeDriver: false,
      tension: 50,
      friction: 7
    }).start();
    setIsSearchVisible(show);
  };

  const handleBrandPress = (brand: BrandCard) => {
    router.push({
      pathname: "/browse",
      params: { 
        category: brand.category,
        brandId: brand.id,
        brandName: brand.name
      }
    });
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      router.push({
        pathname: "/browse",
        params: { searchQuery: searchQuery.trim() }
      });
      setSearchQuery('');
      toggleSearch(false);
    }
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

  useEffect(() => {
    // Clear timeout when component unmounts
    return () => {
      if (retryTimerRef.current) {
        clearInterval(retryTimerRef.current);
      }
    };
  }, []);

  const renderBrandCard = ({ item }: { item: BrandCard }) => (
    <View style={styles.brandCardContainer}>
      <TouchableOpacity
        style={styles.brandCard}
        onPress={() => handleBrandPress(item)}
      >
        <Image
          source={item.logo}
          style={styles.brandLogo}
          resizeMode="cover"
        />
      </TouchableOpacity>
    </View>
  );

  const renderCategorySection = (category: ProductCategory) => (
    <View key={category} style={styles.categorySection}>
      <View style={styles.categoryContainer}>
        <Text style={styles.categoryTitle}>{category}</Text>
        <FlatList
          data={brandCards[category]}
          renderItem={renderBrandCard}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.brandList}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Animated.View style={{
          opacity: searchAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0]
          }),
          transform: [{
            translateX: searchAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -50]
            })
          }]
        }}>
          <Image
            source={require('@/assets/images/doormate-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>
        <Animated.View style={[
          styles.searchContainer,
          {
            position: 'absolute',
            right: searchAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: ['4%', '4%']
            }),
            left: searchAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: ['85%', '4%']
            }),
            backgroundColor: searchAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: ['transparent', '#F5F5F5']
            }),
            borderRadius: 20,
            paddingHorizontal: searchAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 12]
            }),
            transform: [{
              translateY: searchAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -40]
              })
            }]
          }
        ]}>
          {isSearchVisible ? (
            <>
              <MaterialCommunityIcons name="magnify" size={24} color="#666" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by product name or brand..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                onSubmitEditing={handleSearch}
                returnKeyType="search"
                onBlur={() => {
                  if (!searchQuery) {
                    toggleSearch(false);
                  }
                }}
              />
              <TouchableOpacity 
                onPress={() => {
                  setSearchQuery('');
                  toggleSearch(false);
                }}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity onPress={() => toggleSearch(true)}>
              <MaterialCommunityIcons name="magnify" size={32} color="#fff" />
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>

      {isOffline ? (
        <View style={styles.offlineContainer}>
          <View style={styles.welcomeContainer}>
            <MaterialCommunityIcons 
              name="wifi-off" 
              size={48} 
              color="#fff" 
              style={styles.offlineIcon} 
            />
            <Text style={styles.emptyText}>
              Brand browsing is unavailable while offline. Please check your internet connection and try again to explore our product categories.
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
      ) : (
        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {Object.keys(brandCards).map((category) => 
            renderCategorySection(category as ProductCategory)
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#8B0000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: '4%',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#fff',
    backgroundColor: '#8B0000',
    position: 'relative',
  },
  logo: {
    width: 150,
    height: 50,
    zIndex: 0,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    top: 20,
    zIndex: 1,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    marginLeft: 8,
    color: '#333',
  },
  searchIcon: {
    marginLeft: 8,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  categorySection: {
    paddingVertical: 12,
  },
  categoryContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    paddingVertical: 16,
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  brandList: {
    paddingHorizontal: 8,
  },
  brandCardContainer: {
    width: 280,
    height: 180,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginHorizontal: 8,
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  brandCard: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
    overflow: 'hidden',
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  brandLogo: {
    width: '100%',
    height: '100%',
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
  emptyText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
    lineHeight: 22,
    marginTop: 16,
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