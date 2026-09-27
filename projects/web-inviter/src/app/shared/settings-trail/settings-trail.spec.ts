import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SettingsTrail } from './settings-trail';

@Component({ template: '' })
class Blank {}

/** "‹ Settings" shows on a page opened from the gear's menu, and only there. */
describe('SettingsTrail', () => {
  let router: Router;
  let trail: SettingsTrail;

  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', component: Blank }])] });
    router = TestBed.inject(Router);
    trail = TestBed.inject(SettingsTrail);
    await router.navigateByUrl('/me/settings');
  });

  it('is off on a page reached any other way', async () => {
    await router.navigateByUrl('/pricing');
    expect(trail.active()).toBe(false);
  });

  it('is on for the page the menu opened, and inside its section', async () => {
    trail.enter('/guide');
    await router.navigateByUrl('/guide');
    expect(trail.active()).toBe(true);
    await router.navigateByUrl('/guide/sharing');
    expect(trail.active()).toBe(true);
  });

  it('ends on leaving the section, so coming back another way shows nothing', async () => {
    trail.enter('/guide');
    await router.navigateByUrl('/guide');
    await router.navigateByUrl('/feed');
    await router.navigateByUrl('/guide');
    expect(trail.active()).toBe(false);
  });

  it('does not treat a longer path as inside the section', async () => {
    trail.enter('/terms');
    await router.navigateByUrl('/terms-and-more');
    expect(trail.active()).toBe(false);
  });

  it('survives a refresh', async () => {
    trail.enter('/billing');
    await router.navigateByUrl('/billing');
    expect(sessionStorage.getItem('ib.settingsTrail')).toBe('/billing');
  });
});
