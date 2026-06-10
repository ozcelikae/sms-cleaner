import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Linking,
  AppState,
  Dimensions,
  PermissionsAndroid,
  Modal,
  Alert,
  NativeModules,
  Image,
} from 'react-native';
import { getSetting, setSetting } from '../services/spamDatabase';
import { COLORS, FONTS } from '../theme';

const { width } = Dimensions.get('window');
const S = width * 0.44;

// Status constants
const STATUS = {
  UNPROTECTED: 'unprotected', // No permission granted
  PENDING: 'pending',          // iOS: user confirmed but extension not yet verified
  PROTECTED: 'protected',      // Fully active
};

// ─── iOS Guide Modal ──────────────────────────────────────────────────────────
function IosGuideModal({ visible, onGoSettings, onClose }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <View style={modal.overlay}>
        <View style={modal.sheet}>
          <Text style={modal.title}>How to Enable iOS SMS Filter?</Text>
          {[
            { n: '1', t: 'Open the "Settings" app' },
            { n: '2', t: 'Scroll down and tap "Messages"' },
            { n: '3', t: 'Tap "Unknown & Spam"' },
            { n: '4', t: 'Enable "Filter Unknown Senders" toggle' },
            { n: '5', t: 'Select "SMS Cleaner" from the list and save' },
          ].map(item => (
            <View key={item.n} style={modal.row}>
              <View style={modal.badge}>
                <Text style={modal.badgeNum}>{item.n}</Text>
              </View>
              <Text style={modal.rowText}>{item.t}</Text>
            </View>
          ))}
          <TouchableOpacity style={modal.primaryBtn} onPress={onGoSettings} activeOpacity={0.85}>
            <Text style={modal.primaryBtnText}>Go to Messages Settings →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={modal.cancelBtn} onPress={onClose}>
            <Text style={modal.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ProtectionScreen() {
  const [status, setStatus] = useState(STATUS.UNPROTECTED);
  const [loading, setLoading] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const appStateRef = useRef(AppState.currentState);
  const wentToSettingsRef = useRef(false);
  const settingsOpenTimeRef = useRef(null);

  // ── iOS: Check if extension ran via App Groups shared container
  const checkIosExtensionRan = useCallback(() => {
    try {
      const SharedDefaults = NativeModules.SharedDefaults;
      if (SharedDefaults?.getBool) {
        return SharedDefaults.getBool('extension_did_run', 'group.com.smscleaner');
      }
    } catch {}
    return false;
  }, []);

  // ── Android: Check OS permission
  const checkAndroidPermission = useCallback(async () => {
    const receive = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS);
    const read = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
    return receive && read;
  }, []);

  // ── Load state
  const loadState = useCallback(async () => {
    try {
      if (Platform.OS === 'android') {
        const ok = await checkAndroidPermission();
        setStatus(ok ? STATUS.PROTECTED : STATUS.UNPROTECTED);
      } else {
        const iosFlag = await getSetting('ios_filter_enabled');
        if (iosFlag !== 'true') {
          setStatus(STATUS.UNPROTECTED);
        } else {
          // User confirmed — did the extension actually run?
          const extensionRan = checkIosExtensionRan();
          setStatus(extensionRan ? STATUS.PROTECTED : STATUS.PENDING);
        }
      }
    } catch {
      setStatus(STATUS.UNPROTECTED);
    } finally {
      setLoading(false);
    }
  }, [checkAndroidPermission, checkIosExtensionRan]);

  useEffect(() => { loadState(); }, [loadState]);

  // ── AppState: re-check when app comes to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', async nextState => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      if (prev.match(/inactive|background/) && nextState === 'active') {
        if (Platform.OS === 'android') {
          const ok = await checkAndroidPermission();
          setStatus(ok ? STATUS.PROTECTED : STATUS.UNPROTECTED);
        } else if (wentToSettingsRef.current) {
          wentToSettingsRef.current = false;
          const elapsed = Date.now() - (settingsOpenTimeRef.current || 0);

          if (elapsed < 5000) {
            // Returned too quickly
            Alert.alert(
              '⚠️ Returned Too Quickly',
              'You did not spend enough time in Settings.\n\nPlease go to Settings › Messages › Unknown & Spam and enable SMS Cleaner.',
              [
                {
                  text: 'Try Again',
                  onPress: () => {
                    wentToSettingsRef.current = true;
                    settingsOpenTimeRef.current = Date.now();
                    Linking.openURL('App-prefs:root=MESSAGES').catch(() => Linking.openSettings());
                  },
                },
                { text: 'Cancel', style: 'cancel' },
              ],
              { cancelable: false },
            );
          } else {
            // Enough time passed — ask the user
            Alert.alert(
              'Did you enable SMS Cleaner?',
              'Did you select SMS Cleaner under Messages › Unknown & Spam?',
              [
                {
                  text: 'No, I Did Not',
                  style: 'cancel',
                  onPress: () => setStatus(STATUS.UNPROTECTED),
                },
                {
                  text: 'Yes, I Selected It ✓',
                  onPress: async () => {
                    await setSetting('ios_filter_enabled', 'true');
                    // Real verification happens when the extension runs
                    setStatus(STATUS.PENDING);
                  },
                },
              ],
              { cancelable: false },
            );
          }
        } else {
          // In pending state — check if extension has run
          if (status === STATUS.PENDING) {
            const ran = checkIosExtensionRan();
            if (ran) setStatus(STATUS.PROTECTED);
          }
        }
      }
    });
    return () => sub.remove();
  }, [checkAndroidPermission, checkIosExtensionRan, status]);

  // ── Request Android permissions
  const requestAndroidPermission = useCallback(async () => {
    const alreadyGranted = await checkAndroidPermission();
    if (alreadyGranted) { setStatus(STATUS.PROTECTED); return; }

    const permsToRequest = [
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
      PermissionsAndroid.PERMISSIONS.READ_SMS,
    ];
    // Android 13+ notification permission
    if (Platform.Version >= 33) {
      permsToRequest.push('android.permission.POST_NOTIFICATIONS');
    }
    const result = await PermissionsAndroid.requestMultiple(permsToRequest);
    const ok = result[PermissionsAndroid.PERMISSIONS.RECEIVE_SMS] === PermissionsAndroid.RESULTS.GRANTED &&
               result[PermissionsAndroid.PERMISSIONS.READ_SMS] === PermissionsAndroid.RESULTS.GRANTED;

    if (!ok && Object.values(result).some(s => s === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN)) {
      Alert.alert(
        'Permission Required',
        'SMS permissions were denied. Please enable them manually in Settings.',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Open Settings', onPress: () => Linking.openSettings() }],
      );
    }
    setStatus(ok ? STATUS.PROTECTED : STATUS.UNPROTECTED);
  }, [checkAndroidPermission]);

  // ── Navigate to iOS settings
  const goToIosSettings = useCallback(async () => {
    setShowGuide(false);
    wentToSettingsRef.current = true;
    settingsOpenTimeRef.current = Date.now();
    await Linking.openURL('App-prefs:root=MESSAGES&path=MESSAGE_FILTER_PROVIDER')
      .catch(() => Linking.openURL('App-prefs:root=MESSAGES'))
      .catch(() => Linking.openSettings());
  }, []);

  const handlePermissionButton = () => {
    Platform.OS === 'android' ? requestAndroidPermission() : setShowGuide(true);
  };

  // ── UI calculations
  const shieldColor =
    status === STATUS.PROTECTED ? COLORS.green :
    status === STATUS.PENDING   ? COLORS.yellow :
    COLORS.grey;

  const shieldBg =
    status === STATUS.PROTECTED ? COLORS.greenDim :
    status === STATUS.PENDING   ? COLORS.yellowDim :
    '#14141E';

  const shieldEmoji =
    status === STATUS.PROTECTED ? '🛡️' :
    status === STATUS.PENDING   ? '⏳' :
    '🔓';

  const titleText =
    status === STATUS.PROTECTED ? 'You Are Protected ✓' :
    status === STATUS.PENDING   ? 'Pending...' :
    'Not Protected';

  const subText =
    status === STATUS.PROTECTED ? 'SMS Cleaner is active — running automatically' :
    status === STATUS.PENDING   ? 'Will be verified automatically when the first suspicious SMS arrives' :
    'SMS Cleaner needs permission to work';

  if (loading) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <IosGuideModal visible={showGuide} onGoSettings={goToIosSettings} onClose={() => setShowGuide(false)} />

      {/* Shield */}
      <View style={styles.shieldWrap}>
        {status !== STATUS.UNPROTECTED && (
          <View style={[styles.pulseRing, { borderColor: shieldColor + '18' }]} />
        )}
        <View style={[styles.shieldOuter, { borderColor: shieldColor + '50' }]}>
          <View style={[styles.shieldInner, { backgroundColor: shieldBg }]}>
            <Text style={styles.shieldEmoji}>{shieldEmoji}</Text>
          </View>
        </View>
      </View>

      {/* Status */}
      <View style={styles.statusBlock}>
        <Text style={[styles.statusTitle, { color: shieldColor }]}>{titleText}</Text>
        <Text style={styles.statusSub}>{subText}</Text>
      </View>

      {/* Buttons */}
      {status === STATUS.UNPROTECTED && (
        <TouchableOpacity style={styles.btn} activeOpacity={0.85} onPress={handlePermissionButton}>
          <Text style={styles.btnText}>Grant Permission</Text>
        </TouchableOpacity>
      )}
      {status === STATUS.PENDING && Platform.OS === 'ios' && (
        <TouchableOpacity style={styles.retryBtn} activeOpacity={0.85} onPress={() => setShowGuide(true)}>
          <Text style={styles.retryBtnText}>↺  Try Again</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.footer}>created by Ahmet Emir Özçelik</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  shieldWrap: { width: S + 64, height: S + 64, alignItems: 'center', justifyContent: 'center', marginBottom: 44 },
  pulseRing: { position: 'absolute', width: S + 60, height: S + 60, borderRadius: (S + 60) / 2, borderWidth: 1 },
  shieldOuter: { width: S + 26, height: S + 26, borderRadius: (S + 26) / 2, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  shieldInner: { width: S, height: S, borderRadius: S / 2, alignItems: 'center', justifyContent: 'center' },
  shieldEmoji: { fontSize: S * 0.44 },
  statusBlock: { alignItems: 'center', gap: 10, marginBottom: 40 },
  statusTitle: { fontSize: 26, fontWeight: '700', fontFamily: FONTS.bold, letterSpacing: -0.5 },
  statusSub: { fontSize: 14, color: COLORS.greyLight, textAlign: 'center', lineHeight: 21, fontFamily: FONTS.regular },
  logoImg: { width: 90, height: 90, marginBottom: 28, backgroundColor: 'transparent' },
  btn: { backgroundColor: COLORS.green, paddingHorizontal: 56, paddingVertical: 17, borderRadius: 18, shadowColor: COLORS.green, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 10 },
  btnText: { color: '#0A0A0F', fontSize: 17, fontWeight: '700', fontFamily: FONTS.bold, letterSpacing: 0.3 },
  retryBtn: { marginTop: 4, borderWidth: 1.5, borderColor: COLORS.yellow, paddingHorizontal: 44, paddingVertical: 15, borderRadius: 18 },
  retryBtnText: { color: COLORS.yellow, fontSize: 16, fontWeight: '700', fontFamily: FONTS.bold, letterSpacing: 0.3 },
  footer: { position: 'absolute', bottom: 38, color: COLORS.textMuted, fontSize: 11, fontFamily: FONTS.regular, letterSpacing: 0.3 },
});

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingBottom: 44, borderTopWidth: 1, borderColor: COLORS.border },
  title: { color: COLORS.white, fontSize: 19, fontWeight: '700', fontFamily: FONTS.bold, marginBottom: 22, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 14 },
  badge: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  badgeNum: { color: COLORS.bg, fontSize: 13, fontWeight: '700', fontFamily: FONTS.bold },
  rowText: { color: COLORS.greyLight, fontSize: 14, lineHeight: 20, fontFamily: FONTS.regular, flex: 1 },
  primaryBtn: { backgroundColor: COLORS.green, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  primaryBtnText: { color: COLORS.bg, fontSize: 16, fontWeight: '700', fontFamily: FONTS.bold },
  cancelBtn: { paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { color: COLORS.greyLight, fontSize: 14, fontFamily: FONTS.regular },
});
