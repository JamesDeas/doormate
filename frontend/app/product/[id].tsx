import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Product } from '@/types/product';
import { productApi } from '@/services/api';

// Get base URL for images by removing '/api' from the API_URL
const BASE_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001').replace(/\/api$/, '');

// Debug URL construction
const getFullUrl = (path: string) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  
  // Remove any leading slash to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const fullUrl = `${BASE_URL}/${cleanPath}`;
  console.log('Constructed URL:', fullUrl); // Add debugging
  return fullUrl;
};

const getFullImageUrl = (imagePath: string) => {
  return getFullUrl(imagePath);
};

const Header = ({ title, onBack }: { title: string; onBack: () => void }) => (
  <SafeAreaView style={styles.headerContainer}>
    <View style={styles.header}>
      <TouchableOpacity 
        onPress={() => onBack()}
        style={styles.backButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MaterialCommunityIcons name="arrow-left" size={24} color="#8B0000" />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
    </View>
  </SafeAreaView>
);

const ImageCarousel = ({ images }: { images: string[] }) => {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!images?.length) return null;

  return (
    <View style={styles.carouselContainer}>
      <Image
        source={{ uri: getFullImageUrl(images[activeIndex]) }}
        style={styles.carouselImage}
        resizeMode="cover"
      />
      <View style={styles.radioContainer}>
        {images.map((_, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => setActiveIndex(index)}
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

const renderAIAssistantButton = (product: Product, router: any) => {
  // Get all manual URLs with proper base URL
  const manualUrls = product.manuals?.map(manual => ({
    ...manual,
    url: getFullUrl(manual.url)
  }));

  return (
    <TouchableOpacity
      style={styles.aiAssistantButton}
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
    </TouchableOpacity>
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

  useEffect(() => {
    loadProduct();
    loadDownloadedManuals();
  }, [id]);

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
      const data = await productApi.getProductById(id as string);
      setProduct(data);
    } catch (err) {
      console.error('Error loading product:', err);
      setError('Failed to load product details');
    } finally {
      setLoading(false);
    }
  };

  const handleViewManual = async (manual: { url: string; title: string }) => {
    try {
      if (Platform.OS === 'web') {
        // For web platform, ensure we're using the correct base URL
        const fullUrl = getFullUrl(manual.url);
        console.log('Opening manual URL:', fullUrl);
        window.open(fullUrl, '_blank');
        return;
      }

      // Rest of the mobile platform code...
      const urlParts = manual.url.split('/');
      const subDir = urlParts[urlParts.length - 2];
      
      const downloadedPath = `${FileSystem.documentDirectory}manuals/${subDir}/${manual.title.replace(/\s+/g, '_')}.pdf`;
      const fileInfo = await FileSystem.getInfoAsync(downloadedPath);
      
      if (fileInfo.exists) {
        if (Platform.OS === 'ios') {
          await Linking.openURL(`file://${downloadedPath}`);
        } else {
          await FileSystem.getContentUriAsync(downloadedPath).then(uri => {
            Linking.openURL(uri);
          });
        }
        return;
      }

      // If not downloaded, open the URL directly
      await Linking.openURL(getFullUrl(manual.url));
    } catch (error) {
      console.error('Error viewing manual:', error);
      alert('Failed to open manual. Please try again.');
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

      // Rest of the mobile platform code...
      const urlParts = manual.url.split('/');
      const subDir = urlParts[urlParts.length - 2];
      
      const downloadedPath = `${FileSystem.documentDirectory}manuals/${subDir}/${manual.title.replace(/\s+/g, '_')}.pdf`;
      
      // Create manuals/subDir directory if it doesn't exist
      const dirInfo = await FileSystem.getInfoAsync(`${FileSystem.documentDirectory}manuals/${subDir}`);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}manuals/${subDir}`, { intermediates: true });
      }

      // Download the manual
      const downloadResumable = FileSystem.createDownloadResumable(
        manual.url,
        downloadedPath,
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
      
      // Save to downloaded manuals list
      const updatedManuals = [...downloadedManuals, manual.title];
      await AsyncStorage.setItem('downloadedManuals', JSON.stringify(updatedManuals));
      setDownloadedManuals(updatedManuals);

      alert('Manual downloaded successfully!');
    } catch (error) {
      console.error('Error downloading manual:', error);
      alert('Failed to download manual. Please try again.');
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
                color="#8B0000"
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
            <MaterialCommunityIcons name="check-circle" size={20} color="#8B0000" />
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
            <MaterialCommunityIcons name="arrow-right-circle" size={20} color="#666666" />
            <Text style={styles.applicationText}>{application}</Text>
          </View>
        ))}
      </View>
    );
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
      <ImageCarousel 
        images={[
          product.images?.main,
          ...(product.images?.gallery || [])
        ].filter(Boolean)}
      />
      <Header 
        title={product.title} 
        onBack={() => router.push("/(tabs)/browse")} 
      />
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
          {renderManuals()}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{product.description}</Text>
          </View>

          {renderSpecifications()}
          {renderFeatures()}
          {renderApplications()}

          {product.warranty && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Warranty</Text>
              <Text style={styles.warrantyText}>
                {product.warranty.duration} months - {product.warranty.description}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  headerContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
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
    color: '#333333',
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  content: {
    padding: 16,
  },
  mainImage: {
    width: '100%',
    height: 300,
    backgroundColor: '#F5F5F5',
  },
  brandInfo: {
    marginBottom: 20,
  },
  brandName: {
    fontSize: 18,
    color: '#666666',
    marginBottom: 4,
  },
  modelNumber: {
    fontSize: 14,
    color: '#666666',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#333333',
    lineHeight: 24,
  },
  specItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  specKey: {
    fontSize: 16,
    color: '#666666',
  },
  specValue: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 16,
    color: '#333333',
    marginLeft: 8,
  },
  applicationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  applicationText: {
    fontSize: 16,
    color: '#333333',
    marginLeft: 8,
  },
  warrantyText: {
    fontSize: 16,
    color: '#333333',
  },
  errorText: {
    fontSize: 16,
    color: '#FF0000',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#8B0000',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  manualItem: {
    backgroundColor: '#F5F5F5',
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
    color: '#333333',
    fontWeight: '500',
  },
  manualSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,
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
    backgroundColor: '#666666',
  },
  downloadButton: {
    backgroundColor: '#8B0000',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  progressBar: {
    height: 2,
    backgroundColor: '#8B0000',
    position: 'absolute',
    bottom: 0,
    left: 0,
  },
  carouselContainer: {
    width: '100%',
    height: 300,
    backgroundColor: '#F5F5F5',
  },
  carouselImage: {
    width: '100%',
    height: '100%',
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
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  radioButtonActive: {
    backgroundColor: '#FFFFFF',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  aiAssistantButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  aiAssistantContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiAssistantText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
}); 