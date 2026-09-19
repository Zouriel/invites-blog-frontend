import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * From "Start your event" to the finished link. Follows pages/new-event (details, who, kind, pick)
 * and WIZARD_STEPS / WIZARD_STEPS_IMPORTED; change this when the steps change.
 */
@Component({
  selector: 'app-create-event-guide',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  styleUrls: ['../guide-prose.scss'],
  template: `
    <p>
      You need to be signed in to create an event, because every event gets a photo album and an
      album belongs to an account. No account yet? See <a routerLink="/guide/account">Your account</a>.
    </p>

    <h2 id="start">Start the event</h2>
    <ol>
      <li>
        Choose <strong>Start your event</strong>. When you’re signed in, it’s <strong>New</strong> in
        the bar at the bottom of the screen.
      </li>
      <li>
        <strong>What are you planning?</strong> Give the event a name and a date. The start time is
        optional. You can change them later. Choose <strong>Continue</strong>.
      </li>
      <li>
        <strong>Who is it for?</strong> Add the people the event is for, like the couple or the
        birthday child, or choose <strong>Skip</strong>. See
        <a routerLink="/guide/celebrants">People the event is for</a>.
      </li>
      <li>
        <strong>Add an invitation.</strong> Pick one of the two kinds below, or choose
        <strong>Skip, no invitation</strong>.
      </li>
    </ol>
    <p>
      The event and its photo album are made when you choose Continue on the first step. If you
      started an event recently and never added anything to it, you’re offered that one back instead
      of making another.
    </p>

    <h2 id="kinds">Two kinds of invitation</h2>
    <dl class="defs">
      <div>
        <dt>Dynamic: changes for each guest</dt>
        <dd>
          An animated design from our gallery. Each guest opens their own link and sees their name,
          the details meant for them, a button to reply, and a camera on the day.
          <a routerLink="/guide/animated-invitations">Animated invitations</a>
        </dd>
      </div>
      <div>
        <dt>Static: the same for everyone</dt>
        <dd>
          One picture or video you made yourself, for example in Canva. Every guest sees exactly the
          same thing. <a routerLink="/guide/your-own-design">Your own design</a>
        </dd>
      </div>
    </dl>
    <p>Want a design made just for you? <a routerLink="/inquire">Ask us to design one</a>.</p>

    <h2 id="steps">The steps</h2>
    <p>A step bar at the top of each step shows where you are. The steps depend on the kind of invitation.</p>

    <h3>An animated invitation</h3>
    <ol>
      <li><strong>Roles.</strong> Name the groups of guests. Most events need only one.</li>
      <li><strong>Theme.</strong> Change the colours and fonts. Skipped when the design has none you can change.</li>
      <li><strong>Content.</strong> Fill in the words and photos, with a live preview beside them.</li>
      <li><strong>Guests.</strong> Type your guests in, or import an Excel file.</li>
      <li><strong>Venue.</strong> The venue’s name, address and city, a map link, and arrival notes.</li>
      <li><strong>RSVP.</strong> Every guest is asked whether they’re coming. Add other questions if you need to.</li>
      <li><strong>Inviter.</strong> Your name and email, shown as the host. A phone number and organisation are optional.</li>
      <li><strong>Photos.</strong> How much room your event has for photos and videos on its plan.</li>
      <li><strong>Share.</strong> Choose whether we email your guests, then create the invitation and get its link.</li>
    </ol>

    <h3>Your own design</h3>
    <ol>
      <li><strong>Upload.</strong> Your picture or video.</li>
      <li><strong>Guests.</strong> Optional. Skip it to share one link instead.</li>
      <li><strong>Inviter.</strong> Your name and email.</li>
      <li><strong>Photos.</strong> Room for photos and videos.</li>
      <li><strong>Share.</strong> Who can open the link, and whether we email your guests.</li>
    </ol>
    <p>
      There are no roles, theme, content, venue or RSVP question steps, because your design goes out
      exactly as you made it.
    </p>

    <h3>No invitation</h3>
    <p>
      <strong>Skip, no invitation</strong> takes you to the Photos step and then to the event’s
      dashboard. You can add an invitation later from the dashboard.
    </p>

    <h2 id="save-the-date">A save the date</h2>
    <p>
      Sent months ahead, before the details are settled. On <strong>New event</strong>, switch to
      <strong>Save the date</strong>, give it a name and the date. The time is optional: without one,
      guests’ calendars keep the whole day.
    </p>
    <ul>
      <li>Pick a design (the Save the Date ones come first) or upload your own picture.</li>
      <li>The steps are shorter: content, guests, the place (optional), who it’s from, and Share.</li>
      <li>Guests see the design and an <strong>Add to calendar</strong> button for Google, Outlook or Apple Calendar. The email carries the same buttons and a calendar file.</li>
      <li>It has no replies, no camera and no photo album. Those come with the invitation.</li>
      <li>
        When you’re ready, open it and choose <strong>Make the invitation</strong>. The guest list comes
        along, and anyone you already emailed isn’t counted again. A pass on the save the date moves to
        the invitation too.
      </li>
    </ul>

    <h2 id="drafts">Drafts</h2>
    <ul>
      <li>Each step saves when you move on with <strong>Save &amp; continue</strong> or <strong>Next</strong>.</li>
      <li>
        <strong>Save draft</strong>, on the Theme and Content steps, saves what you have so far and
        keeps you on the page.
      </li>
      <li>Nothing is sent to your guests until you finish the Share step.</li>
      <li>
        To carry on later, open the event from the Hosting tab, where it’s marked
        <em>Not finished</em>, or choose <strong>Continue setting it up</strong> on its dashboard.
      </li>
      <li>
        <strong>Delete draft</strong> removes the event, its guest list and anything added to it, for
        good. It’s only offered while the invitation isn’t finished.
      </li>
    </ul>

    <h2 id="finish">When you finish</h2>
    <p>
      Choosing <strong>Create invitation &amp; get link</strong> on the Share step opens
      <em>Your invitation is ready</em>, with the link to share and how many guests we emailed.
      <a routerLink="/guide/sharing">Sharing and sending</a> explains the choices.
    </p>
    <p>
      <strong>Go to your event</strong> opens the event’s dashboard. You can always find the event
      again on your Home page, under the Hosting tab.
    </p>

    <h3>The dashboard</h3>
    <ul>
      <li>
        A tab for each photo album, with the photos and videos in it. See
        <a routerLink="/guide/photo-buckets">Photo albums</a>.
      </li>
      <li>
        The <strong>Dashboard</strong> tab: finish or add an invitation, add another album, the cover
        photo and event name, and the guest list with everyone’s replies.
      </li>
      <li>
        <strong>Cover photos</strong> and <strong>Album settings</strong> buttons beside the event’s
        name, once the event has an album.
      </li>
    </ul>
  `,
})
export class CreateEventGuideComponent {}
