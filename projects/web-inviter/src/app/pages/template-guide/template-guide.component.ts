import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiAlert } from '@zouriel/ui/alert';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiColumn, UiTable } from '@zouriel/ui/table';
import { UiText } from '@zouriel/ui/text';

type TagRow = Record<'tag' | 'does' | 'example', string>;
type HintRow = Record<'hint' | 'on' | 'does', string>;
type TypeRow = Record<'type' | 'gets', string>;
type PathRow = Record<'path' | 'by', string>;
type RoleJobRow = Record<'want' | 'use' | 'when', string>;
type MultiRoleRow = Record<'thing' | 'gets', string>;
type ThemeRow = Record<'property' | 'becomes' | 'meaning', string>;
type ManifestRow = Record<'field' | 'from', string>;

/**
 * How to author a template, in the app rather than only in the repo.
 *
 * The reference lived in TEMPLATE-GUIDE.md, which is no use to a community designer who never sees
 * the source — they were expected to write a template against tags nobody had told them about.
 * The page follows the same order as public/template-guide.md; change one and change the other.
 */
@Component({
  selector: 'app-template-guide',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiAlert, UiButton, UiCard, UiTable, UiText],
  templateUrl: './template-guide.component.html',
  styleUrl: './template-guide.component.scss',
})
export class TemplateGuideComponent {
  /** The reference is also a static file — open it in a new tab rather than navigate the SPA away. */
  protected openPlainText(): void {
    window.open('/template-guide.md', '_blank', 'noopener');
  }

  /** The table of contents. Each id is the fragment of a section heading on the page. */
  protected readonly sections = [
    { id: 'what', label: 'What a template is' },
    { id: 'example', label: 'A minimal working example' },
    { id: 'tags', label: 'The tags' },
    { id: 'roles', label: 'Roles' },
    { id: 'theming', label: 'Theming' },
    { id: 'motion', label: 'Motion and JavaScript' },
    { id: 'manifest', label: 'The manifest' },
    { id: 'packaging', label: 'Packaging and uploading' },
    { id: 'checklist', label: 'Checklist and common mistakes' },
  ];

  protected readonly tagDefs: UiColumn<TagRow>[] = [
    { key: 'tag', header: 'Tag' },
    { key: 'does', header: 'What it does' },
    { key: 'example', header: 'Example' },
  ];

  protected readonly fillRows: TagRow[] = [
    { tag: 'data-var="PATH"', does: 'Sets the element’s text', example: '<h1 data-var="event.title">Our Day</h1>' },
    { tag: 'data-href="PATH"', does: 'Sets a link’s href', example: '<a data-href="rsvp.link" href="#">RSVP</a>' },
    {
      tag: 'data-src="PATH"',
      does: 'Sets an image’s src, and adds an upload slot to the builder',
      example: '<img data-src="event.coverImage" alt="">',
    },
    {
      tag: 'data-dress-colors',
      does: 'Filled with this guest’s dress colour swatches (see Roles)',
      example: '<div data-dress-colors></div>',
    },
  ];

  protected readonly showRows: TagRow[] = [
    {
      tag: 'data-optional',
      does: 'Hides the element when nothing inside it was filled',
      example: '<p data-optional>Dress code: <span data-var="event.dressCode"></span></p>',
    },
    {
      tag: 'data-block="ID"',
      does: 'A section only some guests see, by role',
      example: '<section data-block="bridesmaidInstructions">',
    },
  ];

  protected readonly motionRows: TagRow[] = [
    {
      tag: 'data-reveal',
      does: 'Gets the class is-visible once its top edge is within 90% of the screen height',
      example: '<section data-reveal>',
    },
    {
      tag: 'data-envelope',
      does: 'Gets the class is-open once the reader has scrolled a quarter of the screen height',
      example: '<header data-envelope>',
    },
  ];

  protected readonly hintDefs: UiColumn<HintRow>[] = [
    { key: 'hint', header: 'Hint' },
    { key: 'on', header: 'Put it on' },
    { key: 'does', header: 'What it does' },
  ];

  protected readonly hintRows: HintRow[] = [
    { hint: 'data-field-label="Gift note"', on: 'a data-var or data-href element', does: 'Sets the label of the input. Without it, the label is made from the path.' },
    { hint: 'data-type="textarea"', on: 'a data-var element', does: 'Picks the kind of input (see below).' },
    { hint: 'data-options="Formal,Casual"', on: 'a data-type="select" element', does: 'The choices in the dropdown. Required for select.' },
    { hint: 'data-slot-label="Cover photo"', on: 'a data-src image', does: 'Names the upload slot.' },
    { hint: 'data-multiple="true"', on: 'a data-src image', does: 'Turns the slot into a gallery: the inviter adds, orders and removes several photos.' },
    { hint: 'data-min-images="2" / data-max-images="8"', on: 'a data-multiple image', does: 'Limits the gallery size. Both optional.' },
    { hint: 'data-role-scope="bride"', on: 'a data-var, data-href or data-src element', does: 'The field belongs to one role instead of being shared (see Roles).' },
  ];

  protected readonly typeDefs: UiColumn<TypeRow>[] = [
    { key: 'type', header: 'data-type' },
    { key: 'gets', header: 'The inviter gets' },
  ];

  protected readonly typeRows: TypeRow[] = [
    { type: 'text', gets: 'a one-line box' },
    { type: 'textarea', gets: 'a multi-line box' },
    { type: 'date', gets: 'a date picker (shown to guests as e.g. “Saturday, 28 August 2026”)' },
    { type: 'time', gets: 'a time picker (shown to guests as e.g. “10:00 PM”)' },
    { type: 'url', gets: 'a link box' },
    { type: 'color', gets: 'a colour picker' },
    { type: 'select', gets: 'a dropdown of your data-options. An upload without data-options is rejected.' },
    { type: 'image', gets: 'an upload slot (you’d normally use data-src instead)' },
  ];

  protected readonly pathDefs: UiColumn<PathRow>[] = [
    { key: 'path', header: 'Path' },
    { key: 'by', header: 'Filled by' },
  ];

  protected readonly pathRows: PathRow[] = [
    { path: 'event.* — any name you invent, e.g. event.title, event.hashtag, event.coverImage', by: 'The inviter, in the builder' },
    { path: 'event.venue.name, event.venue.address, event.venue.mapLink', by: 'The inviter, on the Venue step' },
    { path: 'inviter.name, inviter.phone, inviter.email', by: 'The inviter, on the Inviter step' },
    { path: 'guest.name, guest.role, guest.gender', by: 'Each guest’s own details, added automatically' },
    { path: 'rsvp.link, rsvp.label, rsvp.status', by: 'The platform' },
    { path: 'invite.link, camera.link, photos.link', by: 'The platform' },
  ];

  protected readonly roleJobDefs: UiColumn<RoleJobRow>[] = [
    { key: 'want', header: 'You want…' },
    { key: 'use', header: 'Use' },
    { key: 'when', header: 'Decided when' },
  ];

  protected readonly roleJobRows: RoleJobRow[] = [
    { want: 'a field that each role fills with its own value', use: 'data-role-scope', when: 'the inviter fills the builder' },
    { want: 'a section that only some guests see', use: 'data-block', when: 'the invitation is sent' },
    { want: 'the colours each guest should wear', use: 'data-dress-colors', when: 'the invitation is sent' },
  ];

  protected readonly multiRoleDefs: UiColumn<MultiRoleRow>[] = [
    { key: 'thing', header: 'Thing' },
    { key: 'gets', header: 'A guest with several roles gets' },
  ];

  protected readonly multiRoleRows: MultiRoleRow[] = [
    { thing: 'data-block sections', gets: 'Every section any of their roles would see' },
    { thing: 'data-role-scope fields', gets: 'Filled from any of their roles' },
    { thing: 'Dress colours', gets: 'One row of swatches per role that has a palette' },
    { thing: 'Theme colours', gets: 'Their first role’s theme' },
    { thing: 'guest.role', gets: 'Their first role (guest.roles has them all)' },
  ];

  protected readonly themeDefs: UiColumn<ThemeRow>[] = [
    { key: 'property', header: 'Property' },
    { key: 'becomes', header: 'Saved as' },
    { key: 'meaning', header: 'Use it for' },
  ];

  protected readonly themeRows: ThemeRow[] = [
    { property: '--ib-accent', becomes: 'accentColor', meaning: 'Highlights, rules, buttons' },
    { property: '--ib-bg', becomes: 'backgroundColor', meaning: 'Page background' },
    { property: '--ib-text', becomes: 'textColor', meaning: 'Body text' },
  ];

  protected readonly manifestDefs: UiColumn<ManifestRow>[] = [
    { key: 'field', header: 'Manifest field' },
    { key: 'from', header: 'Built from' },
  ];

  protected readonly manifestRows: ManifestRow[] = [
    { field: 'variables', from: 'every data-var, data-href and data-src path' },
    { field: 'fields', from: 'one entry per data-var / data-href path: key, label, type, options, roleScope' },
    { field: 'imageSlots', from: 'one entry per data-src path: key, label, multiple, minImages, maxImages, roleScope' },
    { field: 'contentBlocks', from: 'every data-block name' },
    { field: 'roles', from: 'the ib-roles meta tag plus every data-role-scope, as slugs' },
    { field: 'roleDefinitions', from: 'per role: slug, label, themeKeys, and the fields and imageSlots scoped to it' },
    { field: 'theme', from: 'every --ib-* property (key, cssVar, label, type, default), the ib-fonts list, and the three required colours' },
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

  protected readonly repoFolderExample = `InvitesBlog.Infrastructure/RawTemplates/<your-slug>/
  index.html     # the whole template
  meta.json      # name, slug, version, category, description
  poster.webp    # optional but wanted: the still the gallery card shows`;

  protected readonly metaExample = `{ "name": "Aurora Vows", "slug": "aurora-vows", "version": "1.0.0",
  "category": "Wedding", "description": "A warm gold-on-ink wedding invite." }`;

  protected readonly checklist = [
    'One file. No <link rel="stylesheet">, no <script src>.',
    'Images and fonts embedded as data: URIs.',
    'Under 300 KB if you can, and never over 800 KB.',
    '--ib-accent, --ib-bg and --ib-text declared in :root and used in your CSS.',
    'Every value that can be empty is wrapped in data-optional.',
    'Every data-type="select" has data-options.',
    'The RSVP button binds rsvp.link and rsvp.label, inside data-optional.',
    'A data-dress-colors spot, styled, if your design has a place for it.',
    'Content every guest needs is outside any data-block.',
    'Tested with fields empty, with a guest with no role, and with a guest with two roles.',
    'Tested in the builder preview while editing, and on a phone.',
    'Check passes and lists the fields you expect.',
  ];
}
