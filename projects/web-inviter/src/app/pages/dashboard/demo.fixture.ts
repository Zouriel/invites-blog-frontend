// A trimmed copy of GET /api/demo/event (2026-11-13), for specs.
import type { DemoEvent } from '../../shared/demo/demo-event';

export const DEMO_FIXTURE = {
 "demo": true,
 "campaign": {
  "id": "de300000-0000-4000-8000-000000000001",
  "title": "Aisha & Ibrahim",
  "status": "Dispatched",
  "paidInviteCapacity": 0,
  "rolesJson": "{\"roles\":[{\"name\":\"Bride's family\",\"contentBlocks\":[]},{\"name\":\"Groom's family\",\"contentBlocks\":[]},{\"name\":\"Friends\",\"contentBlocks\":[]},{\"name\":\"Colleagues\",\"contentBlocks\":[]}]}",
  "coverImageUrl": "/assets/demo/v1/01-table-roses.webp",
  "templatePreviewImageUrl": null,
  "hasInvitation": true,
  "openLink": null,
  "isImported": false,
  "isDraft": false,
  "resumeStep": null,
  "viewer": "organiser",
  "kind": "invitation",
  "allDay": false,
  "eventStartAt": "2026-12-03T12:00:00+00:00",
  "invitationCampaignId": null,
  "openGuestList": false,
  "timeZone": "Indian/Maldives"
 },
 "report": {
  "total": 24,
  "sent": 24,
  "failed": 0,
  "viewed": 20,
  "notSent": 0,
  "rsvp": {
   "going": 13,
   "maybe": 3,
   "notGoing": 2
  }
 },
 "guests": [
  {
   "id": "de300000-0000-4000-8000-000000000100",
   "name": "Mariyam Hassan",
   "email": null,
   "phoneE164": null,
   "role": "Bride's family",
   "gender": "unspecified",
   "optedOut": false,
   "inviteStatus": "Viewed",
   "rsvpStatus": "Going",
   "viewedAt": "2026-11-08T00:00:00+00:00",
   "deliveryChannel": "email",
   "rsvpAnswers": {
    "guestCount": "2",
    "comment": "Wouldn't miss it!"
   },
   "roles": [
    "Bride's family"
   ],
   "selfAdded": false,
   "typedContact": null,
   "emailStatus": "Delivered",
   "emailAt": "2026-11-06T00:00:00+00:00",
   "emailError": null,
   "manualSends": {},
   "shareLink": null,
   "shareText": null
  },
  {
   "id": "de300000-0000-4000-8000-000000000101",
   "name": "Ahmed Rasheed",
   "email": null,
   "phoneE164": null,
   "role": "Groom's family",
   "gender": "unspecified",
   "optedOut": false,
   "inviteStatus": "Viewed",
   "rsvpStatus": "Going",
   "viewedAt": "2026-11-09T01:00:00+00:00",
   "deliveryChannel": "email",
   "rsvpAnswers": {
    "guestCount": "4"
   },
   "roles": [
    "Groom's family"
   ],
   "selfAdded": false,
   "typedContact": null,
   "emailStatus": "Delivered",
   "emailAt": "2026-11-06T00:00:00+00:00",
   "emailError": null,
   "manualSends": {},
   "shareLink": null,
   "shareText": null
  },
  {
   "id": "de300000-0000-4000-8000-000000000102",
   "name": "Fathimath Shifa",
   "email": null,
   "phoneE164": null,
   "role": "Friends",
   "gender": "unspecified",
   "optedOut": false,
   "inviteStatus": "Viewed",
   "rsvpStatus": "Going",
   "viewedAt": "2026-11-10T02:00:00+00:00",
   "deliveryChannel": "email",
   "rsvpAnswers": {
    "guestCount": "1",
    "comment": "So happy for you both"
   },
   "roles": [
    "Friends"
   ],
   "selfAdded": false,
   "typedContact": null,
   "emailStatus": "Delivered",
   "emailAt": "2026-11-06T00:00:00+00:00",
   "emailError": null,
   "manualSends": {},
   "shareLink": null,
   "shareText": null
  }
 ],
 "rsvpQuestions": [
  {
   "key": "guestCount",
   "label": "How many guests? (including you)",
   "type": "number",
   "required": false,
   "options": null,
   "askIfNotGoing": false
  },
  {
   "key": "mealPreference",
   "label": "Meal preference",
   "type": "text",
   "required": false,
   "options": null,
   "askIfNotGoing": false
  },
  {
   "key": "arrivalTime",
   "label": "Arrival time",
   "type": "text",
   "required": false,
   "options": null,
   "askIfNotGoing": false
  },
  {
   "key": "comment",
   "label": "A note for the host",
   "type": "textarea",
   "required": false,
   "options": null,
   "askIfNotGoing": true
  }
 ],
 "sending": {
  "included": 100,
  "extra": 0,
  "used": 24,
  "total": 100,
  "left": 76
 },
 "celebrants": [
  {
   "id": "de300000-0000-4000-8000-000000000050",
   "name": "Aisha Ahmed",
   "email": null,
   "phone": null,
   "canManage": true,
   "notifiedAt": "2026-10-20T00:00:00+00:00"
  },
  {
   "id": "de300000-0000-4000-8000-000000000051",
   "name": "Ibrahim Nasheed",
   "email": null,
   "phone": null,
   "canManage": false,
   "notifiedAt": "2026-10-20T00:00:00+00:00"
  }
 ],
 "buckets": [
  {
   "id": "de300000-0000-4000-8000-000000000002",
   "name": "Photos",
   "title": "Aisha & Ibrahim",
   "coverUrl": "/assets/demo/v1/01-table-roses.webp",
   "tier": "GoldPass",
   "gb": 5,
   "capacityBytes": 5368709120,
   "usedBytes": 807672,
   "percentUsed": 0,
   "itemCount": 12,
   "campaignId": "de300000-0000-4000-8000-000000000001",
   "campaignTitle": "Aisha & Ibrahim",
   "eventDate": "2026-12-03T12:00:00+00:00",
   "isOpen": false,
   "windowDays": 3,
   "isDefault": true,
   "termEndAt": null,
   "expired": false,
   "createdAt": "2026-10-19T00:00:00+00:00",
   "maxBuckets": 2,
   "maxWindowDays": 3,
   "phase": "Active",
   "eventUsedBytes": 807672,
   "privateAlbums": false,
   "branded": false,
   "venueName": null,
   "venueLogoUrl": null,
   "cardTheme": null,
   "trimAt": null,
   "trimBytes": null,
   "freeBytes": 314572800,
   "faceGrouping": false,
   "faceGroupingAvailable": false,
   "faceGroupingIncluded": true
  }
 ],
 "album": {
  "campaignId": "de300000-0000-4000-8000-000000000001",
  "eventTitle": "Aisha & Ibrahim",
  "count": 12,
  "canUpload": false,
  "photos": [
   {
    "id": "de300000-0000-4000-8000-000000001000",
    "url": "/assets/demo/v1/01-table-roses.webp",
    "thumbUrl": "/assets/demo/v1/01-table-roses-thumb.webp",
    "originalUrl": "/assets/demo/v1/01-table-roses.webp",
    "contentType": "image/webp",
    "width": 1280,
    "height": 853,
    "uploaderName": "Mariyam Hassan",
    "canDelete": false,
    "createdAt": "2026-11-11T10:00:00+00:00",
    "uploaderUserId": null,
    "sizeBytes": 70376,
    "favouriteCount": 3,
    "favourited": false,
    "people": null
   },
   {
    "id": "de300000-0000-4000-8000-000000001001",
    "url": "/assets/demo/v1/02-hall.webp",
    "thumbUrl": "/assets/demo/v1/02-hall-thumb.webp",
    "originalUrl": "/assets/demo/v1/02-hall.webp",
    "contentType": "image/webp",
    "width": 1280,
    "height": 853,
    "uploaderName": "Ibrahim Shareef",
    "canDelete": false,
    "createdAt": "2026-11-11T11:00:00+00:00",
    "uploaderUserId": null,
    "sizeBytes": 161866,
    "favouriteCount": 4,
    "favourited": false,
    "people": null
   },
   {
    "id": "de300000-0000-4000-8000-000000001002",
    "url": "/assets/demo/v1/03-aisle.webp",
    "thumbUrl": "/assets/demo/v1/03-aisle-thumb.webp",
    "originalUrl": "/assets/demo/v1/03-aisle.webp",
    "contentType": "image/webp",
    "width": 1280,
    "height": 854,
    "uploaderName": "Sara Ibrahim",
    "canDelete": false,
    "createdAt": "2026-11-11T12:00:00+00:00",
    "uploaderUserId": null,
    "sizeBytes": 81784,
    "favouriteCount": 5,
    "favourited": false,
    "people": null
   },
   {
    "id": "de300000-0000-4000-8000-000000001003",
    "url": "/assets/demo/v1/04-rings.webp",
    "thumbUrl": "/assets/demo/v1/04-rings-thumb.webp",
    "originalUrl": "/assets/demo/v1/04-rings.webp",
    "contentType": "image/webp",
    "width": 1280,
    "height": 853,
    "uploaderName": "Ismail Rameez",
    "canDelete": false,
    "createdAt": "2026-11-11T13:00:00+00:00",
    "uploaderUserId": null,
    "sizeBytes": 48960,
    "favouriteCount": 0,
    "favourited": false,
    "people": null
   }
  ],
  "closedNote": "This is an example event. Nothing here is real.",
  "venueName": null,
  "venueLogoUrl": null,
  "saveTheDate": false,
  "faces": null
 },
 "covers": {
  "bucketId": "de300000-0000-4000-8000-000000000002",
  "photoIds": [
   "de300000-0000-4000-8000-000000001000",
   "de300000-0000-4000-8000-000000001001"
  ],
  "max": 6
 }
} as unknown as DemoEvent;
