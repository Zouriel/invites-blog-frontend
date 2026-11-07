import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { ApiService } from '../../../shared/api/api.service';

/**
 * A design assistant step can take minutes, so the server starts its 200 answer early (spaces keep
 * the connection alive) and can then only report a failure in the body. The app must read that as an
 * error, not as an empty step.
 */
describe('designer assistant API', () => {
  const setup = () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    return { api: TestBed.inject(ApiService), http: TestBed.inject(HttpTestingController) };
  };
  const body = { text: 'hi', outline: '', vocabulary: { moves: [], stickers: [] } };

  it('a failure told in a 200 body becomes an error with its message', async () => {
    const { api, http } = setup();
    const pending = firstValueFrom(api.assistantSend('d1', body));
    const req = http.expectOne((r) => r.url.endsWith('/api/designs/d1/assistant/messages'));
    req.flush({ success: false, message: "You've used this month's AI allowance.", data: null, errors: null });
    await expect(pending).rejects.toThrow("You've used this month's AI allowance.");
  });

  it('a normal answer comes through as the step', async () => {
    const { api, http } = setup();
    const pending = firstValueFrom(api.assistantResults('d1', { results: [], vocabulary: body.vocabulary }));
    const req = http.expectOne((r) => r.url.endsWith('/api/designs/d1/assistant/results'));
    req.flush({ success: true, message: null, data: { messages: [], toolCalls: [], done: true, status: null }, errors: null });
    expect((await pending).done).toBe(true);
  });
});
