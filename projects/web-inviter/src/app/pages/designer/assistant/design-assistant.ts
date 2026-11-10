import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { UiSnackbarService } from '@zouriel/ui/dialog';
import { ApiService } from '../../../shared/api/api.service';
import { DesignStore } from '../design.store';
import type { AiPictureStatus, DesignScene } from '../model/scene';
import type { AssistantMessage, AssistantStatus, AssistantStep, AssistantToolCall } from './assistant.model';
import { runTool, vocabulary, type ToolOutcome } from './assistant-tools';

type ToolReport = ToolOutcome & { id: string };
import { outline } from './outline';

/** How long Check takes to answer after a change (the store waits 900 ms, then asks the server). */
const CHECK_WAIT = 1600;

/**
 * The design assistant for one open design: the chat, and the loop that runs Claude's tool calls on
 * the editor. Provided next to {@link DesignStore} by the editor, so it lives as long as the design
 * is open and keeps working while the phone's sidebar is closed.
 *
 * <p>One message from the person is one exchange and one undo step: the store's transaction opens
 * before the first call and closes when Claude stops (or the person presses Stop), so Undo takes the
 * whole exchange back.</p>
 */
@Injectable()
export class DesignAssistant {
  private readonly api = inject(ApiService);
  private readonly store = inject(DesignStore);
  private readonly snackbar = inject(UiSnackbarService);

  readonly messages = signal<AssistantMessage[]>([]);
  readonly status = signal<AssistantStatus | null>(null);
  readonly loaded = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly working = signal(false);
  /** What is happening now, for the line under the chat ("Adding text…"). */
  readonly activity = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  /** The scene right after the last exchange: while nothing else has changed it, Undo takes that exchange back. */
  private readonly after = signal<DesignScene | null>(null);
  readonly canUndoLast = computed(() => !this.working() && !!this.after() && this.store.scene() === this.after());

  readonly allowed = computed(() => this.status()?.allowed ?? false);
  /** The share of this month's allowance used, 0–100, once it is worth mentioning. */
  readonly usedPercent = computed(() => {
    const s = this.status();
    if (!s || !s.allowanceUsd) return 0;
    return Math.min(100, Math.round((s.usedUsd / s.allowanceUsd) * 100));
  });

  private stopRequested = false;
  private designId: string | null = null;

  async load(): Promise<void> {
    const id = this.store.design()?.id;
    if (!id || (this.designId === id && this.loaded())) return;
    this.designId = id;
    this.loadError.set(null);
    try {
      const chat = await firstValueFrom(this.api.assistantChat(id));
      this.messages.set(chat.messages);
      this.status.set(chat.status);
      this.loaded.set(true);
    } catch (e) {
      this.loadError.set((e as Error).message || 'The assistant could not be loaded.');
    }
  }

  /** The account's AI picture allowance, for the outline's "AI pictures" line; left out when it can't be read. */
  private async aiPictures(): Promise<AiPictureStatus | null> {
    try {
      return await firstValueFrom(this.api.aiPictureStatus());
    } catch {
      return null;
    }
  }

  async send(text: string): Promise<void> {
    const id = this.designId;
    const scene = this.store.scene();
    const trimmed = text.trim();
    if (!id || !scene || !trimmed || this.working() || !this.allowed()) return;

    this.error.set(null);
    this.stopRequested = false;
    this.working.set(true);
    this.activity.set('Thinking…');
    // Shown at once; replaced by the server's copy when it answers.
    const local: AssistantMessage = { id: 'local', role: 'user', text: trimmed, lines: [], startsTurn: true, createdAt: new Date().toISOString() };
    this.messages.update((m) => [...m, local]);

    const opened = this.store.beginTransaction();
    try {
      let step = await firstValueFrom(this.api.assistantSend(id, {
        text: trimmed, outline: outline(scene, this.store.selection(), this.store.playhead(), this.store.preview()?.bytes, await this.aiPictures()), vocabulary: vocabulary(),
      }));
      this.messages.update((m) => m.filter((x) => x !== local));
      this.take(step);
      while (!step.done && step.toolCalls.length && !this.stopRequested) {
        const results = await this.runAll(step.toolCalls);
        if (this.stopRequested) break;
        this.activity.set('Thinking…');
        step = await firstValueFrom(this.api.assistantResults(id, { results, vocabulary: vocabulary() }));
        this.take(step);
      }
    } catch (e) {
      // If the first request failed, the message never reached the chat: take it back off.
      this.messages.update((m) => m.filter((x) => x !== local));
      const err = e as Error & { status?: number };
      this.error.set(err.message || 'Something went wrong. Please try again.');
      // The plan or allowance may have changed under us: ask again.
      if (err.status === 403 || err.status === 422 || err.status === 400) void this.refreshStatus();
    } finally {
      if (opened) {
        const changed = this.store.endTransaction();
        this.after.set(changed ? this.store.scene() : null);
        if (changed) this.snackbar.show({ message: 'The assistant changed the design', action: { label: 'Undo', run: () => this.undoLast() } });
      }
      this.working.set(false);
      this.activity.set(null);
    }
  }

  /** Stops after the tool call that is running; the server closes the rest when the next message comes. */
  stop(): void {
    if (this.working()) this.stopRequested = true;
  }

  undoLast(): void {
    if (!this.canUndoLast()) return;
    this.store.undo();
    this.after.set(null);
  }

  async clear(): Promise<void> {
    if (!this.designId || this.working()) return;
    try {
      await firstValueFrom(this.api.assistantClear(this.designId));
      this.messages.set([]);
      this.after.set(null);
      this.error.set(null);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  private take(step: AssistantStep): void {
    this.messages.update((m) => [...m, ...step.messages]);
    this.status.set(step.status);
  }

  private async runAll(calls: AssistantToolCall[]): Promise<ToolReport[]> {
    const results: ToolReport[] = [];
    for (const call of calls) {
      if (this.stopRequested) {
        results.push({ id: call.id, ok: false, text: 'Stopped by the person.' });
        continue;
      }
      this.activity.set(ACTIVITY[call.name] ?? 'Working…');
      results.push({ id: call.id, ...(await runTool({ store: this.store, api: this.api, checked: () => wait(CHECK_WAIT) }, call.name, call.input)) });
    }
    return results;
  }

  private async refreshStatus(): Promise<void> {
    if (!this.designId) return;
    try {
      this.status.set((await firstValueFrom(this.api.assistantChat(this.designId))).status);
    } catch {
      // The error is already on screen.
    }
  }
}

const ACTIVITY: Record<string, string> = {
  get_elements: 'Looking closer…', get_outline: 'Looking at the design…', add_text: 'Adding text…', add_shape: 'Adding a shape…',
  add_picture: 'Placing a picture…', add_photo_slot: 'Adding a photo…', add_button: 'Adding a button…', add_countdown: 'Adding a countdown…', update_element: 'Making changes…',
  delete_elements: 'Removing…', duplicate_elements: 'Copying…', arrange: 'Arranging…', group_elements: 'Grouping…', ungroup: 'Ungrouping…', flatten_group: 'Drawing the group as a picture…',
  set_motion: 'Setting motion…', apply_effect_move: 'Adding an effect…', add_sticker: 'Adding a sticker…', set_theme: 'Changing the theme…',
  set_page: 'Changing the page…', search_art: 'Searching the art library…', add_art: 'Adding art…', check_design: 'Checking…', show: 'Showing you…',
};

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
