<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/d2116248-5f01-4768-a590-696d82f1012c

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies with `npm ci`.
2. Set `GEMINI_API_KEY` in `.env.local`.
3. Start the web app with `npm run dev`.

## Build the Android app

**Prerequisites:** Node.js, JDK 21, and Android SDK Platform 36.

1. Install dependencies with `npm ci`.
2. Build the web app and sync it to Android:
   `npm run build`
   `npx cap sync android`
3. Build a debug APK:
   `android\gradlew.bat assembleDebug`
4. Find the APK at `android\app\build\outputs\apk\debug\app-debug.apk`.

The **Build Android APK & Google Play AAB** GitHub Actions workflow also builds a
debug APK and a release AAB on pushes to `main` or `master`, and can be run
manually. It publishes them as `grammaticat-android-apk` and
`grammaticat-google-play-aab` workflow artifacts.
