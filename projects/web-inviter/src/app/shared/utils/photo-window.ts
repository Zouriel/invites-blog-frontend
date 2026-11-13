import { eventDay } from './event-time';

/**
 * The one line shown where QR codes and links were, once an event's (or album's) photo window has ended:
 * "Photo window closed on 14 Nov 2026. Guests can still view the album." The server refuses new codes and
 * links then (409 window_closed); existing ones keep opening. `closesAt` is the moment it ended (midnight
 * after the last day), so the day named is the last day it was open, on the event's own clock.
 */
export function photoWindowClosedLine(closesAt: string | null | undefined, zone: string | null | undefined): string {
  const ms = closesAt ? Date.parse(closesAt) : NaN;
  const day = Number.isNaN(ms) ? '' : eventDay(ms - 1000, zone, 'long');
  return day
    ? `Photo window closed on ${day}. Guests can still view the album.`
    : 'Photo window closed. Guests can still view the album.';
}
