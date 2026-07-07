import { Component, ElementRef, computed, input, signal, viewChild } from '@angular/core';

function fmt(s: number): string {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/** `ui-video-player` — native `<video>` with themed controls (play, scrub, time, volume, speed, fullscreen). */
@Component({
  selector: 'ui-video-player',
  template: `
    <div class="vp" #wrap>
      <video #video [src]="src()" [poster]="poster()" (click)="toggle()"
             (timeupdate)="time.set(video.currentTime)"
             (loadedmetadata)="duration.set(video.duration)"
             (play)="playing.set(true)" (pause)="playing.set(false)"></video>
      <div class="controls">
        <button type="button" class="ic" (click)="toggle()" [attr.aria-label]="playing() ? 'Pause' : 'Play'">{{ playing() ? '❚❚' : '▶' }}</button>
        <span class="t">{{ fmt(time()) }}</span>
        <input class="seek" type="range" min="0" [max]="duration() || 0" step="0.1" [value]="time()"
               aria-label="Seek" (input)="seek($event)" />
        <span class="t">{{ fmt(duration()) }}</span>
        <input class="vol" type="range" min="0" max="1" step="0.05" [value]="volume()" aria-label="Volume" (input)="setVol($event)" />
        <select class="rate" aria-label="Playback speed" (change)="setRate($event)">
          @for (r of rates; track r) { <option [value]="r" [selected]="r === 1">{{ r }}×</option> }
        </select>
        <button type="button" class="ic" (click)="fullscreen()" aria-label="Fullscreen">⛶</button>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .vp { position: relative; background: #000; border-radius: var(--ui-radius); overflow: hidden; }
    video { display: block; width: 100%; max-height: 60vh; }
    .controls { display: flex; align-items: center; gap: var(--ui-space-2); padding: var(--ui-space-2) var(--ui-space-3);
      background: var(--ui-color-surface); border-top: 1px solid var(--ui-color-border); }
    .ic { width: 30px; height: 26px; border: none; background: transparent; color: var(--ui-color-text); cursor: pointer; border-radius: 6px; }
    .ic:hover { background: var(--ui-color-surface-raised); }
    .t { font-family: var(--ui-font-mono); font-size: 12px; color: var(--ui-color-text-muted); min-width: 38px; text-align: center; }
    .seek { flex: 1; accent-color: var(--ui-color-primary); }
    .vol { width: 70px; accent-color: var(--ui-color-primary); }
    .rate { height: 24px; background: var(--ui-color-surface); color: var(--ui-color-text); border: 1px solid var(--ui-color-border); border-radius: 6px; font-size: 12px; }
  `,
})
export class UiVideoPlayer {
  src = input.required<string>();
  poster = input<string>();
  protected readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  protected readonly wrap = viewChild.required<ElementRef<HTMLElement>>('wrap');
  protected readonly playing = signal(false);
  protected readonly time = signal(0);
  protected readonly duration = signal(0);
  protected readonly volume = signal(1);
  protected readonly rates = [0.5, 1, 1.5, 2];
  protected readonly fmt = fmt;

  protected toggle(): void {
    const v = this.video().nativeElement;
    v.paused ? v.play() : v.pause();
  }
  protected seek(e: Event): void { this.video().nativeElement.currentTime = Number((e.target as HTMLInputElement).value); }
  protected setVol(e: Event): void { const v = Number((e.target as HTMLInputElement).value); this.video().nativeElement.volume = v; this.volume.set(v); }
  protected setRate(e: Event): void { this.video().nativeElement.playbackRate = Number((e.target as HTMLSelectElement).value); }
  protected fullscreen(): void { this.wrap().nativeElement.requestFullscreen?.(); }
}
