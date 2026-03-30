import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  getBlacklist,
  getWhitelist,
  addToBlacklist,
  removeFromBlacklist,
  addToWhitelist,
  removeFromWhitelist,
} from '../services/spamDatabase';
import { COLORS, FONTS } from '../theme';

function SectionTitle({ title }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function ToggleRow({ label, description, value, onToggle }) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleInfo}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {description ? (
          <Text style={styles.toggleDesc}>{description}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: COLORS.border, true: COLORS.purple }}
        thumbColor={COLORS.white}
      />
    </View>
  );
}

function ListItem({ item, onRemove, labelKey = 'number' }) {
  return (
    <View style={styles.listItem}>
      <View>
        <Text style={styles.listItemNumber}>{item.number}</Text>
        {item.reason ? (
          <Text style={styles.listItemSub}>{item.reason}</Text>
        ) : null}
        {item.label ? (
          <Text style={styles.listItemSub}>{item.label}</Text>
        ) : null}
      </View>
      <TouchableOpacity
        style={styles.removeBtn}
        onPress={() => onRemove(item.number)}>
        <Text style={styles.removeBtnText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function SettingsScreen() {
  const [filters, setFilters] = useState({
    blockNumericOnly: true,
    blockRepeating: true,
    blockSequential: true,
    blockShortCodes: true,
  });

  const [blacklist, setBlacklist] = useState([]);
  const [whitelist, setWhitelist] = useState([]);
  const [newBlack, setNewBlack] = useState('');
  const [newWhite, setNewWhite] = useState('');

  const loadLists = useCallback(async () => {
    const [bl, wl] = await Promise.all([getBlacklist(), getWhitelist()]);
    setBlacklist(bl);
    setWhitelist(wl);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadLists();
    }, [loadLists]),
  );

  const toggleFilter = key => {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleAddBlacklist = async () => {
    const num = newBlack.trim();
    if (!num) return;
    await addToBlacklist(num, 'Manuel eklendi');
    setNewBlack('');
    loadLists();
  };

  const handleRemoveBlacklist = number => {
    Alert.alert('Kara Listeden Çıkar', `${number} silinecek?`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          await removeFromBlacklist(number);
          loadLists();
        },
      },
    ]);
  };

  const handleAddWhitelist = async () => {
    const num = newWhite.trim();
    if (!num) return;
    await addToWhitelist(num, 'Manuel eklendi');
    setNewWhite('');
    loadLists();
  };

  const handleRemoveWhitelist = number => {
    Alert.alert('Beyaz Listeden Çıkar', `${number} silinecek?`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          await removeFromWhitelist(number);
          loadLists();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ayarlar</Text>
      </View>

      {/* Filter Settings */}
      <SectionTitle title="Filtre Kuralları" />
      <View style={styles.card}>
        <ToggleRow
          label="Sadece rakam içerenler"
          description="Harf içermeyen numaraları engelle"
          value={filters.blockNumericOnly}
          onToggle={() => toggleFilter('blockNumericOnly')}
        />
        <View style={styles.divider} />
        <ToggleRow
          label="Tekrarlayan rakamlar"
          description="111111, 999999 gibi numaralar"
          value={filters.blockRepeating}
          onToggle={() => toggleFilter('blockRepeating')}
        />
        <View style={styles.divider} />
        <ToggleRow
          label="Sıralı rakamlar"
          description="123456, 654321 gibi numaralar"
          value={filters.blockSequential}
          onToggle={() => toggleFilter('blockSequential')}
        />
        <View style={styles.divider} />
        <ToggleRow
          label="Kısa kodlar"
          description="4-6 haneli servis numaraları"
          value={filters.blockShortCodes}
          onToggle={() => toggleFilter('blockShortCodes')}
        />
      </View>

      {/* Blacklist */}
      <SectionTitle title={`Kara Liste (${blacklist.length})`} />
      <View style={styles.card}>
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            placeholder="Numara ekle..."
            placeholderTextColor={COLORS.textMuted}
            value={newBlack}
            onChangeText={setNewBlack}
            keyboardType="phone-pad"
          />
          <TouchableOpacity style={styles.addBtn} onPress={handleAddBlacklist}>
            <Text style={styles.addBtnText}>Ekle</Text>
          </TouchableOpacity>
        </View>
        {blacklist.length === 0 ? (
          <Text style={styles.emptyList}>Liste boş</Text>
        ) : (
          blacklist.map(item => (
            <ListItem
              key={item.id}
              item={item}
              onRemove={handleRemoveBlacklist}
            />
          ))
        )}
      </View>

      {/* Whitelist */}
      <SectionTitle title={`Beyaz Liste (${whitelist.length})`} />
      <View style={styles.card}>
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            placeholder="Numara ekle..."
            placeholderTextColor={COLORS.textMuted}
            value={newWhite}
            onChangeText={setNewWhite}
            keyboardType="phone-pad"
          />
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: COLORS.green }]}
            onPress={handleAddWhitelist}>
            <Text style={styles.addBtnText}>Ekle</Text>
          </TouchableOpacity>
        </View>
        {whitelist.length === 0 ? (
          <Text style={styles.emptyList}>Liste boş</Text>
        ) : (
          whitelist.map(item => (
            <ListItem
              key={item.id}
              item={item}
              onRemove={handleRemoveWhitelist}
            />
          ))
        )}
      </View>

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.white,
    fontFamily: FONTS.bold,
  },
  sectionTitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 8,
    fontFamily: FONTS.semiBold,
  },
  card: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  toggleInfo: { flex: 1 },
  toggleLabel: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '500',
    fontFamily: FONTS.semiBold,
  },
  toggleDesc: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
    fontFamily: FONTS.regular,
  },
  divider: { height: 1, backgroundColor: COLORS.border, marginLeft: 16 },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  addInput: {
    flex: 1,
    color: COLORS.white,
    fontSize: 15,
    paddingVertical: 8,
    fontFamily: FONTS.regular,
  },
  addBtn: {
    backgroundColor: COLORS.purple,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 14,
    fontFamily: FONTS.semiBold,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  listItemNumber: {
    color: COLORS.white,
    fontSize: 14,
    fontFamily: FONTS.semiBold,
  },
  listItemSub: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
    fontFamily: FONTS.regular,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.red + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: { color: COLORS.red, fontSize: 12, fontWeight: '700' },
  emptyList: {
    color: COLORS.textMuted,
    fontSize: 13,
    padding: 16,
    fontFamily: FONTS.regular,
  },
  bottomPad: { height: 100 },
});
