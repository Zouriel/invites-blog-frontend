import { Component, ElementRef, input, signal, viewChild } from '@angular/core';

function fmt(s: number): string {
  if (!isFinite(s)) return '0:00';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

/** `ui-audio-player` — themed audio controls (play, scrub, time, volume). */
@Component({
  selector: 'ui-audio-player',
  template: `
    <div class="ap">
      <audio #audio [src]="src()" (timeupdate)="time.set(audio.currentTime)"
             (loadedmetadata)="duration.set(audio.duration)"
             (play)="playing.set(true)" (pause)="playing.set(false)" (ended)="playing.set(false)"></audio>
      <button type="button" class="play" (click)="toggle()" [attr.aria-label]="playing() ? 'Pause' : 'Play'">{{ playing() ? '❚❚' : '▶' }}</button>
      @if (title()) { <span class="title">{{ title() }}</span> }
      <span class="t">{{ fmt(time()) }}</span>
      <input class="seek" type="range" min="0" [max]="duration() || 0" step="0.1" [value]="time()" aria-label="Seek" (input)="seek($event)" />
      <span class="t">{{ fmt(duration()) }}</span>
    </div>
  `,
  styles: `
    :host { display: block; }
    .ap { display: flex; align-items: center; gap: var(--ui-space-2); padding: var(--ui-space-2) var(--ui-space-3);
      background: var(--ui-color-surface); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); font-family: var(--ui-font-default); }
    .play { width: 32px; height: 32px; border-radius: 50%; border: none; background: var(--ui-color-primary); color: var(--ui-color-primary-contrast); cursor: pointer; font-size: 12px; flex: none; }
    .title { font-size: var(--ui-font-size-sm); color: var(--ui-color-text); white-space: nowrap; max-width: 120px; overflow: hidden; text-overflow: ellipsis; }
    .t { font-family: var(--ui-font-mono); font-size: 12px; color: var(--ui-color-text-muted); min-width: 38px; text-align: center; }
    .seek { flex: 1; accent-color: var(--ui-color-primary); }
  `,
})
export class UiAudioPlayer {
  src = input.required<string>();
  title = input<string>();
  protected readonly audio = viewChild.required<ElementRef<HTMLAudioElement>>('audio');
  protected readonly playing = signal(false);
  protected readonly time = signal(0);
  protected readonly duration = signal(0);
  protected readonly fmt = fmt;

  protected toggle(): void { const a = this.audio().nativeElement; a.paused ? a.play() : a.pause(); }
  protected seek(e: Event): void { this.audio().nativeElement.currentTime = Number((e.target as HTMLInputElement).value); }
}
