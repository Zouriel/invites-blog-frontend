import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** The template designer: pages/designer, opened from the Templates page's "Design your own" card. */
@Component({
  selector: 'app-template-designer-guide',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  styleUrls: ['../guide-prose.scss'],
  template: `
    <h2 id="what">What it is</h2>
    <p>
      The template designer is an editor in your browser for making your own animated invitation. It
      is free for every account, and it works on a phone as well as a computer. You lay out text,
      photos and shapes, decide how they move as your guest scrolls, and publish the result as a
      template you can use for an event.
    </p>
    <ul>
      <li><strong>Everything on the page can move.</strong> It fades, flies in, spins, grows, draws itself, or loops while it waits.</li>
      <li><strong>Each guest sees their own details.</strong> Fields fill in their name, the date, the venue, and a reply button and camera come with the page.</li>
      <li><strong>You decide who can use it.</strong> Keep it private, make it for one person, or share it with everyone.</li>
    </ul>

    <h2 id="open">Where to find it</h2>
    <p>
      Open <strong>Templates</strong> and choose the <strong>Design your own</strong> card at the top,
      or go straight to <a routerLink="/template-designer">the designer</a>. Your designs are listed
      there, and <strong>New design</strong> starts another. The designer opens on the website, also
      from the app.
    </p>

    <h2 id="start">Start a design</h2>
    <p>
      Pick a starter, such as an envelope that opens, or a completely blank page, and change it. You
      can also open one of your existing templates as a design.
    </p>

    <h2 id="build">Build the page</h2>
    <dl class="defs">
      <div>
        <dt>Text</dt>
        <dd>Pick a font, size and colour. Text can break into words or letters that arrive one after another.</dd>
      </div>
      <div>
        <dt>Photos and pictures</dt>
        <dd>Add your own pictures, or search the <strong>art library</strong> for free public-domain art to bring in. Animated art turns into movement as the page scrolls.</dd>
      </div>
      <div>
        <dt>Shapes, the pen and brushes</dt>
        <dd>Draw shapes, edit their points, draw freehand with a brush, and merge or cut shapes together.</dd>
      </div>
      <div>
        <dt>Moving stickers</dt>
        <dd>Petals, confetti, sparkles, balloons, hearts, fairy lights, curtains and doors that move on their own.</dd>
      </div>
      <div>
        <dt>Fields guests fill in</dt>
        <dd>Their name, the event’s title, date and time, the venue and its map, the gallery, a reply button, a link, and a dress code.</dd>
      </div>
    </dl>

    <h2 id="motion">Make it move</h2>
    <ul>
      <li>
        <strong>The timeline.</strong> Each item has a bar showing when it is on the page. Drag the
        ends of a bar to change when it appears and disappears, and set keyframes inside it for how it
        moves.
      </li>
      <li>
        <strong>One-tap effects.</strong> Choose how something comes in, goes out, or loops: fade,
        bounce, zoom, turn, reveal, wipe, flip, fold open, draw its outline, float, sway, pulse and
        more. There are no angles to type.
      </li>
      <li>
        <strong>It follows the scroll.</strong> The movement is tied to how far your guest has
        scrolled, so they control the pace.
      </li>
      <li>
        <strong>It stays where you put it.</strong> New designs keep things on screen until they are
        animated away or you set them to scroll with the page.
      </li>
    </ul>

    <h2 id="ai">The AI designer</h2>
    <p>
      On a computer, the <strong>Ask AI</strong> tab beside Properties (on a phone, its button in the top
      bar) opens the AI designer. Tell it what you want, such as a whole invitation or new colours, and it
      makes the change in your design with the same tools you use. Each message is one step you can undo.
      It is an add-on to Premium, or included with Studio; see <a routerLink="/pricing">Plans</a>.
    </p>

    <h2 id="check">Check and preview</h2>
    <p>
      <strong>Preview</strong> shows the page the way a guest sees it, with sample details, empty
      fields, or two different roles. <strong>Check</strong> lists anything that would stop it
      working, such as a missing reply button, and warnings for things worth a second look.
    </p>

    <h2 id="publish">Publish</h2>
    <dl class="defs">
      <div>
        <dt>Private</dt>
        <dd>Only you can start events with it.</dd>
      </div>
      <div>
        <dt>For someone</dt>
        <dd>Enter their email. Only that person can see it and start events with it, and we email them once. It never appears in the gallery.</dd>
      </div>
      <div>
        <dt>Public</dt>
        <dd>It goes into the <strong>Templates</strong> gallery for everyone to use. Public designs are not reviewed first. Anyone can report one, and we remove those that break our rules.</dd>
      </div>
    </dl>
    <p>
      An event keeps the version it started with, so publishing a new version never changes an
      invitation that is already out. You can move your own events to the new version when you want.
    </p>

    <h2 id="use">Use it for an event</h2>
    <p>
      Start an event and choose your template from <strong>Templates</strong>, the same as any other
      design. Roles, colours, words and photos work as they do in the
      <a routerLink="/guide/animated-invitations">animated invitations</a> guide.
    </p>
  `,
})
export class TemplateDesignerGuideComponent {}
