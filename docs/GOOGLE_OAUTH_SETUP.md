# Google OAuth 2.0 Setup Guide for Velve

This guide walks you through setting up Google Sign-In for the Velve mobile app.

## Prerequisites

- Access to [Google Cloud Console](https://console.cloud.google.com/)
- Velve Firebase project already set up
- Expo development environment configured

## Setup Steps

### 1. Create OAuth 2.0 Client ID in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (should match Firebase project: `velve-a3b33`)
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth client ID**

### 2. Configure Web Application Client

Google OAuth for mobile apps requires a **Web application** client type:

1. Select **Application type**: Web application
2. **Name**: `Velve Mobile (Web OAuth)`
3. **Authorized redirect URIs**: Add the following:
   - `https://auth.expo.io/@your-expo-username/velve` (replace with your Expo username)
   - `velve://auth/callback` (custom scheme for mobile)

4. Click **Create**
5. Copy the **Client ID** (format: `xxxxx.apps.googleusercontent.com`)

### 3. Configure Android App (for Production)

For Android builds, you need to register the app's SHA-1 certificate fingerprint:

#### Get SHA-1 Fingerprint

**For development (Debug keystore):**
```bash
cd apps/mobile
npx expo credentials:manager
# Select "Android" > "Keystore" > "View"
```

Or use keytool:
```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

**For production (EAS Build):**
```bash
eas credentials
# Select "Android" > "Keystore" > "View"
```

#### Register in Google Cloud Console

1. In **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Select **Application type**: Android
4. **Package name**: `com.velve.app` (from app.json)
5. **SHA-1 certificate fingerprint**: Paste the fingerprint from above
6. Click **Create**

### 4. Configure iOS App (for Production)

For iOS builds, you need to register the Bundle ID:

1. In **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Select **Application type**: iOS
4. **Bundle ID**: `com.velve.app` (from app.json)
5. Click **Create**

### 5. Update .env File

Add the **Web application** Client ID to your `.env` file:

```env
# Google OAuth 2.0
EXPO_PUBLIC_GOOGLE_CLIENT_ID=xxxxx-xxxxx.apps.googleusercontent.com
```

**Important:** Use the **Web application** Client ID, NOT the Android or iOS client IDs.

### 6. Verify Configuration

1. Start the Expo dev server:
   ```bash
   cd apps/mobile
   npx expo start
   ```

2. Check the console for validation messages:
   ```
   [Firebase] Google OAuth config validated successfully
   ```

3. Test Google Sign-In:
   - Open app on device/simulator
   - Tap "Nastavi sa Google"
   - Should open Google OAuth flow
   - Select account and authorize
   - Should return to app and sign in

## Troubleshooting

### Error: "CLIENT_ID_INVALID"
- Check that `EXPO_PUBLIC_GOOGLE_CLIENT_ID` is set in `.env`
- Verify it ends with `.apps.googleusercontent.com`
- Make sure it's the **Web application** client ID

### Error: "redirect_uri_mismatch"
- Add `velve://auth/callback` to **Authorized redirect URIs** in Google Cloud Console
- Add `https://auth.expo.io/@your-expo-username/velve` (replace with your Expo username)

### Google sign-in opens but immediately fails
- Verify SHA-1 fingerprint is registered for Android
- Verify Bundle ID is registered for iOS
- Check that all three client IDs exist (Web, Android, iOS)

### Network errors
- Check internet connection
- Verify Firebase API key is valid
- Check that Google OAuth APIs are enabled in Cloud Console

## Production Checklist

Before launching to production:

- [ ] Web application OAuth client created
- [ ] Android OAuth client created with production SHA-1
- [ ] iOS OAuth client created with Bundle ID
- [ ] `EXPO_PUBLIC_GOOGLE_CLIENT_ID` in `.env` (Web client ID)
- [ ] Redirect URI `velve://auth/callback` added
- [ ] Expo redirect URI added
- [ ] Tested on physical Android device
- [ ] Tested on physical iOS device
- [ ] Error messages display correctly for all failure cases

## Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Expo AuthSession Documentation](https://docs.expo.dev/versions/latest/sdk/auth-session/)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
