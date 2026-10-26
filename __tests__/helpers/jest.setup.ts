// Every suite gets the in-memory AsyncStorage — services reach it indirectly
// (e.g. matchService → tactical board saves).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
