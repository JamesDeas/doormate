import { API_URL } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  company?: string;
  role: 'user' | 'admin';
  createdAt: string;
  lastLogin?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData extends LoginCredentials {
  firstName: string;
  lastName: string;
  company?: string;
}

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  company?: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

class AuthService {
  private token: string | null = null;

  constructor() {
    this.loadToken();
  }

  async loadToken() {
    try {
      this.token = await AsyncStorage.getItem('auth_token');
      return this.token;
    } catch (error) {
      console.error('Error loading token:', error);
      this.token = null;
      return null;
    }
  }

  private async saveToken(token: string) {
    try {
      await AsyncStorage.setItem('auth_token', token);
      this.token = token;
    } catch (error) {
      console.error('Error saving token:', error);
    }
  }

  private async clearToken() {
    try {
      console.log('Clearing auth token from AsyncStorage...');
      await AsyncStorage.removeItem('auth_token');
      this.token = null;
      console.log('Auth token cleared successfully');
    } catch (error) {
      console.error('Error clearing token:', error);
    }
  }

  getToken() {
    return this.token;
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    const data = await response.json();
    await this.saveToken(data.token);
    return data;
  }

  async signup(data: SignupData): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Signup failed');
    }

    const responseData = await response.json();
    await this.saveToken(responseData.token);
    return responseData;
  }

  async logout() {
    try {
      console.log('Auth service: Clearing token from AsyncStorage...');
      // Clear the token
      await AsyncStorage.removeItem('auth_token');
      this.token = null;
      
      // Return success
      console.log('Auth service: Token cleared successfully');
      return true;
    } catch (error) {
      console.error('Auth service: Error clearing token:', error);
      throw error;
    }
  }

  async getCurrentUser(): Promise<User> {
    if (!this.token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        await this.clearToken();
      }
      throw new Error('Failed to get user profile');
    }

    return response.json();
  }

  async updateProfile(data: UpdateProfileData): Promise<User> {
    if (!this.token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/auth/me`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update profile');
    }

    return response.json();
  }

  async changePassword(data: ChangePasswordData): Promise<void> {
    if (!this.token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/auth/change-password`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to change password');
    }
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }
}

export const authService = new AuthService(); 