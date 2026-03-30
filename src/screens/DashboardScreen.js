import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  FlatList,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getStats, getBlockedMessages } from '../services/spamDatabase';
import { COLORS, FONTS } from '../theme';

function StatCard({ label, value, color, icon }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MessageRow({ item }) {
  const categoryColor =
    item.category === 'spam' ? COLORS.red : COLORS.yellow;

  const timeAgo = (ts) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Az önce';
    if (mins < 60) return `${mins}dk önce`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}sa önce`;
    return `${Math.floor(hrs / 24)}g önce`;
  };

  return (
    <View style={styles.messageRow}>
      <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
      <View style={styles.messageInfo}>
        <Text style={styles.messageNumber}>{item.number}</Text>
        {item.preview ? (
          <Text style={styles.messagePreview} numberOfLines={1}>
            {item.preview}
          </Text>
        ) : null}
        <Text style={styles.messageReason}>{item.reason}</Text>
      </View>
      <Text style={styles.messageTime}>{timeAgo(item.blocked_at)}</Text>
    </View>
  );
}

export default function DashboardScreen({ navigation }) {
  const [stats, setStats] = useState({ blacklistCount: 0, whitelistCount: 0, blockedCount: 0 });
  const [recentBlocked, setRecentBlocked] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [s, messages] = await Promise.all([
        getStats(),
        getBlockedMessages(20, 0),
      ]);
      setStats(s);
      setRecentBlocked(messages);
    } catch (e) {
      console.warn('Dashboard load error:', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.purple}
        />
      }>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>SMS Cleaner</Text>
          <Text style={styles.headerSub}>Koruma aktif</Text>
        </View>
        <View style={styles.statusBadge}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Aktif</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatCard
          label="Engellenen"
          value={stats.blockedCount}
          color={COLORS.red}
          icon="🚫"
        />
        <StatCard
          label="Kara Liste"
          value={stats.blacklistCount}
          color={COLORS.purple}
          icon="⛔"
        />
        <StatCard
          label="Beyaz Liste"
          value={stats.whitelistCount}
          color={COLORS.green}
          icon="✅"
        />
      </View>

      {/* Recent Blocked */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Son Engellenenler</Text>
          {recentBlocked.length > 0 && (
            <TouchableOpacity onPress={() => navigation.navigate('BlockedList')}>
              <Text style={styles.seeAll}>Tümünü gör</Text>
            </TouchableOpacity>
          )}
        </View>

        {recentBlocked.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🛡️</Text>
            <Text style={styles.emptyText}>Henüz engellenen mesaj yok</Text>
            <Text style={styles.emptySubText}>
              Şüpheli SMS geldiğinde burada görünecek
            </Text>
          </View>
        ) : (
          recentBlocked.map(item => (
            <MessageRow key={item.id} item={item} />
          ))
        )}
      </View>

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.white,
    fontFamily: FONTS.bold,
  },
  headerSub: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
    fontFamily: FONTS.regular,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.green,
  },
  statusText: {
    color: COLORS.green,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FONTS.semiBold,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    borderLeftWidth: 3,
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 20,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    textAlign: 'center',
    fontFamily: FONTS.regular,
  },
  section: {
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.white,
    fontFamily: FONTS.semiBold,
  },
  seeAll: {
    fontSize: 13,
    color: COLORS.purple,
    fontFamily: FONTS.regular,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: FONTS.semiBold,
  },
  emptySubText: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
    fontFamily: FONTS.regular,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 10,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  messageInfo: {
    flex: 1,
  },
  messageNumber: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FONTS.semiBold,
  },
  messagePreview: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
    fontFamily: FONTS.regular,
  },
  messageReason: {
    color: COLORS.purple,
    fontSize: 11,
    marginTop: 3,
    fontFamily: FONTS.regular,
  },
  messageTime: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontFamily: FONTS.regular,
  },
  bottomPad: {
    height: 100,
  },
});
