import axios from 'axios';
import { Product, ProductCategory } from '@/types/product';

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

export const productApi = {
  search: async ({ query, category, limit = 10 }: SearchProductsParams): Promise<Product[]> => {
    try {
      const params = new URLSearchParams({
        q: query,
        limit: limit.toString(),
      });

      if (category) {
        params.append('category', category);
      }

      const response = await api.get<Product[]>(`/products/search?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error searching products:', error);
      throw error;
    }
  },

  getProducts: async (params: GetProductsParams): Promise<ProductsResponse> => {
    try {
      const response = await api.get<ProductsResponse>('/products', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  },

  getProductById: async (id: string): Promise<Product> => {
    try {
      const response = await api.get<Product>(`/products/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching product:', error);
      throw error;
    }
  },
}; 