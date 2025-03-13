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
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Product } from '@/types/product';
import { productApi } from '@/services/api';

export default function ProductDetailsScreen() {
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

  const handleDownloadManual = async (manual: { url: string; title: string }) => {
    try {
      if (Platform.OS === 'web') {
        // For web development, just open the PDF in a new tab
        window.open(manual.url, '_blank');
        return;
      }

      // Mobile-specific code using expo-file-system
      const downloadedPath = `${FileSystem.documentDirectory}manuals/${manual.title.replace(/\s+/g, '_')}.pdf`;
      const fileInfo = await FileSystem.getInfoAsync(downloadedPath);
      
      if (fileInfo.exists) {
        // Open the downloaded manual
        if (Platform.OS === 'ios') {
          await Linking.openURL(`file://${downloadedPath}`);
        } else {
          await FileSystem.getContentUriAsync(downloadedPath).then(uri => {
            Linking.openURL(uri);
          });
        }
        return;
      }

      // Create manuals directory if it doesn't exist
      const dirInfo = await FileSystem.getInfoAsync(`${FileSystem.documentDirectory}manuals`);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}manuals`, { intermediates: true });
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

      // Open the downloaded manual
      if (Platform.OS === 'ios') {
        await Linking.openURL(`file://${result.uri}`);
      } else {
        await FileSystem.getContentUriAsync(result.uri).then(contentUri => {
          Linking.openURL(contentUri);
        });
      }
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
          <TouchableOpacity
            key={index}
            style={styles.manualItem}
            onPress={() => handleDownloadManual(manual)}
          >
            <View style={styles.manualInfo}>
              <MaterialCommunityIcons
                name={downloadedManuals.includes(manual.title) ? "file-pdf-box" : "file-download"}
                size={24}
                color="#8B0000"
              />
              <View style={styles.manualText}>
                <Text style={styles.manualTitle}>{manual.title}</Text>
                <Text style={styles.manualSubtitle}>
                  {downloadedManuals.includes(manual.title) ? 'Downloaded' : 'Tap to download'}
                </Text>
              </View>
            </View>
            {downloadProgress[manual.title] !== undefined && downloadProgress[manual.title] < 1 && (
              <View style={[styles.progressBar, { width: `${downloadProgress[manual.title] * 100}%` }]} />
            )}
          </TouchableOpacity>
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
    <>
      <Stack.Screen
        options={{
          title: product.name,
          headerBackTitle: 'Back',
        }}
      />
      <ScrollView style={styles.container}>
        {product.images?.main && (
          <Image
            source={{ uri: product.images.main }}
            style={styles.mainImage}
            resizeMode="cover"
          />
        )}
        
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.productName}>{product.name}</Text>
            {product.brand && (
              <Text style={styles.brandName}>{product.brand.name}</Text>
            )}
            <Text style={styles.modelSku}>
              Model: {product.model} | SKU: {product.sku}
            </Text>
          </View>

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
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
  header: {
    marginBottom: 20,
  },
  productName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  brandName: {
    fontSize: 18,
    color: '#666666',
    marginBottom: 4,
  },
  modelSku: {
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
  progressBar: {
    height: 2,
    backgroundColor: '#8B0000',
    position: 'absolute',
    bottom: 0,
    left: 0,
  },
}); 