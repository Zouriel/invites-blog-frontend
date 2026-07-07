import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiResult } from 'ui/feedback';
import { UiSpinner } from 'ui/spinner';
import { UiContainer, UiStack } from 'ui/layout';
import { UiText } from 'ui/text';
import { ApiService } from '../../shared/api/api.service';
import { PrivacyState } from '../../shared/utils/enums/view-state.enum';
import { PrivacyRemoveInfo } from '../../shared/utils/types/api.types';

@Component({
  selector: 'app-privacy-remove',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiButton, UiCard, UiResult, UiSpinner, UiContainer, UiStack, UiText],
  templateUrl: './privacy-remove.html',
  styleUrl: './privacy-remove.scss',
})
export class PrivacyRemoveComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);

  protected readonly PrivacyState = PrivacyState;
  protected readonly state = signal<PrivacyState>(PrivacyState.Loading);
  protected readonly info = signal<PrivacyRemoveInfo | null>(null);
  protected readonly submitting = signal(false);

  private token = '';

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    this.api.getPrivacyRemoveInfo(this.token).subscribe({
      next: (info) => {
        this.info.set(info);
        this.state.set(info.alreadyRemoved ? PrivacyState.Already : PrivacyState.Confirm);
      },
      error: () => this.state.set(PrivacyState.Error),
    });
  }

  contacts(info: PrivacyRemoveInfo): string {
    const parts: string[] = [];
    if (info.hasPhone) {
      parts.push('phone number');
    }
    if (info.hasEmail) {
      parts.push('email address');
    }
    return parts.join(' and ');
  }

  remove(): void {
    this.submitting.set(true);
    this.api.privacyRemove(this.token).subscribe({
      next: () => {
        this.submitting.set(false);
        this.state.set(PrivacyState.Done);
      },
      error: () => this.submitting.set(false),
    });
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}
