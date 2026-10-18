import { resolveBannerUnitId } from '../src/features/ads/adUnit';

const TEST_ID = 'ca-app-pub-3940256099942544/6300978111';
const REAL_ID = 'ca-app-pub-1111111111111111/2222222222';

describe('resolveBannerUnitId', () => {
  it('uses the real unit in a production build', () => {
    expect(resolveBannerUnitId(REAL_ID, true, TEST_ID)).toBe(REAL_ID);
  });

  it('uses the test unit outside production, even with a real ID set', () => {
    expect(resolveBannerUnitId(REAL_ID, false, TEST_ID)).toBe(TEST_ID);
  });

  it('falls back to the test unit when the real ID is missing', () => {
    expect(resolveBannerUnitId(undefined, true, TEST_ID)).toBe(TEST_ID);
    expect(resolveBannerUnitId('', true, TEST_ID)).toBe(TEST_ID);
  });
});
