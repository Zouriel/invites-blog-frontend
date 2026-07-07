/** Repeated literal sets, centralised as enums. */

export enum GuestGender {
  Male = 'male',
  Female = 'female',
  Neutral = 'neutral',
}

export enum DeliveryChannelKey {
  Email = 'email',
  Link = 'link',
  Telegram = 'telegram',
  WhatsApp = 'whatsapp',
}

export enum WizardStepKey {
  Editor = 'editor',
  Guests = 'guests',
  Venue = 'venue',
  Inviter = 'inviter',
  Delivery = 'delivery',
  Payment = 'payment',
}
