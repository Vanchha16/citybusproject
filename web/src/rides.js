// Getting to the bus stop by ride instead of walking.
//
// Grab and PassApp publish no documented way to open their apps with the pickup
// or drop-off filled in, so we link to each app's OFFICIAL store page: on a
// phone it shows "Open" when the app is installed, "Install" otherwise. The stop
// name is copied so the passenger can paste it as the drop-off.

// Average door-to-door speed in Phnom Penh city traffic. An assumption, not
// measured: change it here if you have better numbers.
export const RIDE_KMH = 18;

/** Ride time in minutes for a road distance in metres (at least 2). */
export const rideMinutes = (meters) => Math.max(2, Math.round(meters / ((RIDE_KMH * 1000) / 60)));

// Official store listings (verified): App Store app id / Google Play package.
// Icons: each app's own App Store icon (96 px), shown only to label the link to that app.
export const RIDE_APPS = [
  {
    key: 'grab',
    name: 'Grab',
    icon: '/rides/grab.png',
    ios: 'https://apps.apple.com/app/id647268330',
    android: 'https://play.google.com/store/apps/details?id=com.grabtaxi.passenger',
  },
  {
    key: 'passapp',
    name: 'PassApp',
    icon: '/rides/passapp.png',
    ios: 'https://apps.apple.com/app/id1535615747',
    android: 'https://play.google.com/store/apps/details?id=kh.com.passapp.passenger',
  },
];

const isApple = () =>
  /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** The store page for this device (App Store on iPhone/iPad, Google Play otherwise). */
export const storeUrl = (app) => (isApple() ? app.ios : app.android);
