import { UiHandleCheck, type UiChoice } from '@zouriel/ui/form';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../shared/api/api.service';
import { APP_ICONS, AppIcon } from '../../shared/icons/app-icons';
import { collectionKind, Portfolio, PortfolioSection, PortfolioSectionKind } from '../../shared/portfolio/portfolio.types';

/** The two kinds of collection, as the choice tiles show them (setup and "Add a section"). */
export const COLLECTION_KIND_CHOICES: UiChoice[] = [
  { value: 'uploads', label: 'Upload your work', description: 'Photos from your phone or computer' },
  { value: 'events', label: 'Pick from an event', description: 'Photos you took at your events here' },
];

/** What each kind of section is called and drawn with in the editor. */
export const SECTION_LOOK: Record<PortfolioSectionKind, { label: string; icon: AppIcon; blurb: string }> = {
  cover: { label: 'Cover', icon: APP_ICONS.cover, blurb: 'Your name, logo and a big photo' },
  collection: { label: 'Collection', icon: APP_ICONS.collection, blurb: 'A set of photos' },
  about: { label: 'About', icon: APP_ICONS.about, blurb: 'A few words about you' },
  designs: { label: 'Invitation designs', icon: APP_ICONS.designer, blurb: 'Designs you published' },
  packages: { label: 'Packages & prices', icon: APP_ICONS.packages, blurb: 'What you offer' },
  reviews: { label: 'Reviews', icon: APP_ICONS.reviews, blurb: 'Kind words from clients' },
  contact: { label: 'Contact', icon: APP_ICONS.contact, blurb: 'Buttons and a message form' },
};

/** The second line of a section card. */
export function sectionDescription(s: PortfolioSection, p: Portfolio): string {
  switch (s.kind) {
    case 'cover':
      return 'Always first';
    case 'collection': {
      const c = p.collections.find((x) => x.id === s.collectionId);
      const n = c?.photos.length ?? 0;
      return `${n} ${n === 1 ? 'photo' : 'photos'}${c && collectionKind(c) === 'uploads' ? ', uploaded' : ''}`;
    }
    case 'about':
      return s.body ? s.body.slice(0, 60) : 'Not written yet';
    case 'packages':
      return s.packages.length ? `${s.packages.length} ${s.packages.length === 1 ? 'package' : 'packages'}` : 'None yet';
    case 'reviews':
      return s.reviews.length ? `${s.reviews.length} ${s.reviews.length === 1 ? 'review' : 'reviews'}` : 'None yet';
    case 'designs':
      return s.templateIds.length ? `${s.templateIds.length} chosen` : 'All your published designs';
    case 'contact': {
      const c = p.contact;
      const n = [c.whatsApp, c.viber, c.instagram, c.phone, c.email].filter(Boolean).length;
      return `${n} ${n === 1 ? 'button' : 'buttons'}${c.enquiries ? ' and a message form' : ''}`;
    }
  }
}

/** The handle field's check, answered by the server. */
export function handleChecker(api: ApiService): (h: string) => Promise<UiHandleCheck> {
  return async (h: string) => {
    try {
      const r = await firstValueFrom(api.portfolioHandleCheck(h));
      const state = r.available ? 'available' : r.reason === 'invalid' ? 'invalid' : 'taken';
      return { state, message: r.reason === 'yours' ? 'This is your link now.' : r.message, suggestion: r.suggestion ?? undefined };
    } catch {
      return { state: 'idle', message: "Couldn't check right now." };
    }
  };
}

/** A first guess at a handle from the studio's name: lowercase, dots for spaces. */
export function handleFromName(name: string): string {
  const s = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 30)
    .replace(/\.+$/, '');
  return s.length >= 3 ? s : '';
}

/** Copies text, falling back to a hidden field where the clipboard API isn't allowed. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Opens the system share sheet when there is one, else copies the link. Returns what happened. */
export async function shareLink(url: string, title: string): Promise<'shared' | 'copied' | 'failed'> {
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
  if (nav.share) {
    try {
      await nav.share({ url, title });
      return 'shared';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'shared';
    }
  }
  return (await copyText(url)) ? 'copied' : 'failed';
}
