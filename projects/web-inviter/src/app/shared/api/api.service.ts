import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { UiToastService } from 'ui/dialog';
import { environment } from '../../../environments/environment';
import { TokenStore } from '../services/token.store';
import {
  AdminLoginResponse,
  ApiEnvelope,
  CampaignImageResult,
  CampaignMeta,
  CampaignSummary,
  CheckoutResponse,
  ContentPayload,
  CreateCampaignResponse,
  DashboardApiResponse,
  DashboardReport,
  DeliverySettings,
  GuestPayload,
  InviterPayload,
  OtpChallenge,
  OtpTokens,
  Paged,
  Pricing,
  RoleDefinition,
  Template,
  TemplateTypeDto,
  TemplateUploadResult,
  UploadResult,
  VenuePayload,
} from '../utils/types/api.types';

/**
 * Central HTTP client. Every endpoint returns the standard
 * `{ success, message, data, errors }` envelope; each method unwraps `.data`
 * and surfaces `message` (+ field errors) via a `ui` toast on failure.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly tokens = inject(TokenStore);
  private readonly toast = inject(UiToastService);
  private readonly base = environment.apiBase;

  /** Unwrap the envelope's `data` and turn any error into a toast + thrown Error. */
  private unwrap<T>(source: Observable<ApiEnvelope<T>>): Observable<T> {
    return source.pipe(
      map((env) => env.data as T),
      catchError((err: HttpErrorResponse) => {
        const env = err.error as ApiEnvelope<unknown> | null;
        const detail = env?.errors?.map((e) => e.message).join(' ');
        const message =
          env?.message ?? detail ?? 'Something went wrong. Please try again.';
        // 401s are auth failures handled elsewhere (admin interceptor clears the session and
        // redirects) — don't also pop a generic error toast for them.
        if (err.status !== 401) {
          this.toast.danger(message);
        }
        return throwError(() => new Error(message));
      }),
    );
  }

  /* Templates */
  listTemplates(category?: string): Observable<Paged<Template>> {
    let params = new HttpParams().set('pageSize', '50');
    if (category) {
      params = params.set('category', category);
    }
    return this.unwrap(
      this.http.get<ApiEnvelope<Paged<Template>>>(`${this.base}/api/templates`, { params }),
    );
  }

  categories(): Observable<string[]> {
    return this.unwrap(
      this.http.get<ApiEnvelope<string[]>>(`${this.base}/api/templates/meta/categories`),
    );
  }

  getTemplate(slug: string): Observable<Template> {
    return this.unwrap(
      this.http.get<ApiEnvelope<Template>>(`${this.base}/api/templates/${slug}`),
    );
  }

  /* Template types (categories) */

  /** Public list — active types only. */
  listTemplateTypes(): Observable<TemplateTypeDto[]> {
    return this.unwrap(
      this.http.get<ApiEnvelope<TemplateTypeDto[]>>(`${this.base}/api/template-types`),
    );
  }

  /** Admin list — includes inactive types. */
  listAdminTemplateTypes(): Observable<TemplateTypeDto[]> {
    return this.unwrap(
      this.http.get<ApiEnvelope<TemplateTypeDto[]>>(`${this.base}/api/admin/template-types`),
    );
  }

  /** Create a new template type (409 on duplicate slug). */
  createTemplateType(name: string): Observable<TemplateTypeDto> {
    return this.unwrap(
      this.http.post<ApiEnvelope<TemplateTypeDto>>(`${this.base}/api/admin/template-types`, {
        name,
      }),
    );
  }

  /** Deactivate a template type. */
  deleteTemplateType(id: string): Observable<unknown> {
    return this.unwrap(
      this.http.delete<ApiEnvelope<unknown>>(`${this.base}/api/admin/template-types/${id}`),
    );
  }

  /* Admin */
  adminLogin(email: string, password: string): Observable<AdminLoginResponse> {
    return this.unwrap(
      this.http.post<ApiEnvelope<AdminLoginResponse>>(`${this.base}/api/admin/login`, {
        email,
        password,
      }),
    );
  }

  /**
   * Upload a raw template package (multipart). Do NOT set Content-Type — the
   * browser adds the correct multipart boundary for the FormData body. The
   * admin interceptor attaches the Bearer token.
   */
  uploadTemplate(form: FormData): Observable<TemplateUploadResult> {
    return this.unwrap(
      this.http.post<ApiEnvelope<TemplateUploadResult>>(
        `${this.base}/api/admin/templates`,
        form,
      ),
    );
  }

  /* Campaigns */
  createCampaign(templateId: string, title: string): Observable<CreateCampaignResponse> {
    return this.unwrap(
      this.http.post<ApiEnvelope<CreateCampaignResponse>>(`${this.base}/api/campaigns`, {
        templateId,
        title,
      }),
    );
  }

  saveContent(campaignId: string, payload: ContentPayload): Observable<unknown> {
    return this.unwrap(
      this.http.put<ApiEnvelope<unknown>>(
        `${this.base}/api/campaigns/${campaignId}/content`,
        payload,
      ),
    );
  }

  /** Full campaign builder summary (roles step reads template blocks + existing roles). */
  getCampaignSummary(campaignId: string): Observable<CampaignSummary> {
    return this.unwrap(
      this.http.get<ApiEnvelope<CampaignSummary>>(
        `${this.base}/api/campaigns/${campaignId}/summary`,
      ),
    );
  }

  /** Set the campaign's guest roles; the server regenerates the personalization rules. */
  setRoles(campaignId: string, roles: RoleDefinition[]): Observable<unknown> {
    return this.unwrap(
      this.http.put<ApiEnvelope<unknown>>(
        `${this.base}/api/campaigns/${campaignId}/roles`,
        { roles },
      ),
    );
  }

  /**
   * Upload an image for a template image slot (multipart). Do NOT set Content-Type —
   * the browser sets the multipart boundary; the campaign-token interceptor attaches the Bearer token.
   * Returns the stored public URL to bind to the slot's `data-src` path.
   */
  uploadCampaignImage(campaignId: string, file: File, slot: string): Observable<CampaignImageResult> {
    const form = new FormData();
    form.append('file', file);
    form.append('slot', slot);
    return this.unwrap(
      this.http.post<ApiEnvelope<CampaignImageResult>>(
        `${this.base}/api/campaigns/${campaignId}/images`,
        form,
      ),
    );
  }

  getPricing(campaignId: string): Observable<Pricing> {
    return this.unwrap(
      this.http.get<ApiEnvelope<Pricing>>(`${this.base}/api/campaigns/${campaignId}/pricing`),
    );
  }

  saveVenue(campaignId: string, payload: VenuePayload): Observable<unknown> {
    return this.unwrap(
      this.http.put<ApiEnvelope<unknown>>(
        `${this.base}/api/campaigns/${campaignId}/venue`,
        payload,
      ),
    );
  }

  saveInviter(campaignId: string, payload: InviterPayload): Observable<unknown> {
    return this.unwrap(
      this.http.put<ApiEnvelope<unknown>>(
        `${this.base}/api/campaigns/${campaignId}/inviter`,
        payload,
      ),
    );
  }

  saveDeliverySettings(campaignId: string, settings: DeliverySettings): Observable<unknown> {
    return this.unwrap(
      this.http.put<ApiEnvelope<unknown>>(
        `${this.base}/api/campaigns/${campaignId}/delivery-settings`,
        { deliverySettingsJson: JSON.stringify(settings) },
      ),
    );
  }

  checkout(campaignId: string): Observable<CheckoutResponse> {
    return this.unwrap(
      this.http.post<ApiEnvelope<CheckoutResponse>>(
        `${this.base}/api/campaigns/${campaignId}/checkout`,
        {},
      ),
    );
  }

  /* Guests */
  uploadGuests(
    campaignId: string,
    file: File,
    defaultCountry: string,
  ): Observable<UploadResult> {
    const form = new FormData();
    form.append('file', file);
    form.append('defaultCountry', defaultCountry);
    return this.unwrap(
      this.http.post<ApiEnvelope<UploadResult>>(
        `${this.base}/api/campaigns/${campaignId}/guests/upload`,
        form,
      ),
    );
  }

  confirmUpload(campaignId: string, uploadId: string): Observable<unknown> {
    return this.unwrap(
      this.http.post<ApiEnvelope<unknown>>(
        `${this.base}/api/campaigns/${campaignId}/guests/confirm-upload`,
        { uploadId },
      ),
    );
  }

  addGuest(campaignId: string, guest: GuestPayload): Observable<unknown> {
    return this.unwrap(
      this.http.post<ApiEnvelope<unknown>>(
        `${this.base}/api/campaigns/${campaignId}/guests`,
        guest,
      ),
    );
  }

  resendGuest(campaignId: string, guestId: string): Observable<unknown> {
    return this.unwrap(
      this.http.post<ApiEnvelope<unknown>>(
        `${this.base}/api/campaigns/${campaignId}/guests/${guestId}/resend`,
        {},
      ),
    );
  }

  cancelCampaign(campaignId: string): Observable<unknown> {
    return this.unwrap(
      this.http.post<ApiEnvelope<unknown>>(
        `${this.base}/api/campaigns/${campaignId}/cancel`,
        {},
      ),
    );
  }

  /* Dashboard (token via query param, not the interceptor). The API returns a nested
     { campaign, report, guests } shape — flatten it to the DashboardReport the UI binds to. */
  dashboard(campaignId: string, token: string): Observable<DashboardReport> {
    const params = new HttpParams().set('token', token);
    return this.unwrap(
      this.http.get<ApiEnvelope<DashboardApiResponse>>(`${this.base}/api/dashboard/${campaignId}`, {
        params,
      }),
    ).pipe(map((r) => this.flattenDashboard(r)));
  }

  private flattenDashboard(r: DashboardApiResponse): DashboardReport {
    const rep = r.report ?? {};
    const cam = r.campaign ?? {};
    const rsvp = rep.rsvp ?? {};
    const total = rep.total ?? 0;
    const going = rsvp.going ?? 0;
    const maybe = rsvp.maybe ?? 0;
    const notGoing = rsvp.notGoing ?? 0;
    return {
      campaignId: cam.id,
      title: cam.title,
      status: cam.status,
      total,
      sent: rep.sent ?? 0,
      failed: rep.failed ?? 0,
      viewed: rep.viewed ?? 0,
      notSent: rep.notSent ?? 0,
      rsvpYes: going,
      rsvpNo: notGoing,
      rsvpPending: Math.max(0, total - going - maybe - notGoing),
      guests: (r.guests ?? []).map((g) => ({
        id: g.id,
        name: g.name,
        email: g.email ?? null,
        phone: g.phoneE164 ?? null,
        status: g.inviteStatus,
        rsvp: g.rsvpStatus ?? null,
        viewedAt: g.viewedAt ?? null,
        deliveryChannel: g.deliveryChannel ?? null,
      })),
    };
  }

  /* "Did you request a template?" — email OTP → list of ready dedicated templates */

  /** Send an email OTP code; returns the challenge to verify against. */
  requestOtp(email: string): Observable<OtpChallenge> {
    return this.unwrap(
      this.http.post<ApiEnvelope<OtpChallenge>>(`${this.base}/api/otp/request`, {
        channel: 'email',
        email,
      }),
    );
  }

  /** Verify an OTP code; returns the requester's access + refresh tokens. */
  verifyOtp(challengeId: string, code: string): Observable<OtpTokens> {
    return this.unwrap(
      this.http.post<ApiEnvelope<OtpTokens>>(`${this.base}/api/otp/verify`, {
        challengeId,
        code,
      }),
    );
  }

  /**
   * Active dedicated templates reserved for the verified email. Empty ⇒ "not ready yet".
   * The OTP access token is passed explicitly (this app has no invitee JWT interceptor).
   */
  myDedicatedTemplates(accessToken: string): Observable<Template[]> {
    const headers = new HttpHeaders({ Authorization: `Bearer ${accessToken}` });
    return this.unwrap(
      this.http.get<ApiEnvelope<Template[]>>(`${this.base}/api/me/dedicated-templates`, {
        headers,
      }),
    );
  }

  /* Convenience: token + meta storage */
  storeToken(campaignId: string, token: string): void {
    this.tokens.set(campaignId, token);
  }

  hasToken(campaignId: string): boolean {
    return !!this.tokens.get(campaignId);
  }

  storeMeta(campaignId: string, meta: CampaignMeta): void {
    this.tokens.setMeta(campaignId, meta);
  }

  getMeta(campaignId: string): CampaignMeta {
    return this.tokens.getMeta(campaignId);
  }
}
