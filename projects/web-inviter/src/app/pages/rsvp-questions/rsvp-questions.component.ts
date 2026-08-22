import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UiAlert } from 'ui/alert';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiCheckbox, UiFormField, UiInput, UiSelect, UiTextarea } from 'ui/form';
import { UiSpinner } from 'ui/spinner';
import { UiText } from 'ui/text';
import { ApiService } from '../../shared/api/api.service';
import { RsvpQuestion } from '../../shared/utils/types/api.types';
import { WizardStepsComponent } from '../../features/wizard/wizard-steps.component';
import { WizardStepKey } from '../../shared/utils/enums/app.enums';
import { wizardStepEyebrow } from '../../shared/utils/constants/app.constants';

/** A question being edited. `options` is a plain string here — a textarea is easier than a list editor. */
type Draft = {
  key: string;
  label: string;
  type: RsvpQuestion['type'];
  required: boolean;
  askIfNotGoing: boolean;
  options: string;
};

/**
 * Choosing what the RSVP form asks.
 *
 * Every event wants something different — a head count for a dinner, a song request for a party, a
 * bus pickup point for an out-of-town wedding — so the form is the host's to shape rather than a
 * fixed set of four boxes.
 */
@Component({
  selector: 'app-rsvp-questions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, UiAlert, UiButton, UiCard, UiCheckbox, UiFormField, UiInput, UiSelect, UiSpinner,
    UiText, UiTextarea, WizardStepsComponent,
  ],
  templateUrl: './rsvp-questions.component.html',
  styleUrl: './rsvp-questions.component.scss',
})
export class RsvpQuestionsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly campaignId = input.required<string>();
  protected readonly stepKey = WizardStepKey.Rsvp;
  protected readonly eyebrow = wizardStepEyebrow(WizardStepKey.Rsvp);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly drafts = signal<Draft[]>([]);

  protected readonly typeOptions = [
    { label: 'Short answer', value: 'text' },
    { label: 'Long answer', value: 'textarea' },
    { label: 'A number', value: 'number' },
    { label: 'Pick one', value: 'select' },
    { label: 'Yes or no', value: 'yesno' },
  ];

  /** Suggestions worth one tap rather than typing out — the questions hosts ask most. */
  protected readonly suggestions: Omit<Draft, 'key'>[] = [
    { label: 'How many guests? (including you)', type: 'number', required: false, askIfNotGoing: false, options: '' },
    { label: 'Meal preference', type: 'select', required: false, askIfNotGoing: false, options: 'Chicken\nFish\nVegetarian' },
    { label: 'Any dietary requirements?', type: 'text', required: false, askIfNotGoing: false, options: '' },
    { label: 'Arrival time', type: 'text', required: false, askIfNotGoing: false, options: '' },
    { label: 'Do you need transport?', type: 'yesno', required: false, askIfNotGoing: false, options: '' },
    { label: 'A note for the host', type: 'textarea', required: false, askIfNotGoing: true, options: '' },
  ];

  /** Suggestions they haven't already added, matched on label so the list shrinks as they build. */
  protected readonly unusedSuggestions = computed(() => {
    const used = new Set(this.drafts().map((d) => d.label.trim().toLowerCase()));
    return this.suggestions.filter((s) => !used.has(s.label.toLowerCase()));
  });

  ngOnInit(): void {
    this.api.rsvpQuestions(this.campaignId()).subscribe({
      next: (questions) => {
        this.drafts.set(questions.map((q) => this.toDraft(q)));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private toDraft(q: RsvpQuestion): Draft {
    return {
      key: q.key,
      label: q.label,
      type: q.type,
      required: q.required ?? false,
      askIfNotGoing: q.askIfNotGoing ?? false,
      options: (q.options ?? []).join('\n'),
    };
  }

  protected add(from?: Omit<Draft, 'key'>): void {
    this.drafts.update((list) => [
      ...list,
      // No key: the server derives one from the label. A key made up here could collide with an
      // existing question's, which is what answers are filed under.
      from
        ? { key: '', ...from }
        : { key: '', label: '', type: 'text', required: false, askIfNotGoing: false, options: '' },
    ]);
  }

  protected remove(index: number): void {
    this.drafts.update((list) => list.filter((_, i) => i !== index));
  }

  protected move(index: number, by: number): void {
    const to = index + by;
    this.drafts.update((list) => {
      if (to < 0 || to >= list.length) return list;
      const next = [...list];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  }

  protected patch(index: number, change: Partial<Draft>): void {
    this.drafts.update((list) => list.map((d, i) => (i === index ? { ...d, ...change } : d)));
  }

  protected save(andContinue: boolean): void {
    if (this.saving()) return;
    this.error.set(null);

    const questions: RsvpQuestion[] = this.drafts().map((d) => ({
      key: d.key,
      label: d.label.trim(),
      type: d.type,
      required: d.required,
      askIfNotGoing: d.askIfNotGoing,
      options:
        d.type === 'select'
          ? d.options.split('\n').map((o) => o.trim()).filter(Boolean)
          : undefined,
    }));

    const unlabelled = questions.findIndex((q) => !q.label);
    if (unlabelled >= 0) {
      this.error.set(`Question ${unlabelled + 1} still needs its wording.`);
      return;
    }

    this.saving.set(true);
    this.api.saveRsvpQuestions(this.campaignId(), questions).subscribe({
      next: (saved) => {
        // Re-read what came back: the server assigns keys and tidies choices, and editing on stale
        // keys afterwards would file the next round of answers somewhere else.
        this.drafts.set(saved.map((q) => this.toDraft(q)));
        this.saving.set(false);
        if (andContinue) void this.router.navigate(['/create', this.campaignId(), 'inviter']);
      },
      error: () => this.saving.set(false),
    });
  }
}
