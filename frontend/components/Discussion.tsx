import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ProfileImage from './ProfileImage';
import { authService, User } from '@/services/auth';
import { API_URL } from '@/services/api';

interface Comment {
  _id: string;
  productId: string;
  userId: string;
  user: {
    _id: string;
    username: string;
    firstName: string;
    lastName: string;
    profileImage?: string;
  };
  text: string;
  createdAt: string;
  updatedAt: string;
}

interface DiscussionProps {
  productId: string;
}

const Discussion: React.FC<DiscussionProps> = ({ productId }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    loadComments();
    loadCurrentUser();
  }, [productId]);

  const loadCurrentUser = async () => {
    try {
      const user = await authService.getCurrentUser();
      setCurrentUser(user);
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  };

  const loadComments = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/products/${productId}/comments`);
      
      if (!response.ok) {
        throw new Error('Failed to load comments');
      }
      
      const data = await response.json();
      setComments(data);
    } catch (error) {
      console.error('Error loading comments:', error);
      Alert.alert('Error', 'Failed to load comments. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    
    try {
      setIsSubmitting(true);
      
      const response = await fetch(`${API_URL}/products/${productId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await authService.getToken()}`,
        },
        body: JSON.stringify({ text: newComment }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to post comment');
      }
      
      const newCommentData = await response.json();
      setComments(prevComments => [newCommentData, ...prevComments]);
      setNewComment('');
    } catch (error) {
      console.error('Error posting comment:', error);
      Alert.alert('Error', 'Failed to post your comment. Please try again later.');
    } finally {
      setIsSubmitting(false);
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

  const renderComment = (item: Comment) => (
    <View key={item._id} style={styles.commentItem}>
      <View style={styles.commentInfo}>
        <ProfileImage
          profileImage={item.user.profileImage}
          firstName={item.user.firstName}
          lastName={item.user.lastName}
          size={40}
          fontSize={16}
        />
        <View style={styles.commentText}>
          <Text style={styles.username}>@{item.user.username}</Text>
          <Text style={styles.commentDate}>{formatDate(item.createdAt)}</Text>
          <Text style={styles.commentContent}>{item.text}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Discussion</Text>
      
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          placeholder="Share your experience with this product..."
          placeholderTextColor="rgba(255, 255, 255, 0.5)"
          value={newComment}
          onChangeText={setNewComment}
          multiline={false}
          maxLength={500}
          onSubmitEditing={handleSubmitComment}
        />
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!newComment.trim() || isSubmitting) && styles.submitButtonDisabled
          ]}
          onPress={handleSubmitComment}
          disabled={!newComment.trim() || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <MaterialCommunityIcons name="send" size={24} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
      
      <View style={styles.discussionArea}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8B0000" />
          </View>
        ) : comments.length > 0 ? (
          <View style={styles.commentsList}>
            {comments.map(renderComment)}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="comment-outline" size={48} color="rgba(255, 255, 255, 0.5)" />
            <Text style={styles.emptyText}>No comments yet. Be the first to share your experience!</Text>
          </View>
        )}
      </View>
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
  },
  commentInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  commentText: {
    marginLeft: 12,
    flex: 1,
  },
  username: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
    opacity: 0.9,
  },
  commentDate: {
    fontSize: 14,
    color: '#fff',
    marginTop: 2,
    opacity: 0.7,
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
});

export default Discussion; 