import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiButton } from '@zouriel/ui/button';
import { SessionStore } from '../../shared/services/session.store';

/** A term and what it means, with an optional one-line example. Drawn as a hairline list, not a table. */
interface Def {
  term: string;
  text: string;
  example?: string;
}

/**
 * How to author a template: the "Making a template" guide in the help centre.
 *
 * <p>It reads like the other guides (their shared prose styles, a term list instead of a table, so
 * nothing is squeezed on a phone). The plain-text reference in public/template-guide.md covers the
 * same ground plus the team's own notes on adding a template to the repo; change one and check the
 * other.</p>
 */
@Component({
  selector: 'app-template-guide',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiButton],
  templateUrl: './template-guide.component.html',
  styleUrls: ['../guide/guide-prose.scss', './template-guide.component.scss'],
})
export class TemplateGuideComponent {
  /** Only a designer can open the designer area; everyone else is told how to become one. */
  protected readonly isDesigner = inject(SessionStore).isDesigner;

  /** The contents. Each id is the fragment of a section heading on the page. */
  protected readonly sections = [
    { id: 'what', label: 'What a template is' },
    { id: 'example', label: 'A minimal working example' },
    { id: 'tags', label: 'The tags' },
    { id: 'roles', label: 'Roles' },
    { id: 'theming', label: 'Theming' },
    { id: 'motion', label: 'Motion and JavaScript' },
    { id: 'manifest', label: 'The manifest' },
    { id: 'packaging', label: 'Packaging and submitting' },
    { id: 'checklist', label: 'Checklist and common mistakes' },
  ];

  protected readonly fillTags: Def[] = [
    { term: 'data-var="PATH"', text: 'Sets the element’s text.', example: '<h1 data-var="event.title">Our Day</h1>' },
    { term: 'data-href="PATH"', text: 'Sets a link’s href.', example: '<a data-href="rsvp.link" href="#">RSVP</a>' },
    {
      term: 'data-src="PATH"',
      text: 'Sets an image’s src, and adds an upload slot to the builder.',
      example: '<img data-src="event.coverImage" alt="">',
    },
    {
      term: 'data-dress-colors',
      text: 'Filled with this guest’s dress colour swatches (see Roles).',
      example: '<div data-dress-colors></div>',
    },
  ];

  protected readonly showTags: Def[] = [
    {
      term: 'data-optional',
      text: 'Hides the element when nothing inside it was filled.',
      example: '<p data-optional>Dress code: <span data-var="event.dressCode"></span></p>',
    },
    {
      term: 'data-block="ID"',
      text: 'A section only some guests see, by role.',
      example: '<section data-block="bridesmaidInstructions">',
    },
  ];

  protected readonly motionTags: Def[] = [
    {
      term: 'data-reveal',
      text: 'Gets the class is-visible once its top edge is within 90% of the screen height.',
      example: '<section data-reveal>',
    },
    {
      term: 'data-envelope',
      text: 'Gets the class is-open once the reader has scrolled a quarter of the screen height.',
      example: '<header data-envelope>',
    },
  ];

  protected readonly hints: Def[] = [
    { term: 'data-field-label="Gift note"', text: 'On a data-var or data-href element. Sets the input’s label; without it, the label is made from the path.' },
    { term: 'data-type="textarea"', text: 'On a data-var element. Picks the kind of input (see below).' },
    { term: 'data-options="Formal,Casual"', text: 'On a data-type="select" element. The choices in the dropdown. Required for select.' },
    { term: 'data-slot-label="Cover photo"', text: 'On a data-src image. Names the upload slot.' },
    { term: 'data-multiple="true"', text: 'On a data-src image. Turns the slot into a gallery: the inviter adds, orders and removes several photos.' },
    { term: 'data-min-images="2" / data-max-images="8"', text: 'On a data-multiple image. Limits the gallery size. Both optional.' },
    { term: 'data-role-scope="bride"', text: 'On a data-var, data-href or data-src element. The field belongs to one role instead of being shared (see Roles).' },
  ];

  protected readonly inputKinds: Def[] = [
    { term: 'text', text: 'A one-line box.' },
    { term: 'textarea', text: 'A multi-line box.' },
    { term: 'date', text: 'A date picker, shown to guests as e.g. “Saturday, 28 August 2026”.' },
    { term: 'time', text: 'A time picker, shown to guests as e.g. “10:00 PM”.' },
    { term: 'url', text: 'A link box.' },
    { term: 'color', text: 'A colour picker.' },
    { term: 'select', text: 'A dropdown of your data-options. An upload without data-options is rejected.' },
    { term: 'image', text: 'An upload slot. You’d normally use data-src instead.' },
  ];

  protected readonly paths: Def[] = [
    { term: 'event.*', text: 'Any name you invent, e.g. event.title, event.hashtag or event.coverImage. Filled by the inviter in the builder.' },
    { term: 'event.venue.name, .address, .mapLink', text: 'Filled by the inviter on the Venue step.' },
    { term: 'inviter.name, .phone, .email', text: 'Filled by the inviter on the Inviter step.' },
    { term: 'guest.name, .role, .gender', text: 'Each guest’s own details, added automatically.' },
    { term: 'rsvp.link, .label, .status', text: 'Filled by invites.blog.' },
    { term: 'invite.link, camera.link, photos.link', text: 'Filled by invites.blog.' },
  ];

  protected readonly roleJobs: Def[] = [
    { term: 'A field each role fills with its own value', text: 'Use data-role-scope. Decided when the inviter fills in the builder.' },
    { term: 'A section only some guests see', text: 'Use data-block. Decided when the invitation is sent.' },
    { term: 'The colours each guest should wear', text: 'Use data-dress-colors. Decided when the invitation is sent.' },
  ];

  protected readonly multiRole: Def[] = [
    { term: 'data-block sections', text: 'Every section any of their roles would see.' },
    { term: 'data-role-scope fields', text: 'Filled from any of their roles.' },
    { term: 'Dress colours', text: 'One row of swatches per role that has a palette.' },
    { term: 'Theme colours', text: 'Their first role’s theme.' },
    { term: 'guest.role', text: 'Their first role. guest.roles has them all.' },
  ];

  protected readonly themeVars: Def[] = [
    { term: '--ib-accent', text: 'Saved as accentColor. Use it for highlights, rules and buttons.' },
    { term: '--ib-bg', text: 'Saved as backgroundColor. Use it for the page background.' },
    { term: '--ib-text', text: 'Saved as textColor. Use it for body text.' },
  ];

  protected readonly manifest: Def[] = [
    { term: 'variables', text: 'Every data-var, data-href and data-src path.' },
    { term: 'fields', text: 'One entry per data-var or data-href path: key, label, type, options and roleScope.' },
    { term: 'imageSlots', text: 'One entry per data-src path: key, label, multiple, minImages, maxImages and roleScope.' },
    { term: 'contentBlocks', text: 'Every data-block name.' },
    { term: 'roles', text: 'The ib-roles meta tag plus every data-role-scope, as slugs.' },
    { term: 'roleDefinitions', text: 'Per role: slug, label, themeKeys, and the fields and image slots scoped to it.' },
    { term: 'theme', text: 'Every --ib-* property (key, cssVar, label, type, default), the ib-fonts list and the three required colours.' },
  ];

  protected readonly starter = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>My Template</title>
  <style>
    :root{ --ib-accent:#c9a227; --ib-bg:#0b0b0f; --ib-text:#f6f2e8; }
    body{ background:var(--ib-bg); color:var(--ib-text); }
    h1{ color:var(--ib-accent); }
    .panel{ opacity:0; transform:translateY(40px); transition:opacity .8s, transform .8s; }
    .panel.is-visible{ opacity:1; transform:none; }
  </style>
</head>
<body>
  <header data-envelope>
    <span data-optional><img data-src="event.coverImage" data-slot-label="Cover photo" alt=""></span>
    <h1 data-var="event.title">Our Celebration</h1>
    <p>Dear <span data-var="guest.name">Guest</span></p>
  </header>

  <section class="panel" data-reveal>
    <p data-var="event.date">The date</p>
    <p data-optional>Dress code: <span data-var="event.dressCode"></span></p>
    <div data-dress-colors></div>
    <a data-href="rsvp.link" href="#" data-optional><span data-var="rsvp.label">Reply now</span></a>
  </section>

  <section class="panel" data-reveal data-block="familyNote">
    <p>Family, please arrive an hour early for photos.</p>
  </section>
</body>
</html>`;

  protected readonly galleryExample = `<div class="photo-strip">
  <img data-src="event.gallery" data-multiple="true" data-min-images="2" data-max-images="8"
       data-slot-label="Photo strip" alt="">
</div>`;

  protected readonly rolesMetaExample = `<meta name="ib-roles" content="Bride, Groom">`;

  protected readonly roleScopeExample = `<img data-src="bride.photo" data-role-scope="bride" data-slot-label="Bride's photo" alt="">
<h2 data-var="groom.name" data-role-scope="groom">The groom</h2>`;

  protected readonly blockExample = `<section data-block="bridesmaidInstructions">
  <p>Bridesmaids, please meet at 3pm for hair and make-up.</p>
</section>`;

  protected readonly rulesExample = `{ "rules": [
  { "condition": { "field": "role", "operator": "equals", "value": "Bridesmaids" },
    "contentBlock": "bridesmaidInstructions" }
] }`;

  protected readonly dressExample = `<!-- You write -->
<div data-dress-colors></div>

<!-- The platform fills it with -->
<div class="ib-dress">
  <p class="ib-dress__role">Groom family men</p>   <!-- only when the guest has more than one palette -->
  <div class="ib-dress__swatches">
    <span class="ib-dress__swatch" title="#1f3a5f" style="background:#1f3a5f"></span>
  </div>
</div>`;

  protected readonly themeExample = `<style>
  :root{
    --ib-accent:#c9a227;
    --ib-bg:#0b0b0f;
    --ib-text:#f6f2e8;
    --ib-heading-font:"Playfair Display", serif;
  }
  body{ background:var(--ib-bg); color:var(--ib-text); }
  h1{ font-family:var(--ib-heading-font); color:var(--ib-accent); }
</style>

<!-- Offer a list of fonts -->
<meta name="ib-fonts" content="Playfair Display, Cormorant, Inter">`;

  protected readonly animationExample = `.panel{ opacity:0; transform:translateY(40px); transition:opacity .8s, transform .8s; }
.panel.is-visible{ opacity:1; transform:none; }

.envelope .flap{ transform-origin:top; transition:transform 1s; }
.envelope.is-open .flap{ transform:rotateX(-180deg); }`;

  protected readonly eventsExample = `addEventListener('invite:data', e => { /* e.detail is the invitation data */ });
addEventListener('invite:progress', e => { /* e.detail is 0..1 down the page */ });
// window.invite.data and window.invite.progress hold the same values.`;

  protected readonly checklist = [
    'One file. No <link rel="stylesheet">, no <script src>.',
    'Images and fonts embedded as data: URIs.',
    'Under 300 KB if you can, and never over 800 KB.',
    '--ib-accent, --ib-bg and --ib-text declared in :root and used in your CSS.',
    'Every value that can be empty is wrapped in data-optional.',
    'Every data-type="select" has data-options.',
    'The RSVP button binds rsvp.link and rsvp.label, inside data-optional.',
    'A styled data-dress-colors spot, if your design has a place for it.',
    'Content every guest needs is outside any data-block.',
    'Tested with fields empty, with a guest with no role, and with a guest with two roles.',
    'Tested in the builder preview while editing, and on a phone.',
    'The Check passes and lists the fields you expect.',
  ];
}
