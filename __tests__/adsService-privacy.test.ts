type ConsentInfo = { canRequestAds: boolean; privacyOptionsRequirementStatus: string };

function loadService(mock: {
  getConsentInfo?: jest.Mock;
  gatherConsent?: jest.Mock;
  showPrivacyOptionsForm?: jest.Mock;
  initialize?: jest.Mock;
} | null) {
  jest.resetModules();
  if (mock === null) {
    jest.doMock('react-native-google-mobile-ads', () => {
      throw new Error('native module unavailable');
    });
  } else {
    const initialize = mock.initialize ?? jest.fn().mockResolvedValue([]);
    jest.doMock('react-native-google-mobile-ads', () => ({
      __esModule: true,
      default: () => ({ initialize }),
      AdsConsentPrivacyOptionsRequirementStatus: { UNKNOWN: 'UNKNOWN', REQUIRED: 'REQUIRED', NOT_REQUIRED: 'NOT_REQUIRED' },
      AdsConsent: {
        gatherConsent: mock.gatherConsent ?? jest.fn().mockResolvedValue({}),
        getConsentInfo: mock.getConsentInfo ?? jest.fn(),
        showPrivacyOptionsForm: mock.showPrivacyOptionsForm ?? jest.fn(),
      },
    }));
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../src/features/ads/adsService') as typeof import('../src/features/ads/adsService');
}

const info = (canRequestAds: boolean, status = 'REQUIRED'): ConsentInfo => ({
  canRequestAds,
  privacyOptionsRequirementStatus: status,
});

describe('adsService — privacy options', () => {
  it('reports the privacy options as required only when UMP says so', async () => {
    const getConsentInfo = jest.fn().mockResolvedValueOnce(info(true, 'REQUIRED')).mockResolvedValueOnce(info(true, 'NOT_REQUIRED'));
    const svc = loadService({ getConsentInfo });
    expect(await svc.isPrivacyOptionsRequired()).toBe(true);
    expect(await svc.isPrivacyOptionsRequired()).toBe(false);
  });

  it('withdrawing consent in the form hides the ads', async () => {
    const getConsentInfo = jest.fn().mockResolvedValue(info(true));
    const showPrivacyOptionsForm = jest.fn().mockResolvedValue(info(false));
    const svc = loadService({ getConsentInfo, showPrivacyOptionsForm });
    await svc.initAds();
    expect(svc.useAdsStore.getState().canShowAds).toBe(true);

    await svc.openPrivacyOptions();
    expect(showPrivacyOptionsForm).toHaveBeenCalledTimes(1);
    expect(svc.useAdsStore.getState().canShowAds).toBe(false);
  });

  it('granting consent in the form initializes the SDK once and shows the ads', async () => {
    const initialize = jest.fn().mockResolvedValue([]);
    const getConsentInfo = jest.fn().mockResolvedValue(info(false));
    const showPrivacyOptionsForm = jest.fn().mockResolvedValue(info(true));
    const svc = loadService({ getConsentInfo, showPrivacyOptionsForm, initialize });
    await svc.initAds();
    expect(initialize).not.toHaveBeenCalled();
    expect(svc.useAdsStore.getState().canShowAds).toBe(false);

    await svc.openPrivacyOptions();
    await svc.openPrivacyOptions();
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(svc.useAdsStore.getState().canShowAds).toBe(true);
  });

  it('keeps the current state when the form fails', async () => {
    const getConsentInfo = jest.fn().mockResolvedValue(info(true));
    const showPrivacyOptionsForm = jest.fn().mockRejectedValue(new Error('form unavailable'));
    const svc = loadService({ getConsentInfo, showPrivacyOptionsForm });
    await svc.initAds();
    await expect(svc.openPrivacyOptions()).resolves.toBeUndefined();
    expect(svc.useAdsStore.getState().canShowAds).toBe(true);
  });

  it('does nothing without the native module (Expo Go / web)', async () => {
    const svc = loadService(null);
    expect(await svc.isPrivacyOptionsRequired()).toBe(false);
    await expect(svc.openPrivacyOptions()).resolves.toBeUndefined();
  });
});
