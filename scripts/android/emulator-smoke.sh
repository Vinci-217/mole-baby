#!/usr/bin/env bash
set -euo pipefail
ANDROID_PREVIEW_CODE="${ANDROID_PREVIEW_CODE:-320001}"
mkdir -p mobile-release
mobile_artifacts="$(pwd)/mobile-release"
adb logcat -c
trap 'adb logcat -d > "$mobile_artifacts/android-logcat.txt"' EXIT
cd android
./gradlew connectedDebugAndroidTest -PmoleVersion="0.32.0-preview.${GITHUB_RUN_NUMBER:-1}" -PmoleVersionCode="$ANDROID_PREVIEW_CODE" -Pandroid.testInstrumentationRunnerArguments.class=com.molebaby.ramu.AndroidSmokeTest --no-daemon
adb pull /sdcard/Android/data/com.molebaby.ramu.preview.dev/files/android-house.png ../mobile-release/android-house.png
./gradlew assembleDebug -PmoleVersionCode="$((ANDROID_PREVIEW_CODE+1))" --no-daemon
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am instrument -w -e class com.molebaby.ramu.UpgradePersistenceTest com.molebaby.ramu.preview.dev.test/androidx.test.runner.AndroidJUnitRunner | tee ../mobile-release/apk-upgrade-test.txt
node -e 'const s=require("fs").readFileSync("../mobile-release/apk-upgrade-test.txt","utf8");if(!/OK \(1 test\)/.test(s)||/FAILURES|INSTRUMENTATION_FAILED/.test(s))process.exit(1)'
cd ..
sha256sum mobile-release/mole-baby-android-preview-dev.apk > mobile-release/SHA256SUMS.txt
