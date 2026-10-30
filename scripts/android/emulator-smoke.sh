#!/usr/bin/env bash
set -euo pipefail
ANDROID_PREVIEW_CODE="${ANDROID_PREVIEW_CODE:-320001}"
mkdir -p mobile-release
mobile_artifacts="$(pwd)/mobile-release"
adb logcat -c
trap 'adb logcat -d > "$mobile_artifacts/android-logcat.txt"; adb shell dumpsys display > "$mobile_artifacts/android-display.txt"; for f in android-house.png android-floating.png android-floating-landscape.png android-last-screen.png android-ui-state.txt; do adb pull "/sdcard/Android/data/com.molebaby.ramu.preview.dev/files/$f" "$mobile_artifacts/$f" || true; done' EXIT
cd android
./gradlew assembleDebugAndroidTest -PmoleVersion="0.32.0-preview.${GITHUB_RUN_NUMBER:-1}" -PmoleVersionCode="$ANDROID_PREVIEW_CODE" --no-daemon
# UTP normally uninstalls target packages after connected tests. Run the same
# instrumentation directly so the real installation and save survive phase one.
adb install -r "$mobile_artifacts/mole-baby-android-preview-dev.apk"
adb install -r app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb shell am instrument -w -e class com.molebaby.ramu.AndroidSmokeTest com.molebaby.ramu.preview.dev.test/androidx.test.runner.AndroidJUnitRunner | tee "$mobile_artifacts/native-smoke-test.txt"
node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");if(!/OK \(1 test\)/.test(s)||/FAILURES|INSTRUMENTATION_FAILED/.test(s))process.exit(1)' "$mobile_artifacts/native-smoke-test.txt"
adb pull /sdcard/Android/data/com.molebaby.ramu.preview.dev/files/android-house.png ../mobile-release/android-house.png
./gradlew assembleDebug -PmoleVersionCode="$((ANDROID_PREVIEW_CODE+1))" --no-daemon
node ../scripts/android/apk-blockmaps.cjs "$mobile_artifacts/mole-baby-android-preview-dev.apk" "$(pwd)/app/build/outputs/apk/debug/app-debug.apk"
./gradlew testDebugUnitTest --tests com.molebaby.ramu.ActualApkDeltaTest -PmoleDeltaOld="$mobile_artifacts/mole-baby-android-preview-dev.apk" -PmoleDeltaNext="$(pwd)/app/build/outputs/apk/debug/app-debug.apk" -PmoleDeltaOutput="$(pwd)/build/apk-delta/rebuilt.apk" --no-daemon
cp build/apk-delta/actual-apk-delta.json "$mobile_artifacts/actual-apk-delta.json"
adb install -r build/apk-delta/rebuilt.apk
adb shell am instrument -w -e class com.molebaby.ramu.UpgradePersistenceTest com.molebaby.ramu.preview.dev.test/androidx.test.runner.AndroidJUnitRunner | tee ../mobile-release/apk-upgrade-test.txt
node -e 'const s=require("fs").readFileSync("../mobile-release/apk-upgrade-test.txt","utf8");if(!/OK \(1 test\)/.test(s)||/FAILURES|INSTRUMENTATION_FAILED/.test(s))process.exit(1)'
cd ..
sha256sum mobile-release/mole-baby-android-preview-dev.apk > mobile-release/SHA256SUMS.txt
