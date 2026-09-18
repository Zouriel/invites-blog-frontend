import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Choosing a design and the Roles, Theme and Content steps (pages/new-event pick, roles, theming, editor). */
@Component({
  selector: 'app-animated-guide',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  styleUrls: ['../guide-prose.scss'],
  template: `
    <h2 id="design">Choose a design</h2>
    <ol>
      <li>Start an event, and on <strong>Add an invitation</strong> choose <strong>Dynamic</strong>.</li>
      <li>Browse the designs, or search by name or occasion.</li>
      <li>Tap a design to see a preview of it.</li>
      <li>Choose <strong>Use this design</strong>, or <strong>Back</strong> to keep looking.</li>
    </ol>
    <p>
      Designs reserved for your account are listed first, under <em>Yours</em>. You can also
      look through <a routerLink="/templates">all the designs</a> without signing in.
    </p>
    <p>
      Nothing fits? Upload <a routerLink="/guide/your-own-design">your own design</a>, or
      <a routerLink="/inquire">ask us to make one</a>.
    </p>

    <h2 id="roles">Roles: who sees what</h2>
    <p>
      A role is a group of guests, like <em>Family</em> or <em>Bridesmaids</em>. You start with one
      role called <em>Guests</em>, and most events need nothing more. Add roles when some people
      should see different details.
    </p>
    <ol>
      <li>Rename <em>Guests</em> if you like, or choose <strong>Add a role</strong>. The design may suggest roles you can add in one tap.</li>
      <li>
        Open <strong>More options</strong> on a role to set:
        <ul>
          <li>
            <strong>Sections this role sees.</strong> Tick the sections meant only for this role. A
            section no role ticks is shown to everyone.
          </li>
          <li>
            <strong>Dress colours.</strong> Pick a colour and we suggest four shades of it. Change
            any of them. Guests with this role see these colours on their invitation.
          </li>
        </ul>
      </li>
      <li>Choose <strong>Save &amp; continue</strong>. You need at least one named role.</li>
    </ol>
    <p>
      Every guest gets at least one role when you add them. A guest with several roles sees every
      section any of their roles sees, and every set of dress colours. Their first role decides the
      invitation’s colours. See the <a routerLink="/guide/guest-list">Guest list</a> guide.
    </p>

    <h2 id="theme">Theme</h2>
    <p>
      <strong>Make it yours</strong> lists the colours and fonts the designer made changeable. They
      start as the designer set them, so change only what you want to.
    </p>
    <ul>
      <li><strong>Everyone</strong> sets the colours for every guest.</li>
      <li>
        <strong>Per role</strong>, shown when you have more than one role, gives a role its own
        colours, for example pink for the bride’s family and navy for the groom’s. Choose
        <strong>Follow the shared ones instead</strong> to undo it.
      </li>
    </ul>
    <p>If a design has nothing to change, this step is skipped.</p>

    <h2 id="content">Content</h2>
    <p>
      This is where you fill in the invitation. The form is on one side and a live preview on the
      other, so you see each change as you make it.
    </p>
    <ul>
      <li>Fill in the fields. Anything not marked as required is optional.</li>
      <li>
        <strong>Cover photo</strong> is how the invitation looks in your list and your guests’ lists.
        Without one, the design’s preview picture is used, which shows example names instead of
        yours.
      </li>
      <li>
        <strong>Photos</strong>: upload a photo for each spot. A gallery spot takes several, which
        you can put in order.
      </li>
      <li>
        With more than one role, each field and photo has <strong>Who sees this</strong>. Tick the
        roles that should see it, or tick nothing to show it to everyone.
      </li>
    </ul>
    <p>
      Use <strong>Save draft</strong> to keep your work and stay on the page, or
      <strong>Next: Guests</strong> to save and move on. A guest’s own name is added to their
      invitation automatically.
    </p>

    <h2 id="after">After the content</h2>
    <p>
      The remaining steps are Guests, Venue, RSVP, Inviter, Photos and Share. See
      <a routerLink="/guide/create-an-event" fragment="steps">Create an event</a> for what each one
      asks.
    </p>
  `,
})
export class AnimatedGuideComponent {}
