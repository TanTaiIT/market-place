import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { Listing } from '@/api/db';
import { C, F, shadow } from '@/theme';

/** Góc nghiêng lặp lại giống .note-card:nth-child(n) trong prototype */
const TILTS = [-2, 1.6, 1, -1.4, -0.6, 2];

export function NoteCard({
  item,
  index,
  onPress,
}: {
  item: Listing;
  index: number;
  onPress: () => void;
}) {
  const tilt = TILTS[index % TILTS.length];

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 90)
        .duration(420)
        .springify()
        .damping(16)}
      style={styles.slot}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          { transform: [{ rotate: `${tilt}deg` }, { scale: pressed ? 0.96 : 1 }] },
        ]}
      >
        <View style={styles.pinhead} />
        <LinearGradient
          colors={item.photo}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.photo}
        >
          <View style={styles.priceTag}>
            <Text style={styles.priceText}>{item.price}</Text>
          </View>
        </LinearGradient>
        <View style={styles.body}>
          <Text numberOfLines={2} style={styles.title}>
            {item.title}
          </Text>
          <Text style={styles.meta}>{item.meta}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1, paddingTop: 8 },
  card: {
    backgroundColor: C.paperWarm,
    borderRadius: 6,
    overflow: 'visible',
    ...shadow,
  },
  pinhead: {
    position: 'absolute',
    top: -6,
    alignSelf: 'center',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: C.pin,
    borderTopWidth: 3,
    borderTopColor: '#ff9b8a',
    zIndex: 3,
    ...shadow,
  },
  photo: {
    height: 104,
    justifyContent: 'flex-end',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  priceTag: {
    position: 'absolute',
    bottom: -2,
    left: 8,
    backgroundColor: C.moss,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 3,
    borderBottomLeftRadius: 0,
  },
  priceText: { color: '#fff', fontFamily: F.monoBold, fontSize: 11 },
  body: { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 12 },
  title: { fontFamily: F.uiBold, fontSize: 13, color: C.ink, lineHeight: 17, marginBottom: 4 },
  meta: { fontFamily: F.mono, fontSize: 10, color: C.inkSoft },
});
