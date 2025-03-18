import axios from 'axios';
import { Product, ProductCategory } from '@/types/product';
import Constants from 'expo-constants';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001/api';

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
      const response = await fetch(`${API_URL}/assistant/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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

      // Process the stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Convert the chunk to text
        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');

        // Process each SSE line
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              onChunk(data.content);
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat API Error:', error);
      throw error;
    }
  }
}; 