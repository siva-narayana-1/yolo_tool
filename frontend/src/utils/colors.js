// Curated high-contrast, vibrant colors tailored for dark-mode computer vision annotation
export const PRESET_COLORS = [
  '#ef4444', // 0: Red
  '#3b82f6', // 1: Blue
  '#10b981', // 2: Emerald Green
  '#f59e0b', // 3: Amber / Yellow-Gold
  '#8b5cf6', // 4: Purple / Violet
  '#ec4899', // 5: Pink
  '#06b6d4', // 6: Cyan
  '#f97316', // 7: Orange
  '#84cc16', // 8: Lime
  '#14b8a6', // 9: Teal
  '#a855f7', // 10: Bright Purple
  '#e11d48', // 11: Rose
  '#6366f1', // 12: Indigo
  '#d946ef', // 13: Fuchsia
  '#0284c7', // 14: Sky Blue
  '#22c55e', // 15: Bright Green
  '#eab308', // 16: Yellow
  '#f43f5e', // 17: Crimson
  '#64748b', // 18: Slate
  '#a3e635', // 19: Electric Lime
];

/**
 * Automatically assigns a visually distinct, vibrant color for a class index.
 * Uses curated palette for first items, then golden ratio HSL distribution.
 */
export function getColorForIndex(index) {
  if (index >= 0 && index < PRESET_COLORS.length) {
    return PRESET_COLORS[index];
  }
  // Golden ratio hue calculation ensures maximally distributed distinguishable colors
  const goldenRatio = 0.618033988749895;
  const hue = Math.round(((index * goldenRatio) % 1) * 360);
  return `hsl(${hue}, 85%, 55%)`;
}

/**
 * Returns hotkey string for index (1..9, 0, then empty)
 */
export function getHotkeyForIndex(index) {
  if (index >= 0 && index < 9) return String(index + 1);
  if (index === 9) return '0';
  return '';
}

/**
 * Converts raw string list of class names into formatted class objects with auto colors & hotkeys
 */
export function formatClassesFromNames(namesList, existingClasses = []) {
  const existingMap = new Map();
  if (Array.isArray(existingClasses)) {
    existingClasses.forEach(c => {
      if (c && c.name) existingMap.set(c.name.toLowerCase().trim(), c.color);
    });
  }

  return namesList
    .map(name => name.trim())
    .filter(name => name.length > 0)
    .map((name, index) => {
      const lower = name.toLowerCase();
      // Keep existing color if known, otherwise auto-assign
      const color = existingMap.has(lower) ? existingMap.get(lower) : getColorForIndex(index);
      return {
        id: index,
        name: name,
        color: color,
        hotkey: getHotkeyForIndex(index)
      };
    });
}
