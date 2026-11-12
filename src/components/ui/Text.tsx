/**
 * Text and TextInput of the app: same as React Native's, but the phone's font
 * size setting enlarges them at most 1.3 times, so that large system fonts
 * cannot push buttons and scores off small screens.
 *
 * React 19 ignores defaultProps on function components, so the cap cannot be
 * set on React Native's Text globally: every screen imports these instead
 * (guarded by __tests__/layout-adaptive.test.ts). A screen may still pass its
 * own maxFontSizeMultiplier.
 */
import type { Ref } from 'react';
import {
  Text as RNText,
  TextInput as RNTextInput,
  type TextInputProps,
  type TextProps,
} from 'react-native';

export const MAX_FONT_SCALE = 1.3;

export function Text({ maxFontSizeMultiplier, ref, ...props }: TextProps & { ref?: Ref<RNText> }) {
  return <RNText ref={ref} maxFontSizeMultiplier={maxFontSizeMultiplier ?? MAX_FONT_SCALE} {...props} />;
}

export function TextInput({ maxFontSizeMultiplier, ref, ...props }: TextInputProps & { ref?: Ref<RNTextInput> }) {
  return <RNTextInput ref={ref} maxFontSizeMultiplier={maxFontSizeMultiplier ?? MAX_FONT_SCALE} {...props} />;
}
