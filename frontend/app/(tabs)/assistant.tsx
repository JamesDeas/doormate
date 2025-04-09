import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  Pressable,
  FlatList,
  Image,
  Animated
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { assistantApi } from '../../services/api';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { localDatabase } from '@/services/localDatabase';
import NetInfo from '@react-native-community/netinfo';
import { useAuth } from '@/app/_layout';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  isStreaming?: boolean;
  isError?: boolean;
}

export default function AssistantScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { isOffline, checkAuthStatus } = useAuth();
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryTimeout, setRetryTimeout] = useState(0);
  const retryTimerRef = useRef<NodeJS.Timeout>();
  const scrollViewRef = useRef<ScrollView>(null);
  const collapseAnimation = useRef(new Animated.Value(1)).current;

  // Get product context from route params
  const productContext = {
    productId: params.productId as string,
    productType: params.productType as 'door' | 'gate' | 'motor' | 'controlSystem',
    manuals: params.manuals as string,  // This is already JSON stringified from the product page
    highlightedText: params.highlightedText as string
  };

  const generalSuggestions = [
    "How to maintain a sectional door?",
    "What are common door issues?",
    "Safety guidelines for gates",
    "Motor troubleshooting steps",
    "Installation best practices",
    "Maintenance schedule tips"
  ];

  const productSuggestions = [
    "How to install this product?",
    "Maintenance requirements",
    "Technical specifications",
    "Common issues and fixes",
    "Safety guidelines",
    "Compatible accessories"
  ];

  const handleSuggestionPress = (suggestion: string) => {
    setInputText(suggestion);
  };

  const renderSuggestionItem = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={styles.suggestionButton}
      onPress={() => handleSuggestionPress(item)}
    >
      <Text style={styles.suggestionText}>{item}</Text>
    </TouchableOpacity>
  );

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      sender: 'user',
      timestamp: new Date()
    };

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      text: '',
      sender: 'assistant',
      timestamp: new Date(),
      isStreaming: true
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      let streamedText = '';
      
      await assistantApi.chat(
        {
          message: userMessage.text,
          ...productContext,
          previousMessages: messages
        },
        (chunk) => {
          streamedText += chunk;
          setMessages(prev => 
            prev.map(msg => 
              msg.id === assistantMessage.id
                ? { ...msg, text: streamedText }
                : msg
            )
          );
        }
      );

      // Update the message to remove streaming status
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessage.id
            ? { ...msg, isStreaming: false }
            : msg
        )
      );
    } catch (error: any) {
      console.error('Error sending message:', error);
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessage.id
            ? { 
                ...msg, 
                text: `Error: ${error.message || 'Something went wrong'}. Please try again.`,
                isStreaming: false,
                isError: true 
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    Animated.timing(collapseAnimation, {
      toValue: messages.length > 0 ? 0 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [messages.length]);

  useEffect(() => {
    // Clear timeout when component unmounts
    return () => {
      if (retryTimerRef.current) {
        clearInterval(retryTimerRef.current);
      }
    };
  }, []);

  const handleRetryConnection = async () => {
    if (isRetrying) return;
    
    setIsRetrying(true);
    setRetryTimeout(30);
    
    // Start countdown timer
    retryTimerRef.current = setInterval(() => {
      setRetryTimeout(prev => {
        if (prev <= 1) {
          clearInterval(retryTimerRef.current);
          setIsRetrying(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Try to reconnect
    await checkAuthStatus();
  };

  // Display product context if available
  const renderProductContext = () => {
    if (!productContext.productId) return null;

    return (
      <Pressable 
        style={styles.contextBanner}
        onPress={() => router.push(`/product/${productContext.productId}`)}
      >
        <Text style={styles.contextText}>
          Viewing: {params.productName || 'Product'} {params.modelNumber ? `(${params.modelNumber})` : ''}
        </Text>
        {productContext.highlightedText && (
          <Text style={styles.highlightText}>
            Selected text: "{productContext.highlightedText.substring(0, 50)}..."
          </Text>
        )}
      </Pressable>
    );
  };

  const renderHeader = () => {
    const expandedHeight = collapseAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: ['0%', '100%'],
    });

    const collapsedOpacity = collapseAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0],
    });

    const expandedOpacity = collapseAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    });

    if (isOffline) {
      return (
        <View style={styles.welcomeContainer}>
          <MaterialCommunityIcons 
            name="wifi-off" 
            size={48} 
            color="#fff" 
            style={styles.offlineIcon} 
          />
          <Text style={styles.emptyText}>
            The AI Assistant is unavailable while offline. Please check your internet connection and try again.
          </Text>
          <TouchableOpacity 
            style={[
              styles.retryButton,
              isRetrying && styles.retryButtonDisabled
            ]}
            onPress={handleRetryConnection}
            disabled={isRetrying}
          >
            <View style={styles.retryButtonContent}>
              <MaterialCommunityIcons 
                name="refresh" 
                size={20} 
                color="#fff" 
                style={[
                  styles.retryIcon,
                  isRetrying && styles.retryIconSpinning
                ]} 
              />
              <Text style={styles.retryButtonText}>
                {isRetrying 
                  ? `Retry in ${retryTimeout}s` 
                  : 'Retry Connection'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.headerContainer}>
        {/* Expanded Header */}
        <Animated.View 
          style={[
            styles.welcomeContainer,
            { 
              opacity: expandedOpacity,
              display: messages.length > 0 ? 'none' : 'flex'
            }
          ]}
        >
          <Text style={styles.welcomeTitle}>How can I assist you today?</Text>
          <View style={styles.welcomeContentContainer}>
            <Image 
              source={require('@/assets/images/doormate-assistant.png')}
              style={styles.assistantImage}
              resizeMode="contain"
            />
            <View style={styles.welcomeTextContainer}>
              <Text style={styles.welcomeText}>
                <Text>• Installation guidance{'\n'}</Text>
                <Text>• Maintenance procedures{'\n'}</Text>
                <Text>• Troubleshooting issues{'\n'}</Text>
                <Text>• Technical specifications{'\n'}</Text>
                <Text>• Safety requirements</Text>
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Collapsed Header */}
        <Animated.View 
          style={[
            styles.collapsedHeader,
            { 
              opacity: collapsedOpacity,
              display: messages.length === 0 ? 'none' : 'flex'
            }
          ]}
        >
          <Image 
            source={require('@/assets/images/doormate-assistant.png')}
            style={styles.collapsedImage}
            resizeMode="contain"
          />
          <Text style={styles.collapsedTitle}>How can I assist you today?</Text>
        </Animated.View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {isOffline ? (
        <View style={styles.offlineContainer}>
          <View style={styles.welcomeContainer}>
            <MaterialCommunityIcons 
              name="wifi-off" 
              size={48} 
              color="#fff" 
              style={styles.offlineIcon} 
            />
            <Text style={styles.emptyText}>
              The AI Assistant is unavailable while offline. Please check your internet connection and try again.
            </Text>
            <TouchableOpacity 
              style={[
                styles.retryButton,
                isRetrying && styles.retryButtonDisabled
              ]}
              onPress={handleRetryConnection}
              disabled={isRetrying}
            >
              <View style={styles.retryButtonContent}>
                <MaterialCommunityIcons 
                  name="refresh" 
                  size={20} 
                  color="#fff" 
                  style={[
                    styles.retryIcon,
                    isRetrying && styles.retryIconSpinning
                  ]} 
                />
                <Text style={styles.retryButtonText}>
                  {isRetrying 
                    ? `Retry in ${retryTimeout}s` 
                    : 'Retry Connection'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          {renderProductContext()}
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          >
            <ScrollView
              ref={scrollViewRef}
              style={styles.messagesContainer}
              contentContainerStyle={styles.messagesContent}
              onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            >
              {renderHeader()}
              {messages.map((message) => (
                <View
                  key={message.id}
                  style={[
                    styles.messageBubble,
                    message.sender === 'user' ? styles.userMessage : styles.assistantMessage,
                    message.isError && styles.errorMessage
                  ]}
                >
                  <Text style={[
                    styles.messageText,
                    message.sender === 'user' ? styles.userMessageText : styles.assistantMessageText,
                    message.isError && styles.errorMessageText
                  ]}>
                    {message.text}
                    {message.isStreaming && '▋'}
                  </Text>
                  <Text style={styles.timestamp}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.suggestionsContainer}>
              <FlatList
                data={productContext.productId ? productSuggestions : generalSuggestions}
                renderItem={renderSuggestionItem}
                keyExtractor={(item) => item}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.suggestionsList}
              />
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder={productContext.productId 
                  ? "Ask about this product..."
                  : "Ask about doors, manuals, or troubleshooting..."}
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                multiline={false}
                maxLength={500}
                onSubmitEditing={handleSend}
                editable={!isLoading}
              />
              <TouchableOpacity 
                style={styles.sendButton} 
                onPress={handleSend}
                disabled={!inputText.trim() || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons 
                    name="send" 
                    size={24} 
                    color={inputText.trim() ? '#fff' : 'rgba(255, 255, 255, 0.5)'} 
                  />
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#8B0000',
  },
  offlineContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
  },
  welcomeContainer: {
    padding: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    margin: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  offlineIcon: {
    marginBottom: 16,
    opacity: 0.7,
    alignSelf: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
  },
  contextBanner: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  contextText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
    opacity: 0.9,
  },
  highlightText: {
    fontSize: 12,
    color: '#fff',
    marginTop: 4,
    fontStyle: 'italic',
    opacity: 0.7,
  },
  welcomeContentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    justifyContent: 'space-between',
  },
  welcomeTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  assistantImage: {
    width: 120,
    height: 120,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    opacity: 0.9,
    textAlign: 'center',
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#fff',
    opacity: 0.8,
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 15,
  },
  messagesContent: {
    paddingTop: 4,
    paddingBottom: 10,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 20,
    marginBottom: 10,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  messageText: {
    fontSize: 16,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  assistantMessageText: {
    color: '#FFFFFF',
    opacity: 0.9,
  },
  errorMessage: {
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
  },
  errorMessageText: {
    color: '#FF6B6B',
  },
  timestamp: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 15,
    height: 44,
    marginRight: 10,
    fontSize: 16,
    color: '#fff',
    paddingTop: 0,
    paddingBottom: 0,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  suggestionsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 8,
  },
  suggestionsList: {
    paddingHorizontal: 8,
  },
  suggestionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  suggestionText: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
  },
  headerContainer: {
    width: '100%',
  },
  collapsedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    margin: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  collapsedImage: {
    width: 32,
    height: 32,
    marginRight: 12,
  },
  collapsedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    opacity: 0.9,
  },
  retryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 24,
    alignSelf: 'center',
  },
  retryButtonDisabled: {
    opacity: 0.5,
  },
  retryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  retryIcon: {
    marginRight: 8,
  },
  retryIconSpinning: {
    transform: [{ rotate: '45deg' }],
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
}); 