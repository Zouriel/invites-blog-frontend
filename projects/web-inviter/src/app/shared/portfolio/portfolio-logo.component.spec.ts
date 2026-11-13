import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiService } from '../api/api.service';
import { PortfolioCoverComponent } from './portfolio-cover.component';
import { PortfolioLogoComponent } from './portfolio-logo.component';
import { Portfolio, PortfolioOptions } from './portfolio.types';

function portfolio(over: Partial<Portfolio> = {}): Portfolio {
  return {
    id: 'p1', handle: 'studio', publicUrl: 'https://invites.blog/@studio', displayName: 'Lens Studio', tagline: null,
    logoUrl: null, coverImageUrl: null, coverSource: 'none', coverPhotoId: null, coverUrl: null,
    theme: 'oxblood', accent: 'theme', font: 'classic',
    contact: { whatsApp: null, viber: null, instagram: null, phone: null, email: null, enquiries: true },
    published: true, publishedAt: null, setupDone: true, photoCount: 0, photoLimit: 500, unreadEnquiries: 0,
    sections: [], collections: [], ...over,
  } as Portfolio;
}

function api() {
  return {
    setPortfolioLogo: vi.fn(() => of(portfolio({ logoUrl: '/assets/l2.png' }))),
    removePortfolioLogo: vi.fn(() => of(portfolio())),
    updatePortfolio: vi.fn((b: object) => of(portfolio({ logoUrl: '/assets/l.png', ...b }))),
    setPortfolioCover: vi.fn(),
    removePortfolioCover: vi.fn(() => of(portfolio())),
  };
}

function mountLogo(p: Portfolio, options: PortfolioOptions | null = null) {
  const a = api();
  TestBed.configureTestingModule({ imports: [PortfolioLogoComponent], providers: [{ provide: ApiService, useValue: a }] });
  const fixture = TestBed.createComponent(PortfolioLogoComponent);
  fixture.componentRef.setInput('portfolio', p);
  fixture.componentRef.setInput('options', options);
  const changed: Portfolio[] = [];
  fixture.componentInstance.changed.subscribe((x) => changed.push(x));
  fixture.detectChanges();
  return { fixture, api: a, el: fixture.nativeElement as HTMLElement, changed };
}

const radios = (el: HTMLElement, label: string) =>
  [...el.querySelectorAll<HTMLElement>(`ui-choice-grid[label="${label}"] [role="radio"]`)];

describe('portfolio logo: one upload box', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('with no logo: only the empty upload box, no avatar, Remove or placement', () => {
    const { el } = mountLogo(portfolio());
    expect(el.querySelectorAll('ui-file-upload').length).toBe(1);
    expect(el.querySelector('ui-file-upload img.preview')).toBeNull();
    expect(el.querySelector('ui-avatar')).toBeNull();
    expect(el.textContent).not.toContain('Remove');
    expect(el.querySelector('ui-choice-grid')).toBeNull();
  });

  it('with a logo: the same single box shows it; under it the avatar with Remove beside it', () => {
    const { el, api } = mountLogo(portfolio({ logoUrl: '/assets/l.png' }));
    const boxes = el.querySelectorAll('ui-file-upload');
    expect(boxes.length).toBe(1);
    const img = boxes[0].querySelector<HTMLImageElement>('img.preview')!;
    expect(img.getAttribute('src')).toBe('/assets/l.png');
    // Contained, so a see-through logo is shown whole on the box's own background.
    expect(boxes[0].querySelector('.dz')!.classList).toContain('fit-contain');
    // Remove is beside the avatar, not inside the box.
    const small = el.querySelector('.small')!;
    expect(small.querySelector('ui-avatar')).not.toBeNull();
    const remove = [...small.querySelectorAll('button')].find((b) => b.textContent?.includes('Remove'))!;
    expect(boxes[0].querySelector('.remove')).toBeNull();
    remove.click();
    expect(api.removePortfolioLogo).toHaveBeenCalled();
  });

  it('a picked file uploads at once', () => {
    const { el, api } = mountLogo(portfolio({ logoUrl: '/assets/l.png' }));
    const input = el.querySelector<HTMLInputElement>('ui-file-upload input[type=file]')!;
    const file = new File(['x'], 'logo.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));
    expect(api.setPortfolioLogo).toHaveBeenCalledWith(file);
  });

  it('places the logo: five named spots and three sizes, saved at once; built-in choices until the server lists them', async () => {
    const { el, api, fixture, changed } = mountLogo(portfolio({ logoUrl: '/assets/l.png' }));
    const spots = radios(el, 'Where the logo sits on the cover');
    expect(spots.map((r) => r.textContent?.trim())).toEqual(['Top left', 'Top middle', 'Middle', 'Bottom left', 'Bottom middle']);
    expect(radios(el, 'Logo size').map((r) => r.textContent?.trim())).toEqual(['Small', 'Medium', 'Large']);
    // Middle and Medium until the server says otherwise.
    expect(spots[2].getAttribute('aria-checked')).toBe('true');
    spots[0].click();
    fixture.detectChanges();
    expect(api.updatePortfolio).toHaveBeenCalledWith({ logoPosition: 'top-left' });
    radios(el, 'Logo size')[2].click();
    expect(api.updatePortfolio).toHaveBeenCalledWith({ logoSize: 'large' });
    await fixture.whenStable();
    expect(changed.length).toBe(2);
    // The one already chosen isn't saved again.
    api.updatePortfolio.mockClear();
    radios(el, 'Logo size')[1].click();
    expect(api.updatePortfolio).not.toHaveBeenCalled();
  });

  it("uses the server's names when it lists them", () => {
    const options = {
      themes: [], accents: [], fonts: [], layouts: [], sectionKinds: [],
      logoPositions: [{ key: 'top-left', label: 'Up left' }, { key: 'center', label: 'Centre' }],
      logoSizes: [{ key: 'small', label: 'Little' }],
    } as PortfolioOptions;
    const { el } = mountLogo(portfolio({ logoUrl: '/assets/l.png', logoPosition: 'top-left' }), options);
    const spots = radios(el, 'Where the logo sits on the cover');
    expect(spots.map((r) => r.textContent?.trim())).toEqual(['Up left', 'Centre']);
    expect(spots[0].getAttribute('aria-checked')).toBe('true');
  });
});

describe('portfolio cover picture: one upload box', () => {
  afterEach(() => TestBed.resetTestingModule());

  function mountCover(p: Portfolio) {
    const a = api();
    TestBed.configureTestingModule({ imports: [PortfolioCoverComponent], providers: [{ provide: ApiService, useValue: a }] });
    const fixture = TestBed.createComponent(PortfolioCoverComponent);
    fixture.componentRef.setInput('portfolio', p);
    fixture.detectChanges();
    return { api: a, el: fixture.nativeElement as HTMLElement };
  }

  it('empty: one box and a line saying what the page uses meanwhile', () => {
    const { el } = mountCover(portfolio({ coverSource: 'auto', coverUrl: '/assets/first.jpg' }));
    expect(el.querySelectorAll('ui-file-upload').length).toBe(1);
    expect(el.querySelector('img.preview')).toBeNull();
    expect(el.querySelectorAll('img').length).toBe(0);
    expect(el.textContent).toContain('first photo of your first collection');
    expect(el.textContent).not.toContain('Remove');
  });

  it('uploaded: the same box shows it, with Remove under it', () => {
    const { el, api } = mountCover(portfolio({ coverSource: 'upload', coverImageUrl: '/assets/cover.jpg', coverUrl: '/assets/cover.jpg' }));
    expect(el.querySelectorAll('ui-file-upload').length).toBe(1);
    // Only one picture on screen: the one in the box.
    expect(el.querySelectorAll('img').length).toBe(1);
    expect(el.querySelector('ui-file-upload img.preview')!.getAttribute('src')).toBe('/assets/cover.jpg');
    el.querySelector<HTMLButtonElement>('ui-file-upload button.remove')!.click();
    expect(api.removePortfolioCover).toHaveBeenCalled();
  });
});
