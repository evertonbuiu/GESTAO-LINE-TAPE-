import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeAppearance,
  isValidHsl,
  parseHsl,
  formatHsl,
  clampNumber,
  resolveMode,
  readableForeground,
  applyAppearance,
  toDbPayload,
  DEFAULT_APPEARANCE,
} from '@/lib/appearance';

describe('appearance validation', () => {
  it('accepts valid hsl strings', () => {
    expect(isValidHsl('217 91% 60%')).toBe(true);
    expect(isValidHsl('0 0% 0%')).toBe(true);
    expect(isValidHsl('360 100% 100%')).toBe(true);
  });

  it('rejects invalid hsl strings', () => {
    expect(isValidHsl('361 10% 10%')).toBe(false);
    expect(isValidHsl('217 191% 60%')).toBe(false);
    expect(isValidHsl('#ff0000')).toBe(false);
    expect(isValidHsl(null)).toBe(false);
    expect(isValidHsl('217,91%,60%')).toBe(false);
  });

  it('parses and formats hsl', () => {
    expect(parseHsl('217 91% 60%')).toEqual({ h: 217, s: 91, l: 60 });
    expect(parseHsl('bad')).toBeNull();
    expect(formatHsl({ h: 216.6, s: 90.4, l: 60.2 })).toBe('217 90% 60%');
    expect(formatHsl({ h: 999, s: -5, l: 200 })).toBe('360 0% 100%');
  });

  it('clamps numbers with fallback', () => {
    expect(clampNumber(5, 0, 2, 1)).toBe(2);
    expect(clampNumber(-5, 0, 2, 1)).toBe(0);
    expect(clampNumber('abc', 0, 2, 1)).toBe(1);
  });
});

describe('normalizeAppearance', () => {
  it('falls back to defaults for garbage', () => {
    expect(normalizeAppearance(null)).toEqual(DEFAULT_APPEARANCE);
    expect(normalizeAppearance({ mode: 'neon', density: 'x', font_scale: 99 })).toEqual({
      ...DEFAULT_APPEARANCE,
      font_scale: 1.3,
    });
  });

  it('keeps valid values', () => {
    expect(
      normalizeAppearance({
        mode: 'dark',
        primary_hsl: '142 71% 45%',
        density: 'compact',
        font_scale: 1.1,
        radius_scale: 0.5,
        reduced_motion: true,
        high_contrast: true,
      }),
    ).toEqual({
      mode: 'dark',
      primary_hsl: '142 71% 45%',
      density: 'compact',
      font_scale: 1.1,
      radius_scale: 0.5,
      reduced_motion: true,
      high_contrast: true,
    });
  });

  it('drops invalid primary color', () => {
    expect(normalizeAppearance({ primary_hsl: 'red' }).primary_hsl).toBeNull();
  });
});

describe('resolveMode / readableForeground', () => {
  it('resolves system mode', () => {
    expect(resolveMode('system', true)).toBe('dark');
    expect(resolveMode('system', false)).toBe('light');
    expect(resolveMode('dark', false)).toBe('dark');
    expect(resolveMode('light', true)).toBe('light');
  });

  it('picks readable foreground', () => {
    expect(readableForeground('217 91% 30%')).toBe('0 0% 100%');
    expect(readableForeground('38 92% 80%')).toBe('222.2 47.4% 11.2%');
    expect(readableForeground('invalid')).toBe('0 0% 100%');
  });
});

describe('applyAppearance', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = document.createElement('html');
  });

  it('applies classes and css variables', () => {
    applyAppearance(root, {
      mode: 'dark',
      primary_hsl: '142 71% 45%',
      density: 'compact',
      font_scale: 1.2,
      radius_scale: 0.5,
      reduced_motion: true,
      high_contrast: true,
    });
    expect(root.classList.contains('dark')).toBe(true);
    expect(root.classList.contains('density-compact')).toBe(true);
    expect(root.classList.contains('high-contrast')).toBe(true);
    expect(root.classList.contains('reduced-motion')).toBe(true);
    expect(root.style.getPropertyValue('--primary')).toBe('142 71% 45%');
    expect(root.style.getPropertyValue('--radius')).toBe('0.250rem');
    expect(root.style.fontSize).toBe('19.2px');
  });

  it('removes primary override when null and honors system mode', () => {
    root.style.setProperty('--primary', '1 2% 3%');
    applyAppearance(root, { ...DEFAULT_APPEARANCE }, true);
    expect(root.style.getPropertyValue('--primary')).toBe('');
    expect(root.classList.contains('dark')).toBe(true);
  });
});

describe('toDbPayload', () => {
  it('normalizes before persisting', () => {
    const payload = toDbPayload(
      { ...DEFAULT_APPEARANCE, font_scale: 5, primary_hsl: 'nope' },
      'user-1',
    );
    expect(payload).toEqual({
      user_id: 'user-1',
      mode: 'system',
      primary_hsl: null,
      density: 'comfortable',
      font_scale: 1.3,
      radius_scale: 1,
      reduced_motion: false,
      high_contrast: false,
    });
  });
});
