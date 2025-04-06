import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { HapticTab } from '@/components/HapticTab';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { useAuth } from '../_layout';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { checkAuthStatus } = useAuth();
  const isMounted = useRef(false);
  
  // Set mounted ref on mount
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // Check authentication status when tabs are opened
  useEffect(() => {
    const verifyAuth = async () => {
      try {
        // Wait a bit to ensure component is mounted
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Don't continue if component unmounted
        if (!isMounted.current) return;
        
        // Check if token exists
        const token = await AsyncStorage.getItem('auth_token');
        
        if (!token) {
          console.log('No auth token found in tabs layout, redirecting to login');
          // Use setTimeout to ensure redirect happens after render
          setTimeout(() => {
            if (isMounted.current) {
              router.replace('/auth/login');
            }
          }, 0);
          return;
        }
        
        // Validate token
        const isAuth = await checkAuthStatus();
        if (!isAuth && isMounted.current) {
          console.log('Invalid auth token in tabs layout, redirecting to login');
          // Use setTimeout to ensure redirect happens after render
          setTimeout(() => {
            if (isMounted.current) {
              router.replace('/auth/login');
            }
          }, 0);
        }
      } catch (error) {
        console.error('Error verifying auth in tabs:', error);
        if (isMounted.current) {
          setTimeout(() => {
            if (isMounted.current) {
              router.replace('/auth/login');
            }
          }, 0);
        }
      }
    };
    
    verifyAuth();
  }, []);
  
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E5E5',
          height: 80,
          paddingBottom: insets.bottom,
        },
        tabBarActiveTintColor: '#8B0000',
        tabBarInactiveTintColor: '#666666',
        headerShown: false,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        tabBarItemStyle: {
          paddingTop: 8,
        },
        tabBarButton: (props) => <HapticTab {...props} />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="home" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="browse"
        options={{
          title: 'Browse',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="magnify" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          title: 'Assistant',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="robot" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="cog" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
} 