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
type ThemeRow = Record<'property' | 'becomes' | 'meaning', string>;

/**
 * How to author a template, in the app rather than only in the repo.
 *
 * The reference lived in TEMPLATE-GUIDE.md, which is no use to a community designer who never sees
 * the source — they were expected to write a template against tags nobody had told them about.
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

  protected readonly tagDefs: UiColumn<TagRow>[] = [
    { key: 'tag', header: 'Tag' },
    { key: 'does', header: 'What it does' },
    { key: 'example', header: 'Example' },
  ];

  protected readonly tagRows: TagRow[] = [
    { tag: 'data-var="PATH"', does: 'Fills the element’s text', example: '<h1 data-var="event.title">' },
    { tag: 'data-href="PATH"', does: 'Fills a link', example: '<a data-href="rsvp.link">RSVP</a>' },
    {
      tag: 'data-src="PATH"',
      does: 'Fills an image — becomes an upload slot in the builder',
      example: '<img data-src="event.coverImage">',
    },
    {
      tag: 'data-block="ID"',
      does: 'A section only some guests see. A block no rule mentions is shown to everyone.',
      example: '<section data-block="maleDressCode">',
    },
    {
      tag: 'data-optional',
      does: 'Hides the element when its value is empty — put it on anything that might be left blank',
      example: '<p data-optional data-var="event.dressCode">',
    },
    {
      tag: 'data-reveal',
      does: 'Gets the class is-visible when scrolled into view — animate it in your CSS',
      example: '<section data-reveal>',
    },
    {
      tag: 'data-envelope',
      does: 'The cover gets is-open after the first scroll — animate a seal or flap',
      example: '<header data-envelope>',
    },
  ];

  protected readonly hintDefs: UiColumn<HintRow>[] = [
    { key: 'hint', header: 'Hint' },
    { key: 'on', header: 'Put it on' },
    { key: 'does', header: 'Does' },
  ];

  protected readonly hintRows: HintRow[] = [
    { hint: 'data-field-label="Gift note"', on: 'a data-var / data-href element', does: 'Sets the box’s label (otherwise it’s guessed from the path)' },
    { hint: 'data-type="textarea"', on: 'a data-var element', does: 'Forces the input kind — see below' },
    { hint: 'data-options="Formal,Casual"', on: 'a data-type="select" element', does: 'The allowed values of the dropdown (required for select)' },
    { hint: 'data-slot-label="Cover photo"', on: 'a data-src image', does: 'Names the image slot in the builder' },
    { hint: 'data-multiple="true"', on: 'a data-src image', does: 'Makes the slot a gallery — the inviter adds, reorders and removes a list of photos' },
    { hint: 'data-min-images="2" / data-max-images="8"', on: 'a data-multiple image', does: 'Bounds the gallery (both optional, unbounded by default)' },
    { hint: 'data-role-scope="groom"', on: 'any data-var / data-href / data-src element', does: 'Marks the field as belonging to one role instead of being shared' },
  ];

  protected readonly typeDefs: UiColumn<TypeRow>[] = [
    { key: 'type', header: 'data-type' },
    { key: 'gets', header: 'Inviter gets' },
  ];

  protected readonly typeRows: TypeRow[] = [
    { type: 'text', gets: 'a single-line box' },
    { type: 'textarea', gets: 'a multi-line box' },
    { type: 'date', gets: 'a date picker' },
    { type: 'time', gets: 'a time picker' },
    { type: 'url', gets: 'a link box' },
    { type: 'color', gets: 'a colour picker' },
    { type: 'select', gets: 'a dropdown of your data-options — must be paired with data-options, or the upload is rejected' },
    { type: 'image', gets: 'an upload slot (usually you just use data-src instead)' },
  ];

  protected readonly themeDefs: UiColumn<ThemeRow>[] = [
    { key: 'property', header: 'Property' },
    { key: 'becomes', header: 'Becomes' },
    { key: 'meaning', header: 'Meaning' },
  ];

  protected readonly themeRows: ThemeRow[] = [
    { property: '--ib-accent', becomes: 'accentColor', meaning: 'Highlights, rules, buttons' },
    { property: '--ib-bg', becomes: 'backgroundColor', meaning: 'Page background' },
    { property: '--ib-text', becomes: 'textColor', meaning: 'Body text' },
  ];

  protected readonly paths = `event.title          event.subtitle       event.description
event.date           event.time           event.schedule       event.dressCode
event.coverImage     event.couplePhoto    (any image path you invent, via data-src)
event.<anything>     (any custom field you invent, via data-var/href)
event.venue.name     event.venue.address  event.venue.mapLink
guest.name           guest.role           guest.gender
inviter.name         inviter.phone        inviter.email
invite.link          rsvp.link            rsvp.status`;

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

<!-- Offer a font menu -->
<meta name="ib-fonts" content="Playfair Display, Cormorant, Inter">`;

  protected readonly rolesExample = `<meta name="ib-roles" content="bride, groom">
...
<img data-src="bride.photo" data-role-scope="bride" data-slot-label="Bride's photo" alt="">
<h2 data-var="groom.name" data-role-scope="groom">The groom</h2>`;

  protected readonly animationExample = `.panel{ opacity:0; transform:translateY(40px); transition:opacity .8s, transform .8s }
.panel.is-visible{ opacity:1; transform:none }

.envelope .flap{ transform-origin:top; transition:transform 1s }
.envelope.is-open .flap{ transform:rotateX(-180deg) }

@media (prefers-reduced-motion: reduce){
  .panel,.flap{ transition:none; opacity:1; transform:none }
}`;

  protected readonly starter = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>My Template</title>
  <style>
    .panel{opacity:0;transform:translateY(40px);transition:opacity .8s,transform .8s}
    .panel.is-visible{opacity:1;transform:none}
    @media (prefers-reduced-motion: reduce){.panel{opacity:1;transform:none;transition:none}}
  </style>
</head>
<body>
  <header class="cover" data-envelope>
    <span data-optional><img data-src="event.coverImage" data-slot-label="Cover photo" alt=""></span>
    <h1 data-var="event.title">Our Celebration</h1>
    <p>Dear <span data-var="guest.name">Guest</span></p>
    <p>Scroll &darr;</p>
  </header>

  <section class="panel" data-reveal>
    <p data-var="event.date">The date</p>
    <p data-optional data-var="event.dressCode">Dress code</p>
    <a data-href="rsvp.link" href="#">RSVP</a>
  </section>

  <section class="panel" data-reveal data-block="maleDressCode"><p>Gentlemen: formal suit.</p></section>
  <section class="panel" data-reveal data-block="femaleDressCode"><p>Ladies: evening formal.</p></section>
</body>
</html>`;
}
