import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { SessionStore } from './shared/services/session.store';

describe('App', () => {
  const signedIn = signal(false);

  beforeEach(async () => {
    signedIn.set(false);
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        // Only the members the shell and its header actually read. A real SessionStore would go to
        // localStorage, which is not what these two assertions are about.
        {
          provide: SessionStore,
          useValue: {
            isSignedIn: signedIn,
            account: signal(null),
            roles: signal([]),
            isAdmin: signal(false),
            isDesigner: signal(false),
            displayName: signal(''),
            clear: () => {},
          },
        },
      ],
    }).compileComponents();
  });

  function shell(): HTMLElement {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the header and the footer to a visitor', () => {
    const el = shell();
    expect(el.querySelector('app-header')).toBeTruthy();
    expect(el.querySelector('app-footer')).toBeTruthy();
  });

  /**
   * Signing in swaps the marketing footer for the bottom bar. Showing both stacks a landing-page
   * footer under a fixed app bar, which is neither useful nor tidy.
   */
  it('drops the footer once signed in, and keeps room for the bottom bar', () => {
    signedIn.set(true);
    const el = shell();
    expect(el.querySelector('app-footer')).toBeNull();
    // The room the footer used to reserve now has to come from the content.
    expect(el.classList.contains('has-tabs')).toBe(true);
  });
});
