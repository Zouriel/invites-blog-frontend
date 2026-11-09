import type { DesignScene } from './scene';
/** A field's path from its label: `event.giftNote` for "Gift note", made unique against the design and the catalog. */
export function fieldPath(scene: DesignScene, known: readonly string[], label: string): string {
  const words = label.replace(/[^A-Za-z0-9 ]+/g, ' ').trim().split(/\s+/);
  let key = words.map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join('') || 'field';
  if (!/^[a-z]/.test(key)) key = 'field' + key;
  let path = `event.${key}`;
  for (let n = 2; scene.fields.some((f) => f.path === path) || known.includes(path); n++) path = `event.${key}${n}`;
  return path;
}
