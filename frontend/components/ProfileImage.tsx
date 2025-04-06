import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';

interface ProfileImageProps {
  profileImage?: string;
  firstName: string;
  lastName: string;
  size?: number;
  fontSize?: number;
  borderWidth?: number;
}

const ProfileImage: React.FC<ProfileImageProps> = ({
  profileImage,
  firstName,
  lastName,
  size = 50,
  fontSize = 20,
  borderWidth = 2,
}) => {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  const randomColors = [
    '#1abc9c', '#2ecc71', '#3498db', '#9b59b6', '#f1c40f',
    '#e67e22', '#e74c3c', '#34495e', '#16a085', '#27ae60',
    '#2980b9', '#8e44ad', '#f39c12', '#d35400', '#c0392b',
    '#7f8c8d',
  ];
  
  // Generate a consistent color based on the name
  const colorIndex = (firstName.charCodeAt(0) + lastName.charCodeAt(0)) % randomColors.length;
  const backgroundColor = randomColors[colorIndex];

  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth,
    backgroundColor: 'transparent', // Make container transparent since we'll handle color in SVG
    borderColor: '#fff',
  };

  // Check if profileImage is a valid string with content
  const hasValidImage = profileImage && profileImage.trim().length > 0;

  return (
    <View style={[styles.container, containerStyle]}>
      {hasValidImage ? (
        <Image
          source={{ uri: profileImage }}
          style={styles.image}
          resizeMode="cover"
        />
      ) : (
        <Svg height={size} width={size} viewBox={`0 0 ${size} ${size}`} style={styles.svg}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={size / 2 - borderWidth / 2}
            fill={backgroundColor}
          />
          <SvgText
            x={size / 2}
            y={size / 2 + fontSize / 8} // More precise vertical centering
            fontSize={fontSize}
            fontWeight="bold"
            fill="#fff"
            textAnchor="middle"
            alignmentBaseline="middle"
            fontFamily="System" // Use system font for better appearance across platforms
          >
            {initials}
          </SvgText>
        </Svg>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 999, // Ensure image is rounded
  },
  svg: {
    position: 'absolute',
  },
  text: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default ProfileImage; 