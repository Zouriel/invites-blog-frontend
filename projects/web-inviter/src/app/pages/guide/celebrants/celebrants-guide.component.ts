import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Celebrants (shared/celebrants): "Can look" by default; full access only from the dashboard, by the organiser. */
@Component({
  selector: 'app-celebrants-guide',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  styleUrls: ['../guide-prose.scss'],
  template: `
    <p>
      Celebrants are the people an event is for: the couple, the birthday child, the retiring
      colleague. Add them and the event shows up in their own account whenever they sign in, with
      who’s coming and all the photos.
    </p>

    <h2 id="add">Add them</h2>
    <p>You can add them while creating the event, on <strong>Who is it for?</strong>, or at any time later:</p>
    <ol>
      <li>Open the event’s dashboard, then the <strong>Dashboard</strong> tab.</li>
      <li>Open the <strong>Celebrants</strong> tab.</li>
      <li>Enter their name, and their email or phone number.</li>
      <li>Tick <strong>Let them know by email</strong> if you want us to tell them.</li>
      <li>Choose <strong>Add</strong>.</li>
    </ol>
    <p>
      They need to sign in with the email or phone number you added. If their account has a different
      one, they can add it to their account. See
      <a routerLink="/guide/account" fragment="phone">Your account</a>.
    </p>
    <p>
      Didn’t tick <strong>Let them know by email</strong>? For anyone added with an email address,
      the Celebrants tab offers <strong>Let them know</strong> so you can tell them later.
    </p>

    <h2 id="access">What they can do</h2>
    <dl class="defs">
      <div>
        <dt>Can look</dt>
        <dd>
          The default. They see the event in their account, with the guest list, the replies and the
          photos. They can’t change anything.
        </dd>
      </div>
      <div>
        <dt>Full access</dt>
        <dd>
          They can edit the event and send invitations, like you. Only you, the organiser, can turn it
          on, and only from the event’s dashboard.
        </dd>
      </div>
    </dl>
    <p>
      To change it, switch <strong>Full access</strong> on or off beside their name in the Celebrants
      tab.
    </p>

    <h2 id="remove">Remove someone</h2>
    <p>
      Choose <strong>Remove</strong> beside their name. They lose access to the event straight away.
      You can add them again later.
    </p>

    <h2 id="photos">Their photos and feed</h2>
    <ul>
      <li>
        They can always see the event’s photos, whoever else you limit.
        <a routerLink="/guide/photo-buckets" fragment="who">Who can see the photos</a>
      </li>
      <li>
        The event is a post in their feed from the moment it’s made, marked <em>Your event</em>.
        <a routerLink="/guide/feed">Your feed</a>
      </li>
    </ul>
  `,
})
export class CelebrantsGuideComponent {}
