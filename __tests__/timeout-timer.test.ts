/**
 * Timeout timer logic — unit tests for countdown behaviour.
 * Tests the pure countdown logic independent of UI.
 */

describe('Timeout countdown logic', () => {
  const TIMEOUT_DURATION = 30;

  function simulateCountdown(startSeconds: number, ticks: number): number {
    let seconds = startSeconds;
    for (let i = 0; i < ticks; i++) {
      if (seconds > 0) seconds -= 1;
    }
    return seconds;
  }

  it('starts at 30 seconds', () => {
    expect(TIMEOUT_DURATION).toBe(30);
  });

  it('decrements by 1 per tick', () => {
    expect(simulateCountdown(30, 1)).toBe(29);
  });

  it('reaches 0 after 30 ticks', () => {
    expect(simulateCountdown(30, 30)).toBe(0);
  });

  it('does not go below 0', () => {
    expect(simulateCountdown(30, 35)).toBe(0);
  });

  it('is urgent when <= 10 seconds', () => {
    const isUrgent = (s: number) => s <= 10;
    expect(isUrgent(11)).toBe(false);
    expect(isUrgent(10)).toBe(true);
    expect(isUrgent(5)).toBe(true);
    expect(isUrgent(0)).toBe(true);
  });

  it('progress goes from 1.0 to 0.0 over 30 ticks', () => {
    const progress = (s: number) => s / TIMEOUT_DURATION;
    expect(progress(30)).toBe(1);
    expect(progress(15)).toBe(0.5);
    expect(progress(0)).toBe(0);
  });
});
