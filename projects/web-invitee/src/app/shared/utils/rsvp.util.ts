import { UiStatus } from 'ui';

/** Human label for a backend rsvpStatus string. */
export function rsvpLabel(status: string): string {
  switch (status) {
    case 'Going':
      return 'Going';
    case 'Maybe':
      return 'Maybe';
    case 'NotGoing':
      return 'Not going';
    case 'ViewedOnly':
      return 'Viewed';
    default:
      return 'Awaiting reply';
  }
}

/** Maps a backend rsvpStatus to a `ui-badge` tone. */
export function rsvpTone(status: string): UiStatus {
  switch (status) {
    case 'Going':
      return 'success';
    case 'Maybe':
      return 'warning';
    case 'NotGoing':
      return 'danger';
    default:
      return 'neutral';
  }
}
