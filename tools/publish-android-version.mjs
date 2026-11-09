import { readFileSync, writeFileSync } from 'node:fs';

const versionPath = 'milkyway/download/version.json';
const metadata = JSON.parse(readFileSync(versionPath, 'utf8'));
const versionCode = Number(process.env.ANDROID_RELEASE_VERSION_CODE);
const versionName = process.env.ANDROID_RELEASE_VERSION_NAME;

if (!Number.isInteger(versionCode) || versionCode <= metadata.versionCode || !versionName) {
  throw new Error('Published Android version must increase the currently available APK version.');
}

metadata.versionCode = versionCode;
metadata.versionName = versionName;
metadata.notes = 'Rebuilt Capacitor Android app with canonical HTTPS loading and Back/Exit controls.';
writeFileSync(versionPath, `${JSON.stringify(metadata, null, 2)}\n`);
