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
  InquiryIssued,
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
  DesignerCommission,
  DesignerEarnings,
  DesignerTemplate,
  LinkResult,
  Account,
  EventPhoto,
  EventPhotoBox,
  MyCampaign,
  MyInvite,
  MyRequest,
  MyTemplatesPage,
  MyTemplateRow,
  PublicDesigner,
  TemplateRelease,
  TemplateScanResult,
  TemplateSubmission,
  FinalizeResult,
  GuestPayload,
  InviterPayload,
  Paged,
  PagedResult,
  RoleDefinition,
  Template,
  TemplateTypeDto,
  TemplateUploadResult,
  UploadResult,
  VenuePayload,
  RsvpQuestion,
} from '../utils/types/api.types';

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

function photoForm(files: File[]): FormData {
  const form = new FormData();
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
      map((env) => env.data as T),
      catchError((err: HttpErrorResponse) => {
        const env = err.error as ApiEnvelope<unknown> | null;
        const detail = env?.errors?.map((e) => e.message).join(' ');
        const message =
          env?.message ?? detail ?? 'Something went wrong. Please try again.';
        // 401s are auth failures handled elsewhere (the session interceptor clears the session and
        // redirects) — don't also pop a generic error toast for them.
        if (loud && err.status !== 401) {
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

  /**
   * Upload a raw template package (multipart). Do NOT set Content-Type — the
   * browser adds the correct multipart boundary for the FormData body. The
   * session interceptor attaches the Bearer token.
   */
  uploadTemplate(form: FormData): Observable<TemplateUploadResult> {
    return this.unwrap(
      this.http.post<ApiEnvelope<TemplateUploadResult>>(
        `${this.base}/api/admin/templates`,
        form,
      ),
    );
  }

  /* Inquiries (custom invitations) */

  /** Public "Start an inquiry" submit — no admin token. */
  /** Designers the request form can offer to route a request to. Public. */
  listPublicDesigners(): Observable<PublicDesigner[]> {
    return this.unwrapQuiet(
      this.http.get<ApiEnvelope<PublicDesigner[]>>(`${this.base}/api/inquiries/designers`),
    );
  }

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

  /** Issue a dedicated template for this inquiry (multipart index.html) — emails the customer. */
  issueInquiryTemplate(id: string, form: FormData): Observable<InquiryIssued> {
    return this.unwrap(
      this.http.post<ApiEnvelope<InquiryIssued>>(`${this.base}/api/admin/inquiries/${id}/issue`, form),
    );
  }

  /** Admin templates — paged, searchable (name/slug), category filter, status tab (active/inactive/all). */
  listAdminTemplates(
    page = 1,
    search = '',
    category = '',
    status = 'active',
    pageSize = 12,
  ): Observable<PagedResult<AdminTemplate>> {
    let params = new HttpParams().set('page', String(page)).set('pageSize', String(pageSize));
    if (search.trim()) params = params.set('search', search.trim());
    if (category) params = params.set('category', category);
    if (status) params = params.set('status', status);
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
  ): Observable<{ added: number; guestCount: number; paidCapacity: number; needsTopUp: boolean; sent: boolean }> {
    return this.unwrap(
      this.http.post<
        ApiEnvelope<{ added: number; guestCount: number; paidCapacity: number; needsTopUp: boolean; sent: boolean }>
      >(`${this.base}/api/campaigns/${campaignId}/guests`, guest, this.dashboardAuth(dashboardToken)),
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

  /* Designer accounts (community templates) */






  /* Designer submissions */

  /** Dry-run the scan so the form can show what we detected before anything is created. */
  scanTemplate(form: FormData): Observable<TemplateScanResult> {
    return this.unwrap(
      this.http.post<ApiEnvelope<TemplateScanResult>>(
        `${this.base}/api/designer/templates/scan`,
        form,
      ),
    );
  }

  listMySubmissions(): Observable<DesignerTemplate[]> {
    return this.unwrap(
      this.http.get<ApiEnvelope<DesignerTemplate[]>>(`${this.base}/api/designer/templates`),
    );
  }

  /** Multipart — do NOT set Content-Type; the browser adds the boundary. */
  submitTemplate(form: FormData): Observable<DesignerTemplate> {
    return this.unwrap(
      this.http.post<ApiEnvelope<DesignerTemplate>>(`${this.base}/api/designer/templates`, form),
    );
  }

  resubmitTemplate(id: string, form: FormData): Observable<DesignerTemplate> {
    return this.unwrap(
      this.http.post<ApiEnvelope<DesignerTemplate>>(
        `${this.base}/api/designer/templates/${id}/resubmit`,
        form,
      ),
    );
  }


  /* Admin review queue */

  listSubmissions(status = 'all', page = 1, pageSize = 20): Observable<PagedResult<TemplateSubmission>> {
    let params = new HttpParams().set('page', String(page)).set('pageSize', String(pageSize));
    if (status && status !== 'all') params = params.set('status', status);
    return this.unwrap(
      this.http.get<ApiEnvelope<PagedResult<TemplateSubmission>>>(
        `${this.base}/api/admin/template-submissions`,
        { params },
      ),
    );
  }


  reviewSubmission(
    id: string,
    approve: boolean,
    rejectionReason?: string,
  ): Observable<TemplateSubmission> {
    return this.unwrap(
      this.http.post<ApiEnvelope<TemplateSubmission>>(
        `${this.base}/api/admin/template-submissions/${id}/review`,
        { approve, rejectionReason: rejectionReason ?? null },
      ),
    );
  }

  /* Admin: designers + earnings */

  listDesigners(page = 1, search = '', pageSize = 20): Observable<PagedResult<AdminDesigner>> {
    let params = new HttpParams().set('page', String(page)).set('pageSize', String(pageSize));
    if (search.trim()) params = params.set('search', search.trim());
    return this.unwrap(
      this.http.get<ApiEnvelope<PagedResult<AdminDesigner>>>(`${this.base}/api/admin/designers`, {
        params,
      }),
    );
  }

  /** Suspending blocks new submissions and sign-ins; published templates deliberately stay live. */
  setDesignerSuspended(id: string, suspended: boolean): Observable<AdminDesigner> {
    return this.unwrap(
      this.http.post<ApiEnvelope<AdminDesigner>>(
        `${this.base}/api/admin/designers/${id}/suspend?suspended=${suspended}`,
        {},
      ),
    );
  }

  designerEarnings(): Observable<DesignerEarnings[]> {
    return this.unwrap(
      this.http.get<ApiEnvelope<DesignerEarnings[]>>(`${this.base}/api/admin/designers/earnings`),
    );
  }

  /** Hands an inquiry to a designer at an agreed price. */
  assignCommission(
    inquiryId: string,
    designerUserId: string | null,
    commissionPrice: number | null,
    usagePrice: number | null,
  ): Observable<InquiryDetail> {
    return this.unwrap(
      this.http.post<ApiEnvelope<InquiryDetail>>(
        `${this.base}/api/admin/inquiries/${inquiryId}/commission`,
        { designerUserId, commissionPrice, usagePrice },
      ),
    );
  }

  /* Designer: commissions + releasing a commission to the gallery */

  listMyCommissions(): Observable<DesignerCommission[]> {
    return this.unwrap(
      this.http.get<ApiEnvelope<DesignerCommission[]>>(`${this.base}/api/designer/commissions`),
    );
  }


  /** The designer's half of the two-party consent. */
  releaseAsDesigner(templateId: string): Observable<TemplateRelease> {
    return this.unwrap(
      this.http.post<ApiEnvelope<TemplateRelease>>(
        `${this.base}/api/template-release/${templateId}/designer-consent`,
        {},
      ),
    );
  }

  /** The requester's half — authorized by the verified email on their account session. */
  releaseAsRequester(templateId: string): Observable<TemplateRelease> {
    return this.unwrap(
      this.http.post<ApiEnvelope<TemplateRelease>>(
        `${this.base}/api/template-release/${templateId}/requester-consent`,
        {},
      ),
    );
  }

  /** Commissioned templates awaiting the requester's decision. */
  myCommissionedTemplates(): Observable<TemplateRelease[]> {
    return this.unwrap(
      this.http.get<ApiEnvelope<TemplateRelease[]>>(`${this.base}/api/me/commissioned-templates`),
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

  /** Creates a designer account. The only self-service sign-up on the platform. */
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

  adminUsers(page = 1, search = '', pageSize = 20): Observable<PagedResult<AdminUser>> {
    const params = new HttpParams()
      .set('page', page)
      .set('pageSize', pageSize)
      .set('search', search);
    return this.unwrap(
      this.http.get<ApiEnvelope<PagedResult<AdminUser>>>(`${this.base}/api/admin/users`, { params }),
    );
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

  addCampaignPhotos(campaignId: string, files: File[]): Observable<EventPhoto[]> {
    return this.unwrap(
      this.http.post<ApiEnvelope<EventPhoto[]>>(
        `${this.base}/api/campaigns/${campaignId}/photos`,
        photoForm(files),
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

  addInvitationPhotos(campaignId: string, files: File[]): Observable<EventPhoto[]> {
    return this.unwrap(
      this.http.post<ApiEnvelope<EventPhoto[]>>(
        `${this.base}/api/me/invitations/${campaignId}/photos`,
        photoForm(files),
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

  /* The templates I'm responsible for — every template for an admin, my own for a designer */

  myTemplates(): Observable<MyTemplatesPage> {
    return this.unwrap(this.http.get<ApiEnvelope<MyTemplatesPage>>(`${this.base}/api/my-templates`));
  }

  templateSource(id: string): Observable<string> {
    return this.unwrap(
      this.http.get<ApiEnvelope<string>>(`${this.base}/api/my-templates/${id}/source`),
    );
  }

  setTemplatePricing(
    id: string,
    usagePrice: number | null,
    commissionPrice: number | null,
  ): Observable<MyTemplateRow> {
    return this.unwrap(
      this.http.put<ApiEnvelope<MyTemplateRow>>(`${this.base}/api/my-templates/${id}/pricing`, {
        usagePrice,
        commissionPrice,
      }),
    );
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

  storeMeta(campaignId: string, meta: CampaignMeta): void {
    this.tokens.setMeta(campaignId, meta);
  }

  getMeta(campaignId: string): CampaignMeta {
    return this.tokens.getMeta(campaignId);
  }
}
