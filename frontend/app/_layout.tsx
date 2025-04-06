import React, { useEffect, useState, createContext, useContext, useRef } from 'react';
import { Slot, useRouter, useSegments, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { authService } from '@/services/auth';
import { View, AppState, AppStateStatus, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Define which segments require authentication - add any protected routes here
const protectedSegments = ['(tabs)'];

// Create auth context
interface AuthContextType {
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  checkAuthStatus: () => Promise<boolean>;
}

export const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  logout: async () => {},
  checkAuthStatus: async () => false,
});

// Custom hook to use auth context
export const useAuth = () => useContext(AuthContext);

export default function RootLayout() {
  const segments = useSegments();
  const router = useRouter();
  const [initialized, setInitialized] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const isMounted = useRef(false);

  // Check if the current route is protected
  const isProtectedRoute = () => {
    return segments[0] && protectedSegments.includes(segments[0]);
  };

  // Function to check auth token and validate it
  const checkAuthStatus = async (): Promise<boolean> => {
    try {
      // Get token from storage
      const token = await AsyncStorage.getItem('auth_token');
      
      if (!token) {
        console.log('No auth token found');
        setAuthToken(null);
        return false;
      }
      
      // Validate token by making an API call to /me endpoint
      try {
        await authService.getCurrentUser();
        console.log('Token is valid, user is authenticated');
        setAuthToken(token);
        return true;
      } catch (error) {
        console.log('Token validation failed, logging out');
        await AsyncStorage.removeItem('auth_token');
        setAuthToken(null);
        return false;
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setAuthToken(null);
      return false;
    }
  };

  // Logout function available globally
  const logout = async () => {
    console.log('Global logout called');
    try {
      await AsyncStorage.removeItem('auth_token');
      setAuthToken(null);
      if (isMounted.current) {
        router.replace('/auth/login');
      }
      return Promise.resolve();
    } catch (error) {
      console.error('Logout error:', error);
      return Promise.reject(error);
    }
  };

  // Auth context value
  const authContextValue = {
    isAuthenticated: !!authToken,
    logout,
    checkAuthStatus,
  };

  // Track component mounting state
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Check for auth token on app state change
  useEffect(() => {
    // Skip this effect until component is initialized
    if (!initialized) return;

    const checkAuthOnFocus = async () => {
      const isAuth = await checkAuthStatus();
      
      // If not authenticated but on protected route, redirect (only if mounted)
      if (!isAuth && isProtectedRoute() && isMounted.current) {
        console.log('Unauthorized access detected, redirecting to login');
        // Use setTimeout to ensure this happens after render
        setTimeout(() => {
          router.replace('/auth/login');
        }, 0);
      }
    };

    // App state change listener - check auth when app comes to foreground
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isMounted.current) {
        checkAuthOnFocus();
      }
    });

    // Initial check - delay slightly to ensure component is mounted
    setTimeout(checkAuthOnFocus, 100);

    return () => {
      subscription.remove();
    };
  }, [segments, initialized]); // Re-run when segments change to catch navigation changes

  // Check authentication and redirect as needed
  useEffect(() => {
    if (!initialized) return;

    const inProtectedRoute = isProtectedRoute();
    const isAuthenticated = !!authToken;

    console.log('Auth state changed:', { 
      isAuthenticated, 
      inProtectedRoute, 
      currentSegment: segments[0],
      token: authToken ? 'exists' : 'missing'
    });

    // Use setTimeout to ensure navigation happens after render
    setTimeout(() => {
      if (isMounted.current) {
        if (!isAuthenticated && inProtectedRoute) {
          console.log('Redirecting to login page - unauthorized');
          router.replace('/auth/login');
        } else if (isAuthenticated && segments[0] === 'auth') {
          console.log('Redirecting to home - already authenticated');
          router.replace('/(tabs)');
        }
      }
    }, 100);
  }, [segments, initialized, authToken]);

  // Initialize auth on app start
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const isAuthenticated = await checkAuthStatus();
        console.log('Initial auth check complete:', isAuthenticated ? 'authenticated' : 'not authenticated');
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setInitialized(true);
        SplashScreen.hideAsync();
      }
    };

    initializeAuth();
  }, []);

  // Show a blank screen while initializing
  if (!initialized) {
    return <View />;
  }

  return (
    <AuthContext.Provider value={authContextValue}>
      <StatusBar style="light" />
      <Slot />
    </AuthContext.Provider>
  );
}
