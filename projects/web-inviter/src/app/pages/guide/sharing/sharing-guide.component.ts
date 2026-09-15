import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * The Share step (pages/delivery), the finished page (pages/success) and replies on the dashboard.
 * Sending prices are the live catalogue's (GET /api/plans, shown on /pricing): $5 for the first 50,
 * then $1 per 10, $1 per 20 on Premium, first 50 included with an event pass.
 */
@Component({
  selector: 'app-sharing-guide',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  styleUrls: ['../guide-prose.scss'],
  template: `
    <h2 id="share-step">The Share step</h2>
    <p>The last step of every invitation.</p>
    <ol>
      <li>
        Tick <strong>Also email the link to my guests</strong> if you want invites.blog to send each
        guest with an email address a message with their own link. Leave it unticked to share the link
        yourself. It can’t be ticked while your guest list is empty.
      </li>
      <li>
        Write the <strong>Message to guests</strong>. It goes in the email, above each guest’s personal
        link.
      </li>
      <li>Choose <strong>Create invitation &amp; get link</strong>.</li>
    </ol>
    <p>
      For your own uploaded design, this step also asks who can open the link. See
      <a routerLink="/guide/your-own-design" fragment="link">Your own design</a>.
    </p>

    <h2 id="link">Your shareable link</h2>
    <p>
      Every invitation gets one link you can send however you like, in a message or a group chat.
      <em>Your invitation is ready</em> shows it, with <strong>Share</strong> and
      <strong>Copy link</strong> buttons, and tells you how many guests we emailed.
    </p>
    <ul>
      <li>
        <strong>Usually</strong>, the link checks the guest list. Whoever opens it confirms their
        email, then sees their own invitation. Only people on your guest list can open it.
      </li>
      <li>
        <strong>For an uploaded design with “Allow anyone to open it” ticked</strong>, anyone with the
        link can open the invitation without signing in.
      </li>
    </ul>
    <div class="note">
      <p>
        If nothing was emailed, the page says so. Share the link with your guests, or send their
        invitations from the event’s dashboard.
      </p>
    </div>

    <h2 id="later">Sending from the dashboard</h2>
    <p>On the event’s dashboard, open the <strong>Dashboard</strong> tab and then <strong>Guests</strong>.</p>
    <ul>
      <li>
        <strong>Add guest</strong> adds someone to the list. Switch on <strong>Send their invite
        now</strong> to send it straight away, or leave it off to send later.
      </li>
      <li>Tick guests in the table and choose <strong>Send to selected</strong> to send to them.</li>
    </ul>

    <h2 id="cost">What it costs</h2>
    <ul>
      <li>Sharing links yourself is always free.</li>
      <li>
        When invites.blog emails each guest their own link, the first 50 guests cost $5, then $1 for
        every 10 more.
      </li>
      <li>On Premium, extra guests are $1 for every 20.</li>
      <li>An event pass includes sending to the first 50 guests.</li>
    </ul>
    <p>See <a routerLink="/pricing">Pricing</a> for the plans.</p>

    <h2 id="replies">Replies</h2>
    <p>
      Every guest is asked whether they’re coming, plus any questions you added on the RSVP step. Their
      answers arrive on the event’s dashboard, under <strong>Guests</strong>:
    </p>
    <ul>
      <li>Totals for how many invitations were sent, failed, not sent yet, and viewed.</li>
      <li>How many said yes, maybe or no, and how many haven’t replied.</li>
      <li>Each guest in the table below.</li>
    </ul>
  `,
})
export class SharingGuideComponent {}
