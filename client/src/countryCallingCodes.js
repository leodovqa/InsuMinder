/**
 * Mapping of international telephone country calling codes and regional NANP / territory prefixes
 * Reference: https://en.wikipedia.org/wiki/List_of_telephone_country_codes
 */
export const COUNTRY_CALLING_CODES = {
  // Zone 1: North American Numbering Plan (NANP) special area codes and territories
  '1340': 'VI', // United States Virgin Islands
  '1670': 'MP', // Northern Mariana Islands
  '1671': 'GU', // Guam
  '1684': 'AS', // American Samoa
  '1787': 'PR', // Puerto Rico
  '1939': 'PR', // Puerto Rico
  '1242': 'BS', // Bahamas
  '1246': 'BB', // Barbados
  '1264': 'AI', // Anguilla
  '1268': 'AG', // Antigua and Barbuda
  '1284': 'VG', // British Virgin Islands
  '1345': 'KY', // Cayman Islands
  '1441': 'BM', // Bermuda
  '1473': 'GD', // Grenada
  '1649': 'TC', // Turks and Caicos Islands
  '1664': 'MS', // Montserrat
  '1721': 'SX', // Sint Maarten
  '1758': 'LC', // Saint Lucia
  '1767': 'DM', // Dominica
  '1784': 'VC', // Saint Vincent and the Grenadines
  '1809': 'DO', // Dominican Republic
  '1829': 'DO', // Dominican Republic
  '1849': 'DO', // Dominican Republic
  '1868': 'TT', // Trinidad and Tobago
  '1869': 'KN', // Saint Kitts and Nevis
  '1876': 'JM', // Jamaica
  '1658': 'JM', // Jamaica

  // Canada area codes
  '1204': 'CA',
  '1226': 'CA',
  '1236': 'CA',
  '1249': 'CA',
  '1250': 'CA',
  '1289': 'CA',
  '1306': 'CA',
  '1343': 'CA',
  '1365': 'CA',
  '1367': 'CA',
  '1382': 'CA',
  '1403': 'CA',
  '1416': 'CA',
  '1418': 'CA',
  '1428': 'CA',
  '1437': 'CA',
  '1438': 'CA',
  '1450': 'CA',
  '1468': 'CA',
  '1474': 'CA',
  '1506': 'CA',
  '1514': 'CA',
  '1519': 'CA',
  '1548': 'CA',
  '1579': 'CA',
  '1581': 'CA',
  '1587': 'CA',
  '1604': 'CA',
  '1613': 'CA',
  '1639': 'CA',
  '1647': 'CA',
  '1672': 'CA',
  '1683': 'CA',
  '1705': 'CA',
  '1709': 'CA',
  '1742': 'CA',
  '1753': 'CA',
  '1778': 'CA',
  '1780': 'CA',
  '1782': 'CA',
  '1807': 'CA',
  '1819': 'CA',
  '1825': 'CA',
  '1867': 'CA',
  '1873': 'CA',
  '1902': 'CA',
  '1905': 'CA',

  // Zone 1 Default (United States)
  '1': 'US',

  // Zone 2: Africa & Atlantic/Indian Ocean Islands
  '20': 'EG',
  '211': 'SS',
  '212': 'MA',
  '213': 'DZ',
  '216': 'TN',
  '218': 'LY',
  '220': 'GM',
  '221': 'SN',
  '222': 'MR',
  '223': 'ML',
  '224': 'GN',
  '225': 'CI',
  '226': 'BF',
  '227': 'NE',
  '228': 'TG',
  '229': 'BJ',
  '230': 'MU',
  '231': 'LR',
  '232': 'SL',
  '233': 'GH',
  '234': 'NG',
  '235': 'TD',
  '236': 'CF',
  '237': 'CM',
  '238': 'CV',
  '239': 'ST',
  '240': 'GQ',
  '241': 'GA',
  '242': 'CG',
  '243': 'CD',
  '244': 'AO',
  '245': 'GW',
  '246': 'IO',
  '247': 'AC',
  '248': 'SC',
  '249': 'SD',
  '250': 'RW',
  '251': 'ET',
  '252': 'SO',
  '253': 'DJ',
  '254': 'KE',
  '255': 'TZ',
  '256': 'UG',
  '257': 'BI',
  '258': 'MZ',
  '260': 'ZM',
  '261': 'MG',
  '262': 'RE',
  '263': 'ZW',
  '264': 'NA',
  '265': 'MW',
  '266': 'LS',
  '267': 'BW',
  '268': 'SZ',
  '269': 'KM',
  '27': 'ZA',
  '290': 'SH',
  '291': 'ER',
  '297': 'AW',
  '298': 'FO',
  '299': 'GL',

  // Zones 3 & 4: Europe
  '30': 'GR',
  '31': 'NL',
  '32': 'BE',
  '33': 'FR',
  '34': 'ES',
  '350': 'GI',
  '351': 'PT',
  '352': 'LU',
  '353': 'IE',
  '354': 'IS',
  '355': 'AL',
  '356': 'MT',
  '357': 'CY',
  '35818': 'AX', // Aland Islands
  '358': 'FI',
  '359': 'BG',
  '36': 'HU',
  '370': 'LT',
  '371': 'LV',
  '372': 'EE',
  '373': 'MD',
  '374': 'AM',
  '375': 'BY',
  '376': 'AD',
  '377': 'MC',
  '378': 'SM',
  '379': 'VA',
  '380': 'UA',
  '381': 'RS',
  '382': 'ME',
  '383': 'XK',
  '385': 'HR',
  '386': 'SI',
  '387': 'BA',
  '389': 'MK',
  '3906698': 'VA', // Vatican City special prefix
  '39': 'IT',
  '40': 'RO',
  '41': 'CH',
  '420': 'CZ',
  '421': 'SK',
  '423': 'LI',
  '43': 'AT',
  '441481': 'GG', // Guernsey
  '441534': 'JE', // Jersey
  '441624': 'IM', // Isle of Man
  '44': 'GB',
  '45': 'DK',
  '46': 'SE',
  '4779': 'SJ', // Svalbard
  '47': 'NO',
  '48': 'PL',
  '49': 'DE',

  // Zone 5: Americas (outside NANP)
  '500': 'FK',
  '501': 'BZ',
  '502': 'GT',
  '503': 'SV',
  '504': 'HN',
  '505': 'NI',
  '506': 'CR',
  '507': 'PA',
  '508': 'PM',
  '509': 'HT',
  '51': 'PE',
  '52': 'MX',
  '53': 'CU',
  '54': 'AR',
  '55': 'BR',
  '56': 'CL',
  '57': 'CO',
  '58': 'VE',
  '590': 'GP',
  '591': 'BO',
  '592': 'GY',
  '593': 'EC',
  '594': 'GF',
  '595': 'PY',
  '596': 'MQ',
  '597': 'SR',
  '598': 'UY',
  '5993': 'BQ', // Sint Eustatius
  '5994': 'BQ', // Saba
  '5997': 'BQ', // Bonaire
  '5999': 'CW', // Curacao
  '599': 'CW',

  // Zone 6: Southeast Asia & Oceania
  '60': 'MY',
  '6189164': 'CC', // Cocos Islands
  '6189162': 'CX', // Christmas Island
  '61': 'AU',
  '62': 'ID',
  '63': 'PH',
  '649': 'PN', // Pitcairn Islands
  '64': 'NZ',
  '65': 'SG',
  '66': 'TH',
  '670': 'TL',
  '672': 'NF',
  '673': 'BN',
  '674': 'NR',
  '675': 'PG',
  '676': 'TO',
  '677': 'SB',
  '678': 'VU',
  '679': 'FJ',
  '680': 'PW',
  '681': 'WF',
  '682': 'CK',
  '683': 'NU',
  '685': 'WS',
  '686': 'KI',
  '687': 'NC',
  '688': 'TV',
  '689': 'PF',
  '690': 'TK',
  '691': 'FM',
  '692': 'MH',

  // Zone 7: Russia & Kazakhstan
  '76': 'KZ',
  '77': 'KZ',
  '7': 'RU',

  // Zone 8: East Asia & South Asia
  '81': 'JP',
  '82': 'KR',
  '84': 'VN',
  '850': 'KP',
  '852': 'HK',
  '853': 'MO',
  '855': 'KH',
  '856': 'LA',
  '86': 'CN',
  '880': 'BD',
  '886': 'TW',

  // Zone 9: Middle East & Central/Western Asia
  '90392': 'CY', // Northern Cyprus
  '90': 'TR',
  '91': 'IN',
  '92': 'PK',
  '93': 'AF',
  '94': 'LK',
  '95': 'MM',
  '960': 'MV',
  '961': 'LB',
  '962': 'JO',
  '963': 'SY',
  '964': 'IQ',
  '965': 'KW',
  '966': 'SA',
  '967': 'YE',
  '968': 'OM',
  '970': 'PS',
  '971': 'AE',
  '972': 'IL',
  '973': 'BH',
  '974': 'QA',
  '975': 'BT',
  '976': 'MN',
  '977': 'NP',
  '98': 'IR',
  '992': 'TJ',
  '993': 'TM',
  '994': 'AZ',
  '995': 'GE',
  '996': 'KG',
  '998': 'UZ'
};

/**
 * Detects ISO 3166-1 alpha-2 country code based on entered phone number digits.
 * Checks longest prefix match from length 7 down to 1.
 *
 * @param {string} phoneNumber
 * @returns {string|null} ISO country code in uppercase (e.g. 'VI', 'US', 'GB') or null
 */
export function detectCountry(phoneNumber) {
  if (!phoneNumber) return null;
  const digits = String(phoneNumber).replace(/\D/g, '');
  if (!digits) return null;

  const maxLen = Math.min(digits.length, 7);
  for (let len = maxLen; len >= 1; len--) {
    const prefix = digits.slice(0, len);
    if (COUNTRY_CALLING_CODES[prefix]) {
      return COUNTRY_CALLING_CODES[prefix];
    }
  }

  return null;
}

