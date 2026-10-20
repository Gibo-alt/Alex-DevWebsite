**Impilo** is a mental wellness app I'm building natively in Kotlin. Early on I wanted a simple guarantee: every push to GitHub should prove that the project still compiles. A small GitHub Actions workflow does exactly that.

## Why bother with CI on a personal project?

It's easy to commit something that builds on your machine but not anywhere else: a missing file, a Gradle change you forgot to push, or a dependency that only resolved because of your local cache. A clean CI build catches those immediately.

## The workflow

The job runs on every push and pull request, sets up Java 17, makes the Gradle wrapper executable and runs the debug build:

```yaml
name: Android build

on:
  push:
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'
          cache: gradle

      - name: Make Gradle wrapper executable
        run: chmod +x ./gradlew

      - name: Build debug APK
        run: ./gradlew assembleDebug
```

## Things that tripped me up

- **Use the wrapper, not a global Gradle.** `./gradlew` pins the version the project expects.
- **The executable bit.** If the wrapper was committed from Windows, CI may not be able to run it. That's what the `chmod` step is for.
- **Java version mismatches.** The Android Gradle Plugin needs a specific JDK, so set it explicitly.

## What's next

The build check is the foundation. Next I'd like to add unit tests for the task and goal logic, and run lint in the same workflow, so the green tick means more than "it compiles".
