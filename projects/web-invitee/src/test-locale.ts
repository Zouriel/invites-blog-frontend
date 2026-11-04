import { setViewerLocale } from './app/shared/utils/event-time';

// Specs read dates as a British viewer would; a spec that needs another locale sets it itself.
setViewerLocale('en-GB');
