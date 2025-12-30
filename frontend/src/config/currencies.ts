/**
 * Currency configuration for the Velo application.
 * Defines supported currencies with their symbols and names.
 */

export interface Currency {
  code: string;
  symbol: string;
  name: string;
  flag?: string;
}

// All supported currencies from API
const ALL_CURRENCIES: Currency[] = [
  { code: 'AED', symbol: 'dh', name: 'UAE Dirham', flag: 'ae' },
  { code: 'AFN', symbol: '؋', name: 'Afghan Afghani', flag: 'af' },
  { code: 'ALL', symbol: 'L', name: 'Albanian Lek', flag: 'al' },
  { code: 'AMD', symbol: '֏', name: 'Armenian Dram', flag: 'am' },
  { code: 'ANG', symbol: 'ƒ', name: 'Netherlands Antillean Guilder', flag: 'cw' },
  { code: 'AOA', symbol: 'Kz', name: 'Angolan Kwanza', flag: 'ao' },
  { code: 'ARS', symbol: '$', name: 'Argentine Peso', flag: 'ar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', flag: 'au' },
  { code: 'AWG', symbol: 'ƒ', name: 'Aruban Florin', flag: 'aw' },
  { code: 'AZN', symbol: '₼', name: 'Azerbaijani Manat', flag: 'az' },
  { code: 'BAM', symbol: 'KM', name: 'Bosnia and Herzegovina Convertible Mark', flag: 'ba' },
  { code: 'BBD', symbol: 'Bds$', name: 'Barbadian Dollar', flag: 'bb' },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', flag: 'bd' },
  { code: 'BGN', symbol: 'лв.', name: 'Bulgarian Lev', flag: 'bg' },
  { code: 'BHD', symbol: 'BD', name: 'Bahraini Dinar', flag: 'bh' },
  { code: 'BIF', symbol: 'FBu', name: 'Burundian Franc', flag: 'bi' },
  { code: 'BMD', symbol: '$', name: 'Bermudian Dollar', flag: 'bm' },
  { code: 'BND', symbol: 'B$', name: 'Brunei Dollar', flag: 'bn' },
  { code: 'BOB', symbol: 'Bs.', name: 'Bolivian Boliviano', flag: 'bo' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', flag: 'br' },
  { code: 'BSD', symbol: '$', name: 'Bahamian Dollar', flag: 'bs' },
  { code: 'BTN', symbol: 'Nu.', name: 'Bhutanese Ngultrum', flag: 'bt' },
  { code: 'BWP', symbol: 'P', name: 'Botswana Pula', flag: 'bw' },
  { code: 'BYN', symbol: 'Br', name: 'Belarusian Ruble', flag: 'by' },
  { code: 'BZD', symbol: 'BZ$', name: 'Belize Dollar', flag: 'bz' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', flag: 'ca' },
  { code: 'CDF', symbol: 'FC', name: 'Congolese Franc', flag: 'cd' },
  { code: 'CHF', symbol: 'Fr.', name: 'Swiss Franc', flag: 'ch' },
  { code: 'CLF', symbol: 'UF', name: 'Chilean Unit of Account (UF)', flag: 'cl' },
  { code: 'CLP', symbol: '$', name: 'Chilean Peso', flag: 'cl' },
  { code: 'CNH', symbol: '¥', name: 'Chinese Yuan (Offshore)', flag: 'cn' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', flag: 'cn' },
  { code: 'COP', symbol: '$', name: 'Colombian Peso', flag: 'co' },
  { code: 'CRC', symbol: '₡', name: 'Costa Rican Colón', flag: 'cr' },
  { code: 'CUP', symbol: '$', name: 'Cuban Peso', flag: 'cu' },
  { code: 'CVE', symbol: '$', name: 'Cape Verdean Escudo', flag: 'cv' },
  { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna', flag: 'cz' },
  { code: 'DJF', symbol: 'Fdj', name: 'Djiboutian Franc', flag: 'dj' },
  { code: 'DKK', symbol: 'kr.', name: 'Danish Krone', flag: 'dk' },
  { code: 'DOP', symbol: 'RD$', name: 'Dominican Peso', flag: 'dm' },
  { code: 'DZD', symbol: 'DA', name: 'Algerian Dinar', flag: 'dz' },
  { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound', flag: 'eg' },
  { code: 'ERN', symbol: 'Nfk', name: 'Eritrean Nakfa', flag: 'er' },
  { code: 'ETB', symbol: 'Br', name: 'Ethiopian Birr', flag: 'et' },
  { code: 'EUR', symbol: '€', name: 'Euro', flag: 'eu' },
  { code: 'FJD', symbol: 'FJ$', name: 'Fijian Dollar', flag: 'fj' },
  { code: 'FKP', symbol: '£', name: 'Falkland Islands Pound', flag: 'fk' },
  { code: 'FOK', symbol: 'kr', name: 'Faroese Króna', flag: 'fo' },
  { code: 'GBP', symbol: '£', name: 'British Pound', flag: 'gb' },
  { code: 'GEL', symbol: '₾', name: 'Georgian Lari', flag: 'ge' },
  { code: 'GGP', symbol: '£', name: 'Guernsey Pound', flag: 'gg' },
  { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi', flag: 'gh' },
  { code: 'GIP', symbol: '£', name: 'Gibraltar Pound', flag: 'gi' },
  { code: 'GMD', symbol: 'D', name: 'Gambian Dalasi', flag: 'gm' },
  { code: 'GNF', symbol: 'FG', name: 'Guinean Franc', flag: 'gn' },
  { code: 'GTQ', symbol: 'Q', name: 'Guatemalan Quetzal', flag: 'gt' },
  { code: 'GYD', symbol: 'G$', name: 'Guyanese Dollar', flag: 'gy' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', flag: 'hk' },
  { code: 'HNL', symbol: 'L', name: 'Honduran Lempira', flag: 'hn' },
  { code: 'HRK', symbol: 'kn', name: 'Croatian Kuna', flag: 'hr' },
  { code: 'HTG', symbol: 'G', name: 'Haitian Gourde', flag: 'ht' },
  { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint', flag: 'hu' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', flag: 'id' },
  { code: 'ILS', symbol: '₪', name: 'Israeli New Shekel', flag: 'il' },
  { code: 'IMP', symbol: '£', name: 'Manx Pound', flag: 'im' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', flag: 'in' },
  { code: 'IQD', symbol: 'ع.د', name: 'Iraqi Dinar', flag: 'iq' },
  { code: 'IRR', symbol: '﷼', name: 'Iranian Rial', flag: 'ir' },
  { code: 'ISK', symbol: 'kr', name: 'Icelandic Króna', flag: 'is' },
  { code: 'JEP', symbol: '£', name: 'Jersey Pound', flag: 'je' },
  { code: 'JMD', symbol: 'J$', name: 'Jamaican Dollar', flag: 'jm' },
  { code: 'JOD', symbol: 'JD', name: 'Jordanian Dinar', flag: 'jo' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', flag: 'jp' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', flag: 'ke' },
  { code: 'KGS', symbol: 'с', name: 'Kyrgyzstani Som', flag: 'kg' },
  { code: 'KHR', symbol: '៛', name: 'Cambodian Riel', flag: 'kh' },
  { code: 'KID', symbol: '$', name: 'Kiribati Dollar', flag: 'ki' },
  { code: 'KMF', symbol: 'CF', name: 'Comorian Franc', flag: 'km' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won', flag: 'kr' },
  { code: 'KWD', symbol: 'KD', name: 'Kuwaiti Dinar', flag: 'kw' },
  { code: 'KYD', symbol: '$', name: 'Cayman Islands Dollar', flag: 'ky' },
  { code: 'KZT', symbol: '₸', name: 'Kazakhstani Tenge', flag: 'kz' },
  { code: 'LAK', symbol: '₭', name: 'Lao Kip', flag: 'la' },
  { code: 'LBP', symbol: 'L£', name: 'Lebanese Pound', flag: 'lb' },
  { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan Rupee', flag: 'lk' },
  { code: 'LRD', symbol: '$', name: 'Liberian Dollar', flag: 'lr' },
  { code: 'LSL', symbol: 'L', name: 'Lesotho Loti', flag: 'ls' },
  { code: 'LYD', symbol: 'LD', name: 'Libyan Dinar', flag: 'ly' },
  { code: 'MAD', symbol: 'DH', name: 'Moroccan Dirham', flag: 'ma' },
  { code: 'MDL', symbol: 'L', name: 'Moldovan Leu', flag: 'md' },
  { code: 'MGA', symbol: 'Ar', name: 'Malagasy Ariary', flag: 'mg' },
  { code: 'MKD', symbol: 'ден', name: 'Macedonian Denar', flag: 'mk' },
  { code: 'MMK', symbol: 'K', name: 'Myanmar Kyat', flag: 'mm' },
  { code: 'MNT', symbol: '₮', name: 'Mongolian Tögrög', flag: 'mn' },
  { code: 'MOP', symbol: 'P', name: 'Macanese Pataca', flag: 'mo' },
  { code: 'MRU', symbol: 'UM', name: 'Mauritanian Ouguiya', flag: 'mr' },
  { code: 'MUR', symbol: 'Rs', name: 'Mauritian Rupee', flag: 'mu' },
  { code: 'MVR', symbol: 'Rf', name: 'Maldivian Rufiyaa', flag: 'mv' },
  { code: 'MWK', symbol: 'MK', name: 'Malawian Kwacha', flag: 'mw' },
  { code: 'MXN', symbol: '$', name: 'Mexican Peso', flag: 'mx' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', flag: 'my' },
  { code: 'MZN', symbol: 'MT', name: 'Mozambican Metical', flag: 'mz' },
  { code: 'NAD', symbol: '$', name: 'Namibian Dollar', flag: 'na' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', flag: 'ng' },
  { code: 'NIO', symbol: 'C$', name: 'Nicaraguan Córdoba', flag: 'ni' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', flag: 'no' },
  { code: 'NPR', symbol: 'Rs', name: 'Nepalese Rupee', flag: 'np' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', flag: 'nz' },
  { code: 'OMR', symbol: 'OMR', name: 'Omani Rial', flag: 'om' },
  { code: 'PAB', symbol: 'B/.', name: 'Panamanian Balboa', flag: 'pa' },
  { code: 'PEN', symbol: 'S/.', name: 'Peruvian Sol', flag: 'pe' },
  { code: 'PGK', symbol: 'K', name: 'Papua New Guinean Kina', flag: 'gn' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso', flag: 'ph' },
  { code: 'PKR', symbol: 'Rs', name: 'Pakistani Rupee', flag: 'pk' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Złoty', flag: 'pl' },
  { code: 'PYG', symbol: '₲', name: 'Paraguayan Guaraní', flag: 'py' },
  { code: 'QAR', symbol: 'QR', name: 'Qatari Riyal', flag: 'qa' },
  { code: 'RON', symbol: 'lei', name: 'Romanian Leu', flag: 'ro' },
  { code: 'RSD', symbol: 'дин.', name: 'Serbian Dinar', flag: 'rs' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble', flag: 'ru' },
  { code: 'RWF', symbol: 'FRw', name: 'Rwandan Franc', flag: 'rw' },
  { code: 'SAR', symbol: 'SR', name: 'Saudi Riyal', flag: 'sa' },
  { code: 'SBD', symbol: '$', name: 'Solomon Islands Dollar', flag: 'sb' },
  { code: 'SCR', symbol: 'Rs', name: 'Seychellois Rupee', flag: 'sc' },
  { code: 'SDG', symbol: '£', name: 'Sudanese Pound', flag: 'sd' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', flag: 'se' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', flag: 'sg' },
  { code: 'SHP', symbol: '£', name: 'Saint Helena Pound', flag: 'sh' },
  { code: 'SLE', symbol: 'Le', name: 'Sierra Leonean Leone', flag: 'sl' },
  { code: 'SLL', symbol: 'Le', name: 'Sierra Leonean Leone (Old)', flag: 'sl' },
  { code: 'SOS', symbol: 'S', name: 'Somali Shilling', flag: 'ml' },
  { code: 'SRD', symbol: '$', name: 'Surinamese Dollar', flag: 'sr' },
  { code: 'SSP', symbol: '£', name: 'South Sudanese Pound', flag: 'sd' },
  { code: 'STN', symbol: 'Db', name: 'São Tomé and Príncipe Dobra', flag: 'st' },
  { code: 'SYP', symbol: '£', name: 'Syrian Pound', flag: 'sy' },
  { code: 'SZL', symbol: 'L', name: 'Eswatini Lilangeni', flag: 'sz' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht', flag: 'th' },
  { code: 'TJS', symbol: 'SM', name: 'Tajikistani Somoni', flag: 'tj' },
  { code: 'TMT', symbol: 'T', name: 'Turkmenistani Manat', flag: 'tm' },
  { code: 'TND', symbol: 'DT', name: 'Tunisian Dinar', flag: 'tn' },
  { code: 'TOP', symbol: 'T$', name: 'Tongan Paʻanga', flag: 'to' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira', flag: 'tr' },
  { code: 'TTD', symbol: 'TT$', name: 'Trinidad and Tobago Dollar', flag: 'tt' },
  { code: 'TVD', symbol: '$', name: 'Tuvaluan Dollar', flag: 'tv' },
  { code: 'TWD', symbol: 'NT$', name: 'New Taiwan Dollar', flag: 'tw' },
  { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling', flag: 'tz' },
  { code: 'UAH', symbol: '₴', name: 'Ukrainian Hryvnia', flag: 'ua' },
  { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling', flag: 'ug' },
  { code: 'USD', symbol: '$', name: 'US Dollar', flag: 'us' },
  { code: 'UYU', symbol: '$U', name: 'Uruguayan Peso', flag: 'uy' },
  { code: 'UZS', symbol: 'soʻm', name: 'Uzbekistani Som', flag: 'uz' },
  { code: 'VES', symbol: 'Bs', name: 'Venezuelan Bolívar', flag: 've' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Đồng', flag: 'vn' },
  { code: 'VUV', symbol: 'VT', name: 'Vanuatu Vatu', flag: 'vu' },
  { code: 'WST', symbol: 'T', name: 'Samoan Tālā', flag: 'ws' },
  { code: 'XAF', symbol: 'FCFA', name: 'Central African CFA Franc' },
  { code: 'XCD', symbol: '$', name: 'East Caribbean Dollar', flag: 'ag' },
  { code: 'XCG', symbol: 'CFA', name: 'CFA Franc' },
  { code: 'XDR', symbol: 'SDR', name: 'Special Drawing Rights', flag: 'un' },
  { code: 'XOF', symbol: 'CFA', name: 'West African CFA Franc', flag: 'sn' },
  { code: 'XPF', symbol: '₣', name: 'CFP Franc', flag: 'pf' },
  { code: 'YER', symbol: '﷼', name: 'Yemeni Rial', flag: 'ye' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', flag: 'za' },
  { code: 'ZMW', symbol: 'ZK', name: 'Zambian Kwacha', flag: 'zm' },
  { code: 'ZWG', symbol: 'ZiG', name: 'Zimbabwe Gold', flag: 'zw' },
  { code: 'ZWL', symbol: '$', name: 'Zimbabwean Dollar', flag: 'zw' },
];

// Default currency
export const DEFAULT_CURRENCY = 'USD';

// Popular currencies for initial default selection if store is empty
export const POPULAR_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CNY', 'HKD', 'NZD', 'SGD', 'MYR', 'KRW', 'THB', 'VND'];

export const SUPPORTED_CURRENCIES = [
  ...POPULAR_CURRENCIES.map(c => ALL_CURRENCIES.find(currency => currency.code === c)).filter(c => c !== undefined),
  ...ALL_CURRENCIES.filter(c => !POPULAR_CURRENCIES.includes(c.code))
];


// Create lookup maps for easy access
export const CURRENCY_MAP = new Map(
  SUPPORTED_CURRENCIES.map(currency => [currency.code, currency])
);

export const CURRENCY_CODES = SUPPORTED_CURRENCIES.map(currency => currency.code);

/**
 * Check if a currency code is supported
 */
export function isSupportedCurrency(currencyCode: string): boolean {
  return CURRENCY_MAP.has(currencyCode.toUpperCase());
}

/**
 * Get currency information by code
 */
export function getCurrencyInfo(currencyCode: string): Currency {
  const currency = CURRENCY_MAP.get(currencyCode.toUpperCase());
  if (!currency) {
    // Graceful fallback for unknown currencies
    return {
      code: currencyCode.toUpperCase(),
      symbol: '$',
      name: currencyCode.toUpperCase()
    };
  }
  return currency;
}

/**
 * Get currency symbol by code
 */
export function getCurrencySymbol(currencyCode: string): string {
  return getCurrencyInfo(currencyCode).symbol;
}

/**
 * Get currency name by code
 */
export function getCurrencyName(currencyCode: string): string {
  return getCurrencyInfo(currencyCode).name;
}
