# Putting Gouru Valuations on Google Play and the App Store — step by step

Simple steps for the owner. Uploading to the stores, accepting their terms and paying are done **by you** (they need your own
accounts, passwords and payments). Everything the stores ask for is already prepared in this project:

| Ready already | Where |
|---|---|
| Store text (name, description, keywords) | `STORE_LISTING.md` |
| Privacy policy page | https://gcrapp-lilac.vercel.app/privacy |
| Account deletion page | https://gcrapp-lilac.vercel.app/delete-account |
| Reviewer logins (private, never share) | `ValuationBackend/secrets/store-review-logins.txt` |
| Android app id | `com.appgcr.valuationapp` (version 1.0.2, build 3) |
| iPhone app id | `com.appgcr.gouruvaluations` |
| Permission messages (camera, location, microphone, photos) | already in the app |

---

## Step 0 — before any store (do this first)

1. **Push the latest server changes** (the new screens need them), and wait about 5 minutes for Render and Vercel to update.
2. **Test the APK** `GCR-Valuation-1.0.2-test.apk` on 2–3 real phones: sign in, New Case, site photos, notifications.
3. **Decide the account type — important:**
   - **Organisation account (recommended):** in the company name, needs a free **D-U-N-S number** for your business
     (apply at dnb.com, takes about 1–2 weeks). Looks professional, and Google does **not** ask for the 14-day test below.
   - **Personal account:** quicker to open, but Google makes **new personal accounts** run a **closed test with at least
     12 testers for 14 days** before the app can go public.
4. Use the **company email** for both store accounts and turn on **2-step verification**.

---

## Part A — Google Play (Android)

**Cost:** one-time US $25. **Review:** usually 1–7 days.

### A1. Create the developer account
1. Go to **play.google.com/console** → sign up (Organisation or Personal, see Step 0) → pay $25 → verify your identity.

### A2. Make the "release" build (the store file) — on this Mac
The store needs an **.aab** file signed with **your release key** (`gcr-release-key.jks`).
> ⚠️ This key is like the master key of the app. **Keep 2 copies safe (e.g. a pen drive + Google Drive) and never lose the
> password** — without it you can never update the app. Never send it in chat.

Commands (your developer can run these; the passwords are typed only on your computer):
```bash
cd "ValuationApp"
npm run build
npx cap sync android
cd android
export GCR_RELEASE_KEYSTORE=/full/path/to/gcr-release-key.jks
export GCR_RELEASE_KEY_ALIAS=gcrapp
read -s -p "Keystore password: " GCR_RELEASE_KEYSTORE_PASSWORD; export GCR_RELEASE_KEYSTORE_PASSWORD; echo
read -s -p "Key password: " GCR_RELEASE_KEY_PASSWORD; export GCR_RELEASE_KEY_PASSWORD; echo
./gradlew bundleRelease
```
The file is created at `ValuationApp/android/app/build/outputs/bundle/release/app-release.aab`.
For every new version, raise `versionCode` (3 → 4 → 5…) and `versionName` in `android/app/build.gradle`.

### A3. Create the app in Play Console
1. **Create app** → name "Gouru Valuations" → App → Free.
2. **Main store listing:** copy the text from `STORE_LISTING.md`. Add:
   - App icon 512×512 (`gcr_icon_512.png` in the project)
   - Feature graphic 1024×500
   - At least 2 phone screenshots (take them on your phone)
3. **App content** (left menu → Policy → App content), answer each:
   - **Privacy policy:** https://gcrapp-lilac.vercel.app/privacy
   - **App access:** "Some features need login" → give the reviewer login from `store-review-logins.txt`
   - **Ads:** No ads
   - **Content rating:** fill the questionnaire (business app, no violence etc.)
   - **Target audience:** 18 and over
   - **Data safety:** the app collects **name, phone, email, location (only while on duty), photos, documents, audio (voice
     fill)**; all are **encrypted in transit**, used for **app functionality**, **not sold or shared** for ads; users can
     **ask for deletion** at the delete-account page
   - **Account deletion URL:** https://gcrapp-lilac.vercel.app/delete-account
   - **Government app:** No · **Financial features:** No (the app doesn't lend money)

### A4. Upload and release
1. **Testing → Internal testing** → Create release → upload `app-release.aab` → add your team's emails as testers →
   share the test link. Check everything works.
2. Personal accounts only: **Closed testing** with **12+ testers for 14 days**.
3. **Production** → Create release → upload the same .aab → **Send for review**.
4. When approved, it appears on Play Store as **Gouru Valuations**. Engineers then install/update from Play Store —
   no more APK files.

---

## Part B — Apple App Store (iPhone)

**Cost:** US $99 per year. **Needs:** this Mac with Xcode. **Review:** usually 1–3 days.

### B1. Create the developer account
1. Go to **developer.apple.com/programs** → Enroll (Organisation needs the D-U-N-S number) → pay $99.

### B2. Phone notifications on iPhone (one-time)
In the Apple Developer site → Keys → create an **APNs key** → upload it in **Firebase → Project settings → Cloud
Messaging → Apple app configuration**. Without this, iPhones get no pop-up notifications (everything else works).

### B3. Make the iPhone build
```bash
cd "ValuationApp"
npm run build
npx cap sync ios
npx cap open ios
```
In Xcode:
1. Click **App** (left) → **Signing & Capabilities** → choose your **Team** (your Apple developer account).
2. Version **1.0.2**, Build **3** (raise the build number every upload).
3. Top bar: choose **Any iOS Device (arm64)** → menu **Product → Archive**.
4. When done: **Distribute App → App Store Connect → Upload**.

### B4. App Store Connect
1. **appstoreconnect.apple.com** → My Apps → **+ New App** → iOS → name "Gouru Valuations" → bundle id
   `com.appgcr.gouruvaluations` → SKU `gouru-valuations`.
2. Copy the text from `STORE_LISTING.md` (name, subtitle, description, keywords, support and privacy links).
3. Screenshots: iPhone **6.9"/6.7"** size (take on a large iPhone, or the iPhone simulator).
4. **App Privacy:** same data as the Google Data safety list above — "not used for tracking".
5. **App Review Information:** the reviewer login from `store-review-logins.txt`, plus a note:
   "Field app for bank property valuers. Sign in with the demo account; location is used only while on duty."
6. **Encryption question:** "uses only standard encryption (HTTPS)" → exempt.
7. Test first with **TestFlight** (your team installs it from the TestFlight app), then **Add for Review → Submit**.

---

## Common reasons stores reject an app — already handled
| Reason | Gouru |
|---|---|
| Reviewer can't log in | Demo logins in `store-review-logins.txt` (App Review office) |
| No privacy policy | ✅ /privacy page |
| No way to delete account | ✅ /delete-account page |
| Permission without a reason | ✅ Every permission shows a reason |
| App crashes / blank screens | Test on 2–3 phones first (Step 0) |

## After the app is live
- **Updates:** change the code → raise the version numbers → build → upload a new release (same steps A2/A4, B3/B4).
- **Keep safe:** the release key + passwords, the Apple/Google account logins (with 2-step verification), the APNs key.
