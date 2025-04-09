import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { authService } from '@/services/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/app/_layout';
import { localDatabase } from '@/services/localDatabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const isMounted = useRef(false);
  const { isOffline } = useAuth();

  // Set mounted ref
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // On mount, check if user is already logged in
  useEffect(() => {
    const checkExistingAuth = async () => {
      try {
        // Wait a bit to ensure component is mounted
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (!isMounted.current) return;
        
        // Check if there's a valid token
        const token = await AsyncStorage.getItem('auth_token');
        
        if (token) {
          try {
            // Check if we're online
            const online = await localDatabase.isOnline();
            
            // If offline, consider the token valid
            if (!online) {
              console.log('Offline mode: using stored token');
              setTimeout(() => {
                if (isMounted.current) {
                  router.replace('/(tabs)');
                }
              }, 0);
              return;
            }
            
            // Validate token by making API call
            await authService.getCurrentUser();
            console.log('Valid token found, redirecting to home');
            
            // Use setTimeout to ensure this happens after render
            setTimeout(() => {
              if (isMounted.current) {
                router.replace('/(tabs)');
              }
            }, 0);
            return;
          } catch (err) {
            // Token is invalid, clear it
            console.log('Invalid token found, clearing it');
            await AsyncStorage.removeItem('auth_token');
          }
        }
      } catch (err) {
        console.error('Error checking auth:', err);
      } finally {
        if (isMounted.current) {
          setCheckingAuth(false);
        }
      }
    };
    
    checkExistingAuth();
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    // Check if we're offline
    if (isOffline) {
      setError('Cannot login while offline. Please check your internet connection.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      // Clear any existing tokens first
      await AsyncStorage.removeItem('auth_token');
      
      // Perform login
      const result = await authService.login({ email, password });
      
      if (result && result.token) {
        console.log('Login successful, token received');
        
        // Use setTimeout for navigation to avoid navigation during render
        setTimeout(() => {
          if (isMounted.current) {
            router.replace('/(tabs)');
          }
        }, 0);
      } else {
        setError('Login failed - no token received');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to login');
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  // Show loading while checking auth
  if (checkingAuth) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <Image
          source={require('@/assets/images/doormate-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <View style={styles.form}>
          {isOffline && (
            <View style={styles.offlineBanner}>
              <Text style={styles.offlineText}>You are offline. Login is not available.</Text>
            </View>
          )}
          
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor="#666"
            editable={!isOffline}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor="#666"
            editable={!isOffline}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, isOffline && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading || isOffline}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Login</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => {
              if (isMounted.current) {
                router.push('/auth/signup');
              }
            }}
            disabled={isOffline}
          >
            <Text style={[styles.linkText, isOffline && styles.linkTextDisabled]}>
              Don't have an account? Sign up
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#8B0000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  logo: {
    width: 200,
    height: 80,
    alignSelf: 'center',
    marginBottom: 40,
  },
  form: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 20,
    borderRadius: 10,
  },
  input: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 5,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#4A0404',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: '#8B8B8B',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#FF6B6B',
    marginBottom: 10,
    textAlign: 'center',
  },
  linkButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  linkText: {
    color: '#fff',
    fontSize: 14,
  },
  linkTextDisabled: {
    color: '#ccc',
  },
  offlineBanner: {
    backgroundColor: '#FFE4B5',
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
  },
  offlineText: {
    color: '#8B4513',
    textAlign: 'center',
    fontSize: 14,
  },
}); 