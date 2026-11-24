// Turns a planned itinerary into short step-by-step text in English or Khmer.
const KM_DIGITS = '០១២៣៤៥៦៧៨៩';
const kmNum = (n) => String(n).replace(/\d/g, (d) => KM_DIGITS[d]);

export function clock(min) {
  const m = Math.round(min) % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

const round = (x) => Math.max(1, Math.round(x));
const dist = (m, lang) => {
  if (m >= 1000) {
    const km = (m / 1000).toFixed(1);
    return lang === 'km' ? `${kmNum(km)} គីឡូម៉ែត្រ` : `${km} km`;
  }
  const r = Math.round(m / 10) * 10;
  return lang === 'km' ? `${kmNum(r)} ម៉ែត្រ` : `${r} m`;
};
const mins = (x, lang) => (lang === 'km' ? `${kmNum(round(x))} នាទី` : `${round(x)} min`);
const nm = (point, lang, fallback) => point?.name?.[lang] ?? point?.name?.en ?? fallback;

export function describeItinerary(it, lang = 'en') {
  const steps = it.legs.map((leg, i) => {
    const isLast = i === it.legs.length - 1;
    if (leg.type === 'walk') {
      const target = isLast ? nm(leg.to, lang, lang === 'km' ? 'គោលដៅរបស់អ្នក' : 'your destination') : nm(leg.to, lang);
      return lang === 'km'
        ? `🚶 ដើរ ${dist(leg.meters, lang)} (ប្រហែល ${mins(leg.minutes, lang)}) ទៅ${isLast ? '' : 'ចំណត'} ${target}។`
        : `🚶 Walk ${dist(leg.meters, lang)} (about ${mins(leg.minutes, lang)}) to ${isLast ? '' : 'the '}${target}${isLast ? '' : ' stop'}.`;
    }
    const line = lang === 'km' ? `ខ្សែ ${leg.code}` : `Line ${leg.code}`;
    const stopsCount = lang === 'km' ? `${kmNum(leg.numStops)} ចំណត` : `${leg.numStops} stop${leg.numStops === 1 ? '' : 's'}`;
    return lang === 'km'
      ? `🚌 ជិះ${line} ទិសដៅ ${nm({ name: leg.headsign }, lang)} នៅម៉ោង ${clock(leg.departMin)}។ ជិះ ${stopsCount} (${mins(leg.minutes, lang)}) ហើយចុះនៅ ${nm(leg.to, lang)}។`
      : `🚌 Take ${line} towards ${nm({ name: leg.headsign }, lang)} at ${clock(leg.departMin)}. Ride ${stopsCount} (${mins(leg.minutes, lang)}) and get off at ${nm(leg.to, lang)}.`;
  });
  const summary = lang === 'km'
    ? `ធ្វើដំណើរប្រហែល ${mins(it.durationMin, lang)}, មកដល់ម៉ោង ${clock(it.arriveMin)}${it.transfers ? `, ប្តូរឡាន ${kmNum(it.transfers)} ដង` : ''}`
    : `About ${mins(it.durationMin, lang)}, arrive ${clock(it.arriveMin)}${it.transfers ? `, ${it.transfers} transfer${it.transfers > 1 ? 's' : ''}` : ''}`;
  return { summary, steps };
}

/** One message for the assistant panel. */
export function composeAnswer({ lang, origin, destination, plan, note, servingLineCodes }) {
  const parts = [];
  if (note) parts.push(note);
  if (!destination) {
    parts.push(lang === 'km'
      ? 'សូមប្រាប់ខ្ញុំពីកន្លែងដែលអ្នកចង់ទៅ ឧទាហរណ៍៖ «ទៅអាកាសយានដ្ឋានតេជោ»។'
      : 'Tell me where you want to go, for example: "How do I get to Techo Airport?"');
    return parts.join('\n\n');
  }
  const destName = destination.name[lang] ?? destination.name.en;
  if (servingLineCodes.length) {
    parts.push(lang === 'km'
      ? `ខ្សែឡានក្រុងដែលទៅដល់ ${destName}៖ ${servingLineCodes.join(', ')}។`
      : `Bus lines that go to ${destName}: ${servingLineCodes.join(', ')}.`);
  }
  const best = plan.options[0];
  if (plan.walkOnly && (!best || plan.walkOnly.minutes <= best.durationMin)) {
    parts.push(lang === 'km'
      ? `${destName} នៅជិតណាស់ — ដើរប្រហែល ${mins(plan.walkOnly.minutes, lang)} (${dist(plan.walkOnly.meters, lang)})។`
      : `${destName} is close — about a ${mins(plan.walkOnly.minutes, lang)} walk (${dist(plan.walkOnly.meters, lang)}).`);
  }
  if (!best) {
    if (!plan.walkOnly) {
      parts.push(lang === 'km'
        ? `សុំទោស ខ្ញុំរកមិនឃើញខ្សែឡានក្រុងពី ${origin.label[lang]} ទៅ ${destName} ទេ។`
        : `Sorry, I couldn't find a bus route from ${origin.label.en} to ${destName}.`);
    }
    return parts.join('\n\n');
  }
  const { summary, steps } = describeItinerary(best, lang);
  parts.push(`${lang === 'km' ? 'ផ្លូវល្អបំផុត' : 'Best route'} (${summary}):\n${steps.join('\n')}`);
  if (plan.options.length > 1) {
    parts.push(lang === 'km'
      ? `មានជម្រើសផ្សេងទៀត ${kmNum(plan.options.length - 1)} នៅលើផែនទី។`
      : `${plan.options.length - 1} more option${plan.options.length > 2 ? 's are' : ' is'} shown on the map.`);
  }
  return parts.join('\n\n');
}
