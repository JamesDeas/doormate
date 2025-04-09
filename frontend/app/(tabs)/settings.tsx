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
import { savedProductsApi } from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ProfileImage from '@/components/ProfileImage';
import { debounce } from 'lodash';
import type { Product } from '@/types/product';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
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

  // Set mounted ref
  useEffect(() => {
    isMounted.current = true;
    loadUserProfile();
    loadSavedProducts();
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Debounced function to check username availability
  const checkUsername = debounce(async (username: string) => {
    if (!username || username.trim() === '') {
      setUsernameStatus('invalid');
      return;
    }
    
    // If username hasn't changed, it's valid
    if (user && username === user.username) {
      setUsernameStatus('valid');
      return;
    }
    
    // Username validation - alphanumeric and underscore only
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setUsernameStatus('invalid');
      return;
    }
    
    // Username must be between 3 and 20 characters
    if (username.length < 3 || username.length > 20) {
      setUsernameStatus('invalid');
      return;
    }
    
    setUsernameStatus('checking');
    try {
      const isAvailable = await authService.checkUsernameAvailability(username);
      if (isMounted.current) {
        setUsernameStatus(isAvailable ? 'valid' : 'invalid');
      }
    } catch (error) {
      console.error('Error checking username:', error);
      if (isMounted.current) {
        setUsernameStatus('');
      }
    }
  }, 500);

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
      const userData = await authService.getCurrentUser();
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
      const products = await savedProductsApi.getSavedProducts();
      if (isMounted.current) {
        setSavedProducts(products);
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
      await savedProductsApi.removeSavedProduct(productId);
      if (isMounted.current) {
        setSavedProducts(prevProducts => 
          prevProducts.filter(product => product._id !== productId)
        );
        showSuccess('Product removed from saved items');
      }
    } catch (error) {
      console.error('Error removing saved product:', error);
      if (isMounted.current) {
        Alert.alert('Error', 'Failed to remove product from saved items');
      }
    }
  };

  const renderSavedProduct = ({ item }: { item: Product }) => (
    <TouchableOpacity 
      style={styles.savedProductItem}
      onPress={() => router.push(`/product/${item._id}`)}
    >
      <Image 
        source={{ uri: item.images?.main }} 
        style={styles.savedProductImage}
        resizeMode="cover"
      />
      <View style={styles.savedProductInfo}>
        <Text style={styles.savedProductTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.savedProductModel} numberOfLines={1}>
          {item.model}
        </Text>
      </View>
      <TouchableOpacity 
        style={styles.removeSavedButton}
        onPress={() => handleRemoveSavedProduct(item._id)}
      >
        <MaterialCommunityIcons name="close" size={20} color="#666" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
  };

  const handleSave = async () => {
    console.log('Save button clicked');
    
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
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          {!isEditing && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setIsEditing(true)}
            >
              <MaterialCommunityIcons name="pencil" size={22} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

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
          </View>
          
          {isEditing ? (
            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="First Name"
                value={formData.firstName}
                onChangeText={(value) => setFormData(prev => ({ ...prev, firstName: value }))}
              />
              <TextInput
                style={styles.input}
                placeholder="Last Name"
                value={formData.lastName}
                onChangeText={(value) => setFormData(prev => ({ ...prev, lastName: value }))}
              />
              <View>
                <TextInput
                  style={[
                    styles.input,
                    usernameStatus === 'valid' && styles.validInput,
                    usernameStatus === 'invalid' && styles.invalidInput
                  ]}
                  placeholder="Username *"
                  value={formData.username}
                  onChangeText={(value) => {
                    setFormData(prev => ({ ...prev, username: value }));
                    
                    // Clear status when emptying the field
                    if (!value.trim()) {
                      setUsernameStatus('invalid');
                      return;
                    }
                    
                    // If unchanged from current username, it's valid
                    if (user && value === user.username) {
                      setUsernameStatus('valid');
                      return;
                    }
                    
                    // Otherwise check with debounced function
                    checkUsername(value);
                  }}
                  autoCapitalize="none"
                />
                {usernameStatus === 'checking' && (
                  <View style={styles.usernameStatus}>
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                )}
                {usernameStatus === 'invalid' && formData.username && (
                  <Text style={styles.invalidText}>
                    {!/^[a-zA-Z0-9_]+$/.test(formData.username) 
                      ? 'Username must contain only letters, numbers, and underscores'
                      : formData.username.length < 3 || formData.username.length > 20 
                        ? 'Username must be between 3-20 characters'
                        : 'Username already taken'}
                  </Text>
                )}
                {usernameStatus === 'valid' && formData.username && user?.username !== formData.username && (
                  <Text style={styles.validText}>
                    Username available
                  </Text>
                )}
              </View>
              <TextInput
                style={styles.input}
                placeholder="Company (Optional)"
                value={formData.company}
                onChangeText={(value) => setFormData(prev => ({ ...prev, company: value }))}
              />
              
              {/* Password change toggle button */}
              <TouchableOpacity
                style={styles.togglePasswordButton}
                onPress={() => setShowPasswordFields(!showPasswordFields)}
              >
                <MaterialCommunityIcons 
                  name={showPasswordFields ? "chevron-up" : "chevron-down"} 
                  size={24} 
                  color="#fff" 
                />
                <Text style={styles.togglePasswordText}>
                  {showPasswordFields ? "Hide Password Fields" : "Change Password"}
                </Text>
              </TouchableOpacity>
              
              {/* Password fields */}
              {showPasswordFields && (
                <View style={styles.passwordFields}>
                  <TextInput
                    style={styles.input}
                    placeholder="Current Password"
                    value={passwordData.currentPassword}
                    onChangeText={(value) => setPasswordData(prev => ({ ...prev, currentPassword: value }))}
                    secureTextEntry
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="New Password"
                    value={passwordData.newPassword}
                    onChangeText={(value) => setPasswordData(prev => ({ ...prev, newPassword: value }))}
                    secureTextEntry
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm New Password"
                    value={passwordData.confirmPassword}
                    onChangeText={(value) => setPasswordData(prev => ({ ...prev, confirmPassword: value }))}
                    secureTextEntry
                  />
                </View>
              )}
              
              <View style={styles.buttonRow}>
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
                    setFormData({
                      firstName: user?.firstName || '',
                      lastName: user?.lastName || '',
                      username: user?.username || '',
                      company: user?.company || '',
                      profileImage: user?.profileImage || '',
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
                    <Text style={[styles.buttonText, styles.saveButtonText]}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.profileInfo}>
              <Text style={styles.label}>Name</Text>
              <Text style={styles.value}>{user?.firstName} {user?.lastName}</Text>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{user?.email}</Text>
              {user?.company && (
                <>
                  <Text style={styles.label}>Company</Text>
                  <Text style={styles.value}>{user.company}</Text>
                </>
              )}
            </View>
          )}
        </View>

        {/* Saved Products Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Saved Products</Text>
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
            <Text style={styles.emptyText}>
              No saved products yet. Save products for offline access from the product page.
            </Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: '4%',
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#fff',
    backgroundColor: '#8B0000',
    position: 'relative',
    justifyContent: 'space-between',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  editButton: {
    padding: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 5,
  },
  value: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 15,
  },
  form: {
    gap: 15,
  },
  input: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 16,
    color: '#333',
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
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  saveButton: {
    backgroundColor: '#4A0404',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  saveButtonText: {
    color: '#fff',
  },
  togglePasswordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 8,
    marginVertical: 5,
  },
  togglePasswordText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 10,
    fontWeight: '500',
  },
  passwordFields: {
    marginTop: 5,
    gap: 15,
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
  savedProductItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
  },
  savedProductImage: {
    width: 60,
    height: 60,
    borderRadius: 4,
  },
  savedProductInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  savedProductTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  savedProductModel: {
    fontSize: 14,
    color: '#666',
  },
  removeSavedButton: {
    padding: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    marginTop: 12,
    marginBottom: 12,
  },
  loadingIndicator: {
    marginVertical: 20,
  },
  separator: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 8,
  },
}); 