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
      <li>Choose who can see it (with a Platinum pass).</li>
    </ul>

    <h2 id="sizes">Space by plan</h2>
    <p>Space belongs to the event and is shared by all of its albums. A pass is bought for one event.</p>
    <dl class="defs">
      <div><dt>Free</dt><dd>{{ size(free) }} per event, one album, open from the day before the event to the day after. Photos are kept for good.</dd></div>
      <div><dt>Gold pass · {{ mvr(gold.price) }}</dt><dd>{{ size(gold) }}, up to {{ gold.maxBuckets }} albums, open until {{ gold.maxWindowDays }} days after the event starts. Everything kept for a year, then {{ size(free) }} for good.</dd></div>
      <div><dt>Platinum pass · {{ mvr(platinum.price) }}</dt><dd>{{ size(platinum) }}, up to {{ platinum.maxBuckets }} albums, open until {{ platinum.maxWindowDays }} days after the event starts, and you choose who can see each one. Everything kept for a year, then {{ size(free) }} for good.</dd></div>
      <div><dt>Another year of a pass</dt><dd>{{ mvr(gold.extensionPrice ?? 0) }} for a Gold pass, {{ mvr(platinum.extensionPrice ?? 0) }} for a Platinum pass, without invitations. We email you a month and a week before a pass ends.</dd></div>
      <div><dt>Keep your photos · {{ mvr(keep) }} a year</dt><dd>Keeps a Free event’s photos online for another year.</dd></div>
      <div><dt>At a venue</dt><dd>A resort or hall on Venue gives every event held there {{ size(venue) }}, face grouping and no “Made with” mark, kept while the venue stays on Venue, with the venue’s name and logo on its albums and QR cards. If the venue’s plan ends, the event goes back to Free, and the people it is for can keep everything with a Platinum pass.</dd></div>
    </dl>
    <p>See <a routerLink="/pricing">Pricing</a> for what happens when a plan ends.</p>

    <h3>More than one album</h3>
    <p>
      With a Gold pass an event can have {{ gold.maxBuckets }} albums, and with a Platinum pass
      {{ platinum.maxBuckets }}, for separate parts like a ceremony and an after-party. Add one with
      <strong>Add another album</strong> on the Dashboard tab. The camera on your invitation always adds
      to the first album.
    </p>

    <h2 id="download">Downloading and sharing</h2>
    <ul>
      <li>
        On an album’s tab, choose <strong>Download all</strong>. The whole album comes as one zip, however
        large. The download link works for about 30 minutes.
      </li>
      <li>
        Press and hold a photo, or choose <strong>Select</strong>, then tick the photos you want. A bar at
        the bottom offers <strong>Share</strong>, <strong>Download</strong> and <strong>Remove</strong>.
        <strong>Select all</strong> ticks every photo.
      </li>
      <li>
        On the phone apps, <strong>Download</strong> saves to your gallery (iPhone Photos or the Android
        gallery). <strong>Share</strong> sends the photos to any app through the phone’s share sheet, up to
        100 files and 2 GB at once.
      </li>
      <li>On the website, <strong>Share</strong> uses the device’s share menu where the browser supports it.</li>
      <li>The photo viewer has <strong>Download</strong> and <strong>Share</strong> too.</li>
      <li>Photos are removed only from the selection bar or the viewer.</li>
    </ul>

    <h3>Filter</h3>
    <p>
      A <strong>Filter</strong> button, with a count, opens filters: <strong>Uploaded by</strong> (pick
      people) and <strong>Photos or videos</strong>. Active filters show as chips, and <strong>Clear all</strong>
      removes them. With a filter on, the button reads <strong>Download these N</strong> and saves only those.
    </p>

    <h3>Grouping by face</h3>
    <p>
      The host can switch on <strong>Group photos by face</strong> in the album’s settings. The album then
      puts photos of the same person together. The host names people in a <strong>People</strong> tab, and
      named people appear in the filter. Anyone can tap <strong>That’s me</strong> to opt out. It comes
      with any pass or Premium, is off unless the host turns it on, and isn’t offered in Illinois, Texas or Washington (USA). See the
      <a routerLink="/privacy" fragment="faces">Privacy Policy</a>.
    </p>

    <h2 id="favourites">Favourites</h2>
    <ul>
      <li>Double-tap a photo, or tap its heart, to heart it. Tap again to un-heart it.</li>
      <li>Hearts show as a count on the photo’s corner and in the viewer.</li>
      <li>
        Every signed-in person who can see the album can heart its photos. Guests who only have the link
        can see the counts but can’t heart.
      </li>
      <li>The heart in the top bar opens <strong>Favourites</strong>: all the photos you hearted across events.</li>
      <li>
        The album’s owner, organisers and the people the event is for get a phone notification when others
        heart photos in their album. Notifications are grouped, with at most one per album every 15 minutes.
      </li>
    </ul>
  `,
})
export class PhotoBucketsGuideComponent {
  protected readonly free = plan('Free');
  protected readonly gold = plan('GoldPass');
  protected readonly platinum = plan('PlatinumPass');
  protected readonly venue = plan('Venue');
  protected readonly keep = catalog().keepPhotos.price;
  protected readonly mvr = mvr;
  protected size(p: { eventBytes: number | null }): string {
    return formatBytes(p.eventBytes ?? 0);
  }
}
