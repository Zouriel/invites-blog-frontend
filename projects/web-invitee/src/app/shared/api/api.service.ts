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
  ClaimResult,
  InboxCard,
  InviteByToken,
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

  // --- Inbox (jwt required; interceptor attaches header) ---
  getMyInvites(): Observable<InboxCard[]> {
    return this.unwrap(this.http.get<ApiEnvelope<InboxCard[]>>(`${this.base}/api/me/invites`));
  }

  claimInvite(inviteId: string): Observable<ClaimResult> {
    return this.unwrap(
      this.http.post<ApiEnvelope<ClaimResult>>(`${this.base}/api/invites/${inviteId}/claim`, {}),
    );
  }

  // --- The link is the key: public token endpoints (no auth header) ---
  getInviteByToken(token: string): Observable<InviteByToken> {
    return this.unwrap(
      this.http.get<ApiEnvelope<InviteByToken>>(
        `${this.base}/api/invites/by-token/${encodeURIComponent(token)}`,
      ),
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
        const apiError = this.normalise(err);
        this.handle(apiError);
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

  private handle(error: ApiError): void {
    this.toasts.danger(error.message);
    if (error.status === 401 || error.status === 403) {
      this.tokens.clearToken();
      this.router.navigate(['/login'], { queryParams: { returnTo: '/inbox' } });
    }
  }
}
