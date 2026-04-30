# Must Do

## iOS Rich Push Image Preview

Expo push payloads now include `richContent.image` and `data.imageUrl`, so Android can show item image previews from the current server payload.

To finish this on iOS production builds, add a Notification Service Extension through the native/EAS build flow so APNs can download and attach the image before the notification is displayed. Without that extension, iOS may receive the URL in `data` but will not reliably show the image preview in the notification UI.

References:
- https://docs.expo.dev/push-notifications/sending-notifications/
- https://docs.expo.dev/push-notifications/sending-notifications-custom/
