import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
  Animated,
  Image,
  SafeAreaView,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { authService, User } from '@/services/auth';
import { savedProductsApi, API_URL } from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ProfileImage from '@/components/ProfileImage';
import { debounce } from 'lodash';
import type { Product } from '@/types/product';
import { localDatabase } from '@/services/localDatabase';
import { useAuth } from '@/app/_layout';

// Get base URL for images by removing '/api' from the API_URL
const BASE_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001').replace(/\/api$/, '');

// Debug URL construction
const getFullUrl = (path: string) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  
  // Remove any leading slash to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // If the path is for an image or manual, use the BASE_URL
  if (cleanPath.startsWith('images/') || cleanPath.startsWith('manuals/')) {
    const fullUrl = `${BASE_URL}/${cleanPath}`;
    console.log('Constructed URL:', fullUrl); // Add debugging
    return fullUrl;
  }
  
  // For API endpoints, use the API_URL
  const fullUrl = `${API_URL}/${cleanPath}`;
  console.log('Constructed API URL:', fullUrl); // Add debugging
  return fullUrl;
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { isOffline } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'valid' | 'invalid' | 'checking' | ''>('');
  const [savedProducts, setSavedProducts] = useState<Product[]>([]);
  const [isLoadingSavedProducts, setIsLoadingSavedProducts] = useState(false);
  const successOpacity = useRef(new Animated.Value(0)).current;
  const isMounted = useRef(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    company: '',
    profileImage: '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameValid, setUsernameValid] = useState<boolean>(true);
  const usernameCheckTimeout = useRef<NodeJS.Timeout>();

  // Set mounted ref
  useEffect(() => {
    isMounted.current = true;
    loadUserProfile();
    loadSavedProducts();
    return () => {
      isMounted.current = false;
    };
  }, []);

  const validateUsername = (username: string) => {
    if (!username) return false;
    return /^[a-zA-Z0-9_]{3,20}$/.test(username);
  };

  const checkUsernameAvailability = async (username: string) => {
    if (!username || username === user?.username) {
      setUsernameAvailable(null);
      return;
    }
    
    if (!validateUsername(username)) {
      setUsernameValid(false);
      setUsernameAvailable(null);
      return;
    }
    
    setUsernameValid(true);
    try {
      const available = await authService.checkUsernameAvailability(username);
      setUsernameAvailable(available);
    } catch (error) {
      console.error('Error checking username availability:', error);
      setUsernameAvailable(null);
    }
  };

  const handleUsernameChange = (text: string) => {
    setFormData(prev => ({ ...prev, username: text }));
    setUsernameValid(validateUsername(text));
    
    // Clear any existing timeout
    if (usernameCheckTimeout.current) {
      clearTimeout(usernameCheckTimeout.current);
    }
    
    // Set a new timeout to check availability
    usernameCheckTimeout.current = setTimeout(() => {
      checkUsernameAvailability(text);
    }, 500);
  };

  // Handle success message animation
  useEffect(() => {
    if (successMessage) {
      // Fade in
      Animated.timing(successOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Automatically fade out after 3 seconds
      const timer = setTimeout(() => {
        Animated.timing(successOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          if (isMounted.current) {
            setSuccessMessage('');
          }
        });
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const loadUserProfile = async () => {
    try {
      let userData: User | null = null;
      
      // Try to get user data from the server if online
      if (!isOffline) {
        try {
          userData = await authService.getCurrentUser();
        } catch (error) {
          console.error('Error loading user profile from server:', error);
          // If server request fails, try to load from local storage
          userData = await localDatabase.getUserProfile();
        }
      } else {
        // If offline, load from local storage
        userData = await localDatabase.getUserProfile();
      }
      
      if (!userData) {
        throw new Error('Failed to load user profile');
      }
      
      setUser(userData);
      setFormData({
        firstName: userData.firstName,
        lastName: userData.lastName,
        username: userData.username,
        company: userData.company || '',
        profileImage: userData.profileImage || '',
      });
      
      // Set initial username status to valid since the current username is already valid
      setUsernameStatus('valid');
    } catch (error) {
      console.error('Error loading user profile:', error);
      Alert.alert('Error', 'Failed to load user profile');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSavedProducts = async () => {
    if (!authService.isAuthenticated()) return;
    
    setIsLoadingSavedProducts(true);
    try {
      // Check if we're offline
      const online = await localDatabase.isOnline();
      
      if (!online) {
        // If offline, load products from local storage
        const offlineProducts = await localDatabase.getOfflineProducts();
        const productsArray = Object.values(offlineProducts);
        
        if (isMounted.current) {
          setSavedProducts(productsArray);
        }
      } else {
        // If online, try to load from API first
        try {
          const products = await savedProductsApi.getSavedProducts();
          if (isMounted.current) {
            setSavedProducts(products);
          }
        } catch (apiError) {
          console.error('Error loading saved products from API:', apiError);
          // Fall back to local storage if API fails
          const offlineProducts = await localDatabase.getOfflineProducts();
          const productsArray = Object.values(offlineProducts);
          
          if (isMounted.current) {
            setSavedProducts(productsArray);
          }
        }
      }
    } catch (error) {
      console.error('Error loading saved products:', error);
      if (isMounted.current) {
        Alert.alert('Error', 'Failed to load saved products');
      }
    } finally {
      if (isMounted.current) {
        setIsLoadingSavedProducts(false);
      }
    }
  };

  const handleRemoveSavedProduct = async (productId: string) => {
    try {
      // Check if we're offline
      const online = await localDatabase.isOnline();
      
      if (!online) {
        // If offline, just remove from local storage
        await localDatabase.removeOfflineProduct(productId);
        if (isMounted.current) {
          setSavedProducts(prevProducts => 
            prevProducts.filter(product => product._id !== productId)
          );
          showSuccess('Product removed from saved items');
        }
      } else {
        // If online, try to remove from server first
        try {
          await savedProductsApi.removeSavedProduct(productId);
          if (isMounted.current) {
            setSavedProducts(prevProducts => 
              prevProducts.filter(product => product._id !== productId)
            );
            showSuccess('Product removed from saved items');
          }
        } catch (apiError) {
          console.error('Error removing saved product from API:', apiError);
          // Fall back to local storage if API fails
          await localDatabase.removeOfflineProduct(productId);
          if (isMounted.current) {
            setSavedProducts(prevProducts => 
              prevProducts.filter(product => product._id !== productId)
            );
            showSuccess('Product removed from saved items (offline)');
          }
        }
      }
    } catch (error) {
      console.error('Error removing saved product:', error);
      if (isMounted.current) {
        Alert.alert('Error', 'Failed to remove product from saved items');
      }
    }
  };

  const renderSavedProduct = ({ item }: { item: Product }) => (
    <View style={styles.manualItem}>
      <View style={styles.manualInfo}>
        <Image 
          source={{ uri: item.images?.main?.startsWith('file://') ? item.images.main : getFullUrl(item.images?.main) }} 
          style={styles.savedProductImage}
          resizeMode="cover"
        />
        <View style={styles.manualText}>
          <Text style={styles.manualTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.manualSubtitle} numberOfLines={1}>
            Model: {item.model}
          </Text>
        </View>
      </View>
      <View style={styles.manualButtons}>
        <TouchableOpacity
          style={[styles.manualButton, styles.viewButton]}
          onPress={() => router.push(`/product/${item._id}`)}
        >
          <Text style={styles.buttonText}>View</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.manualButton, styles.downloadButton]}
          onPress={() => handleRemoveSavedProduct(item._id)}
        >
          <Text style={styles.buttonText}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
  };

  const handleSave = async () => {
    console.log('Save button clicked');
    
    // Prevent saving when offline
    if (isOffline) {
      Alert.alert('Offline Mode', 'You cannot update your profile while offline. Please connect to the internet and try again.');
      return;
    }
    
    if (!formData.firstName || !formData.lastName) {
      Alert.alert('Error', 'First name and last name are required');
      return;
    }

    // Username validation logic
    if (!formData.username || formData.username.trim() === '') {
      Alert.alert('Error', 'Username is required');
      return;
    }

    // Validate username format
    if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      Alert.alert('Error', 'Username must contain only letters, numbers, and underscores');
      return;
    }

    // Validate username length
    if (formData.username.length < 3 || formData.username.length > 20) {
      Alert.alert('Error', 'Username must be between 3 and 20 characters');
      return;
    }

    // Only validate changed usernames
    const usernameChanged = user && formData.username !== user.username;
    if (usernameChanged) {
      console.log('Username changed from', user?.username, 'to', formData.username);
      console.log('Current username status:', usernameStatus);
      
      // If the status is still checking, wait briefly
      if (usernameStatus === 'checking') {
        Alert.alert('Please wait', 'Still checking username availability');
        return;
      }
      
      // If the status is invalid, block saving
      if (usernameStatus === 'invalid') {
        Alert.alert('Error', 'Username is already taken');
        return;
      }
    }

    // Password validation when changing password
    if (showPasswordFields) {
      if (!passwordData.currentPassword) {
        Alert.alert('Error', 'Current password is required');
        return;
      }
      
      if (!passwordData.newPassword) {
        Alert.alert('Error', 'New password is required');
        return;
      }
      
      if (passwordData.newPassword.length < 6) {
        Alert.alert('Error', 'New password must be at least 6 characters long');
        return;
      }
      
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        Alert.alert('Error', 'New passwords do not match');
        return;
      }
    }

    setIsSaving(true);
    try {
      // Update profile
      console.log('Submitting profile update:', {
        ...formData,
        profileImage: formData.profileImage ? '[IMAGE DATA]' : undefined
      });
      
      const updatedUser = await authService.updateProfile(formData);
      setUser(updatedUser);
      
      // Change password if fields are filled
      if (showPasswordFields) {
        await authService.changePassword({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        });
        
        // Reset password data
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
        
        showSuccess('Profile and password updated successfully');
      } else {
        showSuccess('Profile updated successfully');
      }
      
      // Reset edit state
      setIsEditing(false);
      setShowPasswordFields(false);
    } catch (error: any) {
      console.error('Error updating profile or password:', error);
      Alert.alert('Error', error.message || 'Failed to update profile or password');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (
      !passwordData.currentPassword ||
      !passwordData.newPassword ||
      !passwordData.confirmPassword ||
      passwordData.newPassword !== passwordData.confirmPassword
    ) {
      return;
    }

    setIsSubmittingPassword(true);
    try {
      await authService.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });

      // Clear password fields
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setShowPasswordFields(false);
      showSuccess('Password updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update password. Please check your current password and try again.');
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  // Helper function to resize base64 image for better performance (web only)
  const resizeBase64Image = (base64Str: string): Promise<string> => {
    // Only implement for web platform
    if (Platform.OS !== 'web') {
      return Promise.resolve(base64Str);
    }
    
    return new Promise((resolve, reject) => {
      try {
        // Web-only code using browser APIs
        const img = document.createElement('img');
        
        img.onload = () => {
          // Target size - resize large images to max 800x800px while maintaining aspect ratio
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          
          let width = img.width;
          let height = img.height;
          
          // Resize if the image is larger than our max dimensions
          if (width > MAX_WIDTH || height > MAX_HEIGHT) {
            const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          
          // Create a canvas to draw the resized image
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          
          // Draw the resized image
          ctx.drawImage(img, 0, 0, width, height);
          
          // Get the resized image as base64
          const resizedBase64 = canvas.toDataURL('image/jpeg', 0.7); // Use JPEG with 70% quality
          resolve(resizedBase64);
        };
        
        img.onerror = () => {
          reject(new Error('Error loading image'));
        };
        
        // Set the source of the image to the original base64 string
        img.src = base64Str;
      } catch (error) {
        // If any DOM error occurs (which would happen on native platforms),
        // just return the original image
        console.log('Image resize error (probably on native platform):', error);
        resolve(base64Str);
      }
    });
  };

  // Converted image picker for web compatibility
  const pickImage = async () => {
    try {
      // Request permissions if on mobile
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission required', 'Sorry, we need camera roll permissions to make this work!');
          return;
        }
      }

      // Launch image picker with correct options for web compatibility
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images', // Use string value instead of enum
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true, // Request base64 data directly
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedImage = result.assets[0];
        
        // Use the base64 data if available (works on web)
        if (selectedImage.base64) {
          try {
            // Create a base64 image URL from the raw base64 data
            const imageUrl = `data:image/jpeg;base64,${selectedImage.base64}`;
            
            // Resize the image if we're on web
            if (Platform.OS === 'web') {
              const resizedImageUrl = await resizeBase64Image(imageUrl);
              setFormData(prev => ({ ...prev, profileImage: resizedImageUrl }));
            } else {
              // Just use the original on native platforms
              setFormData(prev => ({ ...prev, profileImage: imageUrl }));
            }
          } catch (resizeError) {
            console.error('Error resizing image:', resizeError);
            // Fallback to original image if resize fails
            const imageUrl = `data:image/jpeg;base64,${selectedImage.base64}`;
            setFormData(prev => ({ ...prev, profileImage: imageUrl }));
          }
        } 
        // Fallback to just the URI for preview (but won't be stored properly)
        else if (selectedImage.uri) {
          setFormData(prev => ({ ...prev, profileImage: selectedImage.uri }));
          console.warn('Base64 image data not available. Image might not be saved properly.');
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  // Simple logout helper function
  const performLogout = () => {
    console.log("Direct logout executing");
    
    try {
      // Remove token from AsyncStorage synchronously
      AsyncStorage.removeItem('auth_token')
        .then(() => {
          console.log("Auth token removed successfully");
          
          // Reset the auth service state
          return authService.logout();
        })
        .then(() => {
          console.log("Auth service logout completed");
          
          // Delay navigation slightly to ensure token removal is processed
          setTimeout(() => {
            console.log("Navigating to login page...");
            if (isMounted.current) {
              router.replace('/auth/login');
            }
          }, 100);
        })
        .catch(err => {
          console.error("Error during logout process:", err);
          // Even on error, try to navigate away
          if (isMounted.current) {
            router.replace('/auth/login');
          }
        });
    } catch (error) {
      console.error("Critical error during logout:", error);
      // Force navigation on any error
      if (isMounted.current) {
        router.replace('/auth/login');
      }
    }
  };

  const renderForm = () => (
    <View style={styles.form}>
      <View style={styles.formGroup}>
        <Text style={styles.label}>First Name</Text>
        <TextInput
          style={styles.input}
          value={formData.firstName}
          onChangeText={(text) => setFormData({ ...formData, firstName: text })}
          placeholder="First Name"
          placeholderTextColor="rgba(0, 0, 0, 0.5)"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Last Name</Text>
        <TextInput
          style={styles.input}
          value={formData.lastName}
          onChangeText={(text) => setFormData({ ...formData, lastName: text })}
          placeholder="Last Name"
          placeholderTextColor="rgba(0, 0, 0, 0.5)"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Username</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={[
              styles.input,
              !usernameValid && styles.inputError
            ]}
            value={formData.username}
            onChangeText={handleUsernameChange}
            placeholder="Username"
            placeholderTextColor="rgba(0, 0, 0, 0.5)"
          />
          {formData.username && (
            <View style={styles.validationIconContainer}>
              {usernameValid && usernameAvailable === true && (
                <MaterialCommunityIcons name="check-circle" size={24} color="#4CAF50" />
              )}
              {(!usernameValid || usernameAvailable === false) && (
                <MaterialCommunityIcons name="close-circle" size={24} color="#F44336" />
              )}
            </View>
          )}
        </View>
        {formData.username && !usernameValid && (
          <Text style={styles.errorText}>
            Username must be 3-20 characters and contain only letters, numbers, and underscores
          </Text>
        )}
        {usernameValid && usernameAvailable === false && (
          <Text style={styles.errorText}>
            This username is already taken
          </Text>
        )}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Company</Text>
        <TextInput
          style={styles.input}
          value={formData.company}
          onChangeText={(text) => setFormData({ ...formData, company: text })}
          placeholder="Company (Optional)"
          placeholderTextColor="rgba(0, 0, 0, 0.5)"
        />
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[
      styles.container,
      isOffline && { paddingTop: 36 }
    ]}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>
        {isOffline && (
          <View style={styles.offlineBanner}>
            <MaterialCommunityIcons name="wifi-off" size={16} color="#8B4513" />
            <Text style={styles.offlineText}>You are offline. Profile editing is disabled.</Text>
          </View>
        )}

        {successMessage ? (
          <Animated.View style={[styles.successMessage, { opacity: successOpacity }]}>
            <MaterialCommunityIcons name="check-circle" size={20} color="#fff" />
            <Text style={styles.successText}>{successMessage}</Text>
          </Animated.View>
        ) : null}

        <View style={styles.profileImageSection}>
          {isEditing ? (
            <TouchableOpacity onPress={pickImage} style={styles.profileImageContainer}>
              <ProfileImage 
                profileImage={formData.profileImage}
                firstName={formData.firstName}
                lastName={formData.lastName}
                size={100}
                fontSize={36}
                borderWidth={3}
              />
              <View style={styles.editImageOverlay}>
                <MaterialCommunityIcons name="camera" size={24} color="#fff" />
              </View>
            </TouchableOpacity>
          ) : (
            <ProfileImage 
              profileImage={user?.profileImage}
              firstName={user?.firstName || ''}
              lastName={user?.lastName || ''}
              size={100}
              fontSize={36}
              borderWidth={3}
            />
          )}
          <Text style={styles.usernameDisplay}>
            @{user?.username}
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Profile Information</Text>
            {!isOffline && (
              <TouchableOpacity 
                onPress={() => setIsEditing(!isEditing)}
                style={styles.editButton}
              >
                <MaterialCommunityIcons 
                  name={isEditing ? "close" : "pencil"} 
                  size={24} 
                  color="#fff" 
                />
              </TouchableOpacity>
            )}
          </View>

          {isEditing ? (
            renderForm()
          ) : (
            <View style={styles.profileInfo}>
              <Text style={styles.label}>Name</Text>
              <Text style={styles.value}>{user?.firstName} {user?.lastName}</Text>
              
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{user?.email}</Text>
              
              <Text style={styles.label}>Username</Text>
              <Text style={styles.value}>@{user?.username}</Text>
              
              {user?.company && (
                <>
                  <Text style={styles.label}>Company</Text>
                  <Text style={styles.value}>{user.company}</Text>
                </>
              )}
            </View>
          )}

          {isEditing && !isOffline && (
            <View style={styles.passwordSection}>
              <TouchableOpacity 
                onPress={() => setShowPasswordFields(!showPasswordFields)}
                style={styles.passwordToggle}
              >
                <Text style={styles.passwordToggleText}>
                  {showPasswordFields ? 'Hide Password Change' : 'Change Password'}
                </Text>
                <MaterialCommunityIcons 
                  name={showPasswordFields ? "chevron-up" : "chevron-down"} 
                  size={24} 
                  color="#fff" 
                />
              </TouchableOpacity>

              {showPasswordFields && (
                <View style={styles.passwordFields}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Current Password"
                    placeholderTextColor="rgba(0, 0, 0, 0.5)"
                    secureTextEntry
                    value={passwordData.currentPassword}
                    onChangeText={(text) => setPasswordData(prev => ({
                      ...prev,
                      currentPassword: text
                    }))}
                  />
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="New Password"
                    placeholderTextColor="rgba(0, 0, 0, 0.5)"
                    secureTextEntry
                    value={passwordData.newPassword}
                    onChangeText={(text) => setPasswordData(prev => ({
                      ...prev,
                      newPassword: text
                    }))}
                  />
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Confirm New Password"
                    placeholderTextColor="rgba(0, 0, 0, 0.5)"
                    secureTextEntry
                    value={passwordData.confirmPassword}
                    onChangeText={(text) => setPasswordData(prev => ({
                      ...prev,
                      confirmPassword: text
                    }))}
                  />
                </View>
              )}
            </View>
          )}

          {isEditing && (
            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={[styles.button, styles.cancelButton]} 
                onPress={() => {
                  setIsEditing(false);
                  setShowPasswordFields(false);
                  setPasswordData({
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: '',
                  });
                }}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.saveButton]} 
                onPress={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Saved Products Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Saved Products</Text>
          </View>
          {isOffline && (
            <View style={styles.offlineBanner}>
              <MaterialCommunityIcons name="wifi-off" size={20} color="#8B4513" />
              <Text style={styles.offlineText}>You are offline. Viewing saved content.</Text>
            </View>
          )}
          {isLoadingSavedProducts ? (
            <ActivityIndicator style={styles.loadingIndicator} />
          ) : savedProducts.length > 0 ? (
            <FlatList
              data={savedProducts}
              renderItem={renderSavedProduct}
              keyExtractor={item => item._id}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="bookmark-outline" size={48} color="#fff" style={styles.emptyIcon} />
              <Text style={styles.emptyText}>
                No saved products yet. Save products for offline access from the product page.
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={performLogout}
        >
          <MaterialCommunityIcons name="logout" size={24} color="#fff" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#8B0000',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: '4%',
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: '4%',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
  },
  profileImageSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 10,
  },
  editImageOverlay: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  usernameDisplay: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
    marginTop: 8,
  },
  successMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 128, 0, 0.7)',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
  },
  successText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 10,
    fontWeight: '500',
  },
  section: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  editButton: {
    padding: 4,
  },
  profileInfo: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
  },
  label: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 8,
    opacity: 0.8,
  },
  value: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 8,
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#000',
    width: '100%',
  },
  validInput: {
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  invalidInput: {
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  usernameStatus: {
    position: 'absolute',
    right: 15,
    top: 15,
  },
  invalidText: {
    color: '#FF6B6B',
    fontSize: 12,
    marginTop: -10,
    marginBottom: 10,
  },
  validText: {
    color: '#4CAF50',
    fontSize: 12,
    marginTop: -10,
    marginBottom: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  saveButton: {
    backgroundColor: '#4A0404',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  passwordSection: {
    marginTop: 8,
  },
  passwordToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    marginTop: 16,
  },
  passwordToggleText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  passwordFields: {
    marginTop: 16,
    gap: 16,
  },
  passwordInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#000',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF6B6B',
    marginBottom: 20,
  },
  logoutText: {
    marginLeft: 10,
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  manualItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    overflow: 'hidden',
  },
  manualInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  manualText: {
    marginLeft: 12,
    flex: 1,
  },
  manualTitle: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
    opacity: 0.9,
  },
  manualSubtitle: {
    fontSize: 14,
    color: '#fff',
    marginTop: 2,
    opacity: 0.7,
  },
  manualButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 8,
  },
  manualButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    minWidth: 100,
    alignItems: 'center',
  },
  viewButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  downloadButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  savedProductImage: {
    width: 60,
    height: 60,
    borderRadius: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    marginBottom: 16,
    opacity: 0.7,
  },
  emptyText: {
    textAlign: 'center',
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
    opacity: 0.8,
  },
  loadingIndicator: {
    marginVertical: 20,
  },
  separator: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 8,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 228, 181, 0.2)',
    padding: 12,
    marginBottom: 8,
  },
  offlineText: {
    color: '#FFE4B5',
    marginLeft: 8,
    fontSize: 14,
  },
  inputDisabled: {
    opacity: 0.5,
    backgroundColor: '#f5f5f5',
  },
  formGroup: {
    width: '100%',
  },
  inputContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  inputError: {
    borderWidth: 1,
    borderColor: '#F44336',
  },
  validationIconContainer: {
    position: 'absolute',
    right: 16,
    zIndex: 1,
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
    marginTop: 4,
  },
}); 