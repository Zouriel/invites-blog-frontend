import type { UiTourLabels, UiTourSpec, UiTourStep } from '@zouriel/ui/guidance';

/**
 * Tip, tour and offer ids, anchors and words, from docs/GUIDANCE.md. The Flutter app uses the same
 * ids and wording: the account remembers what it has seen by these ids, on both. Never rename one here
 * only.
 */
export const TIP = {
  checklist: 'guide.checklist',
  offerWelcome: 'offer.welcome',
  offerHost: 'offer.host',
  offerGuest: 'offer.guest',
  tourWelcome: 'tour.welcome',
  tourCelebrant: 'tour.celebrant',
  tourHost: 'tour.host',
  tourGuest: 'tour.guest',
  feedTemplates: 'tip.feed.templates',
  inboxNew: 'tip.inbox.new',
  newWho: 'tip.new.who',
  meSettings: 'tip.me.settings',
  dashPeople: 'tip.dash.people',
  albumQr: 'tip.album.qr',
  albumSelect: 'tip.album.select',
  favourites: 'tip.favourites',
  templatesDrafts: 'tip.templates.drafts',
} as const;

/** One-off tip words (section 6). */
export const TIP_TEXT = {
  feedTemplates: 'Browse designs for every occasion here.',
  inboxNew: "New marks invitations you haven't opened.",
  newWho: "Add the people it's for. They'll see guests and photos.",
  meSettings: 'Your plan, sign-in and tips live here.',
  dashPeople: 'Switch between guests and celebrants.',
  albumQr: 'Print or show this code so guests can add photos.',
  albumSelect: 'Long-press a photo to select and share several.',
  favourites: 'Double-tap a photo to add it to Favourites.',
  templatesDrafts: 'Invitations you started wait here.',
} as const;

/** The words every tour bubble uses. */
export const TOUR_LABELS: UiTourLabels = {
  back: 'Back',
  next: 'Next',
  done: 'Done',
  skip: 'Skip',
  turnOff: 'Turn off tips',
  step: '{n} of {total}',
};

const tour = (id: string, steps: UiTourStep[]): UiTourSpec => ({ id, steps, labels: TOUR_LABELS, turnOff: true });

/** Section 5. Anchor ids are shared with the app. */
export const TOURS = {
  welcome: tour(TIP.tourWelcome, [
    { anchor: 'nav.feed', text: 'Your events and the people in them show up here.', placement: 'top' },
    { anchor: 'nav.inbox', text: 'Invitations sent to you land here.', placement: 'top' },
    { anchor: 'nav.new', text: 'Start an event: pick a design, add guests, send.', placement: 'top' },
    { anchor: 'nav.me', text: 'Events you host, your plan and settings.', placement: 'top' },
  ]),
  celebrant: (full: boolean) =>
    tour(TIP.tourCelebrant, [
      { anchor: 'dash.guests', text: "See who's coming and what they replied." },
      { anchor: 'dash.album', text: 'Every photo and video guests add lands here.' },
      { anchor: 'dash.add-media', text: 'Add your own photos too.' },
      ...(full ? [{ anchor: 'dash.celebrants', text: 'You can manage this event with the organiser.' }] : []),
    ]),
  host: tour(TIP.tourHost, [
    { anchor: 'dash.guests', text: 'Add guests one by one or upload a list.' },
    { anchor: 'dash.send', text: 'Send the invitations or share one link.' },
    { anchor: 'dash.album-code', text: 'Guests scan this QR code to add photos.' },
    { anchor: 'dash.covers', text: 'Pick the photos that head your event in the feed.' },
    { anchor: 'dash.celebrants', text: 'Add the people this event is for.' },
  ]),
  guest: tour(TIP.tourGuest, [
    { anchor: 'inv.view', text: 'Open your invitation and reply here.' },
    { anchor: 'inv.add-photos', text: 'Add your photos from the day.' },
    { anchor: 'inv.album', text: "Everyone's photos land here." },
  ]),
};

/** A one-off tip that points at something a hint can't sit on (a tab button): a one-step coach mark. */
export const tabTip = (id: string, anchor: string, text: string): UiTourSpec => ({
  id,
  steps: [{ anchor, text }],
  labels: { ...TOUR_LABELS, done: 'Got it' },
  turnOff: true,
});

/** Where the empty-page pictures live (public/empty-art). Bump V when a picture changes. */
export type EmptyArtKey =
  | 'feed'
  | 'inbox'
  | 'hosting'
  | 'photos'
  | 'guests'
  | 'celebrants'
  | 'drafts'
  | 'favourites'
  | 'requested'
  | 'designs';
export const EMPTY_ART_VERSION = 1;
