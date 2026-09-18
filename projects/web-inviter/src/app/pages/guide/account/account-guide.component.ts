import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Signing up, signing in, and joining an email and a phone number into one account. Written from
 * what /join, /login and the Account page (/me) actually do: the sign-in page is email + password or
 * a configured provider; codes are for proving an address when joining or adding one.
 */
@Component({
  selector: 'app-account-guide',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  styleUrls: ['../guide-prose.scss'],
  template: `
    <h2 id="create">Create an account</h2>
    <p>
      You need an account to create an event. If you’ve been invited to something, an account also
      keeps your invitations together in one place.
    </p>
    <ol>
      <li>Open <a routerLink="/join">Create an account</a>. The sign-in page links to it too.</li>
      <li>Enter your email address and choose <strong>Send me a code</strong>.</li>
      <li>We email you a six-digit code. Enter it.</li>
      <li>Add your name if you like. Hosts see it when you reply to an invitation.</li>
      <li>Choose a password of at least 8 characters. This is how you sign in from now on.</li>
      <li>Choose <strong>Create my account</strong>.</li>
    </ol>
    <p>
      Any email address works. Invitations already sent to that address are waiting for you once
      you’re in.
    </p>
    <div class="note">
      <p>Typed the wrong address? Choose <strong>Use a different address</strong> and start again.</p>
    </div>

    <h2 id="sign-in">Sign in</h2>
    <ol>
      <li>Open <a routerLink="/login">Sign in</a>.</li>
      <li>Enter your email and password, and choose <strong>Sign in</strong>.</li>
    </ol>
    <p>
      The sign-in page may also offer <strong>Continue with Google</strong>. Use it to sign in with
      your Google account instead of a password.
    </p>

    <h2 id="phone">Add your phone number or email</h2>
    <p>
      Invitations are matched to the email address or phone number they were sent to. When your
      account has both, invitations sent to either one show up in your events, including ones sent
      before you signed up.
    </p>
    <ol>
      <li>Open your <a routerLink="/me">Account</a> page.</li>
      <li>
        Go to the <strong>Sign-in &amp; security</strong> tab. On the Profile tab, the
        <strong>Add your phone number</strong> button takes you there too.
      </li>
      <li>Enter the phone number or email address you want to add, and choose <strong>Send code</strong>.</li>
      <li>Enter the 6-digit code we sent to it, and choose <strong>Confirm</strong>.</li>
    </ol>
    <p>
      If that number or address already has an account of its own, the two accounts are merged into
      one.
    </p>
    <div class="note">
      <p>
        The page only offers to add the one your account is missing. Once both are on the account, it
        says so.
      </p>
    </div>

    <h2 id="account-page">The Account page</h2>
    <p>When you’re signed in, <strong>Account</strong> is in the bar at the bottom of the screen.</p>
    <dl class="defs">
      <div>
        <dt>Profile</dt>
        <dd>
          Night mode, which is kept on your account so it follows you to your phone. The email, phone
          number and name on your account. Your plan and photo space. What the roles on your account
          let you do.
        </dd>
      </div>
      <div>
        <dt>Sign-in &amp; security</dt>
        <dd>The ways in to your account, and adding your phone number or email.</dd>
      </div>
      <div>
        <dt>Creator</dt>
        <dd>
          Choose <strong>Become a creator</strong> to make invitation templates in the template
          designer and publish them from the same account.
        </dd>
      </div>
    </dl>
  `,
})
export class AccountGuideComponent {}
