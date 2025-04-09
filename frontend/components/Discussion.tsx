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
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ProfileImage from './ProfileImage';
import { authService, User } from '@/services/auth';
import { API_URL } from '@/services/api';
import { localDatabase } from '@/services/localDatabase';

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
  const [likingComments, setLikingComments] = useState<Set<string>>(new Set());

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
    if (!replyText.trim()) return;
    
    try {
      setIsSubmitting(true);
      
      const response = await fetch(`${API_URL}/products/${productId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await authService.getToken()}`,
        },
        body: JSON.stringify({ 
          text: replyText,
          parentId
        }),
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
      
      setReplyText('');
      setReplyingTo(null);
      Keyboard.dismiss();
    } catch (error) {
      console.error('Error posting reply:', error);
      Alert.alert('Error', 'Failed to post your reply. Please try again later.');
    } finally {
      setIsSubmitting(false);
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

  const renderReplyInput = (parentId: string) => {
    if (replyingTo !== parentId) return null;
    
    return (
      <View style={styles.replyInputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Write a reply..."
            placeholderTextColor="rgba(255, 255, 255, 0.5)"
            value={replyText}
            onChangeText={setReplyText}
            multiline={false}
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.submitButton, styles.closeButton]}
            onPress={() => {
              setReplyingTo(null);
              setReplyText('');
              Keyboard.dismiss();
            }}
          >
            <MaterialCommunityIcons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!replyText.trim() || isSubmitting) && styles.submitButtonDisabled
            ]}
            onPress={() => handleReply(parentId)}
            disabled={!replyText.trim() || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <MaterialCommunityIcons name="send" size={24} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderReplies = (comment: Comment) => {
    if (!expandedComments.has(comment._id)) return null;
    
    const commentReplies = replies[comment._id];
    
    if (loadingReplies.has(comment._id)) {
      return (
        <View style={styles.repliesContainer}>
          <ActivityIndicator size="small" color="#fff" />
        </View>
      );
    }
    
    if (!commentReplies?.length) {
      return (
        <View style={styles.repliesContainer}>
          <Text style={styles.noRepliesText}>No replies yet</Text>
        </View>
      );
    }
    
    return (
      <View style={styles.repliesContainer}>
        {commentReplies.map(reply => {
          const canDelete = currentUser && (
            reply.userId === currentUser._id || // Reply author
            comment.userId === currentUser._id  // Parent comment owner
          );
          
          return (
          <View key={reply._id} style={styles.replyItem}>
            <View style={styles.replyHeader}>
              <ProfileImage
                profileImage={reply.user.profileImage}
                firstName={reply.user.firstName}
                lastName={reply.user.lastName}
                size={40}
                fontSize={16}
              />
              <View style={styles.replyInfo}>
                <View style={styles.replyUserInfo}>
                  <Text style={styles.replyUsername}>@{reply.user.username}</Text>
                  <Text style={styles.replyDate}>{formatDate(reply.createdAt)}</Text>
                  {canDelete && (
                    <TouchableOpacity
                      style={styles.replyMenuButton}
                      onPress={() => setSelectedComment(reply._id)}
                    >
                      <MaterialCommunityIcons
                        name="dots-vertical"
                        size={20}
                        color="rgba(255, 255, 255, 0.8)"
                      />
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.replyText}>{reply.text}</Text>
                <View style={styles.replyActions}>
                  <TouchableOpacity
                    style={styles.likeButton}
                    onPress={() => handleLikeComment(reply._id)}
                    disabled={likingComments.has(reply._id)}
                  >
                    {likingComments.has(reply._id) ? (
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
        )})}
      </View>
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
        <ProfileImage
          profileImage={item.user.profileImage}
          firstName={item.user.firstName}
          lastName={item.user.lastName}
          size={40}
          fontSize={16}
        />
          <View style={styles.commentText}>
            <View style={styles.commentHeader}>
          <Text style={styles.username}>@{item.user.username}</Text>
          <Text style={styles.commentDate}>{formatDate(item.createdAt)}</Text>
            </View>
            <Text style={styles.commentContent}>{item.text}</Text>
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
                style={styles.replyButton}
                onPress={() => {
                  if (!currentUser) {
                    Alert.alert('Sign In Required', 'Please sign in to reply to comments.');
                    return;
                  }
                  setReplyingTo(item._id);
                }}
              >
                <MaterialCommunityIcons
                  name="reply"
                  size={20}
                  color="rgba(255, 255, 255, 0.8)"
                />
                <Text style={styles.replyButtonText}>Reply</Text>
              </TouchableOpacity>
              {item.replyCount > 0 && (
                <TouchableOpacity
                  style={styles.showRepliesButton}
                  onPress={() => toggleReplies(item._id)}
                >
                  <MaterialCommunityIcons
                    name={expandedComments.has(item._id) ? "chevron-up" : "chevron-down"}
                    size={20}
                    color="rgba(255, 255, 255, 0.8)"
                  />
                  <Text style={styles.showRepliesText}>
                    {expandedComments.has(item._id)
                      ? 'Hide Replies'
                      : `${item.replyCount} ${item.replyCount === 1 ? 'Reply' : 'Replies'}`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            {renderReplyInput(item._id)}
            {renderReplies(item)}
        </View>
      </View>
    </View>
  );
  };

  return (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Discussion</Text>
      
        <View style={styles.inputWrapper}>
          <TextInput
            style={[
              styles.input,
              isOffline && styles.inputDisabled
            ]}
            placeholder="Share your experience with this product..."
            placeholderTextColor="rgba(255, 255, 255, 0.5)"
            value={newComment}
            onChangeText={setNewComment}
            multiline={false}
            maxLength={500}
            onSubmitEditing={handleSubmitComment}
            editable={!isOffline}
          />
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!newComment.trim() || isSubmitting || isOffline) && styles.submitButtonDisabled
            ]}
            onPress={handleSubmitComment}
            disabled={!newComment.trim() || isSubmitting || isOffline}
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
          ) : isOffline ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="cloud-off-outline" size={48} color="rgba(255, 255, 255, 0.5)" />
              <Text style={styles.emptyText}>Comments are not available while offline. Please check back when you're connected to the internet.</Text>
            </View>
          ) : comments.length > 0 ? (
            <View style={styles.commentsList}>
              {comments.map(renderComment)}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No comments yet</Text>
              <Text style={styles.emptySubText}>Be the first to start the discussion</Text>
            </View>
          )}
        </View>
      </View>

      <Modal
        visible={selectedComment !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedComment(null)}
      >
        <View style={styles.fullScreenModal}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setSelectedComment(null)}
          >
            <View style={styles.bottomSheet}>
              <View style={styles.bottomSheetHandle} />
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setSelectedComment(null);
                  handleDeleteComment(selectedComment!);
                }}
              >
                <MaterialCommunityIcons name="delete-outline" size={24} color="#FF6B6B" />
                <Text style={styles.menuItemText}>Delete Comment</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setSelectedComment(null)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
    </View>
      </Modal>
    </>
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
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  commentText: {
    marginLeft: 12,
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  username: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
    opacity: 0.9,
    marginRight: 8,
  },
  commentDate: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.7,
    marginRight: 8,
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
    padding: 16,
    marginHorizontal: 8,
    marginTop: 8,
    marginBottom: Platform.OS === 'ios' ? 8 : 0,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.8,
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
    flex: 1,
    marginLeft: 12,
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
    fontSize: 16,
    color: '#fff',
    opacity: 0.8,
    marginTop: 4,
    width: '100%',
  },
  replyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
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
    marginTop: 16,
    marginBottom: 8,
    width: '100%',
  },
  closeButton: {
    marginRight: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  replyInput: {
    fontSize: 14,
    color: '#fff',
    minHeight: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
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
});

export default Discussion; 