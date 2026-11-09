import { copyFileSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const androidRoot = path.resolve('android/capacitor');
const appRoot = path.join(androidRoot, 'app');
const javaRoot = path.join(appRoot, 'src/main/java/com/masiyatunda/milkyway');
const buildFile = path.join(appRoot, 'build.gradle');
const config = JSON.parse(readFileSync('capacitor.config.json', 'utf8'));
const version = JSON.parse(readFileSync('milkyway/download/version.json', 'utf8'));
const buildVersionCode = Number(process.env.ANDROID_RELEASE_VERSION_CODE);
const buildVersionName = process.env.ANDROID_RELEASE_VERSION_NAME;
const signingEnvironment = [
  'ANDROID_RELEASE_KEYSTORE_PATH',
  'ANDROID_RELEASE_STORE_PASSWORD',
  'ANDROID_RELEASE_KEY_ALIAS',
  'ANDROID_RELEASE_KEY_PASSWORD',
];
const signingConfigured = signingEnvironment.some(name => process.env[name]);

if (config.android?.path !== 'android/capacitor') {
  throw new Error('Capacitor Android path must be android/capacitor.');
}
if (!Number.isInteger(buildVersionCode) || buildVersionCode <= version.versionCode || !buildVersionName) {
  throw new Error('Android release version must be newer than the currently published APK.');
}
if (signingConfigured && signingEnvironment.some(name => !process.env[name])) {
  throw new Error('All Android release signing environment variables must be configured.');
}

const gradle = readFileSync(buildFile, 'utf8');
if (!gradle.includes('defaultConfig {') || !gradle.includes('buildTypes {')) {
  throw new Error('Generated Android app Gradle file has an unsupported structure.');
}

let updatedGradle = gradle
  .replace(/versionCode\s+\d+/, `versionCode ${buildVersionCode}`)
  .replace(/versionName\s+["'][^"']*["']/, `versionName "${buildVersionName}"`);
if (!/versionCode\s+\d+/.test(updatedGradle) || !/versionName\s+["'][^"']*["']/.test(updatedGradle)) {
  throw new Error('Could not set the Android app version in Gradle.');
}

if (!updatedGradle.includes('androidx.activity:activity')) {
  const dependenciesIndex = updatedGradle.indexOf('dependencies {');
  if (dependenciesIndex < 0) throw new Error('Generated Android app has no dependencies block.');
  const insertionPoint = dependenciesIndex + 'dependencies {'.length;
  updatedGradle = `${updatedGradle.slice(0, insertionPoint)}\n    implementation 'androidx.activity:activity:1.10.1'${updatedGradle.slice(insertionPoint)}`;
}
if (!updatedGradle.includes('com.google.firebase:firebase-messaging')) {
  const dependenciesIndex = updatedGradle.indexOf('dependencies {');
  if (dependenciesIndex < 0) throw new Error('Generated Android app has no dependencies block.');
  const insertionPoint = dependenciesIndex + 'dependencies {'.length;
  updatedGradle = `${updatedGradle.slice(0, insertionPoint)}\n    implementation 'com.google.firebase:firebase-messaging:25.0.1'${updatedGradle.slice(insertionPoint)}`;
}
if (signingConfigured) {
  const buildTypesIndex = updatedGradle.indexOf('    buildTypes {');
  if (buildTypesIndex < 0) throw new Error('Generated Android app has no buildTypes block.');
  updatedGradle = `${updatedGradle.slice(0, buildTypesIndex)}    signingConfigs {
        release {
            storeFile file(System.getenv('ANDROID_RELEASE_KEYSTORE_PATH'))
            storePassword System.getenv('ANDROID_RELEASE_STORE_PASSWORD')
            keyAlias System.getenv('ANDROID_RELEASE_KEY_ALIAS')
            keyPassword System.getenv('ANDROID_RELEASE_KEY_PASSWORD')
        }
    }

${updatedGradle.slice(buildTypesIndex)}`;
  const updatedBuildTypesIndex = updatedGradle.indexOf('    buildTypes {');
  const releaseBuildType = updatedGradle.indexOf('        release {', updatedBuildTypesIndex);
  if (releaseBuildType < 0) throw new Error('Generated Android app has no release build type.');
  const releaseConfigStart = releaseBuildType + '        release {'.length;
  updatedGradle = `${updatedGradle.slice(0, releaseConfigStart)}
            signingConfig signingConfigs.release${updatedGradle.slice(releaseConfigStart)}`;
}
writeFileSync(buildFile, updatedGradle);

for (const file of ['MainActivity.java', 'MilkyWayNativePlugin.java']) {
  copyFileSync(
    path.join('android/native-src/com/masiyatunda/milkyway', file),
    path.join(javaRoot, file),
  );
}

// MilkyWay launcher icons replace the default Capacitor ones.
cpSync('android/native-src/res', path.join(appRoot, 'src/main/res'), { recursive: true, force: true });

const manifestPath = path.join(appRoot, 'src/main/AndroidManifest.xml');
const manifest = readFileSync(manifestPath, 'utf8');
if (!/android\.permission\.INTERNET/.test(manifest)) {
  throw new Error('Generated Android manifest is missing Internet access permission.');
}
if (/android:usesCleartextTraffic\s*=\s*"true"/.test(manifest)) {
  throw new Error('Cleartext HTTP traffic must remain disabled.');
}
// LIVE needs the microphone and camera; the WebView only prompts for them when the app declares them.
const liveAccess = ['CAMERA', 'RECORD_AUDIO', 'MODIFY_AUDIO_SETTINGS'].filter(name => !new RegExp(`android\\.permission\\.${name}\\b`).test(manifest));
if (liveAccess.length) {
  writeFileSync(manifestPath, manifest.replace('</manifest>', `${liveAccess.map(name => `    <uses-permission android:name="android.permission.${name}" />\n`).join('')}</manifest>`));
}
