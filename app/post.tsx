import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Corkboard } from '@/components/Corkboard';
import { CatTape, Field, ScreenHeader } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { POST_CATEGORIES } from '@/api/db';
import { useCreateListing } from '@/queries/listings';
import { C, F, shadow } from '@/theme';

export default function Post() {
  const router = useRouter();
  const toast = useToast();
  const create = useCreateListing();

  const [hasPhoto, setHasPhoto] = useState(false);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState(POST_CATEGORIES[0]);

  /* Ảnh "rơi" vào khung + kẹp giấy xoay — .photo-drop.filled */
  const fill = useSharedValue(0);
  const clipRot = useSharedValue(-8);
  const fillStyle = useAnimatedStyle(() => ({
    opacity: fill.value,
    transform: [{ scale: 0.6 + fill.value * 0.4 }, { rotate: `${-6 + fill.value * 6}deg` }],
  }));
  const clipStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${clipRot.value}deg` }],
  }));

  const togglePhoto = () => {
    const next = !hasPhoto;
    setHasPhoto(next);
    fill.value = withTiming(next ? 1 : 0, { duration: 350 });
    clipRot.value = withSpring(next ? 10 : -8, { damping: 10 });
  };

  /* @keyframes pinPress — nút lún xuống rồi bật nhẹ lên */
  const press = useSharedValue(0);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ translateY: press.value }] }));

  const submit = () => {
    press.value = withSequence(
      withTiming(6, { duration: 140 }),
      withSpring(-3, { damping: 6 }),
      withSpring(0),
    );
    create.mutate(
      { title, price, desc, cat, hasPhoto },
      {
        onSuccess: () => {
          toast('✓ Đã ghim tin lên bảng thành công!');
          setTimeout(() => router.replace('/(tabs)/feed'), 1200);
        },
        onError: (e: Error) => toast(`⚠️ ${e.message}`),
      },
    );
  };

  return (
    <Corkboard>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScreenHeader title="Ghim tin mới" />
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Pressable
              onPress={togglePhoto}
              style={[styles.photoDrop, hasPhoto && { borderStyle: 'solid' }]}
            >
              <Animated.View style={[StyleSheet.absoluteFill, fillStyle]}>
                <LinearGradient
                  colors={['#EFCB9C', '#D9A566']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
              <Animated.View style={[styles.clip, clipStyle]} />
              <Text style={{ fontSize: 26 }}>📎</Text>
              <Text style={styles.photoText}>
                {hasPhoto ? 'Đã thêm ảnh · chạm để bỏ' : 'Chạm để thêm ảnh'}
              </Text>
            </Pressable>

            <Field
              label="Tên món đồ"
              hand
              value={title}
              onChangeText={setTitle}
              placeholder="Ví dụ: Xe đạp thể thao..."
            />

            <Text style={styles.label}>Giá bán</Text>
            <View style={styles.priceRow}>
              <Text style={styles.dong}>đ</Text>
              <TextInput
                value={price}
                onChangeText={setPrice}
                placeholder="0"
                placeholderTextColor={C.muted}
                keyboardType="number-pad"
                style={styles.priceInput}
              />
            </View>

            <Text style={styles.label}>Mô tả ngắn</Text>
            <TextInput
              value={desc}
              onChangeText={setDesc}
              placeholder="Tình trạng, lý do bán, ghi chú thêm..."
              placeholderTextColor={C.muted}
              multiline
              style={styles.textarea}
            />

            <Text style={[styles.label, { marginTop: 18 }]}>Danh mục</Text>
            <View style={styles.catRow}>
              {POST_CATEGORIES.map((c) => (
                <CatTape key={c} label={c} active={cat === c} onPress={() => setCat(c)} />
              ))}
            </View>

            <Animated.View style={[{ marginTop: 18 }, pressStyle]}>
              <View style={styles.submitShadow} />
              <Pressable
                onPress={submit}
                disabled={create.isPending}
                style={[styles.submit, create.isPending && { opacity: 0.7 }]}
              >
                <Text style={styles.submitText}>
                  {create.isPending ? 'Đang ghim...' : '📌 Ghim lên bảng'}
                </Text>
              </Pressable>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Corkboard>
  );
}

const styles = StyleSheet.create({
  photoDrop: {
    borderWidth: 2.5,
    borderStyle: 'dashed',
    borderColor: C.cork,
    borderRadius: 10,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 20,
    backgroundColor: C.paperWarm,
    overflow: 'hidden',
  },
  clip: {
    position: 'absolute',
    top: -8,
    alignSelf: 'center',
    width: 22,
    height: 34,
    borderWidth: 4,
    borderColor: C.corkDark,
    borderRadius: 8,
  },
  photoText: { fontFamily: F.uiSemi, fontSize: 12.5, color: C.inkSoft },
  label: {
    fontFamily: F.uiBold,
    fontSize: 11.5,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: C.inkSoft,
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: C.lineInput,
    marginBottom: 18,
  },
  dong: { fontFamily: F.monoBold, color: C.pin, fontSize: 16 },
  priceInput: { flex: 1, fontFamily: F.handLight, fontSize: 18, color: C.ink, paddingVertical: 6 },
  textarea: {
    borderBottomWidth: 2,
    borderBottomColor: C.lineInput,
    minHeight: 76,
    textAlignVertical: 'top',
    fontFamily: F.ui,
    fontSize: 15,
    lineHeight: 26,
    color: C.ink,
    paddingVertical: 6,
  },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  submitShadow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 6,
    bottom: -6,
    backgroundColor: C.pinDark,
    borderRadius: 10,
  },
  submit: {
    backgroundColor: C.pin,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    ...shadow,
  },
  submitText: { color: '#fff', fontFamily: F.uiBlack, fontSize: 15.5 },
});
