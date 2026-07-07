import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiText } from 'ui/text';
import { UiBadge } from 'ui/badge';
import { UiFormField, UiInput, UiTextarea } from 'ui/form';
import { ApiService } from '../../shared/api/api.service';
import { CustomContent } from '../../shared/utils/types/api.types';
import { SafeUrlPipe } from '../../shared/pipes/safe-url.pipe';
import { WizardStepsComponent } from '../../features/wizard/wizard-steps.component';
import { WizardStepKey } from '../../shared/utils/enums/app.enums';

@Component({
  selector: 'app-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    UiButton,
    UiCard,
    UiText,
    UiBadge,
    UiFormField,
    UiInput,
    UiTextarea,
    SafeUrlPipe,
    WizardStepsComponent,
  ],
  templateUrl: './editor.component.html',
  styleUrl: './editor.component.scss',
})
export class EditorComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly campaignId = input.required<string>();
  protected readonly stepKey = WizardStepKey.Editor;

  private readonly iframe = viewChild<ElementRef<HTMLIFrameElement>>('preview');

  protected readonly form = this.fb.group({
    title: this.fb.control(''),
    subtitle: this.fb.control(''),
    description: this.fb.control(''),
    date: this.fb.control(''),
    time: this.fb.control(''),
    venueName: this.fb.control(''),
    venueAddress: this.fb.control(''),
    schedule: this.fb.control(''),
    dressCode: this.fb.control(''),
  });

  private readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
  protected readonly titleValue = computed(() => this.value().title ?? '');

  protected readonly packageUrl = signal<string | null>(null);
  protected readonly previewSrc = computed(() => {
    const url = this.packageUrl();
    return url ? url + 'index.html' : null;
  });

  protected readonly saving = signal(false);
  protected readonly savedAt = signal<string | null>(null);

  ngOnInit(): void {
    const id = this.campaignId();

    const resume = this.route.snapshot.queryParamMap.get('resume');
    if (resume) {
      this.api.storeToken(id, resume);
    }

    const meta = this.api.getMeta(id);
    if (meta.packageUrl) {
      this.packageUrl.set(meta.packageUrl);
    }
    if (meta.title) {
      this.form.patchValue({ title: meta.title });
    }

    this.form.valueChanges.subscribe(() => this.pushPreview());
  }

  private buildContent(): CustomContent {
    return { ...this.form.getRawValue() };
  }

  protected pushPreview(): void {
    const frame = this.iframe()?.nativeElement;
    if (!frame?.contentWindow) {
      return;
    }
    const v = this.form.getRawValue();
    frame.contentWindow.postMessage(
      {
        __inviteData: {
          event: {
            title: v.title,
            subtitle: v.subtitle,
            description: v.description,
            date: v.date,
            time: v.time,
            venue: { name: v.venueName, address: v.venueAddress },
            schedule: v.schedule,
            dressCode: v.dressCode,
          },
          guest: { name: 'Guest' },
          inviter: { name: '' },
        },
      },
      '*',
    );
  }

  protected onFrameLoad(): void {
    setTimeout(() => this.pushPreview(), 120);
  }

  private persist() {
    return this.api.saveContent(this.campaignId(), {
      customContentJson: JSON.stringify(this.buildContent()),
    });
  }

  protected saveDraft(): void {
    this.saving.set(true);
    this.persist().subscribe({
      next: () => {
        this.saving.set(false);
        this.savedAt.set(new Date().toLocaleTimeString());
      },
      error: () => this.saving.set(false),
    });
  }

  protected next(): void {
    this.saving.set(true);
    this.persist().subscribe({
      next: () => {
        this.saving.set(false);
        this.router.navigate(['/create', this.campaignId(), 'guests']);
      },
      error: () => this.saving.set(false),
    });
  }
}
