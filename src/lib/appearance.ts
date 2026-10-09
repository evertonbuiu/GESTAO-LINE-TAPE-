/**
 * Preferências de aparência por usuário (Configurar Tema).
 * Funções puras: validação, normalização e aplicação de tokens CSS.
 */

export type ThemeMode = 'light' | 'dark' | 'system';
export type Density = 'compact' | 'comfortable';

export interface AppearancePrefs {
  mode: ThemeMode;
  primary_hsl: string | null;
  density: Density;
  font_scale: number;
  radius_scale: number;
  reduced_motion: boolean;
  high_contrast: boolean;
}

export const DEFAULT_APPEARANCE: AppearancePrefs = {
  mode: 'dark',
  primary_hsl: null,
  density: 'comfortable',
  font_scale: 1,
  radius_scale: 1,
  reduced_motion: false,
  high_contrast: false,
};

export const FONT_SCALE_MIN = 0.85;
export const FONT_SCALE_MAX = 1.3;
export const RADIUS_SCALE_MIN = 0;
export const RADIUS_SCALE_MAX = 2;

const HSL_RE = /^(\d{1,3}(?:\.\d+)?) (\d{1,3}(?:\.\d+)?)% (\d{1,3}(?:\.\d+)?)%$/;

export function isValidHsl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = value.match(HSL_RE);
  if (!m) return false;
  const h = Number(m[1]);
  const s = Number(m[2]);
  const l = Number(m[3]);
  return h >= 0 && h <= 360 && s >= 0 && s <= 100 && l >= 0 && l <= 100;
}

export function parseHsl(value: string): { h: number; s: number; l: number } | null {
  if (!isValidHsl(value)) return null;
  const m = value.match(HSL_RE)!;
  return { h: Number(m[1]), s: Number(m[2]), l: Number(m[3]) };
}

export function formatHsl(hsl: { h: number; s: number; l: number }): string {
  const clamp = (n: number, min: number, max: number) =>
    Math.min(max, Math.max(min, Math.round(Number.isFinite(n) ? n : 0)));
  return `${clamp(hsl.h, 0, 360)} ${clamp(hsl.s, 0, 100)}% ${clamp(hsl.l, 0, 100)}%`;
}

export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Normaliza qualquer payload (banco/localStorage) para preferências válidas. */
export function normalizeAppearance(input: unknown): AppearancePrefs {
  const raw = (input ?? {}) as Partial<Record<keyof AppearancePrefs, unknown>>;
  const mode = raw.mode === 'light' || raw.mode === 'dark' || raw.mode === 'system'
    ? raw.mode
    : DEFAULT_APPEARANCE.mode;
  const density = raw.density === 'compact' || raw.density === 'comfortable'
    ? raw.density
    : DEFAULT_APPEARANCE.density;
  return {
    mode,
    primary_hsl: isValidHsl(raw.primary_hsl) ? (raw.primary_hsl as string) : null,
    density,
    font_scale: clampNumber(raw.font_scale, FONT_SCALE_MIN, FONT_SCALE_MAX, 1),
    radius_scale: clampNumber(raw.radius_scale, RADIUS_SCALE_MIN, RADIUS_SCALE_MAX, 1),
    reduced_motion: raw.reduced_motion === true,
    high_contrast: raw.high_contrast === true,
  };
}

/** Resolve o modo efetivo considerando a preferência do sistema. */
export function resolveMode(mode: ThemeMode, systemPrefersDark: boolean): 'light' | 'dark' {
  if (mode === 'system') return systemPrefersDark ? 'dark' : 'light';
  return mode;
}

/** Foreground legível (preto/branco) para uma cor primária. */
export function readableForeground(primary: string): string {
  const parsed = parseHsl(primary);
  if (!parsed) return '0 0% 100%';
  return parsed.l >= 60 ? '222.2 47.4% 11.2%' : '0 0% 100%';
}

export const BASE_FONT_PX = 16;
export const BASE_RADIUS_REM = 0.5;

/** Aplica as preferências no elemento raiz do documento. */
export function applyAppearance(
  root: HTMLElement,
  prefs: AppearancePrefs,
  systemPrefersDark = false,
): void {
  const effective = resolveMode(prefs.mode, systemPrefersDark);
  root.classList.toggle('dark', effective === 'dark');
  root.classList.toggle('high-contrast', prefs.high_contrast);
  root.classList.toggle('reduced-motion', prefs.reduced_motion);
  root.classList.toggle('density-compact', prefs.density === 'compact');

  root.style.setProperty('--app-font-scale', String(prefs.font_scale));
  root.style.fontSize = `${(BASE_FONT_PX * prefs.font_scale).toFixed(2)}px`;
  root.style.setProperty('--radius', `${(BASE_RADIUS_REM * prefs.radius_scale).toFixed(3)}rem`);

  if (prefs.primary_hsl) {
    root.style.setProperty('--primary', prefs.primary_hsl);
    root.style.setProperty('--primary-foreground', readableForeground(prefs.primary_hsl));
    root.style.setProperty('--ring', prefs.primary_hsl);
  } else {
    root.style.removeProperty('--primary');
    root.style.removeProperty('--primary-foreground');
    root.style.removeProperty('--ring');
  }
}

/** Payload pronto para gravar na tabela user_theme_preferences. */
export function toDbPayload(prefs: AppearancePrefs, userId: string) {
  const p = normalizeAppearance(prefs);
  return {
    user_id: userId,
    mode: p.mode,
    primary_hsl: p.primary_hsl,
    density: p.density,
    font_scale: p.font_scale,
    radius_scale: p.radius_scale,
    reduced_motion: p.reduced_motion,
    high_contrast: p.high_contrast,
  };
}

export const PRIMARY_PRESETS: { id: string; name: string; hsl: string }[] = [
  { id: 'azul', name: 'Azul', hsl: '217 91% 60%' },
  { id: 'indigo', name: 'Índigo', hsl: '243 75% 59%' },
  { id: 'verde', name: 'Verde', hsl: '142 71% 45%' },
  { id: 'ambar', name: 'Âmbar', hsl: '38 92% 50%' },
  { id: 'vermelho', name: 'Vermelho', hsl: '0 72% 51%' },
  { id: 'roxo', name: 'Roxo', hsl: '262 83% 58%' },
  { id: 'ciano', name: 'Ciano', hsl: '189 94% 43%' },
  { id: 'rosa', name: 'Rosa', hsl: '333 71% 51%' },
];
