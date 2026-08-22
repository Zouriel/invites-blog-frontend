import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { UiToastService } from 'ui/dialog';
import { environment } from '../../../environments/environment';
import { TokenStore } from '../services/token.store';
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
  OtpChallenge,
  OtpTokens,
  Paged,
  PagedResult,
  RoleDefinition,
  Template,
  TemplateTypeDto,
  TemplateUploadResult,
  UploadResult,
  VenuePayload,
  MyInvitation,
  RsvpBody,
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

  /** The requester's half — authorized by their OTP-verified email. */
  releaseAsRequester(templateId: string, accessToken: string): Observable<TemplateRelease> {
    const headers = new HttpHeaders({ Authorization: `Bearer ${accessToken}` });
    return this.unwrap(
      this.http.post<ApiEnvelope<TemplateRelease>>(
        `${this.base}/api/template-release/${templateId}/requester-consent`,
        {},
        { headers },
      ),
    );
  }

  /** Commissioned templates awaiting the OTP-verified requester's decision. */
  myCommissionedTemplates(accessToken: string): Observable<TemplateRelease[]> {
    const headers = new HttpHeaders({ Authorization: `Bearer ${accessToken}` });
    return this.unwrap(
      this.http.get<ApiEnvelope<TemplateRelease[]>>(`${this.base}/api/me/commissioned-templates`, {
        headers,
      }),
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

  /** Sends a code to a phone number or an email address — whichever they typed. */
  requestSignInCode(identifier: string, defaultCountry = 'MV'): Observable<CodeSent> {
    return this.unwrap(
      this.http.post<ApiEnvelope<CodeSent>>(`${this.base}/api/auth/code/request`, {
        identifier,
        defaultCountry,
      }),
    );
  }

  verifySignInCode(challengeId: string, code: string): Observable<AuthResult> {
    return this.unwrap(
      this.http.post<ApiEnvelope<AuthResult>>(`${this.base}/api/auth/code/verify`, {
        challengeId,
        code,
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

  /** Invitations sent TO this person, across every identifier on their account. */
  myInvites(): Observable<MyInvite[]> {
    return this.unwrap(this.http.get<ApiEnvelope<MyInvite[]>>(`${this.base}/api/me/invites`));
  }

  /** One received invitation, rendered — authorised by the account, no invitation link needed. */
  myInvitation(campaignId: string): Observable<MyInvitation> {
    return this.unwrap(
      this.http.get<ApiEnvelope<MyInvitation>>(`${this.base}/api/me/invitations/${campaignId}`),
    );
  }

  /** Reply to a received invitation. Ownership is checked against the account's verified contacts. */
  rsvp(inviteId: string, body: RsvpBody): Observable<unknown> {
    return this.unwrap(
      this.http.post<ApiEnvelope<unknown>>(`${this.base}/api/invites/${inviteId}/rsvp`, body),
    );
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

  hasToken(campaignId: string): boolean {
    return !!this.tokens.get(campaignId);
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
