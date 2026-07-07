import { ApiErrorItem } from './api.types';

/**
 * Normalised error thrown by `ApiService` after unwrapping the response
 * envelope. Carries the human message, structured `errors`, and HTTP status so
 * pages can branch (e.g. 401 → login) while a toast surfaces the message.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errors: ApiErrorItem[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
