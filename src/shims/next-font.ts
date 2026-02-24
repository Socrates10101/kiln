/**
 * next/font/google shim for Kiln preview.
 * Returns a no-op font object with empty className.
 */
export function Inter() {
  return { className: '', style: { fontFamily: 'var(--font-inter)' } };
}

export function Zen_Old_Mincho() {
  return { className: '', style: { fontFamily: 'var(--font-zen-old-mincho)' } };
}

// Generic handler — works for any font import
export default function createFont() {
  return { className: '', style: {} };
}
