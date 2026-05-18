import type { TextBlock } from './ocrParser';

// Dynamic require — @react-native-ml-kit/text-recognition needs a native build.
// On Expo Go the module is unavailable; isOcrAvailable() returns false and
// recognizeText() returns an empty block array instead of crashing.
let TextRecognition: { recognize: (uri: string) => Promise<{ blocks: TextBlock[] }> } | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@react-native-ml-kit/text-recognition');
  TextRecognition = mod.default ?? mod;
} catch {
  // Native module unavailable (Expo Go / web)
}

export function isOcrAvailable(): boolean {
  return TextRecognition !== null;
}

export async function recognizeText(imageUri: string): Promise<TextBlock[]> {
  if (!TextRecognition) return [];
  const result = await TextRecognition.recognize(imageUri);
  return result.blocks ?? [];
}
