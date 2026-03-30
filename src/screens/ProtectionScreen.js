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

// Durum sabitleri
const STATUS = {
  UNPROTECTED: 'unprotected', // İzin yok
  PENDING: 'pending',          // iOS: "Evet" dendi ama extension henüz çalışmadı
  PROTECTED: 'protected',      // Gerçekten korunuyor
};

// ─── iOS Kılavuz Modal ────────────────────────────────────────────────────────
function IosGuideModal({ visible, onGoSettings, onClose }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <View style={modal.overlay}>
        <View style={modal.sheet}>
          <Text style={modal.title}>iOS SMS Filtresi Nasıl Açılır?</Text>
          {[
            { n: '1', t: '"Ayarlar" uygulamasını aç' },
            { n: '2', t: 'Aşağı kaydır → "Mesajlar" a dokun' },
            { n: '3', t: '"Bilinmeyen ve Spam" a dokun' },
            { n: '4', t: '"SMS Filtrelemesini Etkinleştir" toggle\'ını aç' },
            { n: '5', t: 'Listeden "SMS Cleaner" i seç ve kaydet' },
          ].map(item => (
            <View key={item.n} style={modal.row}>
              <View style={modal.badge}>
                <Text style={modal.badgeNum}>{item.n}</Text>
              </View>
              <Text style={modal.rowText}>{item.t}</Text>
            </View>
          ))}
          <TouchableOpacity style={modal.primaryBtn} onPress={onGoSettings} activeOpacity={0.85}>
            <Text style={modal.primaryBtnText}>Mesajlar Ayarlarına Git →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={modal.cancelBtn} onPress={onClose}>
            <Text style={modal.cancelBtnText}>Vazgeç</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Ana Ekran ────────────────────────────────────────────────────────────────
export default function ProtectionScreen() {
  const [status, setStatus] = useState(STATUS.UNPROTECTED);
  const [loading, setLoading] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const appStateRef = useRef(AppState.currentState);
  const wentToSettingsRef = useRef(false);
  const settingsOpenTimeRef = useRef(null);

  // ── iOS: App Groups shared container'dan extension'ın çalışıp çalışmadığını kontrol et
  const checkIosExtensionRan = useCallback(() => {
    // Native module ile UserDefaults App Group okuma
    // Gerçek cihazda çalışır, simulatorda false döner
    try {
      const SharedDefaults = NativeModules.SharedDefaults;
      if (SharedDefaults?.getBool) {
        return SharedDefaults.getBool('extension_did_run', 'group.com.smscleaner');
      }
    } catch {}
    return false;
  }, []);

  // ── Android: OS iznine bak ───────────────────────────────────────────────
  const checkAndroidPermission = useCallback(async () => {
    const receive = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS);
    const read = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
    return receive && read;
  }, []);

  // ── Durum yükle ──────────────────────────────────────────────────────────
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
          // "Evet" denmiş — extension gerçekten çalıştı mı?
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

  // ── AppState: öne gelince yeniden kontrol ────────────────────────────────
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
            // Çok hızlı döndü
            Alert.alert(
              '⚠️ Çok Hızlı Döndünüz',
              'SMS Cleaner\'ı etkinleştirmek için yeterli süre geçmedi.\n\nAyarlar › Mesajlar › Bilinmeyen ve Spam bölümünden etkinleştirin.',
              [
                {
                  text: 'Tekrar Dene',
                  onPress: () => {
                    wentToSettingsRef.current = true;
                    settingsOpenTimeRef.current = Date.now();
                    Linking.openURL('App-prefs:root=MESSAGES').catch(() => Linking.openSettings());
                  },
                },
                { text: 'Vazgeç', style: 'cancel' },
              ],
              { cancelable: false },
            );
          } else {
            // Yeterli süre geçti — kullanıcıya sor
            Alert.alert(
              'SMS Cleaner\'ı etkinleştirdiniz mi?',
              'Mesajlar › Bilinmeyen ve Spam bölümünden SMS Cleaner\'ı seçtiniz mi?',
              [
                {
                  text: 'Hayır, Etkinleştirmedim',
                  style: 'cancel',
                  onPress: () => setStatus(STATUS.UNPROTECTED),
                },
                {
                  text: 'Evet, Seçtim ✓',
                  onPress: async () => {
                    await setSetting('ios_filter_enabled', 'true');
                    // Gerçek doğrulama extension'ın çalışmasıyla olur
                    setStatus(STATUS.PENDING);
                  },
                },
              ],
              { cancelable: false },
            );
          }
        } else {
          // Pending durumunda extension çalıştı mı kontrol et
          if (status === STATUS.PENDING) {
            const ran = checkIosExtensionRan();
            if (ran) setStatus(STATUS.PROTECTED);
          }
        }
      }
    });
    return () => sub.remove();
  }, [checkAndroidPermission, checkIosExtensionRan, status]);

  // ── Android izin iste ────────────────────────────────────────────────────
  const requestAndroidPermission = useCallback(async () => {
    const alreadyGranted = await checkAndroidPermission();
    if (alreadyGranted) { setStatus(STATUS.PROTECTED); return; }

    const permsToRequest = [
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
      PermissionsAndroid.PERMISSIONS.READ_SMS,
    ];
    // Android 13+ bildirim izni
    if (Platform.Version >= 33) {
      permsToRequest.push('android.permission.POST_NOTIFICATIONS');
    }
    const result = await PermissionsAndroid.requestMultiple(permsToRequest);
    const ok = result[PermissionsAndroid.PERMISSIONS.RECEIVE_SMS] === PermissionsAndroid.RESULTS.GRANTED &&
               result[PermissionsAndroid.PERMISSIONS.READ_SMS] === PermissionsAndroid.RESULTS.GRANTED;

    if (!ok && Object.values(result).some(s => s === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN)) {
      Alert.alert(
        'İzin Gerekli',
        'SMS izinleri reddedildi. Ayarlar\'dan manuel olarak açın.',
        [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Ayarlara Git', onPress: () => Linking.openSettings() }],
      );
    }
    setStatus(ok ? STATUS.PROTECTED : STATUS.UNPROTECTED);
  }, [checkAndroidPermission]);

  // ── iOS ayarlara git ────────────────────────────────────────────────────
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

  // ── UI hesaplamaları ─────────────────────────────────────────────────────
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
    status === STATUS.PROTECTED ? 'Korunuyorsunuz ✓' :
    status === STATUS.PENDING   ? 'Beklemede...' :
    'Korunmuyorsunuz';

  const subText =
    status === STATUS.PROTECTED ? 'SMS Cleaner aktif — otomatik çalışıyor' :
    status === STATUS.PENDING   ? 'İlk şüpheli SMS geldiğinde otomatik doğrulanacak' :
    'SMS Cleaner\'ın çalışabilmesi için izin gerekiyor';

  if (loading) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <IosGuideModal visible={showGuide} onGoSettings={goToIosSettings} onClose={() => setShowGuide(false)} />

      {/* Kalkan */}
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

      {/* Durum */}
      <View style={styles.statusBlock}>
        <Text style={[styles.statusTitle, { color: shieldColor }]}>{titleText}</Text>
        <Text style={styles.statusSub}>{subText}</Text>
      </View>

      {/* Buton — korumasız veya beklemedeyken */}
      {status === STATUS.UNPROTECTED && (
        <TouchableOpacity style={styles.btn} activeOpacity={0.85} onPress={handlePermissionButton}>
          <Text style={styles.btnText}>İzin Ver</Text>
        </TouchableOpacity>
      )}
      {status === STATUS.PENDING && Platform.OS === 'ios' && (
        <TouchableOpacity style={styles.retryBtn} activeOpacity={0.85} onPress={() => setShowGuide(true)}>
          <Text style={styles.retryBtnText}>↺  Tekrar Dene</Text>
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
