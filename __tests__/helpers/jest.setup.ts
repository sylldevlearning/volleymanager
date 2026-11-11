// Every suite gets the in-memory AsyncStorage — services reach it indirectly
// (e.g. matchService → tactical board saves).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Google Sign-In (optional Drive backup): no native module in Jest. The Drive
// backup tests replace src/features/backup/googleAccount with their own mock.
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(async () => ({ type: 'cancelled', data: null })),
    signInSilently: jest.fn(async () => ({ type: 'noSavedCredentialFound', data: null })),
    signOut: jest.fn(async () => null),
    getCurrentUser: jest.fn(() => null),
    getTokens: jest.fn(async () => {
      throw new Error('Not signed in');
    }),
    clearCachedAccessToken: jest.fn(async () => null),
  },
  statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED', IN_PROGRESS: 'IN_PROGRESS', SIGN_IN_REQUIRED: 'SIGN_IN_REQUIRED' },
  isCancelledResponse: (r: { type?: string } | null) => r?.type === 'cancelled',
  isNoSavedCredentialFoundResponse: (r: { type?: string } | null) => r?.type === 'noSavedCredentialFound',
  isErrorWithCode: (e: { code?: unknown } | null) => typeof e?.code === 'string',
}));
