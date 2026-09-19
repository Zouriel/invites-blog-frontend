import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UiAlert } from '@zouriel/ui/alert';
import { UiButton, UiIconButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiDatePicker } from '@zouriel/ui/datepicker';
import { UiConfirmDialog, UiToastService } from '@zouriel/ui/dialog';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiFileUpload, UiFormField, UiInput } from '@zouriel/ui/form';
import { UiProgressBar } from '@zouriel/ui/progress';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { ApiService } from '../../shared/api/api.service';
import { APP_ICONS } from '../../shared/icons/app-icons';
import { formatBytes, passSummary, plan } from '../../shared/utils/plans';
import { Venue, VenueStaff } from '../../shared/utils/types/api.types';

/**
 * A venue's own page, for its owner and its staff: the events at the property, a new one in two
 * fields, and — for the owner — the name and logo guests see on the QR cards and albums, and who
 * the staff are.
 *
 * <p>Staff are matched by email, like the people an event is for, so an owner adds them before they
 * have an account; the page appears for them once they sign in with that address.</p>
 */
@Component({
  selector: 'app-venue-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, FormsModule, RouterLink, HugeiconsIconComponent, UiAlert, UiButton, UiCard, UiConfirmDialog,
    UiDatePicker, UiEmptyState, UiFileUpload, UiFormField, UiIconButton, UiInput, UiProgressBar, UiSpinner, UiText,
  ],
  templateUrl: './venue-home.component.html',
  styleUrl: './venue-home.component.scss',
})
export class VenueHomeComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);

  protected readonly icons = APP_ICONS;
  protected readonly bytes = formatBytes;
  protected readonly perEvent = passSummary(plan('Venue'));
  protected readonly venue = signal<Venue | null>(null);
  protected readonly notVenue = signal(false);
  protected readonly failed = signal(false);

  protected readonly usedPercent = computed(() => {
    const v = this.venue();
    return v && v.accountBytes ? Math.min(100, Math.round((v.usedBytes / v.accountBytes) * 100)) : 0;
  });

  constructor() {
    this.api.venue().subscribe({
      next: (v) => this.adopt(v),
      error: (e: HttpErrorResponse) => (e.status === 403 ? this.notVenue.set(true) : this.failed.set(true)),
    });
  }

  private adopt(v: Venue): void {
    this.venue.set(v);
    this.name.set(v.name);
    this.place.set(v.place ?? '');
  }

  protected copyCode(code: string): void {
    navigator.clipboard?.writeText(code).then(
      () => this.toast.success('Venue code copied.'),
      () => {},
    );
  }

  // ---------- a new event ----------

  protected readonly eventTitle = signal('');
  protected readonly eventDate = signal('');
  protected readonly creating = signal(false);

  protected createEvent(): void {
    const title = this.eventTitle().trim();
    const date = this.eventDate();
    if (!title || !date || this.creating()) return;
    this.creating.set(true);
    // Midday, not midnight: a bare date read as UTC midnight can land on the day before in Malé.
    this.api.createVenueEvent(title, `${date}T12:00:00`).subscribe({
      next: (e) => {
        this.venue.update((v) => (v ? { ...v, events: [e, ...v.events] } : v));
        this.eventTitle.set('');
        this.eventDate.set('');
        this.creating.set(false);
        this.toast.success(`${e.title} is ready. Open it to print its QR cards.`);
      },
      error: () => this.creating.set(false),
    });
  }

  // ---------- the venue itself (owner) ----------

  protected readonly name = signal('');
  protected readonly place = signal('');
  protected readonly saving = signal(false);
  protected readonly uploadingLogo = signal(false);

  protected readonly detailsChanged = computed(() => {
    const v = this.venue();
    return !!v && (this.name().trim() !== v.name || (this.place().trim() || null) !== v.place);
  });

  protected saveDetails(): void {
    if (this.saving() || !this.name().trim()) return;
    this.saving.set(true);
    this.api.updateVenue(this.name().trim(), this.place().trim() || null).subscribe({
      next: (v) => {
        this.adopt(v);
        this.saving.set(false);
        this.toast.success('Saved.');
      },
      error: () => this.saving.set(false),
    });
  }

  protected onLogo(files: File[]): void {
    const file = files[0];
    if (!file || this.uploadingLogo()) return;
    this.uploadingLogo.set(true);
    this.api.setVenueLogo(file).subscribe({
      next: (v) => {
        this.adopt(v);
        this.uploadingLogo.set(false);
      },
      error: () => this.uploadingLogo.set(false),
    });
  }

  protected removeLogo(): void {
    this.api.removeVenueLogo().subscribe({ next: (v) => this.adopt(v) });
  }

  // ---------- staff (owner) ----------

  protected readonly staffEmail = signal('');
  protected readonly staffName = signal('');
  protected readonly addingStaff = signal(false);
  protected readonly removing = signal<VenueStaff | null>(null);
  protected readonly confirmingRemove = signal(false);

  protected addStaff(): void {
    const email = this.staffEmail().trim();
    if (!email || this.addingStaff()) return;
    this.addingStaff.set(true);
    this.api.addVenueStaff(email, this.staffName().trim() || null).subscribe({
      next: (v) => {
        this.adopt(v);
        this.staffEmail.set('');
        this.staffName.set('');
        this.addingStaff.set(false);
        this.toast.success(`${email} can run the venue's events once they sign in with that address.`);
      },
      error: () => this.addingStaff.set(false),
    });
  }

  protected askRemove(s: VenueStaff): void {
    this.removing.set(s);
    this.confirmingRemove.set(true);
  }

  protected removeStaff(): void {
    const s = this.removing();
    if (!s) return;
    this.api.removeVenueStaff(s.id).subscribe({
      next: (v) => {
        this.adopt(v);
        this.removing.set(null);
      },
    });
  }
}
