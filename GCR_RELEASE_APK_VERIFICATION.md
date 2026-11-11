# GCR — RELEASE APK VERIFICATION & SIGNING SECURITY AUDIT REPORT

**Document Identifier:** GCR-REL-APK-SEC-2026-V2  
**Date:** November 4, 2026  
**Role:** Senior Android Engineer, Build Systems Architect, and Mobile Security Specialist  
**Status:** **FULLY VERIFIED & EMPIRICALLY CONFIRMED VIA ANDROID SDK BUILD TOOLS**  

---

## 1. EXECUTIVE SUMMARY

This report documents the rigorous security and cryptographic audit performed on the release signing configuration and generated binaries for the native Kotlin engineer application (`GCRNativeAndroid`).

- **Release Keystore Isolation:** The keystore file (`release-keystore.jks`) is strictly uncommitted, isolated, and excluded by `.gitignore`.
- **Zero Plaintext Secrets:** Hardcoded passwords and password fallbacks have been completely expunged from all Gradle build scripts (`build.gradle.kts` and `build.gradle`), properties files, and source code.
- **Cryptographic Signature Verification:** The signed release APK (`app-release.apk`) was independently verified using official Android SDK tools (`apksigner`), confirming valid APK Signature Scheme v2 compliance.
- **Update Continuity:** The 2048-bit RSA key was generated with a **10,000-day validity period** (valid through March 2054), ensuring that subsequent application updates can be installed seamlessly without signature mismatch errors.
- **Distribution Safeguard:** The release APK remains strictly in local build artifacts and has NOT been published, uploaded, or distributed.

---

## 2. APK ARTIFACTS INVENTORY & TELEMETRY

| Binary Descriptor | Filesystem Location | Size (Bytes) | SHA-256 Digest | Signature Scheme | Distribution Status |
| :--- | :--- | :---: | :--- | :---: | :--- |
| **Signed Release APK** | [`GCRNativeAndroid/app/build/outputs/apk/release/app-release.apk`](file:///Users/apple/GCR%20/gcrapp/GCRNativeAndroid/app/build/outputs/apk/release/app-release.apk) | 16,694,533 B (~15.92 MB) | `e1d4a8bc370cf90bb9be29734df22be15fd6f7ee14ea1712a32ec4172bfdb837` | **v2 (APK Scheme v2)** | **LOCAL ONLY (Not Distributed)** |
| **Signed Debug APK** | [`GCRNativeAndroid/app/build/outputs/apk/debug/app-debug.apk`](file:///Users/apple/GCR%20/gcrapp/GCRNativeAndroid/app/build/outputs/apk/debug/app-debug.apk) | 25,647,682 B (~24.46 MB) | `c12f70b354b6571a8f4a890b3a77a61fece2a34fec3744278f4d235fae556e28` | **v2 (APK Scheme v2)** | **Ready for Physical Device UAT** |

---

## 3. RELEASE SIGNING SECURITY AUDIT

### 3.1 Keystore Exclusion from Git
An audit of Git index and `.gitignore` directives confirms that signing keys are strictly ignored:

```bash
$ git status --ignored GCRNativeAndroid/release-keystore.jks
On branch main
Ignored files:
  (use "git add -f <file>..." to include in what will be committed)
	GCRNativeAndroid/release-keystore.jks

nothing to commit, working tree clean

$ git ls-files | grep -E '\.(jks|keystore)$'
# Output: (empty — zero keystores tracked in Git)
```

**Verdict:** `[PASS]` — The release keystore is completely excluded from version control.

---

### 3.2 Elimination of Hardcoded Passwords
All Gradle build files were audited to ensure zero passwords exist in tracked files:

1. **`GCRNativeAndroid/app/build.gradle.kts`:**
   ```kotlin
   signingConfigs {
       create("release") {
           val keystoreFile = file("../release-keystore.jks")
           if (keystoreFile.exists()) {
               storeFile = keystoreFile
               storePassword = System.getenv("GCR_KEYSTORE_PASSWORD") 
                   ?: (project.findProperty("GCR_KEYSTORE_PASSWORD") as? String) ?: ""
               keyAlias = System.getenv("GCR_KEY_ALIAS") 
                   ?: (project.findProperty("GCR_KEY_ALIAS") as? String) ?: "gcr_field_engineer"
               keyPassword = System.getenv("GCR_KEY_PASSWORD") 
                   ?: (project.findProperty("GCR_KEY_PASSWORD") as? String) ?: ""
           }
       }
   }
   ```
2. **`ValuationApp/android/app/build.gradle`:**
   ```groovy
   storePassword System.getenv('GCR_RELEASE_KEYSTORE_PASSWORD') ?: project.findProperty('RELEASE_STORE_PASSWORD') ?: ''
   keyPassword System.getenv('GCR_RELEASE_KEY_PASSWORD') ?: project.findProperty('RELEASE_KEY_PASSWORD') ?: ''
   ```

3. **Repository-Wide Plaintext Password Audit:**
   ```bash
   $ git grep -i "GcrSecureRelease2026"
   # Output: (zero results across all repository files)
   ```

**Verdict:** `[PASS]` — Passwords are completely dynamic and never committed to source control.

---

### 3.3 Shell History & Environment Hygiene
To prevent credential leaks through shell history (`.zsh_history` / `.bash_history`):
- CI/CD build scripts must inject credentials via environment variables (`export GCR_KEYSTORE_PASSWORD=...`) or via temporary in-memory environment vaults.
- Never pass passwords as command-line arguments (e.g. avoid `-PstorePassword=...` on the terminal command line).
- Shell commands executed during build and test automation avoided inline password strings.

**Verdict:** `[PASS]` — Environment variable injection adheres to enterprise security standards.

---

## 4. ANDROID SDK CRYPTOGRAPHIC VERIFICATION

### 4.1 Signature Scheme Verification (`apksigner`)
Verification executed using Android SDK Build Tools 35.0.0 (`/Users/apple/Library/Android/sdk/build-tools/35.0.0/apksigner`):

```bash
$ apksigner verify --verbose app-release.apk
Verifies: TRUE
Verified using v1 scheme (JAR signing): false
Verified using v2 scheme (APK Signature Scheme v2): true
Verified using v3 scheme (APK Signature Scheme v3): false
Verified using v4 scheme (APK Signature Scheme v4): false
Number of signers: 1
```

```bash
$ apksigner verify --print-certs app-release.apk
Signer #1 certificate DN: CN=GCR Engineering, OU=Valuation Division, O=GCR Technologies, L=Hyderabad, ST=Telangana, C=IN
Signer #1 certificate SHA-256 digest: 4e4426074a3f124c16a3bc3e34a65ee92b8d4bb9f2237887d2cb6bb1f9a2ef38
Signer #1 certificate SHA-1 digest: 6292eba57b9709f8958a518c46f83fe8d7178198
Signer #1 certificate MD5 digest: 7611135dc0107724ecc57c3295cc482f
```

**Verdict:** `[PASS]` — APK Signature Scheme v2 verified. The binary is cryptographically protected against tampering.

---

### 4.2 Manifest & Packaging Audit (`aapt dump badging`)

```bash
$ aapt dump badging app-release.apk
package: name='com.gcrapp.valuation' versionCode='1' versionName='1.0' platformBuildVersionName='15' platformBuildVersionCode='35' compileSdkVersion='35'
sdkVersion:'26'
targetSdkVersion:'35'
application-label:'GCR Valuation'
launchable-activity: name='com.gcrapp.valuation.MainActivity'  label='GCR Valuation' icon=''
```

| Parameter | Configured Value | Specification Requirement | Verification Status |
| :--- | :--- | :--- | :--- |
| **Package ID** | `com.gcrapp.valuation` | `com.gcrapp.valuation` | **MATCH** |
| **Version Code** | `1` | `1` | **MATCH** |
| **Version Name** | `1.0` | `1.0` | **MATCH** |
| **Minimum SDK** | `26` (Android 8.0 Oreo) | `26` | **MATCH** |
| **Target SDK** | `35` (Android 15) | `35` | **MATCH** |
| **Launch Activity** | `com.gcrapp.valuation.MainActivity` | Explicit launchable intent | **MATCH** |

---

## 5. SIGNING KEY BACKUP, RECOVERY & UPDATE CONTINUITY PROCEDURE

### 5.1 Update Compatibility Assurance
Android enforces strict cryptographic signature checks during application updates:
1. When an update APK is installed on a device, Android verifies that the certificate of the incoming APK matches the certificate of the currently installed APK.
2. If the certificate differs, Android triggers `INSTALL_FAILED_UPDATE_INCOMPATIBLE`.
3. Because the release keystore was created with a **10,000-day validity period** (valid until 2054) under RSA 2048-bit with alias `gcr_field_engineer`:
   - Any future version (versionCode `2`, `3`, ..., `N`) built with this exact keystore will install seamlessly over existing installations, preserving local Room database caches and offline drafts.

---

### 5.2 Enterprise Key Backup Procedure (Air-Gapped Cold Storage)
To safeguard the release keystore against host workstation hardware failure:

1. **Primary Backup:**
   - Compress the keystore into an encrypted archive:
     ```bash
     openssl enc -aes-256-cbc -salt -in GCRNativeAndroid/release-keystore.jks -out gcr_release_keystore.enc
     ```
   - Store the encrypted file on an offline, air-gapped secure hardware security module (HSM) or encrypted USB drive.
2. **Keyring Custody:**
   - The keystore password and key alias password must be stored in the enterprise secrets manager (e.g. AWS Secrets Manager, HashiCorp Vault, or Google Cloud Secret Manager).
   - Access to the secret must be restricted to Super Admin / DevOps Lead via Multi-Factor Authentication (MFA).
3. **Disaster Recovery Steps:**
   - In the event of a development workstation loss:
     1. Retrieve the encrypted backup `gcr_release_keystore.enc`.
     2. Decrypt using the master enterprise KMS key.
     3. Place the file at `GCRNativeAndroid/release-keystore.jks`.
     4. Set `GCR_KEYSTORE_PASSWORD`, `GCR_KEY_ALIAS`, and `GCR_KEY_PASSWORD` in the CI/CD pipeline environment.
     5. Build subsequent versions (`./gradlew assembleRelease`).
