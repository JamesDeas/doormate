import React, { useState, useEffect } from 'react';
import { 
  Modal, 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView, 
  Platform, 
  ActivityIndicator, 
  Text, 
  Alert,
  Dimensions
} from 'react-native';
import { WebView } from 'react-native-webview';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';

interface PDFViewerProps {
  visible: boolean;
  pdfUrl: string;
  onClose: () => void;
}

const PDFViewer: React.FC<PDFViewerProps> = ({ visible, pdfUrl, onClose }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfContent, setPdfContent] = useState<string | null>(null);
  const [isLocalFile, setIsLocalFile] = useState(false);

  useEffect(() => {
    if (visible && pdfUrl) {
      preparePdfContent(pdfUrl);
    }
  }, [visible, pdfUrl]);

  const preparePdfContent = async (url: string) => {
    try {
      console.log('Preparing PDF content:', url);
      setIsLoading(true);
      setError(null);
      
      if (url.startsWith('file://')) {
        console.log('Local file detected');
        setIsLocalFile(true);
        
        // Check if file exists
        const fileInfo = await FileSystem.getInfoAsync(url);
        console.log('File info:', fileInfo);
        
        if (!fileInfo.exists) {
          throw new Error('PDF file not found');
        }
        
        // Read file as base64
        const base64 = await FileSystem.readAsStringAsync(url, {
          encoding: FileSystem.EncodingType.Base64
        });
        
        setPdfContent(`data:application/pdf;base64,${base64}`);
      } else {
        // For remote URLs, use as is
        setIsLocalFile(false);
        setPdfContent(url);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error preparing PDF:', error);
      setError('Failed to load PDF file');
      setIsLoading(false);
    }
  };

  const handleError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('WebView error:', nativeEvent);
    setError(`Failed to load PDF: ${nativeEvent.description || 'Unknown error'}`);
    setIsLoading(false);
  };

  const openInExternalViewer = async () => {
    try {
      if (!pdfUrl) return;
      
      console.log('Opening PDF in external viewer:', pdfUrl);
      
      if (isLocalFile) {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(pdfUrl, {
            UTI: 'com.adobe.pdf',
            mimeType: 'application/pdf'
          });
          return;
        }
      } else {
        await WebBrowser.openBrowserAsync(pdfUrl);
      }
    } catch (error) {
      console.error('Error opening PDF:', error);
      Alert.alert('Error', 'Failed to open PDF file');
    }
  };

  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#fff" />
      <Text style={styles.loadingText}>Loading PDF...</Text>
    </View>
  );

  const renderError = () => (
    <View style={styles.errorContainer}>
      <MaterialCommunityIcons name="alert" size={48} color="#fff" />
      <Text style={styles.errorText}>{error}</Text>
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={() => preparePdfContent(pdfUrl)}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.retryButton, styles.externalButton]} 
          onPress={openInExternalViewer}
        >
          <Text style={styles.retryButtonText}>Open Externally</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderContent = () => {
    if (error) {
      return renderError();
    }

    if (!pdfContent || isLoading) {
      return renderLoading();
    }

    // For web platform
    if (Platform.OS === 'web') {
      return (
        <iframe
          src={pdfContent}
          style={{ width: '100%', height: '100%', border: 'none' }}
          onLoad={() => setIsLoading(false)}
        />
      );
    }

    // For mobile platforms
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, minimum-scale=1.0, user-scalable=yes" />
          <style>
            body, html {
              margin: 0;
              padding: 0;
              width: 100%;
              height: 100%;
              background-color: #f5f5f5;
              display: flex;
              flex-direction: column;
            }
            #pdf-viewer {
              flex: 1;
              padding: 16px;
              box-sizing: border-box;
              overflow-y: auto;
              -webkit-overflow-scrolling: touch;
            }
            #pdf-container {
              background: white;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
              border-radius: 8px;
              margin: 0 auto;
              width: 100%;
              max-width: 800px;
              height: fit-content;
            }
            #pdf-content {
              display: block;
              width: 100%;
              height: 100%;
            }
            object, embed {
              display: block;
              width: 100%;
              aspect-ratio: 0.707; /* Standard A4 aspect ratio (1/√2) */
              border: none;
            }
            @media (max-width: 600px) {
              #pdf-viewer {
                padding: 12px;
              }
            }
          </style>
        </head>
        <body>
          <div id="pdf-viewer">
            <div id="pdf-container">
              <object
                id="pdf-content"
                data="${pdfContent}"
                type="application/pdf"
              >
                <embed src="${pdfContent}" type="application/pdf" />
              </object>
            </div>
          </div>
          <script>
            // Ensure proper sizing after load
            document.addEventListener('DOMContentLoaded', function() {
              const pdfContent = document.getElementById('pdf-content');
              const container = document.getElementById('pdf-container');
              
              // Update container height based on content
              function updateSize() {
                if (pdfContent && container) {
                  container.style.height = pdfContent.offsetHeight + 'px';
                }
              }
              
              // Update size on load and resize
              window.addEventListener('resize', updateSize);
              updateSize();
            });
          </script>
        </body>
      </html>
    `;

    return (
      <WebView
        source={{ html: htmlContent }}
        style={styles.webview}
        onError={handleError}
        startInLoadingState={true}
        scalesPageToFit={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        bounces={true}
        showsVerticalScrollIndicator={true}
        renderLoading={renderLoading}
        renderError={renderError}
      />
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>PDF Viewer</Text>
          <TouchableOpacity
            onPress={openInExternalViewer}
            style={styles.externalButton}
          >
            <MaterialCommunityIcons name="open-in-new" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.content}>
          {renderContent()}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#8B0000',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 16,
    flex: 1,
  },
  closeButton: {
    padding: 8,
    marginLeft: -8,
  },
  externalButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webview: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(139, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  retryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  }
});

export default PDFViewer; 