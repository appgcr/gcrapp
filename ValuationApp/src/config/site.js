// Public website & legal pages — one place for the company's contact details.
// email: the privacy / support mailbox shown on the website and in the store listings
export const SITE = {
  brand: 'Gouru Valuations',
  valuer: 'Er. Gouru Neelakanta Reddy',
  valuerTitle: 'B.Tech., MISTE — Civil Engineering Consultant & Approved Panel Valuer',
  iiv: 'Indian Institution of Valuers, Fellow F – 13622',
  address: 'Door No. 21/659, Beside Airtel Show Room, 7 Roads, Kadapa, Y.S.R. District, Andhra Pradesh',
  phones: ['94401 64412', '90525 89896', '94400 48100'],
  email: 'hello.happydooo@gmail.com',
  grievanceOfficer: 'Er. Gouru Neelakanta Reddy',
  policyDate: '11 November 2026',
  apps: 'Gouru Valuations app for Android and iOS, and the web portal',
};

// Banks whose own report formats are built into the app.
// logo: true when public/bank-logos/<key>.png exists; wordmark: the logo already shows the bank's name (official logos only — see public/bank-logos/README.md).
// Banks without a logo show the plain bank icon.
export const BANKS = [
  { key: 'apgb', name: 'Andhra Pradesh Grameena Bank', logo: true, wordmark: true }, { key: 'bob', name: 'Bank of Baroda', logo: true, wordmark: true },
  { key: 'boi', name: 'Bank of India', logo: true, wordmark: true }, { key: 'bom', name: 'Bank of Maharashtra', logo: true, wordmark: true }, { key: 'canara', name: 'Canara Bank', logo: true, wordmark: true },
  { key: 'cbi', name: 'Central Bank of India', logo: true, wordmark: true }, { key: 'indian', name: 'Indian Bank', logo: true, wordmark: true }, { key: 'iob', name: 'Indian Overseas Bank', logo: true, wordmark: true },
  { key: 'karnataka', name: 'Karnataka Bank', logo: true, wordmark: true }, { key: 'pnb', name: 'Punjab National Bank', logo: true, wordmark: true }, { key: 'sbi', name: 'State Bank of India', logo: true },
  { key: 'uco', name: 'UCO Bank', logo: true, wordmark: true }, { key: 'union', name: 'Union Bank of India', logo: true, wordmark: true },
];
export const BANKS_SERVED = BANKS.map((b) => b.name);
