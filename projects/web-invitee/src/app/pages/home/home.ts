import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiContainer, UiStack } from 'ui/layout';
import { UiText } from 'ui/text';
import { UiReveal } from 'ui/fx';

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiButton, UiCard, UiContainer, UiStack, UiText, UiReveal],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomeComponent {
  private router = inject(Router);

  protected readonly steps = [
    {
      title: 'Tap your link.',
      body: 'Your personalized invite opens instantly — no login, no fuss.',
    },
    {
      title: 'RSVP in a tap.',
      body: "Let the host know if you're coming. That's it.",
    },
    {
      title: 'Keep them together.',
      body: 'Verify your phone or email to collect every invite in one calm inbox.',
    },
  ];

  openInbox(): void {
    this.router.navigate(['/login']);
  }
}
