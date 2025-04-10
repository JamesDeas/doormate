import { API_URL } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { localDatabase } from './localDatabase';

// Helper function to check if we're in a browser environment
const isBrowser = () => {
  return typeof window !== 'undefined';
};

export interface User {
  _id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  company?: string;
  profileImage?: string;
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
  username?: string;
  company?: string;
}

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  username?: string;
  company?: string;
  profileImage?: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

class AuthService {
  private token: string | null = null;

  constructor() {
    // Only try to load the token if we're in a browser environment
    if (isBrowser()) {
      this.loadToken();
    }
  }

  async loadToken() {
    try {
      // Only try to access AsyncStorage if we're in a browser environment
      if (isBrowser()) {
        this.token = await AsyncStorage.getItem('auth_token');
        return this.token;
      }
      return null;
    } catch (error) {
      console.error('Error loading token:', error);
      this.token = null;
      return null;
    }
  }

  private async saveToken(token: string) {
    try {
      // Only try to access AsyncStorage if we're in a browser environment
      if (isBrowser()) {
        await AsyncStorage.setItem('auth_token', token);
      }
      this.token = token;
    } catch (error) {
      console.error('Error saving token:', error);
    }
  }

  private async clearToken() {
    try {
      // Only try to access AsyncStorage if we're in a browser environment
      if (isBrowser()) {
        console.log('Clearing auth token from AsyncStorage...');
        await AsyncStorage.removeItem('auth_token');
        console.log('Auth token cleared successfully');
      }
      this.token = null;
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
      if (isBrowser()) {
        await AsyncStorage.removeItem('auth_token');
      }
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

    const userData = await response.json();
    
    // Save user profile to local storage for offline access
    try {
      await localDatabase.saveUserProfile(userData);
    } catch (error) {
      console.error('Error saving user profile to local storage:', error);
    }
    
    return userData;
  }

  async checkUsernameAvailability(username: string): Promise<boolean> {
    const response = await fetch(`${API_URL}/auth/check-username/${username}`);
    
    if (!response.ok) {
      throw new Error('Failed to check username availability');
    }

    const data = await response.json();
    return data.available;
  }

  async updateProfile(data: UpdateProfileData): Promise<User> {
    if (!this.token) {
      throw new Error('Not authenticated');
    }

    console.log('Auth service: Sending profile update request:', {
      ...data,
      profileImage: data.profileImage ? '[Image data]' : undefined
    });

    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('Auth service: Profile update failed:', responseData);
        throw new Error(responseData.message || 'Failed to update profile');
      }

      console.log('Auth service: Profile updated successfully');
      return responseData;
    } catch (error) {
      console.error('Auth service: Error in updateProfile:', error);
      throw error;
    }
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

  async deleteAccount(password: string): Promise<void> {
    if (!this.token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/auth/delete-account`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete account');
    }

    // Clear auth token after successful deletion
    await this.clearToken();
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  getInitials(firstName: string, lastName: string): string {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  }
}

export const authService = new AuthService(); 