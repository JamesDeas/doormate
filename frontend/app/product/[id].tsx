import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Platform,
  Linking,
  SafeAreaView,
  Dimensions,
  FlatList,
  Animated,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Product } from '@/types/product';
import { productApi, savedProductsApi, API_URL } from '@/services/api';
import Discussion from '@/components/Discussion';
import { authService } from '@/services/auth';
import { localDatabase } from '@/services/localDatabase';
import PDFViewer from '@/components/PDFViewer';

// Get base URL for images by removing '/api' from the API_URL
const BASE_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001').replace(/\/api$/, '');

// Debug URL construction
const getFullUrl = (path: string) => {
  if (!path) return '';
  
  // If it's already a full URL, return it as is
  if (path.startsWith('http')) return path;
  
  // If it's a local file path, return it as is
  if (path.startsWith('file://')) return path;
  
  // Remove any leading slash to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // If the path is for an image or manual, use the BASE_URL
  if (cleanPath.startsWith('images/') || cleanPath.startsWith('manuals/')) {
    const fullUrl = `${BASE_URL}/${cleanPath}`;
    console.log('Constructed URL for image/manual:', fullUrl);
    return fullUrl;
  }
  
  // For API endpoints, use the API_URL
  const fullUrl = `${API_URL}/${cleanPath}`;
  console.log('Constructed API URL:', fullUrl);
  return fullUrl;
};

const getFullImageUrl = (imagePath: string) => {
  return getFullUrl(imagePath);
};

// Define tab types
type TabType = 'description' | 'manuals' | 'details' | 'discussion';

const Header = ({ 
  title, 
  onBack, 
  isSaved, 
  onToggleSave 
}: { 
  title: string; 
  onBack: () => void;
  isSaved: boolean;
  onToggleSave: () => void;
}) => (
  <SafeAreaView style={styles.headerContainer}>
    <View style={styles.header}>
      <TouchableOpacity 
        onPress={() => onBack()}
        style={styles.backButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      <TouchableOpacity 
        onPress={onToggleSave}
        style={styles.saveButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MaterialCommunityIcons 
          name={isSaved ? "bookmark" : "bookmark-outline"} 
          size={24} 
          color="#fff" 
        />
      </TouchableOpacity>
    </View>
  </SafeAreaView>
);

const ImageCarousel = ({ images }: { images: string[] }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  if (!images?.length) return null;

  const renderImage = ({ item }: { item: string }) => (
    <Image
      source={{ uri: item.startsWith('file://') ? item : getFullImageUrl(item) }}
      style={styles.carouselImage}
      resizeMode="cover"
    />
  );

  const handleScroll = (event: any) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const offset = event.nativeEvent.contentOffset.x;
    const activeSlide = Math.floor(offset / slideSize);
    setActiveIndex(activeSlide);
  };

  return (
    <View style={styles.carouselContainer}>
      <FlatList
        ref={flatListRef}
        data={images}
        renderItem={renderImage}
        keyExtractor={(item, index) => index.toString()}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      />
      <View style={styles.radioContainer}>
        {images.map((_, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => {
              flatListRef.current?.scrollToIndex({
                index,
                animated: true
              });
            }}
            style={[
              styles.radioButton,
              activeIndex === index && styles.radioButtonActive
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const AnimatedGlowButton = ({ children, onPress }: { children: React.ReactNode; onPress: () => void }) => {
  const glowAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnimation, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnimation, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const opacity = glowAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 0.8],
  });

  const backgroundColor = glowAnimation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['rgba(255, 255, 255, 0.5)', 'rgba(255, 0, 0, 0.8)', 'rgba(255, 255, 255, 0.5)'],
  });

  return (
    <View style={styles.animatedButtonContainer}>
      <Animated.View 
        style={[
          styles.glowBackground,
          { 
            opacity,
            backgroundColor,
            shadowColor: '#FF0000',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.8,
            shadowRadius: 8,
            elevation: 8,
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.3)',
          }
        ]} 
      />
      <TouchableOpacity
        style={styles.aiAssistantButton}
        onPress={onPress}
      >
        {children}
      </TouchableOpacity>
    </View>
  );
};

const renderAIAssistantButton = (product: Product, router: any) => {
  // Get all manual URLs with proper base URL
  const manualUrls = product.manuals?.map(manual => ({
    ...manual,
    url: getFullUrl(manual.url)
  }));

  return (
    <AnimatedGlowButton
      onPress={() => router.push({
        pathname: "/(tabs)/assistant",
        params: {
          productId: product._id,
          productType: determineProductType(product),
          productName: product.title,
          modelNumber: product.model,
          manuals: JSON.stringify(manualUrls)
        }
      })}
    >
      <View style={styles.aiAssistantContent}>
        <MaterialCommunityIcons name="robot" size={24} color="#FFFFFF" />
        <Text style={styles.aiAssistantText}>Ask AI Assistant about this product</Text>
      </View>
    </AnimatedGlowButton>
  );
};

// Helper function to determine product type
const determineProductType = (product: Product): string => {
  // Determine type based on category
  switch (product.category) {
    case 'High-Speed Doors':
    case 'Personnel Doors':
    case 'Sectional Doors':
      return 'door';
    case 'Gates':
      return 'gate';
    case 'Motors':
      return 'motor';
    case 'Control Systems':
      return 'controlSystem';
    default:
      return 'door'; // Default fallback
  }
};

export default function ProductDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{ [key: string]: number }>({});
  const [downloadedManuals, setDownloadedManuals] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('description');
  const [isSaved, setIsSaved] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    checkAuthStatus();
    loadProduct();
    loadDownloadedManuals();
    checkOfflineStatus();
  }, [id]);

  const checkOfflineStatus = async () => {
    const online = await localDatabase.isOnline();
    setIsOffline(!online);
  };

  const checkAuthStatus = async () => {
    try {
      // First check if we're offline
      const online = await localDatabase.isOnline();
      setIsOffline(!online);
      
      // Get the token
      const token = await AsyncStorage.getItem('auth_token');
      setIsAuthenticated(!!token);
      
      // If we're offline and have a token, skip the server validation
      if (!online && token) {
        // Try to get saved status from local database
        try {
          const offlineProduct = await localDatabase.getOfflineProduct(id as string);
          setIsSaved(!!offlineProduct);
        } catch (err) {
          console.log('Error checking offline saved status:', err);
          setIsSaved(false);
        }
        return;
      }
      
      // If online, proceed with normal validation
      if (token) {
        const saved = await savedProductsApi.isProductSaved(id as string);
        setIsSaved(saved);
      }
    } catch (err) {
      console.error('Error checking auth status:', err);
      // If there's an error and we're offline, don't clear the auth state
      if (await localDatabase.isOnline()) {
        setIsAuthenticated(false);
      }
    }
  };

  const toggleSaveProduct = async () => {
    try {
      if (!isAuthenticated) {
        Alert.alert(
          'Authentication Required',
          'Please sign in to save products',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign In', onPress: () => router.push('/auth/login') }
          ]
        );
        return;
      }

      if (isSaved) {
        await savedProductsApi.removeSavedProduct(id as string);
        setIsSaved(false);
      } else {
        await savedProductsApi.saveProduct(id as string);
        setIsSaved(true);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to update saved status');
    }
  };

  const loadDownloadedManuals = async () => {
    try {
      const manuals = await AsyncStorage.getItem('downloadedManuals');
      if (manuals) {
        setDownloadedManuals(JSON.parse(manuals));
      }
    } catch (error) {
      console.error('Error loading downloaded manuals:', error);
    }
  };

  const loadProduct = async () => {
    try {
      setLoading(true);
      setError(null);

      // First check if we have the product in local storage
      const offlineProduct = await localDatabase.getOfflineProduct(id as string);
      if (offlineProduct) {
        setProduct(offlineProduct);
        setLoading(false);
        return;
      }

      // If not in local storage, fetch from API using the productApi service
      const data = await productApi.getProductById(id as string);
      setProduct(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleViewManual = async (manual: { url: string; title: string }) => {
    try {
      console.log('Manual URL before processing:', manual.url);
      
      // Check if this is a local file path
      if (manual.url.startsWith('file://')) {
        console.log('Local file detected, using directly:', manual.url);
        
        // For iOS, we need to check if the file exists
        if (Platform.OS === 'ios') {
          try {
            const fileInfo = await FileSystem.getInfoAsync(manual.url);
            console.log('File info for manual:', fileInfo);
            
            if (!fileInfo.exists) {
              console.error('File does not exist:', manual.url);
              Alert.alert('Error', 'PDF file not found');
              return;
            }
          } catch (error) {
            console.error('Error checking file existence:', error);
            Alert.alert('Error', 'Failed to access PDF file');
            return;
          }
        }
        
        // Set the PDF URL to display in the modal
        setSelectedPdfUrl(manual.url);
        return;
      }
      
      // For remote URLs, use getFullUrl
      const fullUrl = getFullUrl(manual.url);
      console.log('Full URL after processing:', fullUrl);
      
      if (Platform.OS === 'web') {
        console.log('Setting PDF URL for web platform:', fullUrl);
        setSelectedPdfUrl(fullUrl);
      } else {
        // For mobile, check if it's downloaded first
        const urlParts = manual.url.split('/');
        const subDir = urlParts[urlParts.length - 2];
        const downloadedPath = `${FileSystem.documentDirectory}manuals/${subDir}/${manual.title.replace(/\s+/g, '_')}.pdf`;
        console.log('Checking for downloaded manual at:', downloadedPath);
        
        const fileInfo = await FileSystem.getInfoAsync(downloadedPath);
        console.log('File info:', fileInfo);
        
        if (fileInfo.exists) {
          // If downloaded, use the local file
          if (Platform.OS === 'ios') {
            const iosPath = `file://${downloadedPath}`;
            console.log('Using iOS local file path:', iosPath);
            setSelectedPdfUrl(iosPath);
          } else {
            const uri = await FileSystem.getContentUriAsync(downloadedPath);
            console.log('Using Android content URI:', uri);
            setSelectedPdfUrl(uri);
          }
        } else {
          // If not downloaded, use the remote URL
          console.log('Using remote URL for mobile:', fullUrl);
          setSelectedPdfUrl(fullUrl);
        }
      }
    } catch (error) {
      console.error('Error viewing manual:', error);
      Alert.alert('Error', 'Failed to open manual. Please try again.');
    }
  };

  const handleDownloadManual = async (manual: { url: string; title: string }) => {
    try {
      if (Platform.OS === 'web') {
        // For web platform, ensure we're using the correct base URL
        const fullUrl = getFullUrl(manual.url);
        console.log('Downloading from URL:', fullUrl);
        const response = await fetch(fullUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${manual.title}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        return;
      }

      // For mobile platforms
      const fileName = manual.title.replace(/\s+/g, '_') + '.pdf';
      const destinationUri = `${FileSystem.documentDirectory}manuals/${fileName}`;

      // Create manuals directory if it doesn't exist
      const dirInfo = await FileSystem.getInfoAsync(`${FileSystem.documentDirectory}manuals`);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}manuals`, { intermediates: true });
      }

      // If it's already a local file, just share it
      if (manual.url.startsWith('file://')) {
        console.log('Sharing local file:', manual.url);
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(manual.url, {
            UTI: 'com.adobe.pdf',
            mimeType: 'application/pdf',
            dialogTitle: `Share ${manual.title}`,
          });
          return;
        }
      }

      // For remote files, download first
      console.log('Downloading manual to:', destinationUri);
      const downloadResumable = FileSystem.createDownloadResumable(
        getFullUrl(manual.url),
        destinationUri,
        {},
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          setDownloadProgress(prev => ({ ...prev, [manual.title]: progress }));
        }
      );

      const result = await downloadResumable.downloadAsync();
      if (!result) {
        throw new Error('Download failed');
      }

      // After successful download, share the file
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(result.uri, {
          UTI: 'com.adobe.pdf',
          mimeType: 'application/pdf',
          dialogTitle: `Share ${manual.title}`,
        });
      }

      // Save to downloaded manuals list
      const updatedManuals = [...downloadedManuals, manual.title];
      await AsyncStorage.setItem('downloadedManuals', JSON.stringify(updatedManuals));
      setDownloadedManuals(updatedManuals);

      Alert.alert('Success', 'Manual downloaded successfully!');
    } catch (error) {
      console.error('Error downloading manual:', error);
      Alert.alert('Error', 'Failed to download manual. Please try again.');
    }
  };

  const renderManuals = () => {
    if (!product?.manuals?.length) return null;
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Product Manuals</Text>
        {product.manuals.map((manual, index) => (
          <View key={index} style={styles.manualItem}>
            <View style={styles.manualInfo}>
              <MaterialCommunityIcons
                name="file-pdf-box"
                size={24}
                color="#fff"
                style={{ opacity: 0.9 }}
              />
              <View style={styles.manualText}>
                <Text style={styles.manualTitle}>{manual.title}</Text>
                <Text style={styles.manualSubtitle}>
                  {downloadedManuals.includes(manual.title) ? 'Downloaded' : 'Available for download'}
                </Text>
              </View>
            </View>
            <View style={styles.manualButtons}>
              <TouchableOpacity
                style={[styles.manualButton, styles.viewButton]}
                onPress={() => handleViewManual(manual)}
              >
                <Text style={styles.buttonText}>View</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.manualButton, styles.downloadButton]}
                onPress={() => handleDownloadManual(manual)}
              >
                <Text style={styles.buttonText}>Download</Text>
              </TouchableOpacity>
            </View>
            {downloadProgress[manual.title] !== undefined && downloadProgress[manual.title] < 1 && (
              <View style={[styles.progressBar, { width: `${downloadProgress[manual.title] * 100}%` }]} />
            )}
          </View>
        ))}
      </View>
    );
  };

  const renderSpecifications = () => {
    if (!product?.specifications?.length) return null;
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Specifications</Text>
        {product.specifications.map((spec, index) => (
          <View key={index} style={styles.specItem}>
            <Text style={styles.specKey}>{spec.key}</Text>
            <Text style={styles.specValue}>
              {spec.value}
              {spec.unit ? ` ${spec.unit}` : ''}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const renderFeatures = () => {
    if (!product?.features?.length) return null;
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Features</Text>
        {product.features.map((feature, index) => (
          <View key={index} style={styles.featureItem}>
            <MaterialCommunityIcons 
              name="check-circle" 
              size={20} 
              color="#fff"
              style={{ opacity: 0.9 }}
            />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderApplications = () => {
    if (!product?.applications?.length) return null;
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Applications</Text>
        {product.applications.map((application, index) => (
          <View key={index} style={styles.applicationItem}>
            <MaterialCommunityIcons 
              name="arrow-right-circle" 
              size={20} 
              color="#fff"
              style={{ opacity: 0.9 }}
            />
            <Text style={styles.applicationText}>{application}</Text>
          </View>
        ))}
      </View>
    );
  };

  // Tab navigation component
  const TabNavigation = () => {
    const tabs: { id: TabType; label: string }[] = [
      { id: 'description', label: 'Description' },
      { id: 'manuals', label: 'Manuals' },
      { id: 'details', label: 'Details' },
      { id: 'discussion', label: 'Discussion' },
    ];

    return (
      <View style={styles.tabContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tabButton,
              activeTab === tab.id && styles.activeTabButton
            ]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text
              style={[
                styles.tabLabel,
                activeTab === tab.id && styles.activeTabLabel
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // Render content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'description':
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{product?.description}</Text>
          </View>
        );
      case 'manuals':
        return renderManuals();
      case 'details':
        return (
          <>
            {renderSpecifications()}
            {renderFeatures()}
            {renderApplications()}
            {product?.warranty && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Warranty</Text>
                <Text style={styles.warrantyText}>
                  {product.warranty.duration} months - {product.warranty.description}
                </Text>
              </View>
            )}
          </>
        );
      case 'discussion':
        return (
          <Discussion 
            productId={product?._id || ''} 
            isOffline={isOffline}
          />
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#8B0000" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadProduct}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Product not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {product.images?.gallery?.length > 0 ? (
        <ImageCarousel 
          images={[product.images.main, ...product.images.gallery]} 
        />
      ) : (
        <Image
          source={{ uri: product.images?.main?.startsWith('file://') ? product.images.main : getFullImageUrl(product.images?.main) }}
          style={styles.productImage}
          resizeMode="cover"
        />
      )}
      <Header 
        title={product.title} 
        onBack={() => router.push("/(tabs)/browse")} 
        isSaved={isSaved}
        onToggleSave={toggleSaveProduct}
      />
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>You are offline. Viewing saved content.</Text>
        </View>
      )}
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <View style={styles.brandInfo}>
            {product.brand && (
              <Text style={styles.brandName}>{product.brand.name}</Text>
            )}
            <Text style={styles.modelNumber}>
              Model: {product.model}
            </Text>
            <Text style={styles.modelNumber}>
              SKU: {product.sku}
            </Text>
          </View>

          {renderAIAssistantButton(product, router)}
          
          {/* Tab Navigation */}
          <TabNavigation />
          
          {/* Tab Content */}
          {renderTabContent()}
        </View>
      </ScrollView>
      
      {selectedPdfUrl && (
        <PDFViewer
          visible={!!selectedPdfUrl}
          pdfUrl={selectedPdfUrl}
          onClose={() => setSelectedPdfUrl(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#8B0000',
  },
  headerContainer: {
    backgroundColor: '#8B0000',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#8B0000',
  },
  content: {
    padding: 16,
  },
  productImage: {
    width: '100%',
    height: 300,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  brandInfo: {
    marginBottom: 20,
  },
  brandName: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 4,
    opacity: 0.9,
  },
  modelNumber: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.7,
  },
  section: {
    marginBottom: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#fff',
    lineHeight: 24,
    opacity: 0.8,
  },
  specItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  specKey: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.7,
  },
  specValue: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
    opacity: 0.9,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 16,
    color: '#fff',
    marginLeft: 8,
    opacity: 0.8,
  },
  applicationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  applicationText: {
    fontSize: 16,
    color: '#fff',
    marginLeft: 8,
    opacity: 0.8,
  },
  warrantyText: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.8,
  },
  errorText: {
    fontSize: 16,
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  manualItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    overflow: 'hidden',
  },
  manualInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  manualText: {
    marginLeft: 12,
    flex: 1,
  },
  manualTitle: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
    opacity: 0.9,
  },
  manualSubtitle: {
    fontSize: 14,
    color: '#fff',
    marginTop: 2,
    opacity: 0.7,
  },
  manualButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 8,
  },
  manualButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    minWidth: 100,
    alignItems: 'center',
  },
  viewButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  downloadButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  progressBar: {
    height: 2,
    backgroundColor: '#fff',
    position: 'absolute',
    bottom: 0,
    left: 0,
    opacity: 0.8,
  },
  carouselContainer: {
    width: '100%',
    height: 300,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  carouselImage: {
    width: Dimensions.get('window').width,
    height: 300,
  },
  radioContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 16,
    width: '100%',
    gap: 8,
  },
  radioButton: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  radioButtonActive: {
    backgroundColor: '#fff',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  animatedButtonContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  glowBackground: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 12,
  },
  aiAssistantButton: {
    backgroundColor: '#8B0000',
    borderRadius: 8,
    padding: 16,
    position: 'relative',
    zIndex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  aiAssistantContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiAssistantText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    opacity: 0.9,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  activeTabButton: {
    backgroundColor: 'rgba(139, 0, 0, 0.5)',
  },
  tabLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginLeft: 4,
  },
  activeTabLabel: {
    color: '#fff',
    fontWeight: '600',
  },
  saveButton: {
    padding: 8,
    marginRight: -8,
  },
  offlineBanner: {
    backgroundColor: '#FFE4B5',
    padding: 8,
    alignItems: 'center',
  },
  offlineText: {
    color: '#8B4513',
    fontSize: 14,
  },
}); 