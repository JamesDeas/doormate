import React, { useState } from 'react';
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
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { authService } from '@/services/auth';
import { SafeAreaView } from 'react-native-safe-area-context';
import { debounce } from 'lodash';

export default function SignupScreen() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    username: '',
    company: '',
  });
  const [error, setError] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'valid' | 'invalid' | 'checking' | ''>('');
  const [isLoading, setIsLoading] = useState(false);

  // Debounced function to check username availability
  const checkUsername = debounce(async (username: string) => {
    if (!username || username.trim() === '') {
      setUsernameStatus('');
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
      setUsernameStatus(isAvailable ? 'valid' : 'invalid');
    } catch (error) {
      console.error('Error checking username:', error);
      setUsernameStatus('');
    }
  }, 500);

  const handleUsernameChange = (value: string) => {
    updateFormData('username', value);
    checkUsername(value);
  };

  const handleSignup = async () => {
    // Validate form
    if (!formData.email || !formData.password || !formData.firstName || !formData.lastName || !formData.username) {
      setError('Please fill in all required fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    // Username validation
    if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      setError('Username must contain only letters, numbers, and underscores');
      return;
    }
    
    if (formData.username.length < 3 || formData.username.length > 20) {
      setError('Username must be between 3 and 20 characters');
      return;
    }

    if (usernameStatus !== 'valid') {
      setError('Username is invalid or already taken');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const { confirmPassword, ...signupData } = formData;
      await authService.signup(signupData);
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };

  const updateFormData = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Image
            source={require('@/assets/images/doormate-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="First Name *"
              value={formData.firstName}
              onChangeText={(value) => updateFormData('firstName', value)}
              placeholderTextColor="#666"
            />

            <TextInput
              style={styles.input}
              placeholder="Last Name *"
              value={formData.lastName}
              onChangeText={(value) => updateFormData('lastName', value)}
              placeholderTextColor="#666"
            />

            <TextInput
              style={styles.input}
              placeholder="Email *"
              value={formData.email}
              onChangeText={(value) => updateFormData('email', value)}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor="#666"
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
                onChangeText={handleUsernameChange}
                autoCapitalize="none"
                placeholderTextColor="#666"
              />
              {usernameStatus === 'checking' && (
                <View style={styles.usernameStatus}>
                  <ActivityIndicator size="small" color="#8B0000" />
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
              {usernameStatus === 'valid' && formData.username && (
                <Text style={styles.validText}>
                  Username available
                </Text>
              )}
            </View>

            <TextInput
              style={styles.input}
              placeholder="Company (Optional)"
              value={formData.company}
              onChangeText={(value) => updateFormData('company', value)}
              placeholderTextColor="#666"
            />

            <TextInput
              style={styles.input}
              placeholder="Password *"
              value={formData.password}
              onChangeText={(value) => updateFormData('password', value)}
              secureTextEntry
              placeholderTextColor="#666"
            />

            <TextInput
              style={styles.input}
              placeholder="Confirm Password *"
              value={formData.confirmPassword}
              onChangeText={(value) => updateFormData('confirmPassword', value)}
              secureTextEntry
              placeholderTextColor="#666"
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={styles.button}
              onPress={handleSignup}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => router.back()}
            >
              <Text style={styles.linkText}>
                Already have an account? Login
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#8B0000',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
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
  validInput: {
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  invalidInput: {
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  button: {
    backgroundColor: '#4A0404',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
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
  usernameStatus: {
    position: 'absolute',
    right: 15,
    top: 15,
  },
  validText: {
    color: '#4CAF50',
    fontSize: 12,
    marginTop: -10,
    marginBottom: 10,
  },
  invalidText: {
    color: '#FF6B6B',
    fontSize: 12,
    marginTop: -10,
    marginBottom: 10,
  },
  linkButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  linkText: {
    color: '#fff',
    fontSize: 14,
  },
}); 