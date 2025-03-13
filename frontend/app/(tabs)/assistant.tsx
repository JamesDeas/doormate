import React, { useState, useRef, useCallback } from 'react';
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
  Pressable
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { assistantApi } from '../../services/api';
import { useRouter, useLocalSearchParams } from 'expo-router';

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
  const scrollViewRef = useRef<ScrollView>(null);

  // Get product context from route params
  const productContext = {
    productId: params.productId as string,
    productType: params.productType as 'door' | 'gate' | 'motor' | 'controlSystem',
    manualUrl: params.manualUrl as string,
    highlightedText: params.highlightedText as string
  };

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

  return (
    <SafeAreaView style={styles.container}>
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
          {messages.length === 0 && (
            <View style={styles.welcomeContainer}>
              <Text style={styles.welcomeTitle}>Welcome to DoorMate Assistant!</Text>
              <Text style={styles.welcomeText}>
                I can help you with:
                {'\n'}- Installation guidance
                {'\n'}- Maintenance procedures
                {'\n'}- Troubleshooting issues
                {'\n'}- Technical specifications
                {'\n'}- Safety requirements
              </Text>
              <Text style={styles.welcomePrompt}>
                How can I assist you today?
              </Text>
            </View>
          )}
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

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder={productContext.productId 
              ? "Ask about this product..."
              : "Ask about doors, manuals, or troubleshooting..."}
            multiline
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
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <Ionicons 
                name="send" 
                size={24} 
                color={inputText.trim() ? '#007AFF' : '#A0A0A0'} 
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  contextBanner: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#BBDEFB',
  },
  contextText: {
    fontSize: 14,
    color: '#1976D2',
    fontWeight: '500',
  },
  highlightText: {
    fontSize: 12,
    color: '#455A64',
    marginTop: 4,
    fontStyle: 'italic',
  },
  welcomeContainer: {
    padding: 20,
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#2196F3',
  },
  welcomeText: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'left',
    color: '#455A64',
    marginBottom: 16,
  },
  welcomePrompt: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1976D2',
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 15,
  },
  messagesContent: {
    paddingTop: 20,
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
    backgroundColor: '#007AFF',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#E9E9EB',
  },
  messageText: {
    fontSize: 16,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  assistantMessageText: {
    color: '#000000',
  },
  errorMessage: {
    backgroundColor: '#FFE5E5',
  },
  errorMessageText: {
    color: '#D32F2F',
  },
  timestamp: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E9E9EB',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 10,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
}); 