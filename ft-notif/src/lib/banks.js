// Banks & e-wallets available in Malaysia. `logo` maps to /static/banks/<logo>.png;
// banks without a logo file fall back to a coloured monogram (see BankLogo.svelte).
// `aliases` keep older saved names (e.g. "GX", "Affin") matched to the right bank.

export const BANK_GROUPS = ['Commercial Banks', 'Islamic Banks', 'Digital Banks', 'Government & Development', 'E-Wallets', 'Other'];

export const MY_BANKS = [
  // Commercial
  { name: 'Maybank',            group: 'Commercial Banks', logo: 'maybank',    color: '#FFC72C', short: 'MB' },
  { name: 'CIMB',               group: 'Commercial Banks', logo: 'cimb',       color: '#EC1C24', aliases: ['CIMB Bank'] },
  { name: 'Public Bank',        group: 'Commercial Banks', logo: 'publicbank', color: '#E2231A', short: 'PB' },
  { name: 'RHB',                group: 'Commercial Banks', logo: 'rhb',        color: '#0067B1', aliases: ['RHB Bank'] },
  { name: 'Hong Leong Bank',    group: 'Commercial Banks', logo: 'hlb',        color: '#E31837', short: 'HLB' },
  { name: 'AmBank',             group: 'Commercial Banks', logo: 'ambank',     color: '#ED1C24' },
  { name: 'Alliance Bank',      group: 'Commercial Banks', logo: 'alliance',   color: '#002F6C' },
  { name: 'Affin Bank',         group: 'Commercial Banks', logo: 'affin',      color: '#0055A5', aliases: ['Affin'] },
  { name: 'OCBC',               group: 'Commercial Banks', logo: 'ocbc',       color: '#E30613', aliases: ['OCBC Bank'] },
  { name: 'UOB',                group: 'Commercial Banks', logo: 'uob',        color: '#005EB8', aliases: ['UOB Bank'] },
  { name: 'HSBC',               group: 'Commercial Banks', logo: 'hsbc',       color: '#DB0011', aliases: ['HSBC Bank'] },
  { name: 'Standard Chartered', group: 'Commercial Banks', logo: 'sc',         color: '#0072AA', short: 'SC' },
  { name: 'Citibank',           group: 'Commercial Banks', logo: 'citi',       color: '#003B70' },
  { name: 'Bank of China',      group: 'Commercial Banks', logo: 'boc',        color: '#B81C22', short: 'BOC' },
  { name: 'ICBC',               group: 'Commercial Banks', logo: 'icbc',       color: '#C7000B' },
  { name: 'China Construction Bank', group: 'Commercial Banks',                color: '#0066B3', short: 'CCB' },
  { name: 'Bangkok Bank',       group: 'Commercial Banks',                     color: '#1E3E8A', short: 'BBL' },
  { name: 'MUFG Bank',          group: 'Commercial Banks',                     color: '#E60012', short: 'MUFG' },

  // Islamic
  { name: 'Maybank Islamic',    group: 'Islamic Banks', logo: 'maybank',    color: '#FFC72C' },
  { name: 'CIMB Islamic',       group: 'Islamic Banks', logo: 'cimb',       color: '#EC1C24' },
  { name: 'Public Islamic Bank',group: 'Islamic Banks', logo: 'publicbank', color: '#E2231A' },
  { name: 'RHB Islamic',        group: 'Islamic Banks', logo: 'rhb',        color: '#0067B1' },
  { name: 'Hong Leong Islamic', group: 'Islamic Banks', logo: 'hlb',        color: '#E31837' },
  { name: 'AmBank Islamic',     group: 'Islamic Banks', logo: 'ambank',     color: '#ED1C24' },
  { name: 'Alliance Islamic',   group: 'Islamic Banks', logo: 'alliance',   color: '#002F6C' },
  { name: 'Affin Islamic',      group: 'Islamic Banks', logo: 'affin',      color: '#0055A5' },
  { name: 'Bank Islam',         group: 'Islamic Banks', logo: 'bankislam',  color: '#C8102E' },
  { name: 'Bank Muamalat',      group: 'Islamic Banks', logo: 'muamalat',   color: '#F26522' },
  { name: 'Bank Rakyat',        group: 'Islamic Banks', logo: 'bankrakyat', color: '#0067B1' },
  { name: 'MBSB Bank',          group: 'Islamic Banks', logo: 'mbsb',       color: '#0072BC', aliases: ['MBSB'] },
  { name: 'Al Rajhi Bank',      group: 'Islamic Banks', logo: 'alrajhi',    color: '#2B2BFF' },
  { name: 'Kuwait Finance House', group: 'Islamic Banks', logo: 'kfh',      color: '#00843D', short: 'KFH' },
  { name: 'OCBC Al-Amin',       group: 'Islamic Banks', logo: 'ocbc',       color: '#E30613' },
  { name: 'HSBC Amanah',        group: 'Islamic Banks', logo: 'hsbc',       color: '#DB0011' },
  { name: 'Standard Chartered Saadiq', group: 'Islamic Banks', logo: 'sc',  color: '#0072AA' },

  // Digital
  { name: 'MAE',                group: 'Digital Banks', logo: 'maybank',    color: '#FFC72C', aliases: ['MAE by Maybank'] },
  { name: 'GXBank',             group: 'Digital Banks', logo: 'gx',         color: '#7B2FF7', aliases: ['GX', 'GX Bank'] },
  { name: 'AEON Bank',          group: 'Digital Banks', logo: 'aeon',       color: '#E4007F' },
  { name: 'Boost Bank',         group: 'Digital Banks', logo: 'boost',      color: '#EE2E24' },
  { name: 'Ryt Bank',           group: 'Digital Banks', logo: 'ryt',        color: '#0000E6' },
  { name: 'KAF Digital Bank',   group: 'Digital Banks',                     color: '#0B3B60', short: 'KAF' },

  // Government / development
  { name: 'BSN',                group: 'Government & Development',          color: '#0054A6', aliases: ['Bank Simpanan Nasional'] },
  { name: 'Agrobank',           group: 'Government & Development',          color: '#00873E', short: 'AGRO' },

  // E-wallets
  { name: "Touch 'n Go eWallet", group: 'E-Wallets', logo: 'tng',   color: '#005ABB', aliases: ['TNG', 'Touch n Go'] },
  { name: 'Boost',              group: 'E-Wallets', logo: 'boost', color: '#EE2E24' },
  { name: 'ShopeePay',          group: 'E-Wallets',                color: '#EE4D2D', short: 'SP' },
  { name: 'GrabPay',            group: 'E-Wallets',                color: '#00B14F', short: 'GP' },

  { name: 'Other',              group: 'Other',                    color: '#64748B', short: '?' },
];

const byKey = new Map();
for (const b of MY_BANKS) {
  for (const n of [b.name, ...(b.aliases || [])]) byKey.set(n.toLowerCase(), b);
}

/** Look up bank metadata by saved account name; unknown names get a neutral monogram. */
export function bankMeta(name = '') {
  return byKey.get(String(name).trim().toLowerCase())
    || { name, group: 'Other', color: '#64748B' };
}

export function bankInitials(b) {
  if (b.short) return b.short;
  const words = String(b.name || '?').replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  return words.length > 1 ? (words[0][0] + words[1][0]).toUpperCase() : (words[0] || '?').slice(0, 3).toUpperCase();
}
