import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getStats } from '../services/spamDatabase';
import { COLORS, FONTS } from '../theme';

export default function DetailsScreen() {
  const [blockedCount, setBlockedCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      getStats()
        .then(s => setBlockedCount(s.blockedCount))
        .catch(() => {});
    }, []),
  );

  return (
    <View style={styles.container}>
      {/* Cards row */}
      <View style={styles.row}>
        {/* Left card — Blocking Principle */}
        <View style={[styles.card, styles.cardLeft]}>
          <Text style={styles.cardIcon}>🔍</Text>
          <Text style={styles.cardTitle}>Blocking Principle</Text>
          <Text style={styles.cardBody}>
            Numbers containing only digits, repeating (111111) and sequential
            (123456) patterns, numbers starting with 850, and known spam
            numbers are automatically blocked.
          </Text>
        </View>

        {/* Right card — Blocked Count */}
        <View style={[styles.card, styles.cardRight]}>
          <Text style={styles.cardIcon}>🚫</Text>
          <Text style={styles.cardTitle}>Blocked So Far</Text>
          <Text style={styles.bigNumber}>{blockedCount}</Text>
          <Text style={styles.bigNumberLabel}>SMS blocked</Text>
        </View>
      </View>

      {/* Footer */}
      <Text style={styles.footer}>created by Ahmet Emir Özçelik</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: 'row',
    gap: 14,
    flex: 1,
    maxHeight: 280,
  },
  card: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardLeft: {},
  cardRight: {
    alignItems: 'flex-start',
  },
  cardIcon: {
    fontSize: 24,
    marginBottom: 10,
  },
  cardTitle: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FONTS.semiBold,
    marginBottom: 10,
    letterSpacing: 0.1,
  },
  cardBody: {
    color: COLORS.greyLight,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONTS.regular,
  },
  bigNumber: {
    color: COLORS.green,
    fontSize: 48,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    marginTop: 4,
    letterSpacing: -2,
  },
  bigNumberLabel: {
    color: COLORS.greyLight,
    fontSize: 12,
    fontFamily: FONTS.regular,
    marginTop: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 36,
    alignSelf: 'center',
    color: COLORS.textMuted,
    fontSize: 11,
    fontFamily: FONTS.regular,
    letterSpacing: 0.2,
  },
});
