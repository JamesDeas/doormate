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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { authService, User } from '@/services/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const successOpacity = useRef(new Animated.Value(0)).current;
  const isMounted = useRef(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    company: '',
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
    return () => {
      isMounted.current = false;
    };
  }, []);

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
        company: userData.company || '',
      });
    } catch (error) {
      console.error('Error loading user profile:', error);
      Alert.alert('Error', 'Failed to load user profile');
    } finally {
      setIsLoading(false);
    }
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
  };

  const handleSave = async () => {
    if (!formData.firstName || !formData.lastName) {
      Alert.alert('Error', 'First name and last name are required');
      return;
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
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      {successMessage ? (
        <Animated.View style={[styles.successMessage, { opacity: successOpacity }]}>
          <MaterialCommunityIcons name="check-circle" size={20} color="#fff" />
          <Text style={styles.successText}>{successMessage}</Text>
        </Animated.View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Profile Information</Text>
          {!isEditing && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setIsEditing(true)}
            >
              <MaterialCommunityIcons name="pencil" size={22} color="#fff" />
            </TouchableOpacity>
          )}
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
                    company: user?.company || '',
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

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={performLogout}
      >
        <MaterialCommunityIcons name="logout" size={24} color="#fff" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#8B0000',
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
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
  }
}); 