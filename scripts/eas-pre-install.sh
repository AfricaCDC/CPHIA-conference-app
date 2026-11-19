#!/usr/bin/env bash
# EAS cloud builders ship JDK 17; Capacitor 8 compiles with Java 21.
# On the Linux cloud builder, install JDK 21 and point Gradle at it. Local builds (macOS) are left alone.
set -euo pipefail

if [[ "$(uname -s)" != "Linux" || "${EAS_BUILD_RUNNER:-}" != "eas-build" ]]; then
  exit 0
fi

if ! ls -d /usr/lib/jvm/java-21-openjdk-* >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo apt-get install -y --no-install-recommends openjdk-21-jdk-headless
fi

JDK21="$(ls -d /usr/lib/jvm/java-21-openjdk-* | head -1)"
mkdir -p "$HOME/.gradle"
PROPS="$HOME/.gradle/gradle.properties"
touch "$PROPS"
# The builder's default jvmargs carry -XX:MaxPermSize, which Java 21 refuses to start with;
# eas.json overrides org.gradle.jvmargs on the Gradle command line for that reason.
echo "org.gradle.java.home=${JDK21}" >> "$PROPS"
echo "Gradle will use ${JDK21}"
