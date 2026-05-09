import { useWindowDimensions } from 'react-native';

export type ScreenSize = 'small' | 'medium' | 'tablet';

export interface ResponsiveLayout {
  size: ScreenSize;
  isSmall: boolean;
  isMedium: boolean;
  isTablet: boolean;
  width: number;
  height: number;
  /** Score font size: smaller on tight screens */
  scoreFontSize: number;
  /** Score button min height */
  scoreButtonSize: number;
}

export function useResponsive(): ResponsiveLayout {
  const { width, height } = useWindowDimensions();

  let size: ScreenSize;
  if (width < 370) {
    size = 'small';
  } else if (width < 768) {
    size = 'medium';
  } else {
    size = 'tablet';
  }

  return {
    size,
    isSmall: size === 'small',
    isMedium: size === 'medium',
    isTablet: size === 'tablet',
    width,
    height,
    scoreFontSize: size === 'small' ? 72 : size === 'tablet' ? 128 : 96,
    scoreButtonSize: size === 'small' ? 72 : size === 'tablet' ? 140 : 88,
  };
}
