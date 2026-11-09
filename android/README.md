# MilkyWay Android release

The Android project is generated from `@capacitor/android` into `android/capacitor` by the release workflow. Native overrides live in `android/native-src` and are copied into that generated project before each build.

The app starts at `https://www.masiyatunda.com/milkyway/`, the canonical app URL that returns without a redirect. The native plugin provides the in-app Back/Exit action, secure external HTTPS links, app version information, and Firebase client initialization.

The workflow builds a signed release APK. Before running `.github/workflows/android-apk.yml`, add these repository Actions secrets using the existing Android release keystore:

- `ANDROID_RELEASE_KEYSTORE_BASE64`
- `ANDROID_RELEASE_STORE_PASSWORD`
- `ANDROID_RELEASE_KEY_ALIAS`
- `ANDROID_RELEASE_KEY_PASSWORD`

Never commit the keystore or its passwords. The workflow decodes the base64 keystore into the runner's temporary directory and passes signing credentials to Gradle through environment variables; credentials are not written into the generated project. On a successful build, Actions commits the generated Android project and signed `milkyway/download/MilkyWay.apk` to the branch that triggered the build.
