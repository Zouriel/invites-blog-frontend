import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { UiToastService } from 'ui/dialog';
import { environment } from '../../../environments/environment';
import { TokenStore } from '../services/token.store';
import {
  ApiEnvelope,
  CampaignMeta,
  CheckoutResponse,
  ContentPayload,
  CreateCampaignResponse,
  DashboardReport,
  DeliverySettings,
  GuestPayload,
  InviterPayload,
  Paged,
  Pricing,
  Template,
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
        this.toast.danger(message);
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

  /* Dashboard (token via query param, not the interceptor) */
  dashboard(campaignId: string, token: string): Observable<DashboardReport> {
    const params = new HttpParams().set('token', token);
    return this.unwrap(
      this.http.get<ApiEnvelope<DashboardReport>>(`${this.base}/api/dashboard/${campaignId}`, {
        params,
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
