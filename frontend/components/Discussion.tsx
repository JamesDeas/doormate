import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  Keyboard,
  Image,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ProfileImage from './ProfileImage';
import { authService, User } from '@/services/auth';
import { API_URL } from '@/services/api';
import { localDatabase } from '@/services/localDatabase';
import * as ImagePicker from 'expo-image-picker';

interface Comment {
  _id: string;
  productId: string;
  userId: string;
  parentId?: string | null;
  user: {
    _id: string;
    username: string;
    firstName: string;
    lastName: string;
    profileImage?: string;
  };
  text: string;
  image?: string | null;
  likes: string[];
  likesCount: number;
  replyCount: number;
  createdAt: string;
  updatedAt: string;
}

interface DiscussionProps {
  productId: string;
  isOffline: boolean;
}

const Discussion: React.FC<DiscussionProps> = ({ productId, isOffline }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [replies, setReplies] = useState<{ [key: string]: Comment[] }>({});
  const [newComment, setNewComment] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedComment, setSelectedComment] = useState<string | null>(null);
  const [selectedReplyForDelete, setSelectedReplyForDelete] = useState<string | null>(null);
  const [likingComments, setLikingComments] = useState<Set<string>>(new Set());
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [replyImage, setReplyImage] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [selectedCommentForModal, setSelectedCommentForModal] = useState<string | null>(null);
  const [modalReplyText, setModalReplyText] = useState('');
  const [modalReplyImage, setModalReplyImage] = useState<string | null>(null);
  const [isModalSubmitting, setIsModalSubmitting] = useState(false);
  const [isModalUploadingImage, setIsModalUploadingImage] = useState(false);
  const [showReplyMenu, setShowReplyMenu] = useState<string | null>(null);

  useEffect(() => {
    loadComments();
    loadCurrentUser();
    console.log('Discussion component mounted. API_URL:', API_URL);
  }, [productId]);

  const loadCurrentUser = async () => {
    try {
      // Check if offline first
      const online = await localDatabase.isOnline();
      if (!online) {
        // Try to get user from local storage
        const user = await localDatabase.getUserProfile();
        if (user) {
          setCurrentUser(user);
        }
        return;
      }

      console.log('Loading current user');
      const user = await authService.getCurrentUser();
      console.log('Current user loaded:', user);
      console.log('Current user ID:', user._id);
      setCurrentUser(user);
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  };

  const loadComments = async () => {
    try {
      setIsLoading(true);
      
      // Check if offline first
      const online = await localDatabase.isOnline();
      if (!online) {
        // When offline, don't try to load comments
        setComments([]);
        setIsLoading(false);
        return;
      }

      console.log('Loading comments for product:', productId);
      console.log('Using API URL:', API_URL);
      console.log('Full comments URL:', `${API_URL}/products/${productId}/comments`);
      
      const response = await fetch(`${API_URL}/products/${productId}/comments`);
      console.log('Comments response status:', response.status);
      
      if (!response.ok) {
        throw new Error('Failed to load comments');
      }
      
      const data = await response.json();
      console.log('Comments loaded:', data.length);
      console.log('First comment:', data[0]);
      
      setComments(data);
    } catch (error) {
      console.error('Error loading comments:', error);
      // Don't show error alert when offline
      if (await localDatabase.isOnline()) {
        Alert.alert('Error', 'Failed to load comments. Please try again later.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const pickImage = async (isReply: boolean = false) => {
    try {
      // Request permissions
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Please grant camera roll permissions to upload images.');
          return;
        }
      }
      
      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      
      if (!result.canceled) {
        if (isReply) {
          setReplyImage(result.assets[0].uri);
        } else {
          setSelectedImage(result.assets[0].uri);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const takePhoto = async (isReply: boolean = false) => {
    try {
      // Request camera permissions
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Please grant camera permissions to take photos.');
          return;
        }
      }
      
      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      
      if (!result.canceled) {
        if (isReply) {
          setReplyImage(result.assets[0].uri);
        } else {
          setSelectedImage(result.assets[0].uri);
        }
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() && !selectedImage) return;
    
    try {
      setIsSubmitting(true);
      setIsUploadingImage(true);
      
      const formData = new FormData();
      formData.append('text', newComment);
      
      if (selectedImage) {
        // For web, we need to fetch the image as a blob
        if (Platform.OS === 'web') {
          try {
            const response = await fetch(selectedImage);
            if (!response.ok) throw new Error('Failed to fetch image');
            const blob = await response.blob();
            const filename = 'image.jpg';
            formData.append('image', blob, filename);
          } catch (error) {
            console.error('Error processing image:', error);
            throw new Error('Failed to process image for upload');
          }
        } else {
          // For mobile, we can use the URI directly
          const filename = selectedImage.split('/').pop() || 'image.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : 'image/jpeg';
          
          formData.append('image', {
            uri: selectedImage,
            name: filename,
            type,
          } as any);
        }
      }
      
      console.log('Submitting comment with formData:', {
        text: newComment,
        hasImage: !!selectedImage,
        productId
      });
      
      const response = await fetch(`${API_URL}/products/${productId}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await authService.getToken()}`
        },
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.message || 'Failed to post comment');
      }
      
      const newCommentData = await response.json();
      setComments(prevComments => [newCommentData, ...prevComments]);
      setNewComment('');
      setSelectedImage(null);
    } catch (error) {
      console.error('Error posting comment:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to post your comment. Please try again later.');
    } finally {
      setIsSubmitting(false);
      setIsUploadingImage(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      setIsDeleting(commentId);
      
      const token = await authService.getToken();
      console.log('Token for delete request:', token);
      
      const response = await fetch(`${API_URL}/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete comment');
      }

      // Find if the deleted comment is a reply by checking all replies
      let isReply = false;
      let parentId = null;
      
      for (const [pId, repliesList] of Object.entries(replies)) {
        if (repliesList.some(reply => reply._id === commentId)) {
          isReply = true;
          parentId = pId;
          break;
        }
      }

      if (isReply && parentId) {
        // Update replies state by removing the deleted reply
        setReplies(prevReplies => ({
          ...prevReplies,
          [parentId]: prevReplies[parentId].filter(reply => reply._id !== commentId)
        }));

        // Update the parent comment's replyCount
        setComments(prevComments =>
          prevComments.map(comment =>
            comment._id === parentId
              ? { ...comment, replyCount: Math.max(0, comment.replyCount - 1) }
              : comment
          )
        );
      } else {
        // If it's a main comment, remove it from comments state
        setComments(prevComments => prevComments.filter(comment => comment._id !== commentId));
      }

      setSelectedComment(null);
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'Failed to delete comment');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    if (!currentUser) {
      Alert.alert('Sign In Required', 'Please sign in to like comments.');
      return;
    }

    try {
      setLikingComments(prev => new Set([...prev, commentId]));
      
      // Find comment in either main comments or replies
      const mainComment = comments.find(c => c._id === commentId);
      const replyComment = Object.values(replies).flat().find(r => r._id === commentId);
      const comment = mainComment || replyComment;
      
      if (!comment) {
        throw new Error('Comment not found');
      }

      const isLiked = comment.likes.includes(currentUser._id);
      
      const response = await fetch(`${API_URL}/comments/${commentId}/like`, {
        method: isLiked ? 'DELETE' : 'POST',
        headers: {
          'Authorization': `Bearer ${await authService.getToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to update like');
      }

      const data = await response.json();
      
      // Update state based on whether it's a main comment or reply
      if (mainComment) {
        setComments(prevComments => 
          prevComments.map(c => 
            c._id === commentId 
              ? { ...c, likes: data.likes, likesCount: data.likesCount }
              : c
          )
        );
      } else {
        setReplies(prevReplies => {
          const updatedReplies = { ...prevReplies };
          // Find which parent comment contains this reply
          for (const parentId in updatedReplies) {
            updatedReplies[parentId] = updatedReplies[parentId].map(r =>
              r._id === commentId
                ? { ...r, likes: data.likes, likesCount: data.likesCount }
                : r
            );
          }
          return updatedReplies;
        });
      }
    } catch (error) {
      console.error('Error updating like:', error);
      Alert.alert('Error', 'Failed to update like. Please try again.');
    } finally {
      setLikingComments(prev => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const loadReplies = async (commentId: string) => {
    if (loadingReplies.has(commentId)) return;
    
    try {
      setLoadingReplies(prev => new Set([...prev, commentId]));
      
      const response = await fetch(`${API_URL}/comments/${commentId}/replies`);
      if (!response.ok) {
        throw new Error('Failed to load replies');
      }
      
      const data = await response.json();
      setReplies(prev => ({
        ...prev,
        [commentId]: data
      }));
      
    } catch (error) {
      console.error('Error loading replies:', error);
      Alert.alert('Error', 'Failed to load replies');
    } finally {
      setLoadingReplies(prev => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
    }
  };

  const handleReply = async (parentId: string) => {
    if (!replyText.trim() && !replyImage) return;
    
    try {
      setIsSubmitting(true);
      setIsUploadingImage(true);
      
      const formData = new FormData();
      formData.append('text', replyText);
      formData.append('parentId', parentId);
      
      if (replyImage) {
        // For web, we need to convert base64 to blob
        if (Platform.OS === 'web') {
          const response = await fetch(replyImage);
          const blob = await response.blob();
          formData.append('image', blob, 'image.jpg');
        } else {
          // For mobile, we can use the URI directly
          const filename = replyImage.split('/').pop() || 'image.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : 'image/jpeg';
          
          formData.append('image', {
            uri: replyImage,
            name: filename,
            type,
          } as any);
        }
      }
      
      const response = await fetch(`${API_URL}/products/${productId}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await authService.getToken()}`
        },
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to post reply');
      }
      
      const newReply = await response.json();
      
      // Update replies state
      setReplies(prev => ({
        ...prev,
        [parentId]: [...(prev[parentId] || []), newReply]
      }));
      
      // Update the reply count of the parent comment
      setComments(prevComments =>
        prevComments.map(c =>
          c._id === parentId
            ? { ...c, replyCount: c.replyCount + 1 }
            : c
        )
      );
      
      // Automatically expand the replies section
      setExpandedComments(prev => new Set([...prev, parentId]));
      
      // Reset reply input and close reply form
      setReplyText('');
      setReplyImage(null);
      setReplyingTo(null);
      Keyboard.dismiss();
    } catch (error) {
      console.error('Error posting reply:', error);
      Alert.alert('Error', 'Failed to post your reply. Please try again later.');
    } finally {
      setIsSubmitting(false);
      setIsUploadingImage(false);
    }
  };

  const toggleReplies = async (commentId: string) => {
    if (expandedComments.has(commentId)) {
      setExpandedComments(prev => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
    } else {
      setExpandedComments(prev => new Set([...prev, commentId]));
      if (!replies[commentId]) {
        await loadReplies(commentId);
      }
    }
  };

  const renderReplyInput = (commentId: string) => (
      <View style={styles.replyInputContainer}>
      <View style={styles.replyInputRow}>
          <TextInput
          style={styles.replyInput}
            placeholder="Write a reply..."
          placeholderTextColor="#fff"
            value={replyText}
            onChangeText={setReplyText}
          multiline
          />
        <View style={styles.commentInputButtons}>
          <TouchableOpacity
            style={styles.imageButton} 
            onPress={() => pickImage(true)}
            disabled={isUploadingImage}
          >
            {isUploadingImage ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <MaterialCommunityIcons name="image" size={24} color="#fff" />
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.imageButton} 
            onPress={() => takePhoto(true)}
            disabled={isUploadingImage}
          >
            {isUploadingImage ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <MaterialCommunityIcons name="camera" size={24} color="#fff" />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!replyText.trim()) && styles.submitButtonDisabled
            ]}
            onPress={() => handleReply(commentId)}
            disabled={!replyText.trim() || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <MaterialCommunityIcons name="send" size={24} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
      {replyImage && (
        <View style={styles.selectedImageContainer}>
          <Image source={{ uri: replyImage }} style={styles.selectedImage} />
          <TouchableOpacity 
            style={styles.removeImageButton}
            onPress={() => setReplyImage(null)}
          >
            <MaterialCommunityIcons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
      </View>
    );

  const renderReplies = (comment: Comment) => {
    if (!expandedComments.has(comment._id)) return null;
    
    const commentReplies = replies[comment._id] || [];
    
      return (
        <View style={styles.repliesContainer}>
        {loadingReplies.has(comment._id) ? (
          <View style={styles.loadingReplies}>
            <ActivityIndicator size="small" color="#FF6B6B" />
          </View>
        ) : commentReplies.length === 0 ? (
          <Text style={styles.noReplies}>No replies yet</Text>
        ) : (
          commentReplies.map(reply => {
            const isCurrentUserReply = currentUser && reply.userId === currentUser._id;
            const isLiked = currentUser && reply.likes.includes(currentUser._id);
            const isLiking = likingComments.has(reply._id);
            
            return (
              <View key={reply._id} style={styles.replyItem}>
                {isCurrentUserReply && (
                  <TouchableOpacity
                    style={styles.menuButton}
                    onPress={() => setShowReplyMenu(reply._id)}
                  >
                    {isDeleting === reply._id ? (
                      <ActivityIndicator size="small" color="#FF6B6B" />
                    ) : (
                      <MaterialCommunityIcons name="dots-vertical" size={20} color="rgba(255, 255, 255, 0.8)" />
                    )}
                  </TouchableOpacity>
                )}
                {showReplyMenu === reply._id && (
                  <View style={styles.replyMenu}>
                    <TouchableOpacity
                      style={styles.replyMenuItem}
                      onPress={() => {
                        setShowReplyMenu(null);
                        setSelectedReplyForDelete(reply._id);
                      }}
                    >
                      <MaterialCommunityIcons name="trash-can" size={20} color="#FF6B6B" />
                      <Text style={styles.replyMenuItemText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <View style={styles.replyInfo}>
                  <ProfileImage
                    profileImage={reply.user.profileImage}
                    firstName={reply.user.firstName}
                    lastName={reply.user.lastName}
                    size={32}
                    fontSize={14}
                  />
                  <View style={styles.replyText}>
                    <View style={styles.replyHeader}>
                      <Text style={styles.username}>@{reply.user.username}</Text>
                      <Text style={styles.replyDate}>{formatDate(reply.createdAt)}</Text>
                    </View>
                    <Text style={styles.replyContent}>{reply.text}</Text>
                    {reply.image && (
                      <View style={styles.commentImageContainer}>
                        <Image 
                          source={{ uri: `${API_URL.replace('/api', '')}${reply.image}` }} 
                          style={styles.commentImage}
                          resizeMode="contain"
                        />
                      </View>
                    )}
                    <View style={styles.replyActions}>
                      <TouchableOpacity
                        style={styles.likeButton}
                        onPress={() => handleLikeComment(reply._id)}
                        disabled={isLiking}
                      >
                        {isLiking ? (
          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <MaterialCommunityIcons
                              name={reply.likes.includes(currentUser?._id || '') ? "heart" : "heart-outline"}
                              size={20}
                              color={reply.likes.includes(currentUser?._id || '') ? "#FF6B6B" : "rgba(255, 255, 255, 0.8)"}
                            />
                            {reply.likesCount > 0 && (
                              <Text style={[
                                styles.replyLikeCount,
                                reply.likes.includes(currentUser?._id || '') && styles.likeCountActive
                              ]}>
                                {reply.likesCount}
                              </Text>
                            )}
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
        </View>
      );
          })
        )}
      </View>
    );
  };

  const renderCommentInput = () => (
    <View style={styles.commentInputContainer}>
      <View style={styles.commentInputRow}>
        <TextInput
          style={styles.commentInput}
          placeholder="Add a comment..."
          placeholderTextColor="#fff"
          value={newComment}
          onChangeText={setNewComment}
          multiline
        />
        <View style={styles.commentInputButtons}>
          <TouchableOpacity 
            style={styles.imageButton} 
            onPress={() => pickImage(false)}
            disabled={isUploadingImage}
          >
            {isUploadingImage ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <MaterialCommunityIcons name="image" size={24} color="#fff" />
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.imageButton} 
            onPress={() => takePhoto(false)}
            disabled={isUploadingImage}
          >
            {isUploadingImage ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <MaterialCommunityIcons name="camera" size={24} color="#fff" />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!newComment.trim() && !selectedImage) && styles.submitButtonDisabled
            ]}
            onPress={handleSubmitComment}
            disabled={!newComment.trim() && !selectedImage || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <MaterialCommunityIcons name="send" size={24} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
      {selectedImage && (
        <View style={styles.selectedImageContainer}>
          <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
          <TouchableOpacity 
            style={styles.removeImageButton}
            onPress={() => setSelectedImage(null)}
          >
            <MaterialCommunityIcons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
        </View>
      );

  const handleModalReply = async (parentId: string) => {
    if (!modalReplyText.trim() && !modalReplyImage) return;
    
    try {
      setIsModalSubmitting(true);
      setIsModalUploadingImage(true);
      
      const formData = new FormData();
      formData.append('text', modalReplyText);
      formData.append('parentId', parentId);
      
      if (modalReplyImage) {
        // For web, we need to convert base64 to blob
        if (Platform.OS === 'web') {
          const response = await fetch(modalReplyImage);
          const blob = await response.blob();
          formData.append('image', blob, 'image.jpg');
        } else {
          // For mobile, we can use the URI directly
          const filename = modalReplyImage.split('/').pop() || 'image.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : 'image/jpeg';
          
          formData.append('image', {
            uri: modalReplyImage,
            name: filename,
            type,
          } as any);
        }
      }
      
      const response = await fetch(`${API_URL}/products/${productId}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await authService.getToken()}`
        },
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to post reply');
      }
      
      const newReply = await response.json();
      
      // Update replies state
      setReplies(prev => ({
        ...prev,
        [parentId]: [...(prev[parentId] || []), newReply]
      }));
      
      // Update the reply count of the parent comment
      setComments(prevComments =>
        prevComments.map(c =>
          c._id === parentId
            ? { ...c, replyCount: c.replyCount + 1 }
            : c
        )
      );
      
      // Reset modal reply input
      setModalReplyText('');
      setModalReplyImage(null);
      Keyboard.dismiss();
    } catch (error) {
      console.error('Error posting reply:', error);
      Alert.alert('Error', 'Failed to post your reply. Please try again later.');
    } finally {
      setIsModalSubmitting(false);
      setIsModalUploadingImage(false);
    }
  };
  
  const pickImageForModal = async () => {
    try {
      // Request permissions
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Please grant camera roll permissions to upload images.');
          return;
        }
      }
      
      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      
      if (!result.canceled) {
        setModalReplyImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };
  
  const takePhotoForModal = async () => {
    try {
      // Request camera permissions
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Please grant camera permissions to take photos.');
          return;
        }
      }
      
      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      
      if (!result.canceled) {
        setModalReplyImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };
  
  const renderModalReplyInput = (commentId: string) => (
    <View style={styles.modalReplyInputContainer}>
      <View style={styles.modalReplyInputRow}>
        <TextInput
          style={styles.modalReplyInput}
          placeholder="Write a reply..."
          placeholderTextColor="#fff"
          value={modalReplyText}
          onChangeText={setModalReplyText}
          multiline
        />
        <View style={styles.commentInputButtons}>
          <TouchableOpacity 
            style={styles.imageButton} 
            onPress={pickImageForModal}
            disabled={isModalUploadingImage}
          >
            {isModalUploadingImage ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <MaterialCommunityIcons name="image" size={24} color="#fff" />
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.imageButton} 
            onPress={takePhotoForModal}
            disabled={isModalUploadingImage}
          >
            {isModalUploadingImage ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <MaterialCommunityIcons name="camera" size={24} color="#fff" />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!modalReplyText.trim() && !modalReplyImage) && styles.submitButtonDisabled
            ]}
            onPress={() => handleModalReply(commentId)}
            disabled={!modalReplyText.trim() && !modalReplyImage || isModalSubmitting}
          >
            {isModalSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <MaterialCommunityIcons name="send" size={24} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
      {modalReplyImage && (
        <View style={styles.selectedImageContainer}>
          <Image source={{ uri: modalReplyImage }} style={styles.selectedImage} />
          <TouchableOpacity 
            style={styles.removeImageButton}
            onPress={() => setModalReplyImage(null)}
          >
            <MaterialCommunityIcons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
  
  const renderReplyMenu = (replyId: string) => (
    <View style={styles.replyMenuDropdown}>
      <TouchableOpacity
        style={styles.replyMenuItem}
        onPress={() => {
          setShowReplyMenu(null);
          setSelectedReplyForDelete(replyId);
        }}
      >
        <MaterialCommunityIcons name="delete" size={20} color="#FF6B6B" />
        <Text style={styles.replyMenuItemText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  const renderRepliesModal = (comment: Comment) => {
    if (!selectedCommentForModal) return null;
    
    // Find the correct comment that was selected for the modal
    const selectedComment = comments.find(c => c._id === selectedCommentForModal);
    if (!selectedComment) return null;
    
    // Make sure we're using the correct comment ID for the modal
    const commentReplies = replies[selectedCommentForModal] || [];
          
          return (
      <Modal
        visible={!!selectedCommentForModal}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedCommentForModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Comments</Text>
              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={() => {
                  setSelectedCommentForModal(null);
                  setModalReplyText('');
                  setModalReplyImage(null);
                }}
              >
                <MaterialCommunityIcons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScrollContent}>
              <View style={styles.modalCommentContainer}>
                <View style={styles.modalCommentHeader}>
              <ProfileImage
                    profileImage={selectedComment.user.profileImage}
                    firstName={selectedComment.user.firstName}
                    lastName={selectedComment.user.lastName}
                size={40}
                fontSize={16}
              />
                  <View style={styles.modalCommentInfo}>
                    <Text style={styles.modalUsername}>@{selectedComment.user.username}</Text>
                    <Text style={styles.modalCommentDate}>{formatDate(selectedComment.createdAt)}</Text>
                  </View>
                </View>
                <Text style={styles.modalCommentText}>{selectedComment.text}</Text>
                {selectedComment.image && (
                  <View style={styles.modalCommentImageContainer}>
                    <Image 
                      source={{ uri: `${API_URL.replace('/api', '')}${selectedComment.image}` }} 
                      style={styles.modalCommentImage}
                      resizeMode="contain"
                    />
                  </View>
                )}
              </View>
              
              <View style={styles.modalRepliesSection}>
                {loadingReplies.has(selectedCommentForModal) ? (
                  <View style={styles.loadingReplies}>
                    <ActivityIndicator size="small" color="#FF6B6B" />
                  </View>
                ) : commentReplies.length === 0 ? (
                  <Text style={styles.noReplies}>No replies yet</Text>
                ) : (
                  commentReplies.map(reply => {
                    const isCurrentUserReply = currentUser && reply.userId === currentUser._id;
                    const isLiked = currentUser && reply.likes.includes(currentUser._id);
                    const isLiking = likingComments.has(reply._id);
                    
                    return (
                      <View key={reply._id} style={styles.modalReplyItem}>
                        {isCurrentUserReply && (
                    <TouchableOpacity
                            style={styles.menuButton}
                            onPress={() => setShowReplyMenu(reply._id)}
                          >
                            {isDeleting === reply._id ? (
                              <ActivityIndicator size="small" color="#FF6B6B" />
                            ) : (
                              <MaterialCommunityIcons name="dots-vertical" size={20} color="rgba(255, 255, 255, 0.8)" />
                            )}
                    </TouchableOpacity>
                  )}
                        {showReplyMenu === reply._id && renderReplyMenu(reply._id)}
                        <View style={styles.modalReplyInfo}>
                          <ProfileImage
                            profileImage={reply.user.profileImage}
                            firstName={reply.user.firstName}
                            lastName={reply.user.lastName}
                            size={32}
                            fontSize={14}
                          />
                          <View style={styles.modalReplyText}>
                            <View style={styles.modalReplyHeader}>
                              <Text style={styles.modalUsername}>@{reply.user.username}</Text>
                              <Text style={styles.modalReplyDate}>{formatDate(reply.createdAt)}</Text>
                </View>
                            <Text style={styles.modalReplyContent}>{reply.text}</Text>
                            {reply.image && (
                              <View style={styles.modalCommentImageContainer}>
                                <Image 
                                  source={{ uri: `${API_URL.replace('/api', '')}${reply.image}` }} 
                                  style={styles.modalCommentImage}
                                  resizeMode="contain"
                                />
                              </View>
                            )}
                            <View style={styles.modalReplyActions}>
                  <TouchableOpacity
                    style={styles.likeButton}
                    onPress={() => handleLikeComment(reply._id)}
                                disabled={isLiking}
                  >
                                {isLiking ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <MaterialCommunityIcons
                                      name={isLiked ? "heart" : "heart-outline"}
                          size={20}
                                      color={isLiked ? "#FF6B6B" : "rgba(255, 255, 255, 0.8)"}
                        />
                        {reply.likesCount > 0 && (
                          <Text style={[
                                        styles.likeCount,
                                        isLiked && styles.likeCountActive
                          ]}>
                            {reply.likesCount}
                          </Text>
                        )}
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
                    );
                  })
                )}
      </View>
            </ScrollView>
            
            {renderModalReplyInput(selectedCommentForModal)}

            {/* Delete reply confirmation modal */}
            {selectedReplyForDelete && (
              <View style={styles.replyDeleteModalOverlay}>
                <View style={styles.deleteModalContent}>
                  <Text style={styles.modalTitle}>Delete Reply</Text>
                  <Text style={styles.modalText}>Are you sure you want to delete this reply? This action cannot be undone.</Text>
                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.cancelModalButton]}
                      onPress={() => setSelectedReplyForDelete(null)}
                    >
                      <Text style={styles.modalButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.deleteModalButton]}
                      onPress={() => {
                        if (selectedReplyForDelete) {
                          handleDeleteComment(selectedReplyForDelete);
                          setSelectedReplyForDelete(null);
                        }
                      }}
                    >
                      <Text style={[styles.modalButtonText, styles.deleteButtonText]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    );
  };

  const renderComment = (item: Comment) => {
    const isCurrentUserComment = currentUser && item.userId === currentUser._id;
    const isLiked = currentUser && item.likes.includes(currentUser._id);
    const isLiking = likingComments.has(item._id);
    
    return (
      <View key={item._id} style={styles.commentItem}>
        {isCurrentUserComment && (
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setSelectedComment(item._id)}
          >
            {isDeleting === item._id ? (
              <ActivityIndicator size="small" color="#FF6B6B" />
            ) : (
              <MaterialCommunityIcons name="dots-vertical" size={20} color="rgba(255, 255, 255, 0.8)" />
            )}
          </TouchableOpacity>
        )}
        <View style={styles.commentInfo}>
          <View style={styles.commentHeader}>
        <ProfileImage
          profileImage={item.user.profileImage}
          firstName={item.user.firstName}
          lastName={item.user.lastName}
          size={40}
          fontSize={16}
        />
            <View style={styles.userInfo}>
          <Text style={styles.username}>@{item.user.username}</Text>
          <Text style={styles.commentDate}>{formatDate(item.createdAt)}</Text>
            </View>
          </View>
          <View style={styles.commentText}>
            <Text style={styles.commentContent}>{item.text}</Text>
            {item.image && (
              <View style={styles.commentImageContainer}>
                <Image 
                  source={{ uri: `${API_URL.replace('/api', '')}${item.image}` }} 
                  style={styles.commentImage}
                  resizeMode="contain"
                />
              </View>
            )}
            <View style={styles.commentActions}>
              <TouchableOpacity
                style={styles.likeButton}
                onPress={() => handleLikeComment(item._id)}
                disabled={isLiking}
              >
                {isLiking ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name={isLiked ? "heart" : "heart-outline"}
                      size={20}
                      color={isLiked ? "#FF6B6B" : "rgba(255, 255, 255, 0.8)"}
                    />
                    {item.likesCount > 0 && (
                      <Text style={[
                        styles.likeCount,
                        isLiked && styles.likeCountActive
                      ]}>
                        {item.likesCount}
                      </Text>
                    )}
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.chatButton}
                onPress={() => {
                  if (!replies[item._id]) {
                    loadReplies(item._id);
                  }
                  setSelectedCommentForModal(item._id);
                }}
              >
                <MaterialCommunityIcons
                  name="chat"
                  size={20}
                  color="rgba(255, 255, 255, 0.8)"
                />
                <Text style={styles.chatButtonText}>
                  {item.replyCount > 0 ? item.replyCount : 'Reply'}
                  </Text>
                </TouchableOpacity>
            </View>
            {renderRepliesModal(item)}
        </View>
      </View>
    </View>
  );
  };

  return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Discussion</Text>
      
    {isOffline ? (
      <Text style={styles.offlineMessage}>Discussion is not available offline</Text>
    ) : (
      <>
        {renderCommentInput()}
        
        <View style={styles.discussionArea}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FF6B6B" />
            </View>
          ) : comments.length === 0 ? (
            <Text style={styles.noComments}>No comments yet. Be the first to share your experience!</Text>
          ) : (
            comments.map(renderComment)
          )}
        </View>
      </>
    )}

    {/* Delete post confirmation modal */}
      <Modal
      visible={!!selectedComment}
      transparent
        animationType="fade"
        onRequestClose={() => setSelectedComment(null)}
      >
      <View style={styles.modalOverlay}>
        <View style={styles.deleteModalContent}>
          <Text style={styles.modalTitle}>Delete Comment</Text>
          <Text style={styles.modalText}>Are you sure you want to delete this comment? This action cannot be undone.</Text>
          <View style={styles.modalActions}>
          <TouchableOpacity
              style={[styles.modalButton, styles.cancelModalButton]}
            onPress={() => setSelectedComment(null)}
          >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
              <TouchableOpacity
              style={[styles.modalButton, styles.deleteModalButton]}
                onPress={() => {
                if (selectedComment) {
                  handleDeleteComment(selectedComment);
                  setSelectedComment(null);
                }
              }}
            >
              <Text style={[styles.modalButtonText, styles.deleteButtonText]}>Delete</Text>
              </TouchableOpacity>
            </View>
        </View>
    </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  discussionArea: {
    minHeight: 300,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  commentsList: {
    paddingBottom: 8,
  },
  commentItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  commentInfo: {
    flexDirection: 'column',
    width: '100%',
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
  },
  username: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
    opacity: 0.9,
    marginBottom: 2,
  },
  commentDate: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.7,
  },
  commentText: {
    width: '100%',
  },
  commentContent: {
    fontSize: 16,
    color: '#fff',
    lineHeight: 22,
    marginTop: 8,
    opacity: 0.8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    minHeight: 200,
  },
  emptyText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
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
  submitButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  menuButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
    zIndex: 1,
  },
  fullScreenModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#8B0000',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    width: '100%',
    height: '80%',
  },
  deleteModalContent: {
    backgroundColor: '#8B0000',
    borderRadius: 20,
    padding: 20,
  },
  bottomSheet: {
    backgroundColor: '#8B0000',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 48 : 32,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginVertical: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 8,
    marginVertical: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
  },
  menuItemText: {
    color: '#fff',
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.9,
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    borderRadius: 4,
  },
  likeCount: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginLeft: 4,
  },
  likeCountActive: {
    color: '#FF6B6B',
  },
  repliesContainer: {
    marginTop: 8,
    marginLeft: 0,
    paddingLeft: 24,
    width: '100%',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
  },
  replyItem: {
    marginBottom: 12,
    width: '100%',
    paddingRight: 16,
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
  replyInfo: {
    flexDirection: 'row',
    marginLeft: 16,
    marginTop: 8,
  },
  replyUsername: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
    opacity: 0.9,
  },
  replyDate: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.7,
    marginLeft: 8,
  },
  replyText: {
    flex: 1,
    marginLeft: 12,
  },
  replyActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  replyMenuButton: {
    padding: 4,
    marginLeft: 'auto',
  },
  replyUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  replyLikeCount: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginLeft: 4,
  },
  replyInputContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  replyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  replyInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    minHeight: 40,
    maxHeight: 120,
  },
  replyInputButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 8,
  },
  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
  },
  replyButtonText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 4,
    opacity: 0.9,
  },
  showRepliesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  showRepliesText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 4,
    opacity: 0.8,
  },
  noRepliesText: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.7,
    fontStyle: 'italic',
  },
  inputDisabled: {
    opacity: 0.5,
  },
  emptySubText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  commentInputContainer: {
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentInputRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    minHeight: 40,
    maxHeight: 120,
  },
  commentInputButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  imageButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
  },
  selectedImageContainer: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 8,
  },
  selectedImage: {
    width: 100,
    height: 100,
    borderRadius: 4,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  commentImageContainer: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    overflow: 'hidden',
    width: '100%',
  },
  commentImage: {
    width: '100%',
    height: undefined,
    aspectRatio: 1,
    borderRadius: 4,
  },
  loadingReplies: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noReplies: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.7,
    fontStyle: 'italic',
  },
  replyContent: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  offlineMessage: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
  },
  noComments: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  modalText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    padding: 16,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelModalButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  deleteModalButton: {
    backgroundColor: '#FF6B6B',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  modalReplyInputContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    backgroundColor: '#8B0000',
  },
  modalReplyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalReplyInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    minHeight: 40,
    maxHeight: 120,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
  },
  chatButtonText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 4,
    opacity: 0.9,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeModalButton: {
    padding: 4,
  },
  modalCommentContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  modalCommentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalCommentInfo: {
    marginLeft: 12,
  },
  modalUsername: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  modalCommentDate: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  modalCommentText: {
    fontSize: 16,
    color: '#fff',
    lineHeight: 22,
  },
  modalCommentImageContainer: {
    marginTop: 8,
    borderRadius: 8,
    overflow: 'hidden',
    width: '100%',
  },
  modalCommentImage: {
    width: '100%',
    height: undefined,
    aspectRatio: 1,
    borderRadius: 8,
  },
  modalRepliesSection: {
    padding: 16,
    paddingTop: 0,
  },
  modalReplyItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  modalReplyInfo: {
    flexDirection: 'row',
  },
  modalReplyText: {
    flex: 1,
    marginLeft: 12,
  },
  modalReplyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalReplyDate: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginLeft: 8,
  },
  modalReplyContent: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
  },
  modalReplyActions: {
    flexDirection: 'row',
    marginTop: 8,
  },
  modalScrollContent: {
    flex: 1,
  },
  replyMenuDropdown: {
    position: 'absolute',
    backgroundColor: '#8B0000',
    borderRadius: 8,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  replyMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 4,
  },
  replyMenuItemText: {
    color: '#FF6B6B',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  replyDeleteModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  replyMenu: {
    position: 'absolute',
    right: 8,
    top: 40,
    backgroundColor: '#8B0000',
    borderRadius: 8,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
});

export default Discussion; 