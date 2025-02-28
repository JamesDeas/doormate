import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

export default function Layout() {
  return (
    <>
      <StatusBar style="dark" />
      <Tabs
        screenOptions={{
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: '#E5E5E5',
            height: 80,
            paddingBottom: 12,
            paddingTop: 8,
          },
          tabBarActiveTintColor: '#8B0000',
          tabBarInactiveTintColor: '#666666',
          headerShown: false,
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '500',
            marginTop: 0,
          },
          tabBarIconStyle: {
            marginBottom: 4,
          },
          tabBarLabelPosition: 'below-icon',
        }}
        initialRouteName="index"
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="home" size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="browse"
          options={{
            title: 'Browse',
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="magnify" size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="assistant"
          options={{
            title: 'Assistant',
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="robot" size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="cog" size={24} color={color} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}
