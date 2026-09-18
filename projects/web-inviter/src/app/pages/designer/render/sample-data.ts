/**
 * The invitation the editor previews with — the C# `DesignSampleData`, key for key, so the browser
 * preview binds exactly what the server's did.
 */
import { blank, findVariable, slug, type RenderCatalog } from './css';
import { walk, type NScene } from './model';

export type SampleMode = 'filled' | 'empty' | 'roles';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Json = any;

export function sampleData(scene: NScene, catalog: RenderCatalog, mode: SampleMode, blocks: readonly string[] | null = null): Json {
  const empty = mode === 'empty';
  const roles = scene.roles.filter((r) => !blank(r));
  const guestRoles = mode === 'roles' && roles.length >= 2 ? roles.slice(0, 2) : roles.slice(0, 1);
  const sample = (path: string): string | null => (empty ? null : findVariable(catalog, path)?.sample ?? null);

  const eventObj: Json = {
    title: findVariable(catalog, 'event.title')!.sample,
    subtitle: sample('event.subtitle'),
    description: sample('event.description'),
    date: sample('event.date'),
    time: sample('event.time'),
    schedule: sample('event.schedule'),
    dressCode: sample('event.dressCode'),
    hashtag: sample('event.hashtag'),
    venue: {
      name: sample('event.venue.name'),
      address: sample('event.venue.address'),
      mapLink: empty ? null : 'https://maps.example.com',
    },
  };

  const photos: string[] = [];
  if (!empty) for (let i = 0; i < 6; i++) photos.push(placeholder(i, i + 1));

  for (const { el } of walk(scene.elements)) {
    if (el.type !== 'slot' || !el.slot || empty) continue;
    const path = el.slot.path ?? '';
    const key = path.startsWith('event.') ? path.slice(6) : null;
    if (key === null || key.includes('.')) continue;
    eventObj[key] = el.slot.multiple || (el.slot.index !== null && el.slot.index > 0) ? [...photos] : placeholder(key.length);
  }

  for (const field of scene.fields) {
    if (!field.path?.startsWith('event.')) continue;
    const key = field.path.slice(6);
    if (key.includes('.') || empty) continue;
    eventObj[key] = field.type === 'url' ? 'https://example.com'
      : field.type === 'select' ? field.options?.[0] ?? field.label
        : blank(field.sample) ? field.label : field.sample;
  }

  const used: string[] = [];
  for (const { el } of walk(scene.elements)) {
    if (blank(el.block)) continue;
    const b = slug(el.block!);
    if (!used.includes(b)) used.push(b);
  }
  const shown = blocks === null ? used : used.filter((b) => blocks.includes(b));

  const dress: Json[] = [];
  if (!empty) {
    const palettes = guestRoles.length === 0 ? ['Guests'] : guestRoles;
    const swatches = [['#1b3d59', '#d4eef8', '#f3eed8'], ['#6a97c0', '#152026', '#b3d5f1']];
    palettes.forEach((role, i) => dress.push({ role, colors: [...swatches[i % 2]] }));
  }

  return {
    event: eventObj,
    guest: {
      name: findVariable(catalog, 'guest.name')!.sample,
      role: guestRoles[0] ?? null,
      roles: [...guestRoles],
      gender: null,
    },
    venue: structuredClone(eventObj.venue),
    inviter: { name: sample('inviter.name'), phone: sample('inviter.phone'), email: sample('inviter.email') },
    rsvp: { link: '#rsvp', label: 'Reply now', status: 'Pending' },
    invite: { link: '#invite' },
    invitation: { kind: 'dynamic' },
    photos: { link: '#photos' },
    camera: empty ? {} : { link: '#camera' },
    theme: {},
    themeVars: {},
    resolvedBlocks: shown,
    dressColors: dress,
  };
}

/** A soft gradient card that reads as "a photo goes here" — `DesignSampleData.Placeholder`. */
export function placeholder(seed: number, number?: number): string {
  const pairs = [['#b3d5f1', '#1b3d59'], ['#f3eed8', '#6a97c0'], ['#d4eef8', '#152026'], ['#6a97c0', '#f3eed8']];
  const p = pairs[Math.abs(seed) % pairs.length];
  const label = number !== undefined
    ? `<text x="200" y="250" font-family="Georgia,serif" font-size="150" text-anchor="middle" fill="#ffffff" fill-opacity=".85">${number}</text>`
    : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p[0]}"/><stop offset="1" stop-color="${p[1]}"/></linearGradient></defs><rect width="400" height="400" fill="url(#g)"/><circle cx="140" cy="150" r="42" fill="#ffffff" fill-opacity=".45"/><path d="M0 330 L120 220 L220 300 L300 240 L400 320 L400 400 L0 400Z" fill="#ffffff" fill-opacity=".35"/>${label}</svg>`;
  return 'data:image/svg+xml;base64,' + btoa(svg);
}
