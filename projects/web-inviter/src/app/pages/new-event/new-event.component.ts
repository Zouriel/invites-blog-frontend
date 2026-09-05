import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiDatePicker } from '@zouriel/ui/datepicker';
import { UiToastService } from '@zouriel/ui/dialog';
import { UiFormField, UiInput } from '@zouriel/ui/form';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { SessionStore } from '../../shared/services/session.store';

/**
 * Starting an event.
 *
 * <p><b>Why this exists.</b> Creation used to be four doors on marketing pages — a template, your own
 * design, a commission, a media bucket — and whichever one somebody pressed decided what their event
 * WAS, permanently. But an event can be an invitation, a bucket, or both; that is configuration, not
 * four products. So the name and the night come first, because those are true of any event, and what
 * it has comes after, when the choice is visible and reversible.</p>
 *
 * <p>Two steps in one page rather than two routes: the event exists after step one — it has a name, a
 * date and an owner — so somebody who stops there has not lost anything, and the second step is
 * offering rather than gating.</p>
 */
@Component({
  selector: 'app-new-event',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, RouterLink, UiButton, UiCard, UiDatePicker, UiFormField, UiInput, UiText,
  ],
  templateUrl: './new-event.component.html',
  styleUrl: './new-event.component.scss',
})
export class NewEventComponent {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);
  private readonly toast = inject(UiToastService);

  /**
   * A media bucket belongs to an ACCOUNT — it outlives the event, it is paid for every six months,
   * and its dashboard is reached through the account. So a signed-out visitor is asked to sign in
   * rather than handed a bucket that would belong to nobody and be reachable from nowhere. The
   * invitation half needs no account at all, and still doesn't.
   */
  protected readonly signedIn = this.session.isSignedIn;

  protected readonly title = signal(
    this.api.getMeta(this.route.snapshot.queryParamMap.get('event') ?? '').title ?? '',
  );
  protected readonly date = signal('');
  protected readonly creating = signal(false);

  /**
   * Set once the event exists. Its presence is what moves the page to the second step.
   *
   * <p>Also settable from the URL, which is how somebody comes BACK here after signing in to add a
   * bucket: the event they named is already made, and asking for its name again would be the bug.</p>
   */
  protected readonly campaignId = signal<string | null>(
    this.route.snapshot.queryParamMap.get('event'),
  );

  protected readonly addingBucket = signal(false);
  protected readonly hasBucket = signal(false);

  protected readonly ready = computed(() => !!this.title().trim() && !!this.date());

  protected create(): void {
    const title = this.title().trim();
    const date = this.date();
    if (!title || !date || this.creating()) return;

    this.creating.set(true);
    // Midday, not midnight: the window this feeds opens at the start of this day in Malé either way,
    // and a bare date read as UTC midnight lands on the previous day for a +05:00 reader.
    this.api.createEvent(title, `${date}T12:00:00`).subscribe({
      next: (created) => {
        this.api.storeToken(created.campaignId, created.accessToken);
        this.api.storeMeta(created.campaignId, { title });
        this.campaignId.set(created.campaignId);
        this.creating.set(false);
      },
      error: () => this.creating.set(false),
    });
  }

  /** Sign in, and come straight back to this step with the event already made. */
  protected signInForBucket(): void {
    void this.router.navigate(['/login'], {
      queryParams: { next: `/events/new?event=${this.campaignId()}` },
    });
  }

  protected addBucket(): void {
    const id = this.campaignId();
    if (!id || this.addingBucket()) return;

    this.addingBucket.set(true);
    this.api.createCampaignBucket(id).subscribe({
      next: () => {
        this.hasBucket.set(true);
        this.addingBucket.set(false);
        this.toast.success('Media bucket added.');
      },
      error: () => this.addingBucket.set(false),
    });
  }

  /** Off to pick a design, carrying the event so the gallery attaches rather than starting another. */
  protected chooseTemplate(): void {
    void this.router.navigate(['/templates'], { queryParams: { forEvent: this.campaignId() } });
  }

  protected bringOwn(): void {
    void this.router.navigate(['/bring-your-own'], { queryParams: { forEvent: this.campaignId() } });
  }

  /**
   * Where "I'm finished here" goes.
   *
   * <p>The dashboard is account-authorised — it takes a signed-in owner or the emailed magic-link
   * token, and deliberately not the builder's possession token — so sending a signed-out creator
   * there lands them on "this campaign isn't on your account". The guest list is the right place for
   * them anyway: it is the same list that decides who may see the bucket, and it opens on the
   * possession token they are holding.</p>
   */
  protected done(): void {
    void this.router.navigate(
      this.signedIn()
        ? ['/dashboard', this.campaignId()]
        : ['/create', this.campaignId(), 'guests'],
    );
  }
}
