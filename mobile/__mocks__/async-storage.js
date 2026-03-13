// Mock for @react-native-async-storage/async-storage in Jest
// The real jest.setup.ts registers a more detailed mock via jest.mock()
// but Jest needs to be able to resolve the module path first.
const AsyncStorage = {
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  getAllKeys: jest.fn(),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
  multiRemove: jest.fn(),
};
module.exports = AsyncStorage;
