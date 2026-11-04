import { Pipe, PipeTransform } from '@angular/core';
import { EventDateStyle, eventDay, formatEventTime } from '../utils/event-time';

/** The day an event falls on, on its own clock: `{{ e.eventStartAt | eventDay: e.timeZone : 'short' }}`. */
@Pipe({ name: 'eventDay' })
export class EventDayPipe implements PipeTransform {
  transform(at: string | null | undefined, zone: string | null | undefined, style: EventDateStyle = 'short'): string {
    return eventDay(at, zone, style);
  }
}

/**
 * The day and time on the event's clock with its zone, and the viewer's own time when it differs:
 * `{{ e.eventStartAt | eventTime: e.timeZone }}` → "Sunday, 25 October 2026 · 7:00 pm GMT (3:00 pm your time)".
 */
@Pipe({ name: 'eventTime' })
export class EventTimePipe implements PipeTransform {
  transform(at: string | null | undefined, zone: string | null | undefined, allDay = false, style: EventDateStyle = 'full'): string {
    return formatEventTime(at, zone, { allDay, style });
  }
}
