import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Bring your own design: pages/bring-your-own, the imported wizard, delivery and the dashboard's Public link. */
@Component({
  selector: 'app-own-design-guide',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  styleUrls: ['../guide-prose.scss'],
  template: `
    <h2 id="what">What to expect</h2>
    <ul>
      <li>
        <strong>Your design goes out exactly as you made it.</strong> We don’t change anything in it.
        Every guest sees the same picture, with the same names, words and colours.
      </li>
      <li>
        <strong>It can’t show each guest their own name.</strong> With a guest list, the email that
        carries it still greets each guest by name.
      </li>
      <li>
        <strong>You still get replies and photos.</strong> Guests on your list get a reply button
        under your design, and there’s a camera on the day.
      </li>
      <li><strong>It stays yours.</strong> It’s never added to our gallery or shown to anyone else.</li>
    </ul>

    <h2 id="upload">Upload it</h2>
    <ol>
      <li>Start an event, and on <strong>Add an invitation</strong> choose <strong>Static</strong>.</li>
      <li>Choose <strong>Choose your design</strong> and pick a picture (PNG or JPG) or a video, up to 80 MB.</li>
      <li>Check the preview, then choose <strong>Use this design</strong>.</li>
    </ol>
    <p>By uploading, you confirm you have the right to use the design, including its fonts and images.</p>

    <h2 id="steps">The steps after uploading</h2>
    <ol>
      <li>
        <strong>Guests.</strong> Optional. Add guests if each one should get their own link and be
        able to reply. Otherwise continue without a list and share one link. Uploaded designs have no
        roles, so there’s no role to pick.
      </li>
      <li><strong>Inviter.</strong> Your name and email.</li>
      <li><strong>Photos.</strong> Room for photos and videos on the event’s plan.</li>
      <li><strong>Share.</strong> Who can open the link, and whether we email your guests.</li>
    </ol>
    <p>
      Preparing a list in Excel? See the <a routerLink="/guide/guest-list">Guest list</a> guide, and
      leave the role column empty.
    </p>

    <h2 id="link">Who can open the link</h2>
    <p>On the Share step, <strong>Allow anyone to open it</strong> decides who the link works for.</p>
    <dl class="defs">
      <div>
        <dt>Ticked: an open link</dt>
        <dd>
          A short link for a group chat. Anyone with it can open the invitation without signing in.
          They aren’t asked to reply and can’t see your event’s photos, but they can use the camera on
          the day.
        </dd>
      </div>
      <div>
        <dt>Not ticked: guest list only</dt>
        <dd>
          People who open the link are asked for an email or phone number on your guest list, and we
          send them a code. With an empty guest list, this link would open for nobody, so you can’t
          finish until you tick the box or add guests.
        </dd>
      </div>
    </dl>

    <h2 id="later">Changing it later</h2>
    <p>On the event’s dashboard, the <strong>Public link</strong> card lets you:</p>
    <ul>
      <li>Tick or untick <strong>Allow anyone to open it</strong>, then choose <strong>Generate link</strong>.</li>
      <li><strong>Copy link</strong> to paste it anywhere.</li>
      <li>
        <strong>Generate a new link</strong> if the link reached people it wasn’t meant for. The old
        link stops working.
      </li>
      <li><strong>Stop sharing</strong> to turn the link off.</li>
    </ul>
  `,
})
export class OwnDesignGuideComponent {}
