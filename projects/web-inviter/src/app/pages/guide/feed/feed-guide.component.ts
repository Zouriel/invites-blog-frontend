import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * The Home feed (pages/inbox, feed-post) and the dashboard's Cover photos. Who sees a post is
 * FeedService's rule: organiser and celebrants from the start, a guest once their invitation went out.
 */
@Component({
  selector: 'app-feed-guide',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  styleUrls: ['../guide-prose.scss'],
  template: `
    <h2 id="home">Your Home page</h2>
    <p>When you’re signed in, <strong>Home</strong> in the bar at the bottom has three tabs:</p>
    <dl class="defs">
      <div><dt>Feed</dt><dd>Every event you’re part of, as posts, with the latest activity first.</dd></div>
      <div>
        <dt>Received</dt>
        <dd>
          Invitations sent to your email or phone number, including ones sent before you signed up,
          with your reply.
        </dd>
      </div>
      <div>
        <dt>Hosting</dt>
        <dd>The events you run, and events made for you. Unfinished ones are marked so you can carry on.</dd>
      </div>
    </dl>

    <h2 id="posts">Event posts</h2>
    <p>Each event is one post. It shows:</p>
    <ul>
      <li>The event’s photos. Swipe to see more. Before there are any, it shows the invitation.</li>
      <li>The event’s name, the host, the date and the venue.</li>
      <li>How you’re involved: Hosting, Organising, Your event or Invited.</li>
      <li>A link to open the event, or your invitation if you’re a guest.</li>
    </ul>

    <h2 id="who">Who sees a post</h2>
    <ul>
      <li>The organiser and the people the event is for, from the moment the event is made.</li>
      <li>A guest, once their own invitation has been sent to them.</li>
      <li>Nobody else. A cancelled event’s post disappears.</li>
    </ul>

    <h2 id="likes">Likes, comments and replies</h2>
    <ul>
      <li>Tap the heart to like a post. Tap it again to take the like back.</li>
      <li>Write in <strong>Add a comment</strong> and choose <strong>Post</strong>.</li>
      <li>Choose <strong>Reply</strong> under a comment to answer it, and the heart beside it to like it.</li>
      <li>Comments from the organiser are marked <em>Host</em>.</li>
      <li>
        You can delete your own comments. The organiser can delete any comment on their event. A
        comment’s replies go with it.
      </li>
    </ul>

    <h2 id="caption">The caption</h2>
    <p>
      If you organise the event, you can write the words under its post. Choose
      <strong>Add a caption</strong> or <strong>Edit caption</strong> on the post, write, and choose
      <strong>Save</strong>. Leave it empty to use the invitation’s own words.
    </p>

    <h2 id="covers">Cover photos</h2>
    <ol>
      <li>Open the event’s dashboard and choose <strong>Cover photos</strong>.</li>
      <li>Pick up to 6 photos from the event’s main bucket. They show in the order you pick them.</li>
    </ol>
    <p>With none picked, the post shows the first photos added.</p>
    <div class="note">
      <p>
        The single <strong>Cover photo</strong> on the Dashboard tab is different: it’s the picture
        that marks the event in lists, like your Hosting tab and your guests’ Received tab.
      </p>
    </div>

    <p>
      Photos come from the event’s bucket. See <a routerLink="/guide/photo-buckets">Photo buckets</a>
      for how they get there and who can see them.
    </p>
  `,
})
export class FeedGuideComponent {}
