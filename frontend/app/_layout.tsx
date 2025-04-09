import React, { useEffect, useState, createContext, useContext, useRef } from 'react';
import { Slot, useRouter, useSegments, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { authService } from '@/services/auth';
import { View, AppState, AppStateStatus, Alert, Text, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDatabase } from '@/services/localDatabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Define which segments require authentication - add any protected routes here
const protectedSegments = ['(tabs)'];

// Create auth context
interface AuthContextType {
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  checkAuthStatus: () => Promise<boolean>;
  isOffline: boolean;
}

export const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  logout: async () => {},
  checkAuthStatus: async () => false,
  isOffline: false,
});

// Custom hook to use auth context
export const useAuth = () => useContext(AuthContext);

// Offline indicator component
const OfflineIndicator = () => {
  const insets = useSafeAreaInsets();
  
  return (
    <View style={[
      styles.offlineContainer,
      { paddingTop: insets.top }
    ]}>
      <Text style={styles.offlineText}>You are offline. Some features may be limited.</Text>
    </View>
  );
};

export default function RootLayout() {
  const segments = useSegments();
  const router = useRouter();
  const [initialized, setInitialized] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const isMounted = useRef(false);

  // Check if the current route is protected
  const isProtectedRoute = () => {
    return segments[0] && protectedSegments.includes(segments[0]);
  };

  // Function to check auth token and validate it
  const checkAuthStatus = async (): Promise<boolean> => {
    try {
      // Check if we're online
      const online = await localDatabase.isOnline();
      setIsOffline(!online);
      
      // Get token from storage
      const token = await AsyncStorage.getItem('auth_token');
      
      if (!token) {
        console.log('No auth token found');
        setAuthToken(null);
        return false;
      }
      
      // If offline, consider the token valid if it exists
      if (!online) {
        console.log('Offline mode: using stored token');
        setAuthToken(token);
        return true;
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
    isOffline,
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
      
      // If not authenticated but on protected route, redirect (only if mounted and online)
      if (!isAuth && isProtectedRoute() && isMounted.current && !isOffline) {
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
      token: authToken ? 'exists' : 'missing',
      isOffline
    });

    // Use setTimeout to ensure navigation happens after render
    setTimeout(() => {
      if (isMounted.current) {
        // Don't redirect to login if offline and we have a token
        if (!isAuthenticated && inProtectedRoute && !isOffline) {
          console.log('Redirecting to login page - unauthorized');
          router.replace('/auth/login');
        } else if (isAuthenticated && segments[0] === 'auth') {
          console.log('Redirecting to home - already authenticated');
          router.replace('/(tabs)');
        }
      }
    }, 100);
  }, [segments, initialized, authToken, isOffline]);

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
      {isOffline && <OfflineIndicator />}
      <Slot />
    </AuthContext.Provider>
  );
}

const styles = StyleSheet.create({
  offlineContainer: {
    backgroundColor: '#FFE4B5',
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    zIndex: 1000,
  },
  offlineText: {
    color: '#8B4513',
    fontSize: 14,
  },
});
