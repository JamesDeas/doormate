import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product } from '@/types/product';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import NetInfo from '@react-native-community/netinfo';
import { API_URL } from '@/services/api';

// Keys for AsyncStorage
const SAVED_PRODUCTS_KEY = 'saved_products';
const OFFLINE_PRODUCTS_KEY = 'offline_products';
const LAST_SYNC_KEY = 'last_sync';
const USER_PROFILE_KEY = 'user_profile';

/**
 * Local database service for storing product data for offline access
 */
class LocalDatabase {
  /**
   * Save a product to local storage for offline access
   * @param product The product to save
   */
  async saveProductOffline(product: Product): Promise<void> {
    try {
      // Get existing offline products
      const existingProducts = await this.getOfflineProducts();
      
      // Add or update the product
      const updatedProducts = {
        ...existingProducts,
        [product._id]: {
          ...product,
          lastUpdated: new Date().toISOString(),
        },
      };
      
      // Save to AsyncStorage
      await AsyncStorage.setItem(OFFLINE_PRODUCTS_KEY, JSON.stringify(updatedProducts));
      
      // Update last sync time
      await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
      
      console.log(`Product ${product._id} saved for offline access`);
    } catch (error) {
      console.error('Error saving product for offline access:', error);
      throw error;
    }
  }
  
  /**
   * Get all products saved for offline access
   */
  async getOfflineProducts(): Promise<Record<string, Product & { lastUpdated: string }>> {
    try {
      const productsJson = await AsyncStorage.getItem(OFFLINE_PRODUCTS_KEY);
      return productsJson ? JSON.parse(productsJson) : {};
    } catch (error) {
      console.error('Error getting offline products:', error);
      return {};
    }
  }
  
  /**
   * Get a specific product by ID from offline storage
   * @param productId The ID of the product to retrieve
   */
  async getOfflineProduct(productId: string): Promise<Product | null> {
    try {
      const products = await this.getOfflineProducts();
      return products[productId] || null;
    } catch (error) {
      console.error(`Error getting offline product ${productId}:`, error);
      return null;
    }
  }
  
  /**
   * Remove a product from offline storage
   * @param productId The ID of the product to remove
   */
  async removeOfflineProduct(productId: string): Promise<void> {
    try {
      const products = await this.getOfflineProducts();
      
      if (products[productId]) {
        delete products[productId];
        await AsyncStorage.setItem(OFFLINE_PRODUCTS_KEY, JSON.stringify(products));
        console.log(`Product ${productId} removed from offline storage`);
      }
    } catch (error) {
      console.error(`Error removing offline product ${productId}:`, error);
      throw error;
    }
  }
  
  /**
   * Check if a product is available offline
   * @param productId The ID of the product to check
   */
  async isProductAvailableOffline(productId: string): Promise<boolean> {
    try {
      const products = await this.getOfflineProducts();
      return !!products[productId];
    } catch (error) {
      console.error(`Error checking if product ${productId} is available offline:`, error);
      return false;
    }
  }
  
  /**
   * Get the last sync time
   */
  async getLastSyncTime(): Promise<Date | null> {
    try {
      const lastSync = await AsyncStorage.getItem(LAST_SYNC_KEY);
      return lastSync ? new Date(lastSync) : null;
    } catch (error) {
      console.error('Error getting last sync time:', error);
      return null;
    }
  }
  
  /**
   * Save user profile data for offline access
   * @param user The user profile to save
   */
  async saveUserProfile(user: any): Promise<void> {
    try {
      await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(user));
      console.log('User profile saved for offline access');
    } catch (error) {
      console.error('Error saving user profile for offline access:', error);
      throw error;
    }
  }
  
  /**
   * Get user profile data from offline storage
   */
  async getUserProfile(): Promise<any | null> {
    try {
      const userJson = await AsyncStorage.getItem(USER_PROFILE_KEY);
      return userJson ? JSON.parse(userJson) : null;
    } catch (error) {
      console.error('Error getting user profile from offline storage:', error);
      return null;
    }
  }
  
  /**
   * Check if the device is online
   */
  async isOnline(): Promise<boolean> {
    try {
      const netInfo = await NetInfo.fetch();
      return netInfo.isConnected === true;
    } catch (error) {
      console.error('Error checking network status:', error);
      return false;
    }
  }
  
  /**
   * Download and save product images for offline access
   * @param product The product containing images to download
   */
  async downloadProductImages(product: Product): Promise<Product> {
    try {
      // Create a copy of the product to modify
      const updatedProduct = { ...product };
      
      // Download main image if it exists
      if (product.images?.main) {
        try {
          console.log(`Processing main image: ${product.images.main}`);
          const mainImagePath = await this.downloadImage(product.images.main, `product_${product._id}_main`);
          updatedProduct.images = {
            ...updatedProduct.images,
            main: mainImagePath,
          };
          console.log(`Main image processed successfully: ${mainImagePath}`);
        } catch (error) {
          console.error(`Error downloading main image for product ${product._id}:`, error);
          // Keep the original URL if download fails
          updatedProduct.images = {
            ...updatedProduct.images,
            main: product.images.main,
          };
        }
      }
      
      // Download gallery images if they exist
      if (product.images?.gallery && product.images.gallery.length > 0) {
        const galleryPaths = [];
        for (let i = 0; i < product.images.gallery.length; i++) {
          try {
            console.log(`Processing gallery image ${i}: ${product.images.gallery[i]}`);
            const galleryImagePath = await this.downloadImage(
              product.images.gallery[i],
              `product_${product._id}_gallery_${i}`
            );
            galleryPaths.push(galleryImagePath);
            console.log(`Gallery image ${i} processed successfully: ${galleryImagePath}`);
          } catch (error) {
            console.error(`Error downloading gallery image ${i} for product ${product._id}:`, error);
            // Keep the original URL if download fails
            galleryPaths.push(product.images.gallery[i]);
          }
        }
        updatedProduct.images = {
          ...updatedProduct.images,
          gallery: galleryPaths,
        };
      }
      
      return updatedProduct;
    } catch (error) {
      console.error(`Error downloading images for product ${product._id}:`, error);
      return product;
    }
  }
  
  /**
   * Download an image and save it locally
   * @param imageUrl The URL of the image to download
   * @param filename The filename to save the image as
   */
  private async downloadImage(imageUrl: string, filename: string): Promise<string> {
    try {
      // Ensure we have an absolute URL
      const absoluteUrl = imageUrl.startsWith('http') 
        ? imageUrl 
        : `${API_URL.replace(/\/api$/, '')}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
      
      console.log(`Downloading image from: ${absoluteUrl}`);
      
      // For web platform, use the browser's Cache API
      if (Platform.OS === 'web') {
        try {
          // Check if the browser supports Cache API
          if ('caches' in window) {
            const cache = await caches.open('product-images');
            
            // Try to get the cached response
            const cachedResponse = await cache.match(absoluteUrl);
            if (cachedResponse) {
              // Create a blob URL from the cached response
              const blob = await cachedResponse.blob();
              const blobUrl = URL.createObjectURL(blob);
              return blobUrl;
            }
            
            // If not in cache, fetch and cache it
            const response = await fetch(absoluteUrl);
            if (response.ok) {
              // Clone the response before caching
              const responseToCache = response.clone();
              await cache.put(absoluteUrl, responseToCache);
              
              // Create a blob URL from the response
              const blob = await response.blob();
              const blobUrl = URL.createObjectURL(blob);
              return blobUrl;
            }
          }
          // Fallback to original URL if caching fails or is not supported
          return absoluteUrl;
        } catch (error) {
          console.error('Error caching image on web:', error);
          return absoluteUrl;
        }
      }
      
      // For native platforms, download the image
      const fileUri = `${FileSystem.documentDirectory}images/${filename}.jpg`;
      
      // Check if the image already exists
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (fileInfo.exists) {
        return fileUri;
      }
      
      // Create the directory if it doesn't exist
      await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}images`, { intermediates: true });
      
      // Download the image
      await FileSystem.downloadAsync(absoluteUrl, fileUri);
      
      return fileUri;
    } catch (error) {
      console.error(`Error downloading image ${imageUrl}:`, error);
      throw error;
    }
  }
  
  /**
   * Download and save product manuals for offline access
   * @param product The product containing manuals to download
   */
  async downloadProductManuals(product: Product): Promise<Product> {
    try {
      // Create a copy of the product to modify
      const updatedProduct = { ...product };
      
      // Download manuals if they exist
      if (product.manuals && product.manuals.length > 0) {
        const updatedManuals = [];
        for (let i = 0; i < product.manuals.length; i++) {
          try {
            const manual = product.manuals[i];
            console.log(`Processing manual ${i}: ${manual.url}`);
            const manualPath = await this.downloadManual(manual.url, `product_${product._id}_manual_${i}`);
            
            updatedManuals.push({
              ...manual,
              url: manualPath,
            });
            console.log(`Manual ${i} processed successfully: ${manualPath}`);
          } catch (error) {
            console.error(`Error downloading manual ${i} for product ${product._id}:`, error);
            // Keep the original manual if download fails
            updatedManuals.push(product.manuals[i]);
          }
        }
        updatedProduct.manuals = updatedManuals;
      }
      
      return updatedProduct;
    } catch (error) {
      console.error(`Error downloading manuals for product ${product._id}:`, error);
      return product;
    }
  }
  
  /**
   * Download a manual and save it locally
   * @param manualUrl The URL of the manual to download
   * @param filename The filename to save the manual as
   */
  private async downloadManual(manualUrl: string, filename: string): Promise<string> {
    try {
      // Ensure we have an absolute URL
      const absoluteUrl = manualUrl.startsWith('http') 
        ? manualUrl 
        : `${API_URL.replace(/\/api$/, '')}${manualUrl.startsWith('/') ? manualUrl : `/${manualUrl}`}`;
      
      console.log(`Downloading manual from: ${absoluteUrl}`);
      
      // For web platform, we can't download manuals to local storage
      // Instead, we'll return the original URL
      if (Platform.OS === 'web') {
        return absoluteUrl;
      }
      
      // For native platforms, download the manual
      const fileUri = `${FileSystem.documentDirectory}manuals/${filename}.pdf`;
      
      // Check if the manual already exists
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (fileInfo.exists) {
        return fileUri;
      }
      
      // Create the directory if it doesn't exist
      await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}manuals`, { intermediates: true });
      
      // Download the manual
      await FileSystem.downloadAsync(absoluteUrl, fileUri);
      
      return fileUri;
    } catch (error) {
      console.error(`Error downloading manual ${manualUrl}:`, error);
      throw error;
    }
  }
}

export const localDatabase = new LocalDatabase(); 