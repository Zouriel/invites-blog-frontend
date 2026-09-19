import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catalog, formatBytes, mvr, plan } from '../../../shared/utils/plans';

/**
 * Buckets: the camera, contribution codes (shared/bucket-panel), who can see (shared/bucket-settings),
 * sizes by plan (the same catalog as /pricing) and downloading (shared/photo-box).
 */
@Component({
  selector: 'app-photo-buckets-guide',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  styleUrls: ['../guide-prose.scss'],
  template: `
    <p>
      Every event gets an album once it’s finished (sent, or finished as photos only), whether or not
      it has an invitation. You’ll find it as a tab on the event’s dashboard, with everything added so far.
    </p>

    <h2 id="adding">How photos get in</h2>
    <h3>The camera in the invitation</h3>
    <p>
      Guests who replied that they’re coming get a camera button on their invitation. Tap to take a
      photo, or hold to record a video. It opens around the event: on the free plan, from the day
      before until the day after. Some plans allow a longer window.
    </p>

    <h3>QR codes on the tables</h3>
    <p>Not everyone at an event is on your guest list. A printed code lets anyone there add to the album.</p>
    <ol>
      <li>On the dashboard, open the album’s tab and choose <strong>Album settings</strong>.</li>
      <li>Under <strong>Contribution code</strong>, choose <strong>Create a code</strong>.</li>
      <li>Give it a label only you see, like “Reception tables”.</li>
      <li>
        Decide on <strong>Let anyone add with just a name</strong>:
        <ul>
          <li><strong>On:</strong> anyone who scans it types their name and can add photos without signing in.</li>
          <li><strong>Off:</strong> only people on your list can add, after verifying the email or phone you listed them under.</li>
        </ul>
      </li>
      <li>Choose <strong>Create code</strong>, then <strong>Download code</strong> and print it.</li>
    </ol>
    <p>
      The code’s link is shown only once, just after you make it. The image keeps working. People who
      scan it can take photos or add them from their library, but they can’t look through the album
      or remove anything.
    </p>
    <p>
      <strong>Turn it off</strong> stops a code working for everyone, including printed copies.
      Anything already added stays.
    </p>

    <h2 id="who">Who can see the photos</h2>
    <ul>
      <li>You and the people the event is for can always see them.</li>
      <li>At first, every guest on your list can see them, including guests you add later.</li>
      <li>
        In <strong>Album settings</strong>, under <strong>Who can see it</strong>, switch guests off
        to limit it, or use <strong>Allow all</strong> and <strong>Allow none</strong>. Once you limit
        it, guests you add later start switched off.
      </li>
      <li>A code on the tables only lets people add. It never lets anyone see the album.</li>
    </ul>

    <h2 id="settings">Album settings</h2>
    <p>Beside the event’s name on the dashboard. From there you can:</p>
    <ul>
      <li>Rename the album, for example “The ceremony”.</li>
      <li>Create, download and turn off contribution codes.</li>
      <li>See how much space is used, and how many days it collects for.</li>
      <li>Choose who can see it (with a Wedding pass).</li>
    </ul>

    <h2 id="sizes">Space by plan</h2>
    <p>Space belongs to the event and is shared by all of its albums. A pass is bought for one event.</p>
    <dl class="defs">
      <div><dt>Free</dt><dd>{{ size(free) }} per event, one album, open from the day before the event to the day after. Photos are kept for {{ free.retentionDays }} days after the event.</dd></div>
      <div><dt>Party pass · {{ mvr(party.price) }}</dt><dd>{{ size(party) }}, up to {{ party.maxBuckets }} albums, open until {{ party.maxWindowDays }} days after the event starts. Kept for a year.</dd></div>
      <div><dt>Wedding pass · {{ mvr(wedding.price) }}</dt><dd>{{ size(wedding) }}, up to {{ wedding.maxBuckets }} albums, open until {{ wedding.maxWindowDays }} days after the event starts, and you choose who can see each one. Kept for a year.</dd></div>
      <div><dt>Another year of a pass</dt><dd>{{ mvr(party.extensionPrice ?? 0) }} for a Party pass, {{ mvr(wedding.extensionPrice ?? 0) }} for a Wedding pass, without invitations. We email you a month and a week before a pass ends.</dd></div>
      <div><dt>Keep your photos · {{ mvr(keep) }} a year</dt><dd>Keeps a Free event’s photos online for another year.</dd></div>
      <div><dt>At a venue</dt><dd>An event held at a resort or hall on the Venue plan gets {{ size(venue) }} and up to {{ venue.maxBuckets }} albums, with the venue’s name on its QR cards. Enter the code the venue gives you on the Dashboard tab.</dd></div>
    </dl>
    <p>See <a routerLink="/pricing">Pricing</a> for what happens when a plan ends. Until online payments are ready, <a routerLink="/inquire" [queryParams]="{ topic: 'wedding' }">ask us</a> and we add the pass for you.</p>

    <h3>More than one album</h3>
    <p>
      With a Party pass an event can have {{ party.maxBuckets }} albums, and with a Wedding pass
      {{ wedding.maxBuckets }}, for separate parts like a ceremony and an after-party. Add one with
      <strong>Add another album</strong> on the Dashboard tab. The camera on your invitation always adds
      to the first album.
    </p>

    <h2 id="download">Downloading</h2>
    <ul>
      <li>On an album’s tab, choose <strong>Download all</strong>.</li>
      <li>Or choose <strong>Select</strong>, tick the photos you want, and download just those.</li>
    </ul>
  `,
})
export class PhotoBucketsGuideComponent {
  protected readonly free = plan('Free');
  protected readonly party = plan('PartyPass');
  protected readonly wedding = plan('WeddingPass');
  protected readonly venue = plan('Venue');
  protected readonly keep = catalog().keepPhotos.price;
  protected readonly mvr = mvr;
  protected size(p: { eventBytes: number | null }): string {
    return formatBytes(p.eventBytes ?? 0);
  }
}
