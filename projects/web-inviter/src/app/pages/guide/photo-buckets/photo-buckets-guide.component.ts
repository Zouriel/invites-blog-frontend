import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Buckets: the camera, contribution codes (shared/bucket-panel), who can see (shared/bucket-settings),
 * sizes by plan (GET /api/plans) and downloading (shared/photo-box).
 */
@Component({
  selector: 'app-photo-buckets-guide',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  styleUrls: ['../guide-prose.scss'],
  template: `
    <p>
      A bucket is made with every event, whether or not it has an invitation. You’ll find it as a tab
      on the event’s dashboard, with everything added so far.
    </p>

    <h2 id="adding">How photos get in</h2>
    <h3>The camera in the invitation</h3>
    <p>
      Guests who replied that they’re coming get a camera button on their invitation. Tap to take a
      photo, or hold to record a video. It opens around the event: on the free plan, from the day
      before until the day after. Some plans allow a longer window.
    </p>

    <h3>QR codes on the tables</h3>
    <p>Not everyone at an event is on your guest list. A printed code lets anyone there add to the bucket.</p>
    <ol>
      <li>On the dashboard, open the bucket’s tab and choose <strong>Bucket settings</strong>.</li>
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
      scan it can take photos or add them from their library, but they can’t look through the bucket
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
        In <strong>Bucket settings</strong>, under <strong>Who can see it</strong>, switch guests off
        to limit it, or use <strong>Allow all</strong> and <strong>Allow none</strong>. Once you limit
        it, guests you add later start switched off.
      </li>
      <li>A code on the tables only lets people add. It never lets anyone see the bucket.</li>
    </ul>

    <h2 id="settings">Bucket settings</h2>
    <p>Beside the event’s name on the dashboard. From there you can:</p>
    <ul>
      <li>Rename the bucket, for example “The ceremony”.</li>
      <li>Create, download and turn off contribution codes.</li>
      <li>See how much space is used, and choose the bucket’s size on plans that let you.</li>
      <li>Choose who can see it.</li>
    </ul>

    <h2 id="sizes">Space by plan</h2>
    <dl class="defs">
      <div><dt>Free</dt><dd>500 MB per event. Photos are kept for 90 days after the event.</dd></div>
      <div><dt>Basic</dt><dd>20 GB across your account. Each event starts with 2 GB and can have up to 10 GB. You choose each bucket’s size.</dd></div>
      <div><dt>Event pass</dt><dd>50 GB for one event, up to 3 buckets, kept for 6 months after the event.</dd></div>
      <div><dt>Premium</dt><dd>200 GB across your account, up to 50 GB per event and 3 buckets per event. You choose each bucket’s size.</dd></div>
    </dl>
    <p>See <a routerLink="/pricing">Pricing</a> for prices, upload windows and what happens when a plan ends.</p>

    <h3>More than one bucket</h3>
    <p>
      With an event pass or Premium, an event can have up to 3 buckets, for separate parts like a
      ceremony and an after-party. Add one with <strong>Add another bucket</strong> on the Dashboard
      tab. The camera on your invitation always adds to the first bucket.
    </p>

    <h2 id="download">Downloading</h2>
    <ul>
      <li>On a bucket’s tab, choose <strong>Download all</strong>.</li>
      <li>Or choose <strong>Select</strong>, tick the photos you want, and download just those.</li>
    </ul>
  `,
})
export class PhotoBucketsGuideComponent {}
