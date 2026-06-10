import React, { useEffect } from 'react';
import { Platform, StatusBar, Text, View, NativeModules, NativeEventEmitter } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ProtectionScreen from './src/screens/ProtectionScreen';
import DetailsScreen from './src/screens/DetailsScreen';
import { COLORS, FONTS } from './src/theme';
import { logBlockedMessage } from './src/services/spamDatabase';

const Tab = createBottomTabNavigator();

function TabIcon({ emoji, focused }) {
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.4 }}>{emoji}</Text>
  );
}

export default function App() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const { SmsReceiverModule } = NativeModules;
    if (!SmsReceiverModule) return;

    const emitter = new NativeEventEmitter(SmsReceiverModule);
    const sub = emitter.addListener('onSmsReceived', event => {
      if (event?.blocked) {
        logBlockedMessage(
          event.number,
          event.body?.slice(0, 100) ?? '',
          '850 premium-rate prefix or numeric pattern',
          'spam',
        ).catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarStyle: {
              backgroundColor: COLORS.surface,
              borderTopColor: COLORS.border,
              borderTopWidth: 1,
              height: Platform.OS === 'ios' ? 88 : 68,
              paddingBottom: Platform.OS === 'ios' ? 28 : 12,
              paddingTop: 10,
            },
            tabBarActiveTintColor: COLORS.green,
            tabBarInactiveTintColor: COLORS.textMuted,
            tabBarLabelStyle: {
              fontSize: 11,
              fontFamily: FONTS.semiBold,
              letterSpacing: 0.2,
            },
            tabBarIcon: ({ focused }) =>
              route.name === 'Koruma' ? (
                <TabIcon emoji="🛡️" focused={focused} />
              ) : (
                <TabIcon emoji="📊" focused={focused} />
              ),
          })}>
          <Tab.Screen name="Protection" component={ProtectionScreen} />
          <Tab.Screen name="Details" component={DetailsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
