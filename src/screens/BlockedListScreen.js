import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getBlockedMessages, clearBlockedMessages, addToWhitelist } from '../services/spamDatabase';
import { COLORS, FONTS } from '../theme';

const FILTERS = ['Tümü', 'Spam', 'Junk'];

function BlockedItem({ item, onWhitelist }) {
  const isSpam = item.category === 'spam';
  const color = isSpam ? COLORS.red : COLORS.yellow;
  const label = isSpam ? 'SPAM' : 'JUNK';

  const date = new Date(item.blocked_at).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={styles.item}>
      <View style={styles.itemLeft}>
        <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color }]}>
          <Text style={[styles.badgeText, { color }]}>{label}</Text>
        </View>
        <View style={styles.itemBody}>
          <Text style={styles.itemNumber}>{item.number}</Text>
          {item.preview ? (
            <Text style={styles.itemPreview} numberOfLines={2}>{item.preview}</Text>
          ) : null}
          <Text style={styles.itemReason}>{item.reason}</Text>
        </View>
      </View>
      <View style={styles.itemRight}>
        <Text style={styles.itemDate}>{date}</Text>
        <TouchableOpacity
          style={styles.allowBtn}
          onPress={() => onWhitelist(item.number)}>
          <Text style={styles.allowBtnText}>İzin ver</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function BlockedListScreen() {
  const [messages, setMessages] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('Tümü');

  const loadMessages = useCallback(async () => {
    const data = await getBlockedMessages(200, 0);
    setMessages(data);
    applyFilter(data, search, activeFilter);
  }, [search, activeFilter]);

  useFocusEffect(
    useCallback(() => {
      loadMessages();
    }, [loadMessages]),
  );

  const applyFilter = (data, searchText, filterType) => {
    let result = data;

    if (filterType !== 'Tümü') {
      result = result.filter(
        m => m.category === filterType.toLowerCase(),
      );
    }

    if (searchText.trim()) {
      result = result.filter(
        m =>
          m.number.includes(searchText) ||
          (m.preview && m.preview.toLowerCase().includes(searchText.toLowerCase())),
      );
    }

    setFiltered(result);
  };

  const handleSearch = text => {
    setSearch(text);
    applyFilter(messages, text, activeFilter);
  };

  const handleFilter = type => {
    setActiveFilter(type);
    applyFilter(messages, search, type);
  };

  const handleWhitelist = number => {
    Alert.alert(
      'İzin Ver',
      `${number} numarasını beyaz listeye eklemek istiyor musun?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Ekle',
          onPress: async () => {
            await addToWhitelist(number);
            loadMessages();
          },
        },
      ],
    );
  };

  const handleClearAll = () => {
    Alert.alert(
      'Tümünü Temizle',
      'Tüm engelleme geçmişi silinecek. Emin misin?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Temizle',
          style: 'destructive',
          onPress: async () => {
            await clearBlockedMessages();
            loadMessages();
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Engellenenler</Text>
        {messages.length > 0 && (
          <TouchableOpacity onPress={handleClearAll}>
            <Text style={styles.clearBtn}>Temizle</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Numara veya mesaj ara..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={handleSearch}
        />
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterChip,
              activeFilter === f && styles.filterChipActive,
            ]}
            onPress={() => handleFilter(f)}>
            <Text
              style={[
                styles.filterChipText,
                activeFilter === f && styles.filterChipTextActive,
              ]}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.countText}>{filtered.length} kayıt</Text>
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => (
          <BlockedItem item={item} onWhitelist={handleWhitelist} />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>Kayıt bulunamadı</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  clearBtn: {
    color: COLORS.red,
    fontSize: 14,
    fontFamily: FONTS.regular,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: 20,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: {
    flex: 1,
    color: COLORS.white,
    fontSize: 15,
    paddingVertical: 12,
    fontFamily: FONTS.regular,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 14,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.purple,
    borderColor: COLORS.purple,
  },
  filterChipText: { color: COLORS.textMuted, fontSize: 13, fontFamily: FONTS.regular },
  filterChipTextActive: { color: COLORS.white, fontWeight: '600' },
  countText: {
    marginLeft: 'auto',
    color: COLORS.textMuted,
    fontSize: 12,
    fontFamily: FONTS.regular,
  },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  itemLeft: { flexDirection: 'row', flex: 1, gap: 10 },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  itemBody: { flex: 1 },
  itemNumber: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FONTS.semiBold,
  },
  itemPreview: { color: COLORS.textMuted, fontSize: 12, marginTop: 2, fontFamily: FONTS.regular },
  itemReason: { color: COLORS.purple, fontSize: 11, marginTop: 3, fontFamily: FONTS.regular },
  itemRight: { alignItems: 'flex-end', justifyContent: 'space-between' },
  itemDate: { color: COLORS.textMuted, fontSize: 11, fontFamily: FONTS.regular },
  allowBtn: {
    backgroundColor: COLORS.green + '22',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.green,
  },
  allowBtnText: { color: COLORS.green, fontSize: 11, fontFamily: FONTS.regular },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { color: COLORS.textMuted, fontSize: 15, fontFamily: FONTS.regular },
});
