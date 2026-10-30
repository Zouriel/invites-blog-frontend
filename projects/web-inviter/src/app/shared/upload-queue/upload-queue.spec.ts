import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { DirectUploadStatus, EventPhoto } from '../utils/types/api.types';
import { PutFile, UploadDoor, UploadQueue } from './upload-queue';

const file = (name: string): File => new File(['x'], name, { type: 'image/jpeg' });
const photo = (id: string): EventPhoto => ({ id, url: `/assets/${id}` }) as EventPhoto;

/** A door where every file goes direct and lands at once, with hooks for each way it can go wrong. */
function door(over: Partial<UploadDoor> = {}): UploadDoor {
  return {
    link: (f) => of({ direct: true, id: f.name, url: `https://r2/${f.name}`, contentType: f.type }),
    legacy: () => of([photo('legacy')]),
    complete: (id) => of({ id, status: 'processing' } as DirectUploadStatus),
    status: (ids) =>
      of(ids.map((id) => ({ id, status: 'done', photo: photo(id) }) as DirectUploadStatus)),
    ...over,
  };
}

const netFail = (): Error => Object.assign(new Error('offline'), { status: 0 });
const refusal = (): Error => Object.assign(new Error('This album is full.'), { status: 400 });

describe('UploadQueue', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 50 }));
  afterEach(() => vi.useRealTimers());

  const run = async (q: UploadQueue, files: File[]): Promise<void> => {
    const done = q.send(files);
    await vi.runAllTimersAsync();
    await done;
  };

  it('sends everything and reports each photo as it lands', async () => {
    const added: (EventPhoto | null)[] = [];
    const put = vi.fn<PutFile>().mockResolvedValue();
    const q = new UploadQueue(door(), { added: (p) => added.push(p) }, put, 1);

    await run(q, [file('a'), file('b'), file('c'), file('d'), file('e')]);

    expect(put).toHaveBeenCalledTimes(5);
    expect(q.sent()).toBe(5);
    expect(q.percent()).toBe(100);
    expect(added.map((p) => p?.id).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(q.busy()).toBe(false);
  });

  it('never has more than three in flight', async () => {
    let now = 0;
    let most = 0;
    const put: PutFile = async () => {
      most = Math.max(most, ++now);
      await new Promise((r) => setTimeout(r, 5));
      now--;
    };
    const q = new UploadQueue(door(), {}, put, 1);

    await run(q, Array.from({ length: 12 }, (_, i) => file(`p${i}`)));

    expect(most).toBe(3);
    expect(q.sent()).toBe(12);
  });

  it('one bad connection does not cost the others, and the file is kept to retry', async () => {
    const put: PutFile = async (url) => {
      if (url.endsWith('/bad')) throw netFail();
    };
    const q = new UploadQueue(door({ legacy: () => throwError(netFail) }), {}, put, 1);

    await run(q, [file('a'), file('bad'), file('c')]);

    expect(q.sent()).toBe(2);
    expect(q.failed().map((f) => f.name)).toEqual(['bad']);
  });

  it('retries a dropped upload on the same link, so space is held only once', async () => {
    let tries = 0;
    const link = vi.fn(door().link);
    const put: PutFile = async () => {
      if (++tries < 3) throw netFail();
    };
    const q = new UploadQueue(door({ link }), {}, put, 1);

    await run(q, [file('a')]);

    expect(tries).toBe(3);
    expect(link).toHaveBeenCalledTimes(1);
    expect(q.sent()).toBe(1);
    expect(q.failed()).toEqual([]);
  });

  it('asks for a new link once storage has refused the old one', async () => {
    const realPut = vi.fn<PutFile>().mockResolvedValue();
    const xhr = vi.fn();
    const link = vi.fn(door().link);
    let first = true;
    const put: PutFile = async (u, f, t) => {
      if (first) {
        first = false;
        const { LinkSpentForTest } = await import('./upload-queue');
        throw new LinkSpentForTest('Storage answered 403');
      }
      xhr();
      return realPut(u, f, t);
    };
    const q = new UploadQueue(door({ link }), {}, put, 1);

    await run(q, [file('a')]);

    expect(link).toHaveBeenCalledTimes(2);
    expect(xhr).toHaveBeenCalledTimes(1);
  });

  it('does not send the bytes again when only saying so failed', async () => {
    const put = vi.fn<PutFile>().mockResolvedValue();
    let calls = 0;
    const complete: UploadDoor['complete'] = (id) =>
      ++calls === 1 ? throwError(netFail) : of({ id, status: 'processing' } as DirectUploadStatus);
    const q = new UploadQueue(door({ complete }), {}, put, 1);

    await run(q, [file('a')]);

    expect(put).toHaveBeenCalledTimes(1);
    expect(calls).toBe(2);
  });

  it('a browser that can never reach storage still gets through on the old route', async () => {
    const added: (EventPhoto | null)[] = [];
    const legacy = vi.fn(door().legacy);
    const put: PutFile = async () => {
      throw netFail();
    };
    const q = new UploadQueue(door({ legacy }), { added: (p) => added.push(p) }, put, 1);

    await run(q, [file('a')]);

    expect(legacy).toHaveBeenCalledTimes(1);
    expect(added).toHaveLength(1);
    expect(q.sent()).toBe(1);
    expect(q.failed()).toEqual([]);
  });

  it('retry sends only what failed', async () => {
    let down = true;
    const put = vi.fn<PutFile>(async (url) => {
      if (down && url.endsWith('/bad')) throw netFail();
    });
    const q = new UploadQueue(door({ legacy: () => throwError(netFail) }), {}, put, 1);
    await run(q, [file('good'), file('bad')]);
    down = false;
    put.mockClear();

    const again = q.retryFailed();
    await vi.runAllTimersAsync();
    await again;

    expect(put.mock.calls.map((c) => c[0])).toEqual(['https://r2/bad']);
    expect(q.failed()).toEqual([]);
    expect(q.total()).toBe(1);
    expect(q.sent()).toBe(1);
  });

  it('a refusal is said once and not retried', async () => {
    const refused: string[] = [];
    const link = vi.fn(() => throwError(refusal));
    const q = new UploadQueue(door({ link }), { refused: (m) => refused.push(m) }, vi.fn(), 1);

    await run(q, [file('a')]);

    expect(link).toHaveBeenCalledTimes(1);
    expect(refused).toEqual(['This album is full.']);
    expect(q.failed()).toEqual([]);
  });

  it('a rate limit is waited out, not treated as a refusal', async () => {
    let calls = 0;
    const base = door().link;
    const link: UploadDoor['link'] = (f) =>
      ++calls === 1 ? throwError(() => Object.assign(new Error('busy'), { status: 429 })) : base(f);
    const q = new UploadQueue(door({ link }), {}, vi.fn().mockResolvedValue(undefined), 1);

    await run(q, [file('a')]);

    expect(q.sent()).toBe(1);
  });

  it('falls back to the old route when told to, with no upload to storage', async () => {
    const added: (EventPhoto | null)[] = [];
    const put = vi.fn<PutFile>();
    const legacy = vi.fn(door().legacy);
    const q = new UploadQueue(
      door({ link: () => of({ direct: false }), legacy }),
      { added: (p) => added.push(p) },
      put,
      1,
    );

    await run(q, [file('a')]);

    expect(put).not.toHaveBeenCalled();
    expect(legacy).toHaveBeenCalledTimes(1);
    expect(added.map((p) => p?.id)).toEqual(['legacy']);
  });

  it('reports a file the server refuses after it arrived', async () => {
    const refused: string[] = [];
    const q = new UploadQueue(
      door({
        status: (ids) =>
          of(ids.map((id) => ({ id, status: 'failed', error: 'Not a photo.' }) as DirectUploadStatus)),
      }),
      { refused: (m) => refused.push(m) },
      vi.fn().mockResolvedValue(undefined),
      1,
    );

    await run(q, [file('a')]);

    expect(refused).toEqual(['Not a photo.']);
    expect(q.finishing()).toBe(0);
  });

  it('keeps watching through a failed status check', async () => {
    const added: (EventPhoto | null)[] = [];
    let calls = 0;
    const q = new UploadQueue(
      door({
        status: (ids) =>
          ++calls === 1
            ? throwError(netFail)
            : of(ids.map((id) => ({ id, status: 'done', photo: photo(id) }) as DirectUploadStatus)),
      }),
      { added: (p) => added.push(p) },
      vi.fn().mockResolvedValue(undefined),
      1,
    );

    await run(q, [file('a')]);

    expect(added).toHaveLength(1);
  });
});
