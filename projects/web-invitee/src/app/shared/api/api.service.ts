import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { UiToastService } from 'ui/dialog';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TokenStore } from '../services/token-store.service';
import { ApiError } from '../utils/types/api-error';
import {
  ApiEnvelope,
  CampaignOtpResult,
  ClaimResult,
  InboxCard,
  InviteByToken,
  MyInvite,
  OtpRequestBody,
  OtpRequestResult,
  OtpVerifyBody,
  OtpVerifyResult,
  PrivacyRemoveInfo,
  PrivacyRemoveResult,
  RsvpBody,
  RsvpResult,
} from '../utils/types/api.types';

/**
 * Single typed gateway to the invites.blog API. Every method unwraps the
 * response envelope (`{success,message,data,errors}`) to the inner `data`,
 * surfaces failures via a toast, and rethrows a normalised {@link ApiError}.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private tokens = inject(TokenStore);
  private toasts = inject(UiToastService);
  private router = inject(Router);
  private base = environment.apiBase;

  // --- OTP ---
  requestOtp(body: OtpRequestBody): Observable<OtpRequestResult> {
    return this.unwrap(
      this.http.post<ApiEnvelope<OtpRequestResult>>(`${this.base}/api/otp/request`, body),
    );
  }

  verifyOtp(body: OtpVerifyBody): Observable<OtpVerifyResult> {
    return this.unwrap(
      this.http.post<ApiEnvelope<OtpVerifyResult>>(`${this.base}/api/otp/verify`, body),
    );
  }

  /**
   * Guest-list-gated OTP for the shared campaign link (/e/{id}): the backend only emails a code if the
   * address is on that campaign's guest list, so an uninvited email is told "not invited" — no wasted send.
   */
  requestCampaignOtp(campaignId: string, email: string): Observable<CampaignOtpResult> {
    return this.unwrap(
      this.http.post<ApiEnvelope<CampaignOtpResult>>(
        `${this.base}/api/campaigns/${campaignId}/request-otp`,
        { email },
      ),
    );
  }

  // --- Inbox (jwt required; interceptor attaches header) ---
  getMyInvites(): Observable<InboxCard[]> {
    return this.unwrap(this.http.get<ApiEnvelope<InboxCard[]>>(`${this.base}/api/me/invites`));
  }

  /** Shared campaign link (/e/{id}): the OTP-verified caller's personalized invite (jwt attached). */
  getMyInvite(campaignId: string): Observable<MyInvite> {
    return this.unwrap(
      this.http.get<ApiEnvelope<MyInvite>>(`${this.base}/api/campaigns/${campaignId}/my-invite`),
    );
  }

  /** Per-guest tokenized link (/i/{token}): opens the invite directly — the token is the key, no OTP. */
  getInviteByToken(token: string): Observable<InviteByToken> {
    return this.unwrap(
      this.http.get<ApiEnvelope<InviteByToken>>(
        `${this.base}/api/invites/by-token/${encodeURIComponent(token)}`,
      ),
    );
  }

  // Authenticated RSVP from the inbox (JWT attached; server checks ownership by verified contact).
  rsvpByInviteId(inviteId: string, body: RsvpBody): Observable<RsvpResult> {
    return this.unwrap(
      this.http.post<ApiEnvelope<RsvpResult>>(`${this.base}/api/invites/${inviteId}/rsvp`, body),
    );
  }

  // Claim is authorized by possession of the raw invite token (not the invite id).
  claimInvite(token: string): Observable<ClaimResult> {
    return this.unwrap(
      this.http.post<ApiEnvelope<ClaimResult>>(`${this.base}/api/invites/by-token/${token}/claim`, {}),
    );
  }

  rsvpByToken(token: string, body: RsvpBody): Observable<RsvpResult> {
    return this.unwrap(
      this.http.post<ApiEnvelope<RsvpResult>>(
        `${this.base}/api/invites/by-token/${encodeURIComponent(token)}/rsvp`,
        body,
      ),
    );
  }

  // --- Privacy self-service (public) ---
  getPrivacyRemoveInfo(token: string): Observable<PrivacyRemoveInfo> {
    return this.unwrap(
      this.http.get<ApiEnvelope<PrivacyRemoveInfo>>(
        `${this.base}/api/privacy/remove/${encodeURIComponent(token)}`,
      ),
    );
  }

  privacyRemove(token: string): Observable<PrivacyRemoveResult> {
    return this.unwrap(
      this.http.post<ApiEnvelope<PrivacyRemoveResult>>(
        `${this.base}/api/privacy/remove/${encodeURIComponent(token)}`,
        {},
      ),
    );
  }

  /** Maps an envelope to its inner `data`, surfacing/normalising any failure. */
  private unwrap<T>(source$: Observable<ApiEnvelope<T>>): Observable<T> {
    return source$.pipe(
      map((env) => {
        if (env && env.success === false) {
          throw this.fromEnvelope(env, 0);
        }
        return (env?.data ?? null) as T;
      }),
      catchError((err: unknown) => {
        const url = err instanceof HttpErrorResponse ? (err.url ?? '') : '';
        const apiError = this.normalise(err);
        this.handle(apiError, url);
        return throwError(() => apiError);
      }),
    );
  }

  private normalise(err: unknown): ApiError {
    if (err instanceof ApiError) {
      return err;
    }
    if (err instanceof HttpErrorResponse) {
      const env = err.error as ApiEnvelope<unknown> | null;
      if (env && typeof env === 'object' && 'success' in env) {
        return this.fromEnvelope(env, err.status);
      }
      return new ApiError(err.message || 'Something went wrong.', err.status);
    }
    return new ApiError('Something went wrong.', 0);
  }

  private fromEnvelope(env: ApiEnvelope<unknown>, status: number): ApiError {
    const message =
      env.message ?? env.errors?.[0]?.message ?? 'Something went wrong. Please try again.';
    return new ApiError(message, status, env.errors ?? []);
  }

  private handle(error: ApiError, url: string): void {
    // A missing/expired/invalid session on a private endpoint (401 or 403) is handled by re-verifying,
    // so don't surface a scary "403 / Http failure" toast for it.
    const authFailure =
      (error.status === 401 || error.status === 403) && this.isAuthenticatedEndpoint(url);
    if (!authFailure) {
      this.toasts.danger(error.message);
    }

    // Only an EXPIRED/INVALID session on an authenticated endpoint should end the
    // session. A 403 is an authorization (permission) response — not an expired
    // token — and a failure on a public endpoint must never wipe a valid login.
    // This keeps a refresh of the inbox with a valid JWT logged in.
    if (error.status !== 401 || !this.isAuthenticatedEndpoint(url)) {
      return;
    }

    this.tokens.clearToken();
    if (!this.isOnPublicRoute()) {
      this.router.navigate(['/login'], { queryParams: { returnTo: '/inbox' } });
    }
  }

  /** Mirrors the jwt interceptor: `/api/me/...`, claim, and authenticated (inbox) RSVP carry the JWT. */
  private isAuthenticatedEndpoint(url: string): boolean {
    return (
      url.includes('/api/me/') ||
      /\/api\/invites\/by-token\/[^/]+\/claim$/.test(url) ||
      /\/api\/invites\/[^/]+\/rsvp$/.test(url) ||
      /\/api\/campaigns\/[^/]+\/my-invite$/.test(url)
    );
  }

  /** The inbox is the only auth-gated route; anywhere else we must not bounce. */
  private isOnPublicRoute(): boolean {
    const path = this.router.url.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
    return path !== '/inbox';
  }
}
