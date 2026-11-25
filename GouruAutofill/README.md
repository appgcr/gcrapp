# Gouru Autofill (Chrome extension)

Fills a valuation portal form (Valocity for now) from a Gouru Valuations case.
It only fills. You check the form and press Save yourself.

## Install (one time)
1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose this `GouruAutofill` folder.
4. Pin it: click the puzzle icon in the toolbar, then the pin next to **Gouru Autofill**.

## Use
1. Log in to Valocity yourself and open the job's valuation form.
2. Click the **Gouru Autofill** icon, log in with your Gouru username and password (first time only).
3. Pick the case and press **Fill this page**.
4. Green = filled from Gouru. Orange = usual answer, please check. The panel on the page lists what was not filled.
5. Check everything, then press Save in Valocity.

## Adding another portal
Copy `portals/valocity.js`, change `match` and the labels, and add it to `PORTALS` in `popup.js`.
