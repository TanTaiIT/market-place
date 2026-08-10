import React from 'react';
import { Tabs } from 'expo-router';
import { TabBar } from '@/components/TabBar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
    >
      <Tabs.Screen name="feed" />
      <Tabs.Screen name="chatlist" />
      <Tabs.Screen name="notif" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
