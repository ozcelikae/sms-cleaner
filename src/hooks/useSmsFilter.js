/**
 * useSmsFilter Hook
 * Android SMS listening + permission management
 */

import { useEffect, useState, useCallback } from 'react';
import {
  NativeModules,
  NativeEventEmitter,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { filterMessage } from '../services/filterService';

const { SmsReceiverModule } = NativeModules;

export default function useSmsFilter() {
  const [hasPermission, setHasPermission] = useState(false);
  const [lastBlocked, setLastBlocked] = useState(null);
  const [isListening, setIsListening] = useState(false);

  const requestPermissions = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setHasPermission(true);
      return true;
    }

    try {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
        PermissionsAndroid.PERMISSIONS.READ_SMS,
      ]);

      const allGranted = Object.values(granted).every(
        status => status === PermissionsAndroid.RESULTS.GRANTED,
      );

      setHasPermission(allGranted);
      return allGranted;
    } catch (err) {
      console.warn('SMS permission error:', err);
      setHasPermission(false);
      return false;
    }
  }, []);

  const handleIncomingSms = useCallback(async event => {
    if (!event || !event.number) return;

    const { number, body } = event;
    const filterResult = await filterMessage(number, body);

    if (filterResult.result !== 'allow') {
      setLastBlocked({
        number,
        body,
        reason: filterResult.reason,
        score: filterResult.score,
        category: filterResult.category,
        blockedAt: Date.now(),
      });
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (!SmsReceiverModule) return;

    let subscription = null;

    const setup = async () => {
      const granted = await requestPermissions();
      if (!granted) return;

      const emitter = new NativeEventEmitter(SmsReceiverModule);
      subscription = emitter.addListener('onSmsReceived', handleIncomingSms);
      setIsListening(true);
    };

    setup();

    return () => {
      if (subscription) {
        subscription.remove();
        setIsListening(false);
      }
    };
  }, [requestPermissions, handleIncomingSms]);

  return {
    hasPermission,
    isListening,
    lastBlocked,
    requestPermissions,
  };
}
