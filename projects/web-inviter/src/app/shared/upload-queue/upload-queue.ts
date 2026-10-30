import { computed, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';

import { DirectUploadStatus, DirectUploadTicket, EventPhoto } from '../utils/types/api.types';

/** One way in to an album. Each page supplies its own routes; the queue doesn't care which. */
export interface UploadDoor {
  /** Asks to send this file straight to storage. `direct: false` means use {@link legacy}. */
  link(file: File): Observable<DirectUploadTicket>;
  /** The old route, for what can't go direct: the switch is off, or this file is unusual. */
  legacy(file: File): Observable<EventPhoto | EventPhoto[] | { id: string } | null>;
  complete(id: string): Observable<DirectUploadStatus>;
  status(ids: string[]): Observable<DirectUploadStatus[]>;
}

/** Sends the bytes. Swapped out in tests; see {@link putFile}. */
export type PutFile = (url: string, file: File, contentType: string) => Promise<void>;

const WORKERS = 3;
/** About a minute of retries, which is what it takes to come out of a lift or a dead spot. */
const TRIES = 6;
const MAX_BACKOFF_STEPS = 30;
const STALL_MS = 60_000;
const POLL_MS = 2_000;
/** How long a page keeps watching. The server finishes regardless of whether anyone waits. */
const POLL_LIMIT_MS = 5 * 60_000;
const STATUS_BATCH = 50;

/** A failed send worth trying again, as opposed to an answer that won't change. */
class Transient extends Error {}

/** Storage answered and said no, so the link itself is spent (most likely it ran out of time). */
class LinkSpent extends Transient {}

/** For a test's fake {@link PutFile}. */
export const LinkSpentForTest = LinkSpent;

/**
 * A plain request rather than HttpClient: this goes to storage, not the API, so it must not pick up
 * sessions or tokens from the interceptors. Gives up on a connection that has stopped moving rather
 * than on one that is merely slow.
 */
export const putFile: PutFile = (url, file, contentType) =>
  new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let stall: ReturnType<typeof setTimeout>;
    const watch = (): void => {
      clearTimeout(stall);
      stall = setTimeout(() => xhr.abort(), STALL_MS);
    };
    xhr.upload.onprogress = watch;
    xhr.onload = () => {
      clearTimeout(stall);
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new LinkSpent(`Storage answered ${xhr.status}`));
    };
    const failed = (): void => {
      clearTimeout(stall);
      reject(new Transient('The connection dropped'));
    };
    xhr.onerror = failed;
    xhr.onabort = failed;
    xhr.ontimeout = failed;
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);
    watch();
    xhr.send(file);
  });

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** A 4xx from us is an answer. A dropped connection, a busy server or a rate limit isn't. */
const isRefusal = (e: unknown): boolean => {
  const status = (e as { status?: number } | null)?.status;
  return !!status && status >= 400 && status < 500 && status !== 408 && status !== 429;
};

/**
 * Sends many photos to an album without tying them together: each goes on its own, a few at a time,
 * retries by itself, and can't take the others down with it. Once a photo is in storage the server
 * finishes the job, so the wait a guest actually sits through is only the sending.
 */
export class UploadQueue {
  readonly total = signal(0);
  readonly sent = signal(0);
  /** Waiting on the server, which carries on whether or not this page stays open. */
  readonly finishing = signal(0);
  readonly sending = signal(false);
  /** Files that didn't get through, kept so one tap can try them again. */
  readonly failed = signal<File[]>([]);

  readonly busy = computed(() => this.sending() || this.finishing() > 0);
  /** Share of this batch that has been sent, for a progress bar. */
  readonly percent = computed(() =>
    this.total() ? Math.round((this.sent() / this.total()) * 100) : 0,
  );

  private readonly leaveGuard = (e: BeforeUnloadEvent): void => {
    if (this.sending()) e.preventDefault();
  };

  constructor(
    private readonly door: UploadDoor,
    private readonly handlers: {
      /** A photo that has landed, as soon as it has. */
      added?: (photo: EventPhoto | null) => void;
      /** The server refused a file, with its reason. */
      refused?: (message: string) => void;
    } = {},
    private readonly put: PutFile = putFile,
    private readonly backoffMs = 1000,
  ) {}

  retryFailed(): Promise<void> {
    const again = this.failed();
    this.failed.set([]);
    return this.send(again);
  }

  async send(files: File[]): Promise<void> {
    if (!files.length) return;
    this.total.update((n) => (this.sending() ? n + files.length : files.length));
    if (!this.sending()) this.sent.set(0);
    this.sending.set(true);

    const lock = await this.keepAwake();
    if (typeof window !== 'undefined') window.addEventListener('beforeunload', this.leaveGuard);

    const queue = [...files];
    const waiting: string[] = [];
    const worker = async (): Promise<void> => {
      for (let file = queue.shift(); file; file = queue.shift()) {
        try {
          const id = await this.sendWithRetries(file);
          if (id) waiting.push(id);
          this.sent.update((n) => n + 1);
        } catch (e) {
          if (isRefusal(e)) this.handlers.refused?.((e as Error).message);
          else this.failed.update((list) => [...list, file]);
        }
      }
    };
    await Promise.all(Array.from({ length: WORKERS }, worker));

    this.sending.set(false);
    if (typeof window !== 'undefined') window.removeEventListener('beforeunload', this.leaveGuard);
    lock?.release().catch(() => undefined);

    await this.watch(waiting);
  }

  /** Best effort: a locked phone can stop an upload, and not every browser lets us ask. */
  private async keepAwake(): Promise<WakeLockSentinel | null> {
    try {
      return await navigator.wakeLock.request('screen');
    } catch {
      return null;
    }
  }

  /** The id to watch, or null if the old route finished it there and then. */
  private async sendWithRetries(file: File): Promise<string | null> {
    // Kept across attempts: a new link for every retry would hold the file's space again each time,
    // and a batch on a bad connection could fill a nearly full album with space it isn't using.
    let ticket: DirectUploadTicket | null = null;
    let uploaded = false;

    for (let attempt = 1; ; attempt++) {
      try {
        // The last go takes the old route, so a browser that can't reach storage at all (a policy,
        // a proxy, a quirk we haven't met) still gets its photos through.
        if (attempt === TRIES && !uploaded) return await this.sendLegacy(file);

        ticket ??= await firstValueFrom(this.door.link(file));
        if (!ticket.direct || !ticket.id || !ticket.url) return await this.sendLegacy(file);

        if (!uploaded) {
          await this.put(ticket.url, file, ticket.contentType ?? file.type);
          uploaded = true;
        }

        const done = await firstValueFrom(this.door.complete(ticket.id));
        if (done.status === 'failed') {
          throw Object.assign(new Error(done.error ?? 'That photo could not be added.'), { status: 400 });
        }
        return ticket.id;
      } catch (e) {
        if (isRefusal(e) || attempt >= TRIES) throw e;
        if (e instanceof LinkSpent) ticket = null;
        await wait(this.backoffMs * Math.min(2 ** attempt, MAX_BACKOFF_STEPS));
      }
    }
  }

  private async sendLegacy(file: File): Promise<null> {
    const landed = await firstValueFrom(this.door.legacy(file));
    const photo = Array.isArray(landed) ? (landed[0] ?? null) : landed;
    this.handlers.added?.(photo && 'url' in photo ? (photo as EventPhoto) : null);
    return null;
  }

  private async watch(ids: string[]): Promise<void> {
    let open = ids;
    this.finishing.update((n) => n + open.length);
    const deadline = Date.now() + POLL_LIMIT_MS;
    while (open.length && Date.now() < deadline) {
      await wait(POLL_MS);
      let rows: DirectUploadStatus[];
      try {
        rows = await firstValueFrom(this.door.status(open.slice(0, STATUS_BATCH)));
      } catch {
        continue;
      }
      for (const row of rows) {
        if (row.status === 'processing' || row.status === 'issued') continue;
        open = open.filter((id) => id !== row.id);
        this.finishing.update((n) => n - 1);
        if (row.status === 'done') this.handlers.added?.(row.photo ?? null);
        else this.handlers.refused?.(row.error ?? 'That photo could not be added.');
      }
    }
    // Still going when the page stopped watching: stop showing it, not stop it.
    this.finishing.update((n) => n - open.length);
  }
}
