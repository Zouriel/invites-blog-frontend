import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { UiSnackbarService } from '@zouriel/ui/dialog';
import { ApiService } from '../../../shared/api/api.service';
import { DesignStore } from '../design.store';
import type { DesignCatalog, DesignElement, DesignScene } from '../model/scene';
import { findElement } from '../model/scene-ops';
import { runTool, TOOL_NAMES, vocabulary, type ToolContext } from './assistant-tools';
import { DesignAssistant } from './design-assistant';
import { outline } from './outline';

const frame = (t: number, opacity: number) => ({ t, dx: 0, dy: 0, dRotate: 0, scale: 1, opacity });
const catalog = {
  canvas: { width: 390, referenceViewport: 844 }, fontBaseUrl: '/assets/fonts/',
  fonts: [{ id: 'lora', name: 'Lora', category: 'serif', fallback: 'serif', weights: [400], stack: 'Lora, serif' }],
  variables: [
    { path: 'event.title', label: 'Title', group: 'Event', kind: 'text', type: 'text', sample: 'Hana & Imran' },
    { path: 'event.coverImage', label: 'Cover', group: 'Event', kind: 'image', type: 'image', sample: '' },
  ],
  enterPresets: [{ id: 'fade', label: 'Fade in', frames: [frame(0, 0), frame(0.15, 1)] }],
  exitPresets: [{ id: 'fade-out', label: 'Fade out', frames: [frame(0.85, 1), frame(1, 0)] }],
  loopPresets: [{ id: 'float', label: 'Float', frames: [{ t: 0, dx: 0, dy: 0, rotate: 0, scale: 1, opacity: 1 }, { t: 1, dx: 0, dy: -10, rotate: 0, scale: 1, opacity: 1 }], repeat: 4, alternate: false }],
  easings: [], fieldTypes: [], linkPaths: ['camera.link'], starters: [], requiredThemeKeys: ['accent', 'bg', 'text'],
  limits: {},
} as unknown as DesignCatalog;

const rect = (id: string, extra: Partial<DesignElement> = {}): DesignElement => ({
  id, type: 'shape', name: null, x: 20, y: 40, w: 100, h: 50, rotate: 0, scale: 1, opacity: 1, keyframes: [],
  shape: { kind: 'rect', sides: 6, fill: '#000000', stroke: null, strokeWidth: 0, radius: 0 }, ...extra,
});

const scene = (elements: DesignElement[]): DesignScene => ({
  schema: 3, canvas: {}, theme: [{ key: 'bg', label: 'Background', value: '#ffffff' }, { key: 'accent', label: 'Accent', value: '#b08d57' }, { key: 'body-font', label: 'Body font', value: 'lora' }],
  fonts: ['lora'], roles: [], fields: [], elements, assets: { a1: { kind: 'image', data: 'data:image/png;base64,AAAA', width: 800, height: 400, name: 'beach.jpg' } },
});

describe('designer assistant tools', () => {
  let store: DesignStore;
  let ctx: ToolContext;
  const run = (name: string, input: Record<string, unknown>) => runTool(ctx, name, input);
  const el = (id: string) => findElement(store.scene()!, id)!;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [DesignStore, { provide: ApiService, useValue: {} }] });
    store = TestBed.inject(DesignStore);
    store.catalog.set(catalog);
    store.scene.set(scene([rect('e1', { name: 'Box' })]));
    ctx = { store, api: TestBed.inject(ApiService), checked: async () => undefined };
  });
  afterEach(() => vi.useRealTimers());

  /** The server lists the same names in AssistantPrompt.cs (DesignAssistantServiceTests checks its side). */
  it('runs every tool the server offers, and no others', async () => {
    expect([...TOOL_NAMES].sort()).toEqual([
      'add_art', 'add_button', 'add_photo_slot', 'add_picture', 'add_shape', 'add_sticker', 'add_text', 'apply_effect_move', 'arrange',
      'check_design', 'delete_elements', 'duplicate_elements', 'get_elements', 'get_outline', 'group_elements', 'search_art', 'set_motion',
      'set_page', 'set_theme', 'show', 'ungroup', 'update_element',
    ]);
    for (const name of TOOL_NAMES) expect((await run(name, {})).text).not.toContain("There's no tool");
    expect((await run('write_html', {})).ok).toBe(false);
  });

  it('adds text with fields as live placeholders, not typed-out facts', async () => {
    const r = await run('add_text', { text: 'Join {{event.title}}', y: 120, font: 'lora', size: 32, color: 'theme:accent' });
    expect(r.ok).toBe(true);
    const added = store.scene()!.elements.at(-1)!;
    expect(added.text!.runs).toEqual([{ text: 'Join ' }, { var: 'event.title' }]);
    expect(added.text!.style).toMatchObject({ font: 'lora', size: 32, color: 'theme:accent' });
    expect(added.y).toBe(120);
    expect(r.text).toContain(added.id);
    // The person gets a plain line, without ids or coordinates.
    expect(r.summary).toBe('Added text “Join {event.title}”');
  });

  it('turns a written \\n into a real line break', async () => {
    await run('add_text', { text: '{{event.title}}\\nSaturday', y: 0 });
    expect(store.scene()!.elements.at(-1)!.text!.runs).toEqual([{ var: 'event.title' }, { text: '\nSaturday' }]);
  });

  it('refuses what it cannot check: unknown fields, fonts, colours and ids', async () => {
    expect((await run('add_text', { text: '{{guest.password}}', y: 0 })).ok).toBe(false);
    expect((await run('add_text', { text: 'x', y: 0, font: 'comic-sans' })).ok).toBe(false);
    expect((await run('add_shape', { kind: 'rect', x: 0, y: 0, w: 10, h: 10, fill: 'url(javascript:alert(1))' })).ok).toBe(false);
    expect((await run('add_shape', { kind: 'rect', x: 0, y: 0, w: 10, h: 10, fill: 'theme:nope' })).ok).toBe(false);
    expect((await run('update_element', { id: 'e9', x: 1 })).text).toContain('No element "e9"');
    expect(store.scene()!.elements.length).toBe(1);
  });

  it('moves an element with its motion and changes only what is given', async () => {
    store.scene.set(scene([rect('e1', { track: { start: 0, end: 400 }, keyframes: [{ t: 0, y: 40 }, { t: 1, y: 140 }] })]));
    const r = await run('update_element', { id: 'e1', y: 100, fill: '#ff0000' });
    expect(r.ok).toBe(true);
    expect(el('e1').y).toBe(100);
    expect(el('e1').keyframes.map((k) => k.y)).toEqual([100, 200]);
    expect(el('e1').shape!.fill).toBe('#ff0000');
    expect(el('e1').w).toBe(100);
  });

  it('places an uploaded photo from the design assets, keeping its shape', async () => {
    const r = await run('add_picture', { asset: 'a1', y: 300 });
    expect(r.ok).toBe(true);
    const pic = store.scene()!.elements.at(-1)!;
    expect(pic.image).toMatchObject({ asset: 'a1', fit: 'cover' });
    expect(pic.h / pic.w).toBeCloseTo(0.5, 1);
    expect((await run('add_picture', { asset: 'a2' })).ok).toBe(false);
  });

  it('sets ways in, loops and the theme from the catalog only', async () => {
    expect((await run('set_motion', { id: 'e1', enter: 'fade', loop: 'float' })).ok).toBe(true);
    expect(el('e1').enter).toBe('fade');
    expect(el('e1').loop?.preset).toBe('float');
    expect((await run('set_motion', { id: 'e1', enter: 'explode' })).ok).toBe(false);
    expect((await run('set_motion', { id: 'e1', enter: 'none' })).ok).toBe(true);
    expect(el('e1').enter).toBeFalsy();

    expect((await run('set_theme', { entries: { accent: '#c0a060', 'heading-font': 'lora' } })).ok).toBe(true);
    expect(store.scene()!.theme.find((t) => t.key === 'accent')!.value).toBe('#c0a060');
    expect(store.scene()!.theme.some((t) => t.key === 'heading-font')).toBe(true);
    expect((await run('set_theme', { entries: { accent: 'red; background:url(x)' } })).ok).toBe(false);
  });

  it('adds stickers and effect moves the editor knows', async () => {
    const v = vocabulary();
    expect(v.moves.length).toBeGreaterThan(5);
    expect(v.stickers.length).toBeGreaterThan(3);
    expect((await run('add_sticker', { sticker: v.stickers[0].id, at: 0 })).ok).toBe(true);
    expect((await run('apply_effect_move', { id: 'e1', move: v.moves[0].id })).ok).toBe(true);
    expect((await run('add_sticker', { sticker: 'nope' })).ok).toBe(false);
  });

  it('deletes quietly, so the chat reports it rather than a pile of notices', async () => {
    const snackbar = TestBed.inject(UiSnackbarService);
    expect((await run('delete_elements', { ids: ['e1'] })).ok).toBe(true);
    expect(store.scene()!.elements).toEqual([]);
    expect(snackbar.current()).toBeNull();
  });
});

describe('designer assistant outline', () => {
  it('describes the design in a line per element, without the picture data', () => {
    const s = scene([rect('e1', { name: 'Box', enter: 'fade' }), { ...rect('g1'), type: 'group', shape: null, children: [rect('e2')] }]);
    const text = outline(s, ['e1'], 120);
    expect(text).toContain('selected: e1');
    expect(text).toContain('e1 rect "Box" x20 y40 w100 h50');
    expect(text).toContain('enter fade');
    expect(text).toContain('\n  e2 rect');
    expect(text).toContain('a1 photo 800x400 "beach.jpg"');
    expect(text).not.toContain('base64');
  });
});

describe('one message is one undo step', () => {
  let store: DesignStore;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [DesignStore, { provide: ApiService, useValue: {} }] });
    store = TestBed.inject(DesignStore);
    store.catalog.set(catalog);
    store.scene.set(scene([rect('e1')]));
  });

  it('folds every edit in a transaction into one step, however far apart', () => {
    const before = store.scene();
    expect(store.beginTransaction()).toBe(true);
    store.update('e1', (e) => ({ ...e, x: 1 }));
    store.update('e1', (e) => ({ ...e, x: 2 }));
    store.remove(['e1'], { quiet: true });
    expect(store.endTransaction()).toBe(true);
    store.undo();
    expect(store.scene()).toBe(before);
    expect(store.canUndo()).toBe(false);
  });

  it('an empty transaction leaves nothing to undo', () => {
    store.beginTransaction();
    expect(store.endTransaction()).toBe(false);
    expect(store.canUndo()).toBe(false);
  });
});

describe('DesignAssistant', () => {
  let store: DesignStore;
  let assistant: DesignAssistant;
  const api = {
    assistantChat: vi.fn(),
    assistantSend: vi.fn(),
    assistantResults: vi.fn(),
    assistantClear: vi.fn(),
  };
  const status = { allowed: true, reason: null, usedUsd: 0, allowanceUsd: 5, resetsAt: '2026-12-01T00:00:00Z' };
  const msg = (role: 'user' | 'assistant' | 'results', text: string, lines: string[] = []) => ({ id: crypto.randomUUID(), role, text, lines, startsTurn: role === 'user', createdAt: '' });

  beforeEach(async () => {
    Object.values(api).forEach((f) => f.mockReset());
    TestBed.configureTestingModule({ providers: [DesignStore, DesignAssistant, { provide: ApiService, useValue: api }] });
    store = TestBed.inject(DesignStore);
    store.catalog.set(catalog);
    store.design.set({ id: 'd1' } as never);
    store.scene.set(scene([rect('e1')]));
    assistant = TestBed.inject(DesignAssistant);
    api.assistantChat.mockReturnValue(of({ messages: [], status, pendingToolCalls: [] }));
    await assistant.load();
  });

  it('runs the tool calls, sends the results back, and makes the whole exchange one undo', async () => {
    const before = store.scene();
    api.assistantSend.mockReturnValue(of({
      messages: [msg('user', 'make it red')], done: false, status,
      toolCalls: [{ id: 't1', name: 'update_element', input: { id: 'e1', fill: '#ff0000' } }, { id: 't2', name: 'update_element', input: { id: 'e1', w: 200 } }],
    }));
    api.assistantResults.mockReturnValue(of({ messages: [msg('results', '', ['Updated e1']), msg('assistant', 'Made it red.')], toolCalls: [], done: true, status }));

    await assistant.send('make it red');

    const sent = api.assistantSend.mock.calls[0][1];
    expect(sent.outline).toContain('e1 rect');
    expect(sent.vocabulary.moves.length).toBeGreaterThan(0);
    const results = api.assistantResults.mock.calls[0][1].results;
    expect(results.map((r: { id: string; ok: boolean }) => [r.id, r.ok])).toEqual([['t1', true], ['t2', true]]);
    expect(findElement(store.scene()!, 'e1')!.shape!.fill).toBe('#ff0000');
    expect(findElement(store.scene()!, 'e1')!.w).toBe(200);
    expect(assistant.messages().map((m) => m.role)).toEqual(['user', 'results', 'assistant']);
    expect(assistant.working()).toBe(false);

    expect(assistant.canUndoLast()).toBe(true);
    assistant.undoLast();
    expect(store.scene()).toBe(before);
  });

  it('a failed request puts the message back and shows why', async () => {
    api.assistantSend.mockImplementation(() => { throw Object.assign(new Error('You have used this month\'s AI allowance.'), { status: 422 }); });
    await assistant.send('hello');
    expect(assistant.messages()).toEqual([]);
    expect(assistant.error()).toContain('allowance');
    expect(assistant.working()).toBe(false);
    expect(store.inTransaction()).toBe(false);
  });

  it('does nothing when the account may not use it', async () => {
    assistant.status.set({ ...status, allowed: false, reason: 'premium' });
    await assistant.send('hello');
    expect(api.assistantSend).not.toHaveBeenCalled();
  });
});
