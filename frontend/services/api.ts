import axios from 'axios';
import { Product, ProductCategory } from '@/types/product';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDatabase } from '@/services/localDatabase';

// Ensure API_URL includes the /api suffix
export const API_URL = process.env.EXPO_PUBLIC_API_URL 
  ? process.env.EXPO_PUBLIC_API_URL
  : 'http://localhost:5001/api';

console.log('API_URL:', API_URL); // Log the API URL being used

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

// Add request interceptor for logging
api.interceptors.request.use(request => {
  console.log('Starting Request:', request.url);
  return request;
});

// Add response interceptor for logging
api.interceptors.response.use(
  response => {
    console.log('Response:', response.status, response.data);
    return response;
  },
  error => {
    console.error('API Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      config: error.config
    });
    return Promise.reject(error);
  }
);

export interface SearchProductsParams {
  query: string;
  category?: ProductCategory;
  limit?: number;
}

export interface GetProductsParams {
  page?: number;
  limit?: number;
  category?: ProductCategory;
  status?: 'active' | 'discontinued' | 'coming_soon';
  search?: string;
  brandId?: string;
}

export interface ProductsResponse {
  products: Product[];
  total: number;
  pages: number;
  currentPage: number;
}

interface CategoryBrandResponse {
  category: ProductCategory;
  brands: {
    id: string;
    name: string;
  }[];
}

export const productApi = {
  search: async ({ query, category, limit }: SearchProductsParams): Promise<Product[]> => {
    const params = new URLSearchParams();
    params.append('q', query);
    if (category) params.append('category', category);
    if (limit) params.append('limit', limit.toString());

    const response = await fetch(`${API_URL}/products/search?${params}`);
    if (!response.ok) throw new Error('Failed to search products');
    return response.json();
  },

  getProducts: async (params: GetProductsParams): Promise<ProductsResponse> => {
    const searchParams = new URLSearchParams();
    if (params.category) searchParams.append('category', params.category);
    if (params.brandId) searchParams.append('brand', params.brandId);
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());

    const response = await fetch(`${API_URL}/products?${searchParams}`);
    if (!response.ok) throw new Error('Failed to fetch products');
    return response.json();
  },

  getProductById: async (id: string): Promise<Product> => {
    const response = await fetch(`${API_URL}/products/${id}`);
    if (!response.ok) throw new Error('Failed to fetch product');
    return response.json();
  },

  getCategoriesAndBrands: async (): Promise<CategoryBrandResponse[]> => {
    const response = await fetch(`${API_URL}/products/categories`);
    if (!response.ok) throw new Error('Failed to fetch categories and brands');
    return response.json();
  }
};

export interface ChatRequest {
  message: string;
  productId?: string;
  productType?: 'door' | 'gate' | 'motor' | 'controlSystem';
  manuals?: string;  // JSON stringified array of manual objects
  discussions?: string;  // JSON stringified array of discussion objects
  highlightedText?: string;
  previousMessages?: Array<{
    id: string;
    text: string;
    sender: 'user' | 'assistant';
    timestamp: Date;
  }>;
}

export const assistantApi = {
  chat: async (request: ChatRequest, onChunk: (chunk: string) => void) => {
    try {
      // Different implementations for web and mobile
      if (Platform.OS === 'web') {
        // Web implementation using ReadableStream
        const response = await fetch(`${API_URL}/assistant/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
          },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          throw new Error('Network response was not ok');
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Response body is not readable');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() || '';

          for (const event of events) {
            if (event.startsWith('data: ')) {
              try {
                const data = JSON.parse(event.slice(6));
                onChunk(data.content);
              } catch (e) {
                console.error('Error parsing SSE data:', e);
              }
            }
          }
        }

        if (buffer && buffer.startsWith('data: ')) {
          try {
            const data = JSON.parse(buffer.slice(6));
            onChunk(data.content);
          } catch (e) {
            console.error('Error parsing final SSE data:', e);
          }
        }
      } else {
        // Mobile implementation using XHR
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_URL}/assistant/chat`, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('Accept', 'text/event-stream');

        let buffer = '';

        xhr.onprogress = function() {
          const newData = xhr.responseText.substring(buffer.length);
          buffer = xhr.responseText;

          const events = newData.split('\n\n');
          events.forEach(event => {
            if (event.startsWith('data: ')) {
              try {
                const data = JSON.parse(event.slice(6));
                onChunk(data.content);
              } catch (e) {
                // Ignore parsing errors for incomplete chunks
              }
            }
          });
        };

        xhr.onerror = function() {
          throw new Error('Network request failed');
        };

        xhr.send(JSON.stringify(request));

        // Wait for the request to complete
        await new Promise((resolve, reject) => {
          xhr.onload = function() {
            if (xhr.status === 200) {
              resolve(undefined);
            } else {
              reject(new Error(`Request failed with status ${xhr.status}`));
            }
          };
        });
      }
    } catch (error) {
      console.error('Chat API Error:', error);
      throw error;
    }
  }
};

// Saved Products API
export const savedProductsApi = {
  // Get all saved products
  getSavedProducts: async (): Promise<Product[]> => {
    const token = await AsyncStorage.getItem('auth_token');
    if (!token) throw new Error('Authentication required');
    
    const response = await fetch(`${API_URL}/saved-products`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) throw new Error('Failed to fetch saved products');
    return response.json();
  },
  
  // Save a product for offline access
  saveProduct: async (productId: string): Promise<void> => {
    const token = await AsyncStorage.getItem('auth_token');
    if (!token) throw new Error('Authentication required');
    
    // First, save the product on the server
    const response = await fetch(`${API_URL}/saved-products/${productId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) throw new Error('Failed to save product');
    
    // Then, get the full product data
    const productResponse = await fetch(`${API_URL}/products/${productId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!productResponse.ok) throw new Error('Failed to fetch product data');
    
    const product = await productResponse.json();
    
    // Download product images and manuals for offline access
    const productWithLocalImages = await localDatabase.downloadProductImages(product);
    const productWithLocalManuals = await localDatabase.downloadProductManuals(productWithLocalImages);
    
    // Save the product to local storage
    await localDatabase.saveProductOffline(productWithLocalManuals);
  },
  
  // Remove a saved product
  removeSavedProduct: async (productId: string): Promise<void> => {
    const token = await AsyncStorage.getItem('auth_token');
    if (!token) throw new Error('Authentication required');
    
    // Remove from server
    const response = await fetch(`${API_URL}/saved-products/${productId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) throw new Error('Failed to remove saved product');
    
    // Remove from local storage
    await localDatabase.removeOfflineProduct(productId);
  },
  
  // Check if a product is saved
  isProductSaved: async (productId: string): Promise<boolean> => {
    const token = await AsyncStorage.getItem('auth_token');
    if (!token) throw new Error('Authentication required');
    
    const response = await fetch(`${API_URL}/saved-products/check/${productId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) throw new Error('Failed to check if product is saved');
    
    const data = await response.json();
    return data.isSaved;
  }
}; 