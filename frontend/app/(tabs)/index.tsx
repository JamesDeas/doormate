import React, { useState, useRef } from 'react';
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
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ProductCategory } from '@/types/product';

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
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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

  const renderBrandCard = ({ item }: { item: BrandCard }) => (
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
  );

  const renderCategorySection = (category: ProductCategory) => (
    <View key={category} style={styles.categorySection}>
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
  );

  return (
    <View style={styles.container}>
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
            })
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

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {Object.keys(brandCards).map((category) => 
          renderCategorySection(category as ProductCategory)
        )}
      </ScrollView>
    </View>
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
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 16,
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
    top: Platform.OS === 'ios' ? 65 : 25,
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
    paddingVertical: 16,
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
  brandCard: {
    width: 300,
    height: 200,
    backgroundColor: 'transparent',
    marginHorizontal: 8,
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
}); 