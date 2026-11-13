import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom, Observable } from 'rxjs';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiAvatar } from '@zouriel/ui/badge';
import { UiButton, UiIconButton } from '@zouriel/ui/button';
import { UiConfirmDialog, UiModal, UiToastService } from '@zouriel/ui/dialog';
import { UiStarterCard } from '@zouriel/ui/feedback';
import { UiCheckbox, UiChoiceGrid, UiFileUpload, UiFormField, UiHandleField, UiInput, UiSwitch, UiTextarea, type UiChoice, type UiHandleCheck } from '@zouriel/ui/form';
import { UiSelectable, type UiImagePickerItem } from '@zouriel/ui/media';
import { UiGrid } from '@zouriel/ui/layout';
import { UiSectionList, type UiSectionListItem } from '@zouriel/ui/sortable';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { APP_ICONS } from '../../shared/icons/app-icons';
import { PortfolioCoverComponent } from '../../shared/portfolio/portfolio-cover.component';
import { PortfolioLookComponent } from '../../shared/portfolio/portfolio-look.component';
import {
  Portfolio,
  PortfolioDesign,
  PortfolioOptions,
  PortfolioPackage,
  PortfolioReview,
  PortfolioSection,
  PortfolioSectionKind,
} from '../../shared/portfolio/portfolio.types';
import { SECTION_LOOK, copyText, handleChecker, sectionDescription, shareLink } from './portfolio-shared';

type PackageDraft = { name: string; price: string; lines: string };

/**
 * The portfolio's controls once it is set up: the link, Live switch, the sections as cards (drag, hide, edit,
 * remove), the look, enquiries, and a bar with Preview and Share that stays on screen.
 */
@Component({
  selector: 'app-portfolio-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    HugeiconsIconComponent,
    PortfolioCoverComponent,
    PortfolioLookComponent,
    UiAvatar,
    UiButton,
    UiCheckbox,
    UiChoiceGrid,
    UiConfirmDialog,
    UiFileUpload,
    UiFormField,
    UiHandleField,
    UiIconButton,
    UiGrid,
    UiSelectable,
    UiInput,
    UiModal,
    UiSectionList,
    UiStarterCard,
    UiSwitch,
    UiText,
    UiTextarea,
  ],
  templateUrl: './portfolio-editor.component.html',
  styleUrl: './portfolio-editor.component.scss',
})
export class PortfolioEditorComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);
  protected readonly router = inject(Router);
  protected readonly icons = APP_ICONS;

  readonly portfolio = input.required<Portfolio>();
  readonly options = input<PortfolioOptions | null>(null);
  readonly changed = output<Portfolio>();

  protected readonly busy = signal(false);

  // ---------- link, live, share ----------

  protected readonly shortLink = computed(() => `invites.blog/@${this.portfolio().handle}`);

  protected async copy(): Promise<void> {
    const url = this.portfolio().publicUrl;
    if (url && (await copyText(url))) this.toast.success('Link copied.');
  }

  protected async share(): Promise<void> {
    const p = this.portfolio();
    if (!p.publicUrl) return;
    if (!p.published) {
      this.toast.info('Your page is hidden. Turn on Live first, so people can open it.');
      return;
    }
    const r = await shareLink(p.publicUrl, p.displayName);
    if (r === 'copied') this.toast.success('Link copied.');
  }

  /** Opens the page as it is now: the public address when live, else a 30-minute preview link. */
  protected async preview(): Promise<void> {
    const p = this.portfolio();
    // Opened before the request so a browser doesn't treat it as a pop-up.
    const tab = window.open('about:blank', '_blank');
    try {
      const url = p.published && p.publicUrl ? p.publicUrl : (await firstValueFrom(this.api.portfolioPreviewLink())).url;
      if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch {
      tab?.close();
    }
  }

  protected setLive(on: boolean): void {
    void this.run(this.api.publishPortfolio(on), on ? 'Your portfolio is live.' : 'Your portfolio is hidden.');
  }

  // ---------- handle ----------

  protected readonly editingHandle = signal(false);
  protected readonly handleState = signal<UiHandleCheck>({ state: 'idle' });
  protected readonly check = handleChecker(this.api);
  protected handle = '';

  protected openHandle(): void {
    this.handle = this.portfolio().handle ?? '';
    this.handleState.set({ state: 'idle' });
    this.editingHandle.set(true);
  }

  protected async saveHandle(): Promise<void> {
    if (await this.run(this.api.setPortfolioHandle(this.handle), 'Link changed. The old one keeps working for 30 days.'))
      this.editingHandle.set(false);
  }

  // ---------- sections ----------

  protected readonly items = computed<UiSectionListItem[]>(() => {
    const p = this.portfolio();
    return p.sections.map((s) => {
      const look = SECTION_LOOK[s.kind];
      const collection = s.collectionId ? p.collections.find((c) => c.id === s.collectionId) : null;
      return {
        id: s.id,
        label: collection?.title ?? s.title ?? look.label,
        description: sectionDescription(s, p),
        icon: look.icon,
        hidden: s.hidden,
        locked: s.locked,
        hideable: !s.locked,
        removable: !s.locked,
      };
    });
  });

  protected reorder(ids: string[]): void {
    void this.run(this.api.orderPortfolioSections(ids));
  }

  protected toggleHidden(e: { id: string; hidden: boolean }): void {
    void this.run(this.api.updatePortfolioSection(e.id, { hidden: e.hidden }));
  }

  protected readonly removing = signal<PortfolioSection | null>(null);
  protected readonly removeMessage = computed(() => {
    const s = this.removing();
    if (!s) return '';
    if (s.kind === 'collection') {
      const n = this.portfolio().collections.find((c) => c.id === s.collectionId)?.photos.length ?? 0;
      return `The collection and its ${n} ${n === 1 ? 'photo' : 'photos'} leave your portfolio. Your albums keep theirs.`;
    }
    return 'It comes off your page. You can add it again later.';
  });

  protected askRemove(id: string): void {
    this.removing.set(this.portfolio().sections.find((s) => s.id === id) ?? null);
  }

  protected confirmRemove(): void {
    const s = this.removing();
    this.removing.set(null);
    if (s) void this.run(this.api.removePortfolioSection(s.id));
  }

  // ---------- adding ----------

  protected readonly adding = signal(false);
  protected newCollection = '';
  protected readonly addChoices = computed<UiChoice[]>(() => {
    const have = new Set(this.portfolio().sections.map((s) => s.kind));
    const kinds: PortfolioSectionKind[] = ['collection', 'about', 'packages', 'reviews', 'designs', 'contact'];
    return kinds
      .filter((k) => k === 'collection' || !have.has(k))
      .map((k) => ({ value: k, label: SECTION_LOOK[k].label, description: SECTION_LOOK[k].blurb }));
  });
  protected readonly addKind = signal<string | null>(null);

  protected async add(): Promise<void> {
    const kind = this.addKind() as PortfolioSectionKind | null;
    if (!kind) return;
    if (kind === 'collection') {
      const title = this.newCollection.trim() || 'New collection';
      const p = await this.run(this.api.addPortfolioCollection(title));
      if (p) {
        this.adding.set(false);
        this.newCollection = '';
        const c = p.collections[p.collections.length - 1];
        if (c) void this.router.navigate(['/portfolio/collections', c.id]);
      }
      return;
    }
    const p = await this.run(this.api.addPortfolioSection({ kind }));
    if (p) {
      this.adding.set(false);
      const s = p.sections.find((x) => x.kind === kind);
      // After the Add dialog has gone: two dialogs swapping in one tick closed the second one.
      if (s) setTimeout(() => this.edit(s.id), 300);
    }
  }

  // ---------- editing one section ----------

  protected readonly editing = signal<PortfolioSection | null>(null);
  protected readonly editTitle = computed(() => {
    const s = this.editing();
    return s ? SECTION_LOOK[s.kind].label : '';
  });
  protected draft = {
    title: '',
    body: '',
    photoId: null as string | null,
    displayName: '',
    tagline: '',
    whatsApp: '',
    viber: '',
    instagram: '',
    phone: '',
    email: '',
    enquiries: true,
  };
  protected packages: PackageDraft[] = [];
  protected reviews: PortfolioReview[] = [];
  protected chosenDesigns = new Set<string>();
  protected readonly designs = signal<PortfolioDesign[] | null>(null);

  /** Every portfolio photo, to choose a cover or the About picture from. */
  protected readonly photoItems = computed<UiImagePickerItem[]>(() =>
    this.portfolio().collections.flatMap((c) => c.photos.map((ph) => ({ id: ph.id, src: ph.thumbUrl, label: c.title }))),
  );

  protected edit(id: string): void {
    const p = this.portfolio();
    const s = p.sections.find((x) => x.id === id);
    if (!s) return;
    if (s.kind === 'collection' && s.collectionId) {
      void this.router.navigate(['/portfolio/collections', s.collectionId]);
      return;
    }
    const c = p.contact;
    this.draft = {
      title: s.title ?? '',
      body: s.body ?? '',
      photoId: s.kind === 'cover' ? p.coverPhotoId : s.photoId,
      displayName: p.displayName,
      tagline: p.tagline ?? '',
      whatsApp: c.whatsApp ?? '',
      viber: c.viber ?? '',
      instagram: c.instagram ?? '',
      phone: c.phone ?? '',
      email: c.email ?? '',
      enquiries: c.enquiries,
    };
    this.packages = s.packages.map((x: PortfolioPackage) => ({ name: x.name, price: x.price ?? '', lines: (x.lines ?? []).join('\n') }));
    if (s.kind === 'packages' && !this.packages.length) this.packages = [{ name: '', price: '', lines: '' }];
    this.reviews = s.reviews.map((r) => ({ ...r }));
    if (s.kind === 'reviews' && !this.reviews.length) this.reviews = [{ quote: '', name: '' }];
    this.chosenDesigns = new Set(s.templateIds);
    if (s.kind === 'designs' && this.designs() === null)
      this.api.portfolioDesigns().subscribe({ next: (d) => this.designs.set(d), error: () => this.designs.set([]) });
    this.editing.set(s);
  }

  protected pickPhoto(id: string): void {
    this.draft.photoId = this.draft.photoId === id ? null : id;
  }

  protected toggleDesign(id: string, on: boolean): void {
    if (on) this.chosenDesigns.add(id);
    else this.chosenDesigns.delete(id);
  }

  protected addPackage(): void {
    this.packages = [...this.packages, { name: '', price: '', lines: '' }];
  }

  protected removePackage(i: number): void {
    this.packages = this.packages.filter((_, j) => j !== i);
  }

  protected addReview(): void {
    this.reviews = [...this.reviews, { quote: '', name: '' }];
  }

  protected removeReview(i: number): void {
    this.reviews = this.reviews.filter((_, j) => j !== i);
  }

  /** The cover picture was uploaded or removed (saved at once): hand it up, and drop a photo pick it replaced. */
  protected coverChanged(p: Portfolio): void {
    this.changed.emit(p);
    this.draft.photoId = p.coverPhotoId;
  }

  protected async uploadLogo(files: File[]): Promise<void> {
    if (files.length) await this.run(this.api.setPortfolioLogo(files[0]));
  }

  protected async removeLogo(): Promise<void> {
    await this.run(this.api.removePortfolioLogo());
  }

  protected async saveSection(): Promise<void> {
    const s = this.editing();
    if (!s) return;
    const d = this.draft;
    let ok: Portfolio | null = null;
    switch (s.kind) {
      case 'cover':
        ok = await this.run(
          this.api.updatePortfolio({
            displayName: d.displayName.trim(),
            tagline: d.tagline.trim(),
            // A picked photo becomes the cover (replacing an uploaded picture); un-picking it goes back to the
            // first photo, but never throws away an uploaded picture the studio didn't touch here.
            ...(d.photoId
              ? d.photoId !== this.portfolio().coverPhotoId || this.portfolio().coverSource === 'upload'
                ? { coverPhotoId: d.photoId }
                : {}
              : this.portfolio().coverSource === 'photo'
                ? { clearCover: true }
                : {}),
          }),
        );
        break;
      case 'about':
        ok = await this.run(
          this.api.updatePortfolioSection(s.id, { title: d.title, body: d.body, ...(d.photoId ? { photoId: d.photoId } : { clearPhoto: true }) }),
        );
        break;
      case 'packages':
        ok = await this.run(
          this.api.updatePortfolioSection(s.id, {
            title: d.title,
            packages: this.packages
              .filter((x) => x.name.trim())
              .map((x) => ({ name: x.name.trim(), price: x.price.trim() || null, lines: x.lines.split('\n').map((l) => l.trim()).filter(Boolean) })),
          }),
        );
        break;
      case 'reviews':
        ok = await this.run(
          this.api.updatePortfolioSection(s.id, {
            title: d.title,
            reviews: this.reviews.filter((r) => r.quote.trim()).map((r) => ({ quote: r.quote.trim(), name: r.name?.trim() || null })),
          }),
        );
        break;
      case 'designs':
        ok = await this.run(this.api.updatePortfolioSection(s.id, { title: d.title, templateIds: [...this.chosenDesigns] }));
        break;
      case 'contact': {
        const saved = await this.run(this.api.updatePortfolioSection(s.id, { title: d.title }));
        if (saved)
          ok = await this.run(
            this.api.updatePortfolio({
              contact: { whatsApp: d.whatsApp, viber: d.viber, instagram: d.instagram, phone: d.phone, email: d.email, enquiries: d.enquiries },
            }),
          );
        break;
      }
    }
    if (ok) this.editing.set(null);
  }

  // ---------- look ----------

  protected readonly editingLook = signal(false);
  protected theme: string | null = null;
  protected accent: string | null = null;
  protected font: string | null = null;

  protected openLook(): void {
    const p = this.portfolio();
    this.theme = p.theme;
    this.accent = p.accent;
    this.font = p.font;
    this.editingLook.set(true);
  }

  protected async saveLook(): Promise<void> {
    if (await this.run(this.api.updatePortfolio({ theme: this.theme ?? undefined, accent: this.accent ?? undefined, font: this.font ?? undefined })))
      this.editingLook.set(false);
  }

  protected themeLabel(): string {
    const o = this.options();
    const p = this.portfolio();
    const t = o?.themes.find((x) => x.key === p.theme)?.label ?? p.theme;
    const f = o?.fonts.find((x) => x.key === p.font)?.label ?? p.font;
    return `${t}, ${f} fonts`;
  }

  // ---------- helpers ----------

  /** Runs a change, hands the new portfolio up, and returns it (null when it failed; the toast said why). */
  private async run(call: Observable<Portfolio>, done?: string): Promise<Portfolio | null> {
    this.busy.set(true);
    try {
      const p = await firstValueFrom(call);
      this.changed.emit(p);
      if (done) this.toast.success(done);
      return p;
    } catch {
      return null;
    } finally {
      this.busy.set(false);
    }
  }
}
