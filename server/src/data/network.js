// SAMPLE NETWORK DATA for the hackathon prototype.
// Coordinates are approximate and the line layouts are illustrative.
// "AEB" is modelled loosely on the real Airport Express Bus (Monivong Blvd ->
// Hun Sen Blvd -> AEON Mall Mean Chey -> Techo International Airport). Every
// other line is a made-up demo line. Line codes follow the official 1A/1B style
// but do NOT match the real routes with those numbers. Replace this file with official
// Phnom Penh City Bus data (e.g. GTFS) before using it for real.

/** @typedef {{id:string,name:{en:string,km:string},lat:number,lng:number}} Stop */
/**
 * @typedef {{id:string,code:string,name:{en:string,km:string},color:string,
 *   kind:'city'|'airport',headwayMin:number,speedKmh:number,
 *   serviceStart:string,serviceEnd:string,stops:string[]}} Line
 */
/**
 * @typedef {{id:string,name:{en:string,km:string},lat:number,lng:number,
 *   category:string,aliases:string[]}} Place
 */

/** @type {Stop[]} */
export const stops = [
  { id: 'KM9', name: { en: 'Kilometer 9', km: 'គីឡូម៉ែត្រលេខ៩' }, lat: 11.6255, lng: 104.906 },
  { id: 'RUSSEYKEO', name: { en: 'Russey Keo', km: 'ឫស្សីកែវ' }, lat: 11.608, lng: 104.9135 },
  { id: 'JPBRIDGE', name: { en: 'Japanese Friendship Bridge', km: 'ស្ពានជ្រោយចង្វារ' }, lat: 11.5865, lng: 104.9235 },
  { id: 'CHROYCHANGVAR', name: { en: 'Chroy Changvar Roundabout', km: 'រង្វង់មូលជ្រោយចង្វារ' }, lat: 11.596, lng: 104.933 },
  { id: 'WATPHNOM', name: { en: 'Wat Phnom', km: 'វត្តភ្នំ' }, lat: 11.5763, lng: 104.9231 },
  { id: 'NIGHTMARKET', name: { en: 'Night Market (Riverside)', km: 'ផ្សាររាត្រី' }, lat: 11.5745, lng: 104.929 },
  { id: 'CENTRAL', name: { en: 'Central Market', km: 'ផ្សារធំថ្មី' }, lat: 11.5697, lng: 104.9211 },
  { id: 'ROYALPALACE', name: { en: 'Royal Palace', km: 'ព្រះបរមរាជវាំង' }, lat: 11.564, lng: 104.9307 },
  { id: 'ORUSSEY', name: { en: 'Orussey Market', km: 'ផ្សារអូរឫស្សី' }, lat: 11.5655, lng: 104.916 },
  { id: 'MONIVONG', name: { en: 'Monivong – Sihanouk Blvd', km: 'ផ្លូវព្រះមុនីវង្ស - ព្រះសីហនុ' }, lat: 11.556, lng: 104.919 },
  { id: 'INDEPENDENCE', name: { en: 'Independence Monument', km: 'វិមានឯករាជ្យ' }, lat: 11.5563, lng: 104.9282 },
  { id: 'BKK', name: { en: 'Boeung Keng Kang', km: 'បឹងកេងកង' }, lat: 11.552, lng: 104.9235 },
  { id: 'AEON1', name: { en: 'AEON Mall Phnom Penh', km: 'ផ្សារទំនើបអ៊ីអន ភ្នំពេញ' }, lat: 11.55, lng: 104.934 },
  { id: 'KOHPICH', name: { en: 'Koh Pich (Diamond Island)', km: 'កោះពេជ្រ' }, lat: 11.545, lng: 104.939 },
  { id: 'CHBARAMPOV', name: { en: 'Chbar Ampov Market', km: 'ផ្សារច្បារអំពៅ' }, lat: 11.542, lng: 104.948 },
  { id: 'TAKHMAU', name: { en: 'Ta Khmau', km: 'តាខ្មៅ' }, lat: 11.483, lng: 104.947 },
  { id: 'TUOLSLENG', name: { en: 'Tuol Sleng Museum', km: 'សារមន្ទីរទួលស្លែង' }, lat: 11.5494, lng: 104.9178 },
  { id: 'RUSSIAN', name: { en: 'Russian Market', km: 'ផ្សារទួលទំពូង' }, lat: 11.5388, lng: 104.918 },
  { id: 'STUNGMEANCHEY', name: { en: 'Stung Meanchey', km: 'ស្ទឹងមានជ័យ' }, lat: 11.526, lng: 104.906 },
  { id: 'AEONMEANCHEY', name: { en: 'AEON Mall Mean Chey', km: 'ផ្សារទំនើបអ៊ីអន មានជ័យ' }, lat: 11.5163, lng: 104.932 },
  { id: 'OLYMPIC', name: { en: 'Olympic Stadium', km: 'ពហុកីឡដ្ឋានអូឡាំពិក' }, lat: 11.559, lng: 104.9115 },
  { id: 'ITC', name: { en: 'Institute of Technology of Cambodia', km: 'វិទ្យាស្ថានបច្ចេកវិទ្យាកម្ពុជា' }, lat: 11.5704, lng: 104.8984 },
  { id: 'RUPP', name: { en: 'Royal University of Phnom Penh', km: 'សាកលវិទ្យាល័យភូមិន្ទភ្នំពេញ' }, lat: 11.5688, lng: 104.8908 },
  { id: 'POCHENTONG', name: { en: 'Pochentong', km: 'ពោធិ៍ចិនតុង' }, lat: 11.553, lng: 104.864 },
  { id: 'CHOAMCHAO', name: { en: 'Choam Chao Roundabout', km: 'រង្វង់មូលចោមចៅ' }, lat: 11.539, lng: 104.852 },
  { id: 'AEONSENSOK', name: { en: 'AEON Mall Sen Sok City', km: 'ផ្សារទំនើបអ៊ីអន សែនសុខ' }, lat: 11.602, lng: 104.886 },
  { id: 'TOULKORK', name: { en: 'Toul Kork (TK Avenue)', km: 'ទួលគោក' }, lat: 11.583, lng: 104.9 },
  { id: 'HUNSEN_KS', name: { en: 'Hun Sen Blvd (Kandal Stueng)', km: 'មហាវិថីហ៊ុន សែន (កណ្ដាលស្ទឹង)' }, lat: 11.44, lng: 104.923 },
  { id: 'KTI', name: { en: 'Techo International Airport', km: 'អាកាសយានដ្ឋានអន្តរជាតិតេជោ' }, lat: 11.3629, lng: 104.9166 },
];

/** @type {Line[]} */
export const lines = [
  {
    id: 'L01', code: '1A', color: '#2563eb', kind: 'city',
    name: { en: 'Kilometer 9 – Stung Meanchey', km: 'គីឡូម៉ែត្រលេខ៩ - ស្ទឹងមានជ័យ' },
    headwayMin: 12, speedKmh: 16, serviceStart: '05:30', serviceEnd: '20:30',
    stops: ['KM9', 'RUSSEYKEO', 'JPBRIDGE', 'WATPHNOM', 'CENTRAL', 'ORUSSEY', 'TUOLSLENG', 'RUSSIAN', 'STUNGMEANCHEY'],
  },
  {
    id: 'L02', code: '2A', color: '#dc2626', kind: 'city',
    name: { en: 'Chroy Changvar – Ta Khmau', km: 'ជ្រោយចង្វារ - តាខ្មៅ' },
    headwayMin: 15, speedKmh: 16, serviceStart: '05:30', serviceEnd: '20:30',
    stops: ['CHROYCHANGVAR', 'JPBRIDGE', 'NIGHTMARKET', 'ROYALPALACE', 'INDEPENDENCE', 'AEON1', 'KOHPICH', 'CHBARAMPOV', 'TAKHMAU'],
  },
  {
    id: 'L03', code: '3A', color: '#15803d', kind: 'city',
    name: { en: 'Central Market – Choam Chao', km: 'ផ្សារធំថ្មី - ចោមចៅ' },
    headwayMin: 12, speedKmh: 18, serviceStart: '05:30', serviceEnd: '20:30',
    stops: ['CENTRAL', 'OLYMPIC', 'ITC', 'RUPP', 'POCHENTONG', 'CHOAMCHAO'],
  },
  {
    id: 'L04', code: '4B', color: '#9333ea', kind: 'city',
    name: { en: 'AEON Sen Sok – AEON Mall Phnom Penh', km: 'អ៊ីអន សែនសុខ - អ៊ីអន ភ្នំពេញ' },
    headwayMin: 15, speedKmh: 16, serviceStart: '05:30', serviceEnd: '20:30',
    stops: ['AEONSENSOK', 'TOULKORK', 'OLYMPIC', 'BKK', 'INDEPENDENCE', 'AEON1'],
  },
  {
    id: 'L05', code: '5A', color: '#a16207', kind: 'city',
    name: { en: 'Central Market – AEON Mean Chey', km: 'ផ្សារធំថ្មី - អ៊ីអន មានជ័យ' },
    headwayMin: 15, speedKmh: 17, serviceStart: '05:30', serviceEnd: '20:30',
    stops: ['CENTRAL', 'BKK', 'RUSSIAN', 'AEONMEANCHEY'],
  },
  {
    id: 'AEB', code: 'AEB', color: '#0e7490', kind: 'airport',
    name: { en: 'Airport Express – Wat Phnom ⇄ Techo Airport', km: 'រថយន្តក្រុងអាកាសយានដ្ឋាន វត្តភ្នំ ⇄ តេជោ' },
    headwayMin: 30, speedKmh: 30, serviceStart: '05:30', serviceEnd: '23:30',
    stops: ['WATPHNOM', 'CENTRAL', 'MONIVONG', 'AEONMEANCHEY', 'HUNSEN_KS', 'KTI'],
  },
  {
    id: 'AX2', code: 'AX2', color: '#86198f', kind: 'airport',
    name: { en: 'Airport Shuttle – Sen Sok ⇄ Techo Airport (sample)', km: 'រថយន្តក្រុងអាកាសយានដ្ឋាន សែនសុខ ⇄ តេជោ (គំរូ)' },
    headwayMin: 40, speedKmh: 28, serviceStart: '06:00', serviceEnd: '22:00',
    stops: ['AEONSENSOK', 'TOULKORK', 'OLYMPIC', 'RUSSIAN', 'HUNSEN_KS', 'KTI'],
  },
];

/** Searchable destinations. `aliases` are matched case-insensitively in English and Khmer. */
/** @type {Place[]} */
export const places = [
  { id: 'kti', category: 'airport', lat: 11.3629, lng: 104.9166,
    name: { en: 'Techo International Airport', km: 'អាកាសយានដ្ឋានអន្តរជាតិតេជោ' },
    aliases: ['airport', 'techo airport', 'new airport', 'kti', 'ព្រលានយន្តហោះ', 'អាកាសយានដ្ឋាន', 'តេជោ'] },
  { id: 'central-market', category: 'market', lat: 11.5697, lng: 104.9211,
    name: { en: 'Central Market (Phsar Thmei)', km: 'ផ្សារធំថ្មី' },
    aliases: ['central market', 'phsar thmei', 'psar thmey', 'ផ្សារថ្មី'] },
  { id: 'royal-palace', category: 'attraction', lat: 11.5637, lng: 104.931,
    name: { en: 'Royal Palace', km: 'ព្រះបរមរាជវាំង' }, aliases: ['palace', 'វាំង'] },
  { id: 'national-museum', category: 'attraction', lat: 11.566, lng: 104.9295,
    name: { en: 'National Museum of Cambodia', km: 'សារមន្ទីរជាតិ' }, aliases: ['museum', 'national museum'] },
  { id: 'independence-monument', category: 'attraction', lat: 11.5564, lng: 104.9282,
    name: { en: 'Independence Monument', km: 'វិមានឯករាជ្យ' }, aliases: ['independence', 'monument'] },
  { id: 'wat-phnom', category: 'attraction', lat: 11.5762, lng: 104.923,
    name: { en: 'Wat Phnom', km: 'វត្តភ្នំ' }, aliases: ['wat phnom'] },
  { id: 'night-market', category: 'market', lat: 11.5748, lng: 104.9282,
    name: { en: 'Phnom Penh Night Market', km: 'ផ្សាររាត្រីភ្នំពេញ' }, aliases: ['night market', 'ផ្សាររាត្រី'] },
  { id: 'riverside', category: 'attraction', lat: 11.57, lng: 104.9298,
    name: { en: 'Sisowath Quay (Riverside)', km: 'មាត់ទន្លេស៊ីសុវត្ថិ' }, aliases: ['riverside', 'sisowath', 'river side', 'មាត់ទន្លេ'] },
  { id: 'russian-market', category: 'market', lat: 11.5385, lng: 104.9178,
    name: { en: 'Russian Market (Toul Tom Poung)', km: 'ផ្សារទួលទំពូង' }, aliases: ['russian market', 'toul tom poung', 'tuol tom pong'] },
  { id: 'tuol-sleng', category: 'attraction', lat: 11.5494, lng: 104.9178,
    name: { en: 'Tuol Sleng Genocide Museum', km: 'សារមន្ទីរទួលស្លែង' }, aliases: ['tuol sleng', 's-21', 's21', 'ទួលស្លែង'] },
  { id: 'aeon1', category: 'mall', lat: 11.5502, lng: 104.9333,
    name: { en: 'AEON Mall Phnom Penh', km: 'ផ្សារទំនើបអ៊ីអន ភ្នំពេញ' }, aliases: ['aeon 1', 'aeon mall 1', 'aeon phnom penh', 'អ៊ីអន ១'] },
  { id: 'aeon2', category: 'mall', lat: 11.6018, lng: 104.8856,
    name: { en: 'AEON Mall Sen Sok City', km: 'ផ្សារទំនើបអ៊ីអន សែនសុខ' }, aliases: ['aeon 2', 'aeon sen sok', 'aeon mall sen sok', 'sen sok', 'អ៊ីអន ២', 'សែនសុខ'] },
  { id: 'aeon3', category: 'mall', lat: 11.5163, lng: 104.932,
    name: { en: 'AEON Mall Mean Chey', km: 'ផ្សារទំនើបអ៊ីអន មានជ័យ' }, aliases: ['aeon 3', 'aeon mean chey', 'aeon mall mean chey', 'mean chey', 'អ៊ីអន ៣', 'មានជ័យ'] },
  { id: 'nagaworld', category: 'attraction', lat: 11.5525, lng: 104.9335,
    name: { en: 'NagaWorld', km: 'ណាហ្គាវើលដ៍' }, aliases: ['naga', 'nagaworld', 'naga world'] },
  { id: 'koh-pich', category: 'attraction', lat: 11.545, lng: 104.9395,
    name: { en: 'Koh Pich (Diamond Island)', km: 'កោះពេជ្រ' }, aliases: ['koh pich', 'diamond island'] },
  { id: 'olympic', category: 'attraction', lat: 11.5585, lng: 104.9118,
    name: { en: 'Olympic Stadium', km: 'ពហុកីឡដ្ឋានអូឡាំពិក' }, aliases: ['olympic', 'stadium', 'អូឡាំពិក'] },
  { id: 'rupp', category: 'university', lat: 11.5687, lng: 104.8909,
    name: { en: 'Royal University of Phnom Penh', km: 'សាកលវិទ្យាល័យភូមិន្ទភ្នំពេញ' }, aliases: ['rupp', 'royal university'] },
  { id: 'itc', category: 'university', lat: 11.5703, lng: 104.8986,
    name: { en: 'Institute of Technology of Cambodia', km: 'វិទ្យាស្ថានបច្ចេកវិទ្យាកម្ពុជា' }, aliases: ['itc', 'techno', 'institute of technology', 'តិចណូ'] },
  { id: 'railway-station', category: 'transport', lat: 11.5725, lng: 104.916,
    name: { en: 'Phnom Penh Railway Station', km: 'ស្ថានីយ៍រថភ្លើងភ្នំពេញ' }, aliases: ['railway', 'train station', 'ស្ថានីយ៍រថភ្លើង'] },
  { id: 'calmette', category: 'hospital', lat: 11.581, lng: 104.918,
    name: { en: 'Calmette Hospital', km: 'មន្ទីរពេទ្យកាល់ម៉ែត' }, aliases: ['calmette', 'hospital', 'កាល់ម៉ែត'] },
  { id: 'vattanac', category: 'office', lat: 11.5713, lng: 104.9196,
    name: { en: 'Vattanac Capital', km: 'វឌ្ឍនៈ ខេភីថល' }, aliases: ['vattanac'] },
  { id: 'toul-kork', category: 'area', lat: 11.583, lng: 104.9, name: { en: 'Toul Kork', km: 'ទួលគោក' }, aliases: ['tk avenue', 'tuol kork'] },
  { id: 'chbar-ampov', category: 'market', lat: 11.542, lng: 104.948, name: { en: 'Chbar Ampov Market', km: 'ផ្សារច្បារអំពៅ' }, aliases: ['chbar ampov'] },
  { id: 'ta-khmau', category: 'area', lat: 11.483, lng: 104.947, name: { en: 'Ta Khmau', km: 'តាខ្មៅ' }, aliases: ['takhmao', 'ta khmao'] },
  { id: 'pochentong', category: 'area', lat: 11.553, lng: 104.864, name: { en: 'Pochentong', km: 'ពោធិ៍ចិនតុង' }, aliases: ['pochentong', 'old airport'] },
  { id: 'russey-keo', category: 'area', lat: 11.608, lng: 104.9135, name: { en: 'Russey Keo', km: 'ឫស្សីកែវ' }, aliases: ['russey keo', 'km 9', 'kilometer 9'] },
  { id: 'chroy-changvar', category: 'area', lat: 11.596, lng: 104.933, name: { en: 'Chroy Changvar', km: 'ជ្រោយចង្វារ' }, aliases: ['chroy changvar'] },
  { id: 'stung-meanchey', category: 'area', lat: 11.526, lng: 104.906, name: { en: 'Stung Meanchey', km: 'ស្ទឹងមានជ័យ' }, aliases: ['stung meanchey'] },
  { id: 'chip-mong-271', category: 'mall', lat: 11.53, lng: 104.902, name: { en: 'Chip Mong 271 Mega Mall', km: 'ឈីបម៉ុង ២៧១ មេហ្គាម៉ល' }, aliases: ['chip mong', 'chipmong 271', '271 mega mall'] },
];
