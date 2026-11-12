import React, { useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Text } from '../src/components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Zap, Whistle, Users, Trophy } from 'lucide-react-native';
import { ONBOARDING_SLIDES, type OnboardingSlide, type OnboardingSlideId } from '../src/features/onboarding/slides';
import { TacticalBoardIcon } from '../src/components/ui/TacticalBoardIcon';
import { useSettingsStore } from '../src/stores/settingsStore';
import { useAppTheme, useThemedStyles, type AppTheme } from '../src/theme/useAppTheme';

const ICON_SIZE = 56;

const slideColors = (c: AppTheme): Record<OnboardingSlideId, string> => ({
  quickMatch: c.success,
  arbitrage: c.accentSecondary,
  tournament: '#D4AF37',
  tactical: '#E63946', // feature colour, fixed like the others
  teams: c.warning,
});

function SlideIcon({ id }: { id: OnboardingSlideId }) {
  const color = slideColors(useAppTheme())[id];
  switch (id) {
    case 'quickMatch': return <Zap size={ICON_SIZE} color={color} strokeWidth={1.5} />;
    case 'arbitrage': return <Whistle size={ICON_SIZE} color={color} strokeWidth={1.5} />;
    case 'tournament': return <Trophy size={ICON_SIZE} color={color} strokeWidth={1.5} />;
    case 'tactical': return <TacticalBoardIcon size={ICON_SIZE} />;
    case 'teams': return <Users size={ICON_SIZE} color={color} strokeWidth={1.5} />;
  }
}

export default function OnboardingScreen() {
  const styles = useThemedStyles(makeStyles);
  const colors = useAppTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const markOnboardingSeen = useSettingsStore((s) => s.markOnboardingSeen);
  const listRef = useRef<FlatList<OnboardingSlide>>(null);
  const [index, setIndex] = useState(0);

  const isLast = index === ONBOARDING_SLIDES.length - 1;

  function finish() {
    markOnboardingSeen();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  // Android back = Skip (otherwise the onboarding would come back next launch)
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      finish();
      return true;
    });
    return () => handler.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleNext() {
    if (isLast) {
      finish();
      return;
    }
    listRef.current?.scrollToIndex({ index: index + 1, animated: true });
  }

  function handleScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Pressable
          onPress={finish}
          style={styles.skipBtn}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.skip')}
          hitSlop={8}
        >
          <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={ONBOARDING_SLIDES}
        keyExtractor={(s) => s.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        getItemLayout={(_d, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={[styles.iconCircle, { borderColor: slideColors(colors)[item.id] + '55' }]}>
              <SlideIcon id={item.id} />
            </View>
            <Text style={styles.title}>{t(item.titleKey)}</Text>
            <Text style={styles.body}>{t(item.bodyKey)}</Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {ONBOARDING_SLIDES.map((s, i) => (
            <View key={s.id} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <Pressable
          onPress={handleNext}
          style={({ pressed }) => [styles.nextBtn, pressed && styles.nextBtnPressed]}
          accessibilityRole="button"
        >
          <Text style={styles.nextText}>{isLast ? t('onboarding.start') : t('onboarding.next')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (a: AppTheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: a.background },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  skipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: a.backgroundElevated,
  },
  skipText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: a.textSecondary,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 20,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    backgroundColor: a.backgroundSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 26,
    fontFamily: 'Inter_900Black',
    color: a.textPrimary,
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: a.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 20,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: a.backgroundElevated,
  },
  dotActive: {
    width: 24,
    backgroundColor: a.fill,
  },
  nextBtn: {
    height: 56,
    borderRadius: 14,
    backgroundColor: a.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnPressed: { opacity: 0.85 },
  nextText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: a.onFill,
  },
});
