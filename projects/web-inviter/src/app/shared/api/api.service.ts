import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, switchMap, throwError } from 'rxjs';
import { UiToastService } from '@zouriel/ui/dialog';
import { environment } from '../../../environments/environment';
import { TokenStore } from '../services/token.store';
import { parseRoleNames } from '../utils/roles';
import {
  AdminTemplate,
  ApiEnvelope,
  InquiryDetail,
  InquiryPage,
  SubmitInquiryBody,
  UpdateInquiryBody,
  CampaignImageResult,
  CampaignMeta,
  CampaignSummary,
  ContentPayload,
  CreateCampaignResponse,
  DashboardApiResponse,
  DashboardReport,
  DeleteTemplateResult,
  DeliverySettings,
  AdminDesigner,
  AdminPermission,
  AdminRole,
  AdminUser,
  AuditEntry,
  RegisterDesignerBody,
  SuppressionEntry,
  AuthOptions,
  AuthResult,
  CodeSent,
  DeleteTemplateOutcome,
  LinkResult,
  Account,
  BucketAdmission,
  BucketScan,
  EventPhoto,
  EventPhotoBox,
  BucketAccess,
  Celebrant,
  MediaBucket,
  PlanCatalog,
  StorageSummary,
  AdminUserEvent,
  EventPassKind,
  EventVenue,
  StudioClient,
  StudioOverview,
  SubscriptionTier,
  Venue,
  VenueEvent,
  MediaBucketQr,
  MyCampaign,
  MyInvite,
  MyRequest,
  MyTemplatesPage,
  FinalizeResult,
  GuestPayload,
  InviterPayload,
  Paged,
  PagedResult,
  RoleDefinition,
  Template,
  TemplateTypeDto,
  UploadResult,
  VenuePayload,
  RsvpQuestion,
  FeedComment,
  FeedCovers,
  FeedPage,
  FeedPost,
  LikeState,
} from '../utils/types/api.types';
import type {
  DesignAssetUpload, DesignCatalog, DesignDetail, DesignEvent, DesignImportSource, DesignPreview, DesignScene,
  DesignSummary, PublishResult, TemplateReport,
} from '../../pages/designer/model/scene';

/**
 * Central HTTP client. Every endpoint returns the standard
 * `{ success, message, data, errors }` envelope; each method unwraps `.data`
 * and surfaces `message` (+ field errors) via a `ui` toast on failure.
 */
/**
 * The multipart body every photo upload sends. A phone's picker hands back several files at once, so
 * this is always a list — the single-photo case is just a list of one.
 */
/**
 * The name the server asked the file to be saved under, out of a Content-Disposition header.
 * Prefers the RFC 5987 `filename*` form when present, since that is the one that survives non-ASCII —
 * an event called "Raniya's birthday" is exactly the case the plain form mangles.
 */
function fileNameFrom(header: string | null): string | null {
  if (!header) return null;

  const encoded = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(header)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded.trim().replace(/^"|"$/g, ''));
    } catch {
      // A malformed header is not worth failing a download over; fall through to the plain form.
    }
  }

  return /filename="?([^";]+)"?/i.exec(header)?.[1]?.trim() ?? null;
}

/**
 * The human messages in an error body's `errors`, whatever shape it arrived in.
 *
 * <p>Our envelope sends a list of `{ message, field, code }`, but not everything that answers an
 * `/api` request is our envelope: ASP.NET's model validation sends `errors` as an object of field →
 * messages, and a proxy can send anything. Calling `.map` on that object threw inside catchError,
 * which replaced a readable validation message with an unhandled TypeError.</p>
 */
export function errorMessages(errors: unknown): string[] {
  const text = (v: unknown): string[] => {
    if (typeof v === 'string') return v.trim() ? [v] : [];
    if (Array.isArray(v)) return v.flatMap(text);
    if (v && typeof v === 'object' && typeof (v as { message?: unknown }).message === 'string') {
      return text((v as { message: string }).message);
    }
    return [];
  };
  if (Array.isArray(errors)) return errors.flatMap(text);
  // Object form: the first message for each field is enough for a toast.
  if (errors && typeof errors === 'object') {
    return Object.values(errors).flatMap((v) => text(v).slice(0, 1));
  }
  return [];
}

function photoForm(files: File[], poster?: Blob | null): FormData {
  const form = new FormData();

  // A clip and the still that stands for it travel alone. The poster was drawn from THAT video and
  // means nothing next to any other file, so the server refuses a batch carrying one — see
  // PhotosController.AddAsync. The singular `file` field is the same one the camera page posts to.
  if (poster && files.length === 1) {
    form.append('file', files[0], files[0].name);
    form.append('poster', poster, 'poster.jpg');
    return form;
  }

  for (const file of files) form.append('files', file, file.name);
  return form;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly tokens = inject(TokenStore);
  private readonly toast = inject(UiToastService);
  private readonly base = environment.apiBase;

  /** Unwrap the envelope's `data` and turn any error into a toast + thrown Error. */
  private unwrap<T>(source: Observable<ApiEnvelope<T>>): Observable<T> {
    return this.unwrapWith(source, true);
  }

  /**
   * Same, but silent. For decoration a page can live without — failing to load an optional list is
   * not worth a red banner over a form the visitor is in the middle of filling in.
   */
  private unwrapQuiet<T>(source: Observable<ApiEnvelope<T>>): Observable<T> {
    return this.unwrapWith(source, false);
  }

  private unwrapWith<T>(source: Observable<ApiEnvelope<T>>, loud: boolean): Observable<T> {
    return source.pipe(
      // A 204 has no envelope at all, which is success, not a missing field.
      map((env) => (env?.data ?? null) as T),
      catchError((err: HttpErrorResponse) => {
        const env = err.error as ApiEnvelope<unknown> | null;
        const detail = errorMessages(env?.errors).join(' ') || null;
        const message =
          env?.message ?? detail ?? 'Something went wrong. Please try again.';
        // 401s are auth failures handled elsewhere (the session interceptor clears the session and
        // redirects) — don't also pop a generic error toast for them.
        if (loud && err.status !== 401) {
          this.toast.danger(message);
        }
        // The status and any per-field errors ride along, for callers that act on a specific refusal
        // (an autosave conflict, a publish blocked by Check) rather than only showing it.
        return throwError(() => Object.assign(new Error(message), { status: err.status, errors: env?.errors ?? null }));
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

  /** Admin list — includes inactive types; paged + searchable (name/slug). */
  listAdminTemplateTypes(page = 1, search = '', pageSize = 20): Observable<PagedResult<TemplateTypeDto>> {
    let params = new HttpParams().set('page', String(page)).set('pageSize', String(pageSize));
    if (search.trim()) params = params.set('search', search.trim());
    return this.unwrap(
      this.http.get<ApiEnvelope<PagedResult<TemplateTypeDto>>>(
        `${this.base}/api/admin/template-types`,
        { params },
      ),
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

  /* Inquiries (custom invitations) */

  submitInquiry(body: SubmitInquiryBody): Observable<{ id: string }> {
    return this.unwrap(
      this.http.post<ApiEnvelope<{ id: string }>>(`${this.base}/api/inquiries`, body),
    );
  }

  /** Admin queue — unattended first, then oldest. Paged, searchable, and filterable by pipeline status. */
  listInquiries(page = 1, search = '', status = 'all', pageSize = 10): Observable<InquiryPage> {
    let params = new HttpParams().set('page', String(page)).set('pageSize', String(pageSize));
    if (search.trim()) params = params.set('search', search.trim());
    if (status && status !== 'all') params = params.set('status', status);
    return this.unwrap(
      this.http.get<ApiEnvelope<InquiryPage>>(`${this.base}/api/admin/inquiries`, { params }),
    );
  }

  getInquiry(id: string): Observable<InquiryDetail> {
    return this.unwrap(
      this.http.get<ApiEnvelope<InquiryDetail>>(`${this.base}/api/admin/inquiries/${id}`),
    );
  }

  /** Save consultation fields + attended flag. */
  updateInquiry(id: string, body: UpdateInquiryBody): Observable<unknown> {
    return this.unwrap(
      this.http.put<ApiEnvelope<unknown>>(`${this.base}/api/admin/inquiries/${id}`, body),
    );
  }

  /** Admin templates — paged, searchable (name/slug), category filter, status tab (active/inactive/all). */
  listAdminTemplates(
    page = 1,
    search = '',
    category = '',
    status = 'active',
    onlyPublic = false,
    pageSize = 12,
  ): Observable<PagedResult<AdminTemplate>> {
    let params = new HttpParams().set('page', String(page)).set('pageSize', String(pageSize));
    if (search.trim()) params = params.set('search', search.trim());
    if (category) params = params.set('category', category);
    if (status) params = params.set('status', status);
    if (onlyPublic) params = params.set('visibility', 'public');
    return this.unwrap(
      this.http.get<ApiEnvelope<PagedResult<AdminTemplate>>>(`${this.base}/api/admin/templates`, {
        params,
      }),
    );
  }

  /** Delete a template (hard-deletes if unused; deactivates if campaigns still reference it). */
  deleteTemplate(id: string): Observable<DeleteTemplateResult> {
    return this.unwrap(
      this.http.delete<ApiEnvelope<DeleteTemplateResult>>(`${this.base}/api/admin/templates/${id}`),
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

  /**
   * Uploads a cover photo and records it on the campaign. Two calls because they are two different
   * things: the first stores bytes, the second says which stored thing is the cover.
   */
  uploadCover(campaignId: string, file: File): Observable<string> {
    return this.uploadCampaignImages(campaignId, [file], 'cover').pipe(
      map((urls) => urls[0]),
      switchMap((url) => this.setCover(campaignId, url).pipe(map(() => url))),
    );
  }

  /**
   * Renames the campaign — the name the host files it under, not the title inside the invitation.
   * The slug is untouched server-side, so links already sent keep working.
   */
  renameCampaign(campaignId: string, title: string): Observable<unknown> {
    return this.unwrap(
      this.http.put<ApiEnvelope<unknown>>(`${this.base}/api/campaigns/${campaignId}/title`, { title }),
    );
  }

  /** Records (or with null, clears) which image is the campaign's cover. */
  setCover(campaignId: string, url: string | null): Observable<unknown> {
    return this.unwrap(
      this.http.put<ApiEnvelope<unknown>>(`${this.base}/api/campaigns/${campaignId}/cover`, { url }),
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

  /** The same, without a toast: for a page that shows its own error state with a retry. */
  getCampaignSummaryQuiet(campaignId: string): Observable<CampaignSummary> {
    return this.unwrapQuiet(
      this.http.get<ApiEnvelope<CampaignSummary>>(
        `${this.base}/api/campaigns/${campaignId}/summary`,
      ),
    );
  }

  /**
   * Produces this event's public link and returns the address to share.
   *
   * <p><code>allowAnonymous</code> picks which kind: true mints a fresh short code anybody may
   * follow — a NEW one each time, which is the only way anybody has to retire a link they
   * over-shared — while false returns the gated <code>/e/{id}</code>, which asks whoever follows it
   * for a contact on the guest list. Asking for the gated one also drops any anonymous code.</p>
   */
  generateOpenLink(
    campaignId: string,
    allowAnonymous: boolean,
  ): Observable<{ url: string; allowsAnonymous: boolean }> {
    return this.unwrap(
      this.http.put<ApiEnvelope<{ url: string; allowsAnonymous: boolean }>>(
        `${this.base}/api/campaigns/${campaignId}/open-link`,
        { allowAnonymous },
      ),
    );
  }

  /** Turns it off. The link stops working immediately, for people already holding it too. */
  disableOpenLink(campaignId: string): Observable<unknown> {
    return this.unwrap(
      this.http.delete<ApiEnvelope<unknown>>(
        `${this.base}/api/campaigns/${campaignId}/open-link`,
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
   * Uploads one or more photos for a slot and returns their URLs in the order picked. A gallery slot
   * sends several at once; a single slot sends one and gets a one-item list back.
   */
  uploadCampaignImages(campaignId: string, files: File[], slot: string): Observable<string[]> {
    const form = new FormData();
    for (const file of files) form.append('files', file, file.name);
    form.append('slot', slot);
    return this.unwrap(
      this.http.post<ApiEnvelope<CampaignImageResult | CampaignImageResult[]>>(
        `${this.base}/api/campaigns/${campaignId}/images`,
        form,
      ),
    ).pipe(map((res) => (Array.isArray(res) ? res : [res]).map((r) => r.url)));
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

  /** Finalize (no payment): generate the shareable /e/{id} link and email it to guests if chosen. */
  finalizeCampaign(campaignId: string): Observable<FinalizeResult> {
    return this.unwrap(
      this.http.post<ApiEnvelope<FinalizeResult>>(
        `${this.base}/api/campaigns/${campaignId}/finalize`,
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

  /**
   * `dashboardToken` is only needed for a Dashboard page opened purely via the emailed magic link —
   * neither the campaign-token nor the session interceptor has anything cached for that visitor
   * (nothing SHOULD be cached: the dashboard token is a distinct secret from the builder possession
   * token, see TokenStore's doc comment), so this attaches it directly on the one request instead.
   * A signed-in account or a cached possession token still wins if either interceptor already set
   * the header; both interceptors leave an already-present Authorization header alone.
   */
  addGuest(
    campaignId: string,
    guest: GuestPayload,
    dashboardToken?: string,
  ): Observable<{ added: number; guestCount: number; sent: boolean }> {
    return this.unwrap(
      this.http.post<
        ApiEnvelope<{ added: number; guestCount: number; sent: boolean }>
      >(`${this.base}/api/campaigns/${campaignId}/guests`, guest, this.dashboardAuth(dashboardToken)),
    );
  }

  /**
   * Corrects a guest already on the list. Every field is optional and the server merges rather than
   * replaces — an omitted field is left alone, so sending only what changed cannot blank the rest.
   */
  updateGuest(
    campaignId: string,
    guestId: string,
    guest: GuestPayload,
    dashboardToken?: string,
  ): Observable<void> {
    return this.unwrap(
      this.http.put<ApiEnvelope<void>>(
        `${this.base}/api/campaigns/${campaignId}/guests/${guestId}`,
        guest,
        this.dashboardAuth(dashboardToken),
      ),
    );
  }

  resendGuest(
    campaignId: string,
    guestId: string,
    dashboardToken?: string,
  ): Observable<{ sent: boolean }> {
    return this.unwrap(
      this.http.post<ApiEnvelope<{ sent: boolean }>>(
        `${this.base}/api/campaigns/${campaignId}/guests/${guestId}/resend`,
        {},
        this.dashboardAuth(dashboardToken),
      ),
    );
  }

  cancelCampaign(campaignId: string, dashboardToken?: string): Observable<unknown> {
    return this.unwrap(
      this.http.post<ApiEnvelope<unknown>>(
        `${this.base}/api/campaigns/${campaignId}/cancel`,
        {},
        this.dashboardAuth(dashboardToken),
      ),
    );
  }

  private dashboardAuth(dashboardToken?: string): { headers?: HttpHeaders } {
    return dashboardToken
      ? { headers: new HttpHeaders({ Authorization: `Bearer ${dashboardToken}` }) }
      : {};
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
      rsvpMaybe: maybe,
      rsvpNo: notGoing,
      rsvpPending: Math.max(0, total - going - maybe - notGoing),
      guests: (r.guests ?? []).map((g) => ({
        id: g.id,
        name: g.name,
        email: g.email ?? null,
        phone: g.phoneE164 ?? null,
        // The server has always sent this; the table simply threw it away, which left the one field
        // a host is most likely to have got wrong invisible AND uneditable.
        role: g.role ?? null,
        roles: g.roles?.length ? g.roles : g.role ? [g.role] : [],
        status: g.inviteStatus,
        rsvp: g.rsvpStatus ?? null,
        viewedAt: g.viewedAt ?? null,
        deliveryChannel: g.deliveryChannel ?? null,
        rsvpAnswers: g.rsvpAnswers ?? null,
      })),
      rsvpQuestions: r.rsvpQuestions ?? [],
      roles: parseRoleNames(cam.rolesJson),
      coverImageUrl: cam.coverImageUrl ?? null,
      templatePreviewImageUrl: cam.templatePreviewImageUrl ?? null,
      // Defaulted true so an older server, which does not send this, keeps behaving exactly as it
      // did — every campaign it knows about has an invitation.
      hasInvitation: cam.hasInvitation ?? true,
      openLink: cam.openLink ?? null,
      isImported: cam.isImported ?? false,
      isDraft: cam.isDraft ?? false,
      resumeStep: cam.resumeStep ?? null,
      viewer: cam.viewer ?? 'organiser',
      sending: r.sending ?? null,
    };
  }

  /* Templates reserved for the signed-in account — the "My requests" tab */

  /**
   * Active dedicated templates reserved for this account's email. Empty ⇒ nothing reserved (yet).
   * The account's own session identifies them: their token carries the verified contact, so there
   * is no second OTP round to claim what was made for them.
   */
  myDedicatedTemplates(): Observable<Template[]> {
    return this.unwrap(
      this.http.get<ApiEnvelope<Template[]>>(`${this.base}/api/me/dedicated-templates`),
    );
  }

  /**
   * Templates the caller published themselves, private ones included. The gallery lists only public
   * templates, so this is the only way somebody's own design reaches the event picker.
   */
  myOwnTemplates(): Observable<Template[]> {
    return this.unwrap(this.http.get<ApiEnvelope<Template[]>>(`${this.base}/api/me/templates`));
  }

  /* Admin: designers */

  listDesigners(page = 1, search = '', pageSize = 20): Observable<PagedResult<AdminDesigner>> {
    let params = new HttpParams().set('page', String(page)).set('pageSize', String(pageSize));
    if (search.trim()) params = params.set('search', search.trim());
    return this.unwrap(
      this.http.get<ApiEnvelope<PagedResult<AdminDesigner>>>(`${this.base}/api/admin/designers`, {
        params,
      }),
    );
  }

  /** Suspending blocks sign-ins; published templates deliberately stay live. */
  setDesignerSuspended(id: string, suspended: boolean): Observable<AdminDesigner> {
    return this.unwrap(
      this.http.post<ApiEnvelope<AdminDesigner>>(
        `${this.base}/api/admin/designers/${id}/suspend?suspended=${suspended}`,
        {},
      ),
    );
  }

  /* One sign-in for everyone — roles decide what they can reach afterwards */

  authOptions(): Observable<AuthOptions> {
    return this.unwrap(this.http.get<ApiEnvelope<AuthOptions>>(`${this.base}/api/auth/options`));
  }

  signInWithPassword(email: string, password: string): Observable<AuthResult> {
    return this.unwrap(
      this.http.post<ApiEnvelope<AuthResult>>(`${this.base}/api/auth/login`, { email, password }),
    );
  }


  /**
   * Step one of creating a customer account: send a code to the address being claimed.
   *
   * <p>The code is not a formality. Once an account exists, invitations are matched to it by its
   * email address alone — which is what lets somebody invited before they signed up find their post
   * waiting — so an address nobody proved would hand its owner's invitations to whoever typed it.</p>
   */
  startSignUp(identifier: string, defaultCountry = 'MV'): Observable<CodeSent> {
    return this.unwrap(
      this.http.post<ApiEnvelope<CodeSent>>(`${this.base}/api/auth/signup/start`, {
        identifier,
        defaultCountry,
      }),
    );
  }

  /** Step two: the code proves the address, the password is what they sign in with afterwards. */
  completeSignUp(
    challengeId: string,
    code: string,
    password: string,
    displayName?: string,
  ): Observable<AuthResult> {
    return this.unwrap(
      this.http.post<ApiEnvelope<AuthResult>>(`${this.base}/api/auth/signup`, {
        challengeId,
        code,
        password,
        displayName,
      }),
    );
  }

  /** Adds a second identifier to the signed-in account; merges another account if one exists for it. */
  requestLinkCode(identifier: string, defaultCountry = 'MV'): Observable<CodeSent> {
    return this.unwrap(
      this.http.post<ApiEnvelope<CodeSent>>(`${this.base}/api/auth/link/request`, {
        identifier,
        defaultCountry,
      }),
    );
  }

  verifyLinkCode(challengeId: string, code: string): Observable<LinkResult> {
    return this.unwrap(
      this.http.post<ApiEnvelope<LinkResult>>(`${this.base}/api/auth/link/verify`, {
        challengeId,
        code,
      }),
    );
  }

  myCampaigns(): Observable<MyCampaign[]> {
    return this.unwrap(this.http.get<ApiEnvelope<MyCampaign[]>>(`${this.base}/api/me/campaigns`));
  }

  /**
   * Permanently deletes a campaign and everything hanging off it — guests, invitations, delivery
   * attempts, RSVPs, uploads. The server re-checks ownership and writes an audit entry; there is no
   * recycle bin, so callers must confirm first.
   */
  deleteCampaign(id: string): Observable<{ deleted: boolean }> {
    return this.unwrap(
      this.http.delete<ApiEnvelope<{ deleted: boolean }>>(`${this.base}/api/campaigns/${id}`),
    );
  }

  /* Sign-up and OAuth */

  /** Creates a designer account. */
  registerDesigner(body: RegisterDesignerBody): Observable<AuthResult> {
    return this.unwrap(
      this.http.post<ApiEnvelope<AuthResult>>(`${this.base}/api/auth/register/designer`, body),
    );
  }

  /** Adds the creator role to the account already signed in, and returns a token that carries it. */
  becomeDesigner(): Observable<AuthResult> {
    return this.unwrap(
      this.http.post<ApiEnvelope<AuthResult>>(`${this.base}/api/auth/me/become-designer`, {}),
    );
  }

  /** Exchanges a provider ID token for a session. The server verifies it before trusting anything. */
  oauthLogin(provider: string, idToken: string): Observable<AuthResult> {
    return this.unwrap(
      this.http.post<ApiEnvelope<AuthResult>>(`${this.base}/api/auth/oauth/${provider}`, { idToken }),
    );
  }

  /* Admin settings: users, roles, permissions, audit, suppression */

  adminUsers(page = 1, search = '', pageSize = 20, plan = ''): Observable<PagedResult<AdminUser>> {
    let params = new HttpParams()
      .set('page', page)
      .set('pageSize', pageSize)
      .set('search', search);
    if (plan) params = params.set('plan', plan);
    return this.unwrap(
      this.http.get<ApiEnvelope<PagedResult<AdminUser>>>(`${this.base}/api/admin/users`, { params }),
    );
  }

  /**
   * Grant or take away one role on one account.
   *
   * <p>PUT, and it states what should be true afterwards rather than what to do — a toggle that
   * fires twice settles on the same answer instead of half-applying.</p>
   */
  adminSetUserRole(userId: string, role: string, granted: boolean): Observable<AdminUser> {
    return this.unwrap(
      this.http.put<ApiEnvelope<AdminUser>>(`${this.base}/api/admin/users/${userId}/roles`, {
        role,
        granted,
      }),
    );
  }

  /** Sets an account's Studio or Venue plan. None ends it now; an empty end date means it doesn't end. */
  adminSetSubscription(userId: string, tier: SubscriptionTier, endsAt: string | null): Observable<AdminUser> {
    return this.unwrap(
      this.http.put<ApiEnvelope<AdminUser>>(`${this.base}/api/admin/users/${userId}/subscription`, {
        tier,
        endsAt,
      }),
    );
  }

  /** The events an account organised, with their passes. */
  adminUserEvents(userId: string): Observable<AdminUserEvent[]> {
    return this.unwrap(
      this.http.get<ApiEnvelope<AdminUserEvent[]>>(`${this.base}/api/admin/users/${userId}/events`),
    );
  }

  /** Gives an event a Party or Wedding pass, or takes it away with None. The same pass again adds a year. */
  adminSetEventPass(campaignId: string, kind: EventPassKind): Observable<AdminUserEvent> {
    return this.unwrap(
      this.http.put<ApiEnvelope<AdminUserEvent>>(`${this.base}/api/admin/events/${campaignId}/pass`, { kind }),
    );
  }

  /** "Keep your photos" for this many more years; 0 takes it away. */
  adminKeepPhotos(campaignId: string, years: number): Observable<AdminUserEvent> {
    return this.unwrap(
      this.http.put<ApiEnvelope<AdminUserEvent>>(`${this.base}/api/admin/events/${campaignId}/keep-photos`, { years }),
    );
  }

  /** Adds emailed invitations to an event on top of what its pass includes. */
  adminAddSending(campaignId: string, invitations: number): Observable<AdminUserEvent> {
    return this.unwrap(
      this.http.put<ApiEnvelope<AdminUserEvent>>(`${this.base}/api/admin/events/${campaignId}/sending`, { invitations }),
    );
  }

  /** Adds passes to a Studio account's stock (positive) or takes unused ones away (negative). */
  adminAdjustPassCredits(userId: string, kind: 'Party' | 'Wedding', count: number): Observable<AdminUser> {
    return this.unwrap(
      this.http.post<ApiEnvelope<AdminUser>>(`${this.base}/api/admin/users/${userId}/pass-credits`, { kind, count }),
    );
  }

  /* Studio: a designer's or planner's clients and passes */

  studio(): Observable<StudioOverview> {
    return this.unwrap(this.http.get<ApiEnvelope<StudioOverview>>(`${this.base}/api/studio`));
  }

  /** Gives one of the Studio's passes to a client's event. */
  studioGivePass(campaignId: string, kind: 'Party' | 'Wedding'): Observable<StudioClient> {
    return this.unwrap(
      this.http.post<ApiEnvelope<StudioClient>>(`${this.base}/api/studio/clients/${campaignId}/pass`, { kind }),
    );
  }

  /* Venue: a resort or hall, its staff and its events */

  venue(): Observable<Venue> {
    return this.unwrap(this.http.get<ApiEnvelope<Venue>>(`${this.base}/api/venue`));
  }

  updateVenue(name: string, place: string | null): Observable<Venue> {
    return this.unwrap(this.http.put<ApiEnvelope<Venue>>(`${this.base}/api/venue`, { name, place }));
  }

  setVenueLogo(file: File): Observable<Venue> {
    const form = new FormData();
    form.append('file', file);
    return this.unwrap(this.http.post<ApiEnvelope<Venue>>(`${this.base}/api/venue/logo`, form));
  }

  removeVenueLogo(): Observable<Venue> {
    return this.unwrap(this.http.delete<ApiEnvelope<Venue>>(`${this.base}/api/venue/logo`));
  }

  addVenueStaff(email: string, name: string | null): Observable<Venue> {
    return this.unwrap(this.http.post<ApiEnvelope<Venue>>(`${this.base}/api/venue/staff`, { email, name }));
  }

  removeVenueStaff(staffId: string): Observable<Venue> {
    return this.unwrap(this.http.delete<ApiEnvelope<Venue>>(`${this.base}/api/venue/staff/${staffId}`));
  }

  /** The venue a host's event is held at, or null. */
  eventVenue(campaignId: string): Observable<EventVenue | null> {
    return this.unwrapQuiet(this.http.get<ApiEnvelope<EventVenue | null>>(`${this.base}/api/campaigns/${campaignId}/venue-link`));
  }

  /** Holds the host's event at a venue, by the code the venue gave them. */
  linkEventVenue(campaignId: string, code: string): Observable<EventVenue> {
    return this.unwrap(this.http.put<ApiEnvelope<EventVenue>>(`${this.base}/api/campaigns/${campaignId}/venue-link`, { code }));
  }

  unlinkEventVenue(campaignId: string): Observable<unknown> {
    return this.unwrap(this.http.delete<ApiEnvelope<unknown>>(`${this.base}/api/campaigns/${campaignId}/venue-link`));
  }

  /** A new event at the venue, with its first album. */
  createVenueEvent(title: string, eventDate: string): Observable<VenueEvent> {
    return this.unwrap(this.http.post<ApiEnvelope<VenueEvent>>(`${this.base}/api/venue/events`, { title, eventDate }));
  }

  adminRoles(): Observable<AdminRole[]> {
    return this.unwrap(this.http.get<ApiEnvelope<AdminRole[]>>(`${this.base}/api/admin/roles`));
  }

  adminPermissions(): Observable<AdminPermission[]> {
    return this.unwrap(
      this.http.get<ApiEnvelope<AdminPermission[]>>(`${this.base}/api/admin/permissions`),
    );
  }

  adminAudit(page = 1, action = '', pageSize = 25): Observable<PagedResult<AuditEntry>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (action) params = params.set('action', action);
    return this.unwrap(
      this.http.get<ApiEnvelope<PagedResult<AuditEntry>>>(`${this.base}/api/admin/audit`, { params }),
    );
  }

  adminSuppression(page = 1, contactType = '', pageSize = 25): Observable<PagedResult<SuppressionEntry>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (contactType) params = params.set('contactType', contactType);
    return this.unwrap(
      this.http.get<ApiEnvelope<PagedResult<SuppressionEntry>>>(
        `${this.base}/api/admin/suppression`,
        { params },
      ),
    );
  }

  myRequests(): Observable<MyRequest[]> {
    return this.unwrap(this.http.get<ApiEnvelope<MyRequest[]>>(`${this.base}/api/me/requests`));
  }

  /**
   * Records the account's light/dark preference. On the account rather than in the browser, so it
   * follows the person to whatever they next sign in on.
   */
  /**
   * A fresh token for the account already signed in, carrying whatever roles it holds now.
   *
   * <p>Permissions are claims INSIDE the token, so a role an admin grants reaches nobody until one
   * is re-issued. Refreshing only the cached account would be worse than doing nothing — the
   * navigation would appear and every call behind it would be refused.</p>
   */
  refreshSession(): Observable<{ token: string; account: Account }> {
    return this.unwrap(
      this.http.post<ApiEnvelope<{ token: string; account: Account }>>(
        `${this.base}/api/auth/me/refresh`,
        {},
      ),
    );
  }

  setTheme(theme: 'light' | 'dark'): Observable<Account> {
    return this.unwrap(
      this.http.put<ApiEnvelope<Account>>(`${this.base}/api/auth/me/theme`, { theme }),
    );
  }

  /** Invitations sent TO this person, across every identifier on their account. */
  myInvites(): Observable<MyInvite[]> {
    return this.unwrap(this.http.get<ApiEnvelope<MyInvite[]>>(`${this.base}/api/me/invites`));
  }

  /* Event photo box (§5) — what guests shot at the event.
   *
   * Two routes, because there are two kinds of caller and they are authorised differently: the HOST
   * proves ownership of the campaign, a GUEST is matched to their row on its guest list. The server
   * decides which applies; the app just calls the one that matches who the person is on this screen.
   */

  /** The box on the host's own dashboard. */
  campaignPhotos(campaignId: string): Observable<EventPhotoBox> {
    return this.unwrap(
      this.http.get<ApiEnvelope<EventPhotoBox>>(`${this.base}/api/campaigns/${campaignId}/photos`),
    );
  }

  addCampaignPhotos(
    campaignId: string,
    files: File[],
    poster?: Blob | null,
  ): Observable<EventPhoto[]> {
    return this.unwrap(
      this.http.post<ApiEnvelope<EventPhoto[]>>(
        `${this.base}/api/campaigns/${campaignId}/photos`,
        photoForm(files, poster),
      ),
    );
  }

  removeCampaignPhoto(campaignId: string, photoId: string): Observable<unknown> {
    return this.unwrap(
      this.http.delete<ApiEnvelope<unknown>>(
        `${this.base}/api/campaigns/${campaignId}/photos/${photoId}`,
      ),
    );
  }

  /** The same box, seen from a received invitation — authorised as a guest of the event. */
  invitationPhotos(campaignId: string): Observable<EventPhotoBox> {
    return this.unwrap(
      this.http.get<ApiEnvelope<EventPhotoBox>>(
        `${this.base}/api/me/invitations/${campaignId}/photos`,
      ),
    );
  }

  addInvitationPhotos(
    campaignId: string,
    files: File[],
    poster?: Blob | null,
  ): Observable<EventPhoto[]> {
    return this.unwrap(
      this.http.post<ApiEnvelope<EventPhoto[]>>(
        `${this.base}/api/me/invitations/${campaignId}/photos`,
        photoForm(files, poster),
      ),
    );
  }

  removeInvitationPhoto(campaignId: string, photoId: string): Observable<unknown> {
    return this.unwrap(
      this.http.delete<ApiEnvelope<unknown>>(
        `${this.base}/api/me/invitations/${campaignId}/photos/${photoId}`,
      ),
    );
  }

  /**
   * The event's photos as a zip of the originals — all of them, or just the ids given.
   *
   * <p>Fetched as a blob rather than pointed at with a link, because the archive is built behind the
   * session and a plain navigation would arrive without it. The response also carries the filename
   * the server chose, so it comes back whole rather than as bytes the caller has to name.</p>
   */
  downloadEventPhotos(
    campaignId: string,
    as: 'host' | 'guest',
    ids: string[] = [],
  ): Observable<{ blob: Blob; fileName: string }> {
    const url =
      as === 'host'
        ? `${this.base}/api/campaigns/${campaignId}/photos/download`
        : `${this.base}/api/me/invitations/${campaignId}/photos/download`;

    // Repeated `ids` rather than one joined value: it is what [FromQuery] Guid[] binds natively.
    let params = new HttpParams();
    for (const id of ids) params = params.append('ids', id);

    return this.http
      .get(url, { params, responseType: 'blob', observe: 'response' })
      .pipe(
        map((response) => ({
          blob: response.body ?? new Blob(),
          fileName: fileNameFrom(response.headers.get('content-disposition')) ?? 'event-photos.zip',
        })),
      );
  }

  /** One received invitation, rendered — authorised by the account, no invitation link needed. */
  /**
   * Where to send the browser to read an invitation. The invitation itself is rendered by the server
   * on its own host; this returns a one-hop link that admits the caller there.
   */
  invitationRenderLink(campaignId: string): Observable<{ url: string }> {
    return this.unwrap(
      this.http.get<ApiEnvelope<{ url: string }>>(
        `${this.base}/api/me/invitations/${campaignId}/render-link`,
      ),
    );
  }

  /** What this campaign's RSVP form asks. */
  rsvpQuestions(campaignId: string): Observable<RsvpQuestion[]> {
    return this.unwrap(
      this.http.get<ApiEnvelope<{ questions: RsvpQuestion[] }>>(
        `${this.base}/api/campaigns/${campaignId}/rsvp-questions`,
      ),
    ).pipe(map((r) => r.questions ?? []));
  }

  /** Replaces the question set; the server answers with the tidied version it stored. */
  saveRsvpQuestions(campaignId: string, questions: RsvpQuestion[]): Observable<RsvpQuestion[]> {
    return this.unwrap(
      this.http.put<ApiEnvelope<{ questions: RsvpQuestion[] }>>(
        `${this.base}/api/campaigns/${campaignId}/rsvp-questions`,
        { questions },
      ),
    ).pipe(map((r) => r.questions ?? []));
  }

  /** The dashboard for a campaign this account booked — the Sent tab's way in, no magic link. */
  myDashboard(campaignId: string): Observable<DashboardReport> {
    return this.unwrap(
      this.http.get<ApiEnvelope<DashboardApiResponse>>(
        `${this.base}/api/me/campaigns/${campaignId}/dashboard`,
      ),
    ).pipe(map((r) => this.flattenDashboard(r)));
  }

  /* Template designer */

  designCatalog(): Observable<DesignCatalog> {
    return this.unwrap(this.http.get<ApiEnvelope<DesignCatalog>>(`${this.base}/api/designs/catalog`));
  }

  myDesigns(): Observable<DesignSummary[]> {
    return this.unwrap(this.http.get<ApiEnvelope<DesignSummary[]>>(`${this.base}/api/designs`));
  }

  getDesign(id: string): Observable<DesignDetail> {
    return this.unwrap(this.http.get<ApiEnvelope<DesignDetail>>(`${this.base}/api/designs/${id}`));
  }

  createDesign(body: {
    name?: string | null; starter?: string | null; fromTemplateId?: string | null; scene?: DesignScene | null; campaignId?: string | null;
  }): Observable<DesignDetail> {
    return this.unwrap(this.http.post<ApiEnvelope<DesignDetail>>(`${this.base}/api/designs`, body));
  }

  /** Autosave. Quiet: the editor shows its own save state, and a 409 is handled there, not toasted. */
  saveDesign(id: string, scene: DesignScene, name: string, baseRevision: number): Observable<{ revision: number; updatedAt: string }> {
    return this.unwrapQuiet(
      this.http.put<ApiEnvelope<{ revision: number; updatedAt: string }>>(`${this.base}/api/designs/${id}`, { scene, name, baseRevision }),
    );
  }

  deleteDesign(id: string): Observable<unknown> {
    return this.unwrap(this.http.delete<ApiEnvelope<unknown>>(`${this.base}/api/designs/${id}`));
  }

  duplicateDesign(id: string): Observable<DesignDetail> {
    return this.unwrap(this.http.post<ApiEnvelope<DesignDetail>>(`${this.base}/api/designs/${id}/duplicate`, {}));
  }

  /** Quiet: the preview is refreshed constantly and shows its own failure state. */
  previewDesign(body: {
    scene: DesignScene; sample: string; blocks?: string[] | null; hidden?: string[] | null; scroll?: number; editor?: boolean;
  }): Observable<DesignPreview> {
    return this.unwrapQuiet(this.http.post<ApiEnvelope<DesignPreview>>(`${this.base}/api/designs/preview`, body));
  }

  checkDesign(id: string): Observable<DesignPreview> {
    return this.unwrap(this.http.get<ApiEnvelope<DesignPreview>>(`${this.base}/api/designs/${id}/check`));
  }

  uploadDesignAsset(file: File): Observable<DesignAssetUpload> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.unwrap(this.http.post<ApiEnvelope<DesignAssetUpload>>(`${this.base}/api/designs/assets`, form));
  }

  designImportSource(templateId: string): Observable<DesignImportSource> {
    return this.unwrap(this.http.get<ApiEnvelope<DesignImportSource>>(`${this.base}/api/designs/import/${templateId}`));
  }

  publishDesign(id: string, body: {
    visibility: 'Private' | 'Public' | 'Person'; name: string; category: string; description: string; campaignId?: string | null;
    revision: number; poster?: Blob | null; assignedEmail?: string | null;
  }): Observable<PublishResult> {
    const form = new FormData();
    form.append('visibility', body.visibility);
    form.append('name', body.name);
    form.append('category', body.category);
    form.append('description', body.description);
    form.append('revision', String(body.revision));
    if (body.campaignId) form.append('campaignId', body.campaignId);
    if (body.assignedEmail) form.append('assignedEmail', body.assignedEmail);
    if (body.poster) form.append('poster', body.poster, body.poster.type === 'image/png' ? 'poster.png' : 'poster.webp');
    return this.unwrap(this.http.post<ApiEnvelope<PublishResult>>(`${this.base}/api/designs/${id}/publish`, form));
  }

  setDesignVisibility(id: string, visibility: 'Private' | 'Public'): Observable<DesignDetail> {
    return this.unwrap(this.http.put<ApiEnvelope<DesignDetail>>(`${this.base}/api/designs/${id}/visibility`, { visibility }));
  }

  designEvents(id: string): Observable<DesignEvent[]> {
    return this.unwrap(this.http.get<ApiEnvelope<DesignEvent[]>>(`${this.base}/api/designs/${id}/events`));
  }

  upgradeDesignEvent(id: string, campaignId: string): Observable<DesignEvent> {
    return this.unwrap(this.http.post<ApiEnvelope<DesignEvent>>(`${this.base}/api/designs/${id}/events/${campaignId}/upgrade`, {}));
  }

  reportTemplate(templateId: string, reason: string, details: string): Observable<unknown> {
    return this.unwrap(this.http.post<ApiEnvelope<unknown>>(`${this.base}/api/templates/${templateId}/reports`, { reason, details }));
  }

  templateReports(status: 'open' | 'resolved' | 'all' = 'open'): Observable<TemplateReport[]> {
    return this.unwrap(this.http.get<ApiEnvelope<TemplateReport[]>>(`${this.base}/api/admin/template-reports`, { params: { status } }));
  }

  resolveTemplateReport(reportId: string, action: 'dismiss' | 'unlist' | 'remove', note: string): Observable<TemplateReport> {
    return this.unwrap(this.http.post<ApiEnvelope<TemplateReport>>(`${this.base}/api/admin/template-reports/${reportId}/resolve`, { action, note }));
  }

  /** Takes a gallery template out of the gallery: private to its creator until an admin puts it back. */
  unpublishTemplate(templateId: string): Observable<unknown> {
    return this.unwrap(this.http.post<ApiEnvelope<unknown>>(`${this.base}/api/admin/templates/${templateId}/unpublish`, {}));
  }

  republishTemplate(templateId: string): Observable<unknown> {
    return this.unwrap(this.http.post<ApiEnvelope<unknown>>(`${this.base}/api/admin/templates/${templateId}/republish`, {}));
  }

  relistTemplate(templateId: string): Observable<unknown> {
    return this.unwrap(this.http.post<ApiEnvelope<unknown>>(`${this.base}/api/admin/templates/${templateId}/relist`, {}));
  }

  restorePublicPublishing(userId: string): Observable<unknown> {
    return this.unwrap(this.http.post<ApiEnvelope<unknown>>(`${this.base}/api/admin/users/${userId}/public-publishing`, {}));
  }

  myTemplates(): Observable<MyTemplatesPage> {
    return this.unwrap(this.http.get<ApiEnvelope<MyTemplatesPage>>(`${this.base}/api/my-templates`));
  }

  deleteMyTemplate(id: string): Observable<DeleteTemplateOutcome> {
    return this.unwrap(
      this.http.delete<ApiEnvelope<DeleteTemplateOutcome>>(`${this.base}/api/my-templates/${id}`),
    );
  }

  /* Convenience: token + meta storage */
  storeToken(campaignId: string, token: string): void {
    this.tokens.set(campaignId, token);
  }

  /** The stored possession token, if this browser has opened the campaign's link before. */
  getToken(campaignId: string): string | null {
    return this.tokens.get(campaignId);
  }


  /* Bring your own design — the customer supplies the artwork, we supply the evening. */

  /**
   * Starts a campaign from an uploaded design. Anonymous, like ordinary campaign creation: the
   * response carries the possession token that makes the caller its owner from here on.
   */
  createFromOwnDesign(
    title: string,
    file: File,
  ): Observable<{
    campaign: { campaignId: string; status: string; accessToken: string };
    design: { templateId: string; packageUrl: string; previewUrl: string | null; kind: string };
  }> {
    const form = new FormData();
    form.append('title', title);
    form.append('file', file, file.name);
    return this.unwrap(this.http.post<ApiEnvelope<any>>(`${this.base}/api/campaigns/bring-your-own`, form));
  }

  /* Media buckets (§5) — the owner's side. */

  /** A bucket's contents. By bucket, not by campaign — a standalone one has no campaign. */
  mediaBucketMedia(bucketId: string): Observable<EventPhotoBox> {
    return this.unwrap(
      this.http.get<ApiEnvelope<EventPhotoBox>>(
        `${this.base}/api/media-buckets/${bucketId}/media`,
      ),
    );
  }

  addMediaBucketMedia(
    bucketId: string,
    files: File[],
    poster?: Blob | null,
  ): Observable<EventPhoto[]> {
    return this.unwrap(
      this.http.post<ApiEnvelope<EventPhoto[]>>(
        `${this.base}/api/media-buckets/${bucketId}/media`,
        photoForm(files, poster),
      ),
    );
  }

  removeMediaBucketMedia(bucketId: string, photoId: string): Observable<unknown> {
    return this.unwrap(
      this.http.delete<ApiEnvelope<unknown>>(
        `${this.base}/api/media-buckets/${bucketId}/media/${photoId}`,
      ),
    );
  }


  /**
   * An event's own bucket, created on the spot if the event predates buckets. How a host reaches
   * their size, contribution codes and viewer list.
   */
  campaignBucket(campaignId: string): Observable<MediaBucket | null> {
    return this.unwrap(
      this.http.get<ApiEnvelope<MediaBucket | null>>(
        `${this.base}/api/campaigns/${campaignId}/bucket`,
      ),
    );
  }

  /**
   * Starts an event with nothing attached yet — no invitation, no bucket. What it has is chosen
   * next, and either can be added later.
   */
  createEvent(title: string, eventDate: string): Observable<{ campaignId: string; accessToken: string }> {
    return this.unwrap(
      this.http.post<ApiEnvelope<{ campaignId: string; accessToken: string }>>(
        `${this.base}/api/campaigns/bare`,
        { title, eventDate },
      ),
    );
  }

  /**
   * The same thing for a design the customer brought: gives an event that has no invitation one,
   * from their own artwork rather than the gallery.
   */
  importDesign(
    campaignId: string,
    file: File,
  ): Observable<{ templateId: string; packageUrl: string; previewUrl: string | null; kind: string }> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.unwrap(
      this.http.post<ApiEnvelope<{
        templateId: string;
        packageUrl: string;
        previewUrl: string | null;
        kind: string;
      }>>(`${this.base}/api/campaigns/${campaignId}/design`, form),
    );
  }

  /** Gives an event that has no invitation one, by pinning a design onto it. */
  attachTemplate(campaignId: string, templateId: string): Observable<unknown> {
    return this.unwrap(
      this.http.put<ApiEnvelope<unknown>>(`${this.base}/api/campaigns/${campaignId}/template`, {
        templateId,
      }),
    );
  }

  /** Gives this event a bucket. Reading the dashboard deliberately does not. */
  createCampaignBucket(campaignId: string): Observable<MediaBucket> {
    return this.unwrap(
      this.http.post<ApiEnvelope<MediaBucket>>(
        `${this.base}/api/campaigns/${campaignId}/bucket`,
        {},
      ),
    );
  }

  mediaBucket(bucketId: string): Observable<MediaBucket> {
    return this.unwrap(
      this.http.get<ApiEnvelope<MediaBucket>>(`${this.base}/api/media-buckets/${bucketId}`),
    );
  }

  /* Feed */

  /** Every event this account is part of, newest news first. */
  feed(skip = 0, take = 10): Observable<FeedPage> {
    const params = new HttpParams().set('skip', skip).set('take', take);
    return this.unwrap(this.http.get<ApiEnvelope<FeedPage>>(`${this.base}/api/me/feed`, { params }));
  }

  feedComments(campaignId: string): Observable<FeedComment[]> {
    return this.unwrap(this.http.get<ApiEnvelope<FeedComment[]>>(`${this.base}/api/me/feed/${campaignId}/comments`));
  }

  addFeedComment(campaignId: string, body: string, parentId: string | null = null): Observable<FeedComment> {
    return this.unwrap(
      this.http.post<ApiEnvelope<FeedComment>>(`${this.base}/api/me/feed/${campaignId}/comments`, { body, parentId }),
    );
  }

  deleteFeedComment(campaignId: string, commentId: string): Observable<unknown> {
    return this.unwrap(
      this.http.delete<ApiEnvelope<unknown>>(`${this.base}/api/me/feed/${campaignId}/comments/${commentId}`),
    );
  }

  likeFeedPost(campaignId: string, liked: boolean): Observable<LikeState> {
    return this.unwrap(this.http.put<ApiEnvelope<LikeState>>(`${this.base}/api/me/feed/${campaignId}/like`, { liked }));
  }

  likeFeedComment(campaignId: string, commentId: string, liked: boolean): Observable<LikeState> {
    return this.unwrap(
      this.http.put<ApiEnvelope<LikeState>>(`${this.base}/api/me/feed/${campaignId}/comments/${commentId}/like`, { liked }),
    );
  }

  /** The photos chosen to head an event's post. */
  feedCovers(campaignId: string): Observable<FeedCovers> {
    return this.unwrap(this.http.get<ApiEnvelope<FeedCovers>>(`${this.base}/api/me/feed/${campaignId}/covers`));
  }

  setFeedCovers(campaignId: string, photoIds: string[]): Observable<FeedCovers> {
    return this.unwrap(
      this.http.put<ApiEnvelope<FeedCovers>>(`${this.base}/api/me/feed/${campaignId}/covers`, { photoIds }),
    );
  }

  /** An empty caption goes back to the invitation's own words. */
  setFeedCaption(campaignId: string, caption: string | null): Observable<FeedPost> {
    return this.unwrap(this.http.put<ApiEnvelope<FeedPost>>(`${this.base}/api/me/feed/${campaignId}/caption`, { caption }));
  }

  /** The space a venue's events share, for its owner and staff. */
  myStorage(): Observable<StorageSummary> {
    return this.unwrapQuiet(this.http.get<ApiEnvelope<StorageSummary>>(`${this.base}/api/me/storage`));
  }

  /** How many days a bucket collects for, within what its event's plan allows. */
  setBucketWindow(bucketId: string, days: number): Observable<MediaBucket> {
    return this.unwrap(
      this.http.put<ApiEnvelope<MediaBucket>>(`${this.base}/api/media-buckets/${bucketId}/window`, { days }),
    );
  }

  /** The plans and prices. Public, and read by the pricing page while it is prerendered. */
  plans(): Observable<PlanCatalog> {
    return this.unwrapQuiet(this.http.get<ApiEnvelope<PlanCatalog>>(`${this.base}/api/plans`));
  }

  createMediaBucket(body: {
    title: string;
    campaignId?: string | null;
    /** The night it is for. Required for a standalone bucket; a campaign's own date wins otherwise. */
    eventDate?: string | null;
    /**
     * How many days it collects for. Omitted or 1 is the ordinary night; more needs a pass
     * and is capped server-side, so this is a request rather than an instruction.
     */
    windowDays?: number | null;
    /** What to call the bucket itself. Blank is the default name. */
    name?: string | null;
  }): Observable<MediaBucket> {
    return this.unwrap(
      this.http.post<ApiEnvelope<MediaBucket>>(`${this.base}/api/media-buckets`, body),
    );
  }


  mediaBucketQrs(bucketId: string): Observable<MediaBucketQr[]> {
    return this.unwrap(
      this.http.get<ApiEnvelope<MediaBucketQr[]>>(`${this.base}/api/media-buckets/${bucketId}/qr`),
    );
  }

  /** The response is the only place the scannable link ever appears — see MediaBucketQr. */
  /** Renames a bucket. Refused without a pass; blank restores the default name. */
  renameMediaBucket(bucketId: string, name: string): Observable<MediaBucket> {
    return this.unwrap(
      this.http.put<ApiEnvelope<MediaBucket>>(
        `${this.base}/api/media-buckets/${bucketId}/name`,
        { name },
      ),
    );
  }

  /** Every guest on the bucket's event, with whether they may look into it. */
  bucketAccess(bucketId: string): Observable<BucketAccess> {
    return this.unwrap(
      this.http.get<ApiEnvelope<BucketAccess>>(`${this.base}/api/media-buckets/${bucketId}/access`),
    );
  }

  /** Lets some guests into a bucket, or shuts them out. Returns the whole list as it now stands. */
  setBucketAccess(bucketId: string, guestIds: string[], allowed: boolean): Observable<BucketAccess> {
    return this.unwrap(
      this.http.put<ApiEnvelope<BucketAccess>>(`${this.base}/api/media-buckets/${bucketId}/access`, {
        guestIds,
        allowed,
      }),
    );
  }

  /* Celebrants — the people an event is for. Every call returns the list as it now stands. */

  celebrants(campaignId: string): Observable<Celebrant[]> {
    return this.unwrap(
      this.http.get<ApiEnvelope<Celebrant[]>>(`${this.base}/api/campaigns/${campaignId}/celebrants`),
    );
  }

  addCelebrant(
    campaignId: string,
    body: { name: string; email?: string | null; phone?: string | null; notify: boolean },
  ): Observable<Celebrant[]> {
    return this.unwrap(
      this.http.post<ApiEnvelope<Celebrant[]>>(
        `${this.base}/api/campaigns/${campaignId}/celebrants`,
        body,
      ),
    );
  }

  removeCelebrant(campaignId: string, celebrantId: string): Observable<Celebrant[]> {
    return this.unwrap(
      this.http.delete<ApiEnvelope<Celebrant[]>>(
        `${this.base}/api/campaigns/${campaignId}/celebrants/${celebrantId}`,
      ),
    );
  }

  /** Full access or read-only. Only the organiser may change it. */
  setCelebrantAccess(
    campaignId: string,
    celebrantId: string,
    canManage: boolean,
  ): Observable<Celebrant[]> {
    return this.unwrap(
      this.http.put<ApiEnvelope<Celebrant[]>>(
        `${this.base}/api/campaigns/${campaignId}/celebrants/${celebrantId}/access`,
        { canManage },
      ),
    );
  }

  notifyCelebrant(campaignId: string, celebrantId: string): Observable<Celebrant[]> {
    return this.unwrap(
      this.http.post<ApiEnvelope<Celebrant[]>>(
        `${this.base}/api/campaigns/${campaignId}/celebrants/${celebrantId}/notify`,
        {},
      ),
    );
  }

  /** The buckets on an event that the CALLER may look into — a guest's own view. */
  visibleBuckets(campaignId: string): Observable<MediaBucket[]> {
    return this.unwrap(
      this.http.get<ApiEnvelope<MediaBucket[]>>(`${this.base}/api/campaigns/${campaignId}/buckets`),
    );
  }

  createMediaBucketQr(
    bucketId: string,
    body: { label?: string | null; allowAnonymous: boolean },
  ): Observable<MediaBucketQr> {
    return this.unwrap(
      this.http.post<ApiEnvelope<MediaBucketQr>>(
        `${this.base}/api/media-buckets/${bucketId}/qr`,
        body,
      ),
    );
  }

  revokeMediaBucketQr(bucketId: string, qrId: string): Observable<unknown> {
    return this.unwrap(
      this.http.delete<ApiEnvelope<unknown>>(
        `${this.base}/api/media-buckets/${bucketId}/qr/${qrId}`,
      ),
    );
  }

  /* The contributor's side. Anonymous by design — a printed token is the whole authorization. */

  scanBucketCode(token: string): Observable<BucketScan> {
    return this.unwrap(
      this.http.get<ApiEnvelope<BucketScan>>(`${this.base}/api/q/${token}`),
    );
  }

  /**
   * Whether this browser is still admitted to this code. What makes coming back from the camera
   * free — the page holds its ticket in memory and a full-page navigation loses it.
   */
  bucketSession(
    token: string,
  ): Observable<{ admitted: boolean; ticket: string | null; displayName: string | null }> {
    return this.unwrap(
      this.http.get<ApiEnvelope<{ admitted: boolean; ticket: string | null; displayName: string | null }>>(
        `${this.base}/api/q/${token}/session`,
        // The admission lives in an HttpOnly cookie, which a cross-origin call drops unless it is
        // asked for. Same origin in production; this is what makes the dev server behave too.
        { withCredentials: true },
      ),
    );
  }

  /** The anonymous door: a name, and nothing to prove. */
  joinBucket(token: string, displayName: string): Observable<BucketAdmission> {
    return this.unwrap(
      this.http.post<ApiEnvelope<BucketAdmission>>(
        `${this.base}/api/q/${token}/join`,
        { displayName },
        // Admission comes back twice: in the body for this page, and in an HttpOnly cookie for the
        // camera page, which is a separate document holding nothing this one could hand it.
        { withCredentials: true },
      ),
    );
  }

  requestBucketCode(
    token: string,
    body: { channel: string; email?: string | null; phone?: string | null },
  ): Observable<{ challengeId: string; expiresInSeconds: number }> {
    return this.unwrap(
      this.http.post<ApiEnvelope<{ challengeId: string; expiresInSeconds: number }>>(
        `${this.base}/api/q/${token}/otp/request`,
        body,
      ),
    );
  }

  verifyBucketCode(
    token: string,
    body: { challengeId: string; code: string; displayName?: string | null },
  ): Observable<BucketAdmission> {
    return this.unwrap(
      this.http.post<ApiEnvelope<BucketAdmission>>(
        `${this.base}/api/q/${token}/otp/verify`,
        body,
        { withCredentials: true },   // the camera's admission cookie — see joinBucket
      ),
    );
  }

  /**
   * Adds one item as a contributor. One request per item, each carrying its own still when it is a
   * clip — the same contract the picker and the camera use.
   */
  contributeToBucket(
    token: string,
    ticket: string,
    file: File,
    poster?: Blob | null,
  ): Observable<{ id: string; thumbUrl: string }> {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('ticket', ticket);
    if (poster) form.append('poster', poster, 'poster.jpg');
    return this.unwrap(
      this.http.post<ApiEnvelope<{ id: string; thumbUrl: string }>>(
        `${this.base}/api/q/${token}/media`,
        form,
      ),
    );
  }

  storeMeta(campaignId: string, meta: CampaignMeta): void {
    this.tokens.setMeta(campaignId, meta);
  }

  getMeta(campaignId: string): CampaignMeta {
    return this.tokens.getMeta(campaignId);
  }
}
