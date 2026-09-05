import countries from 'i18n-iso-countries';
import fr from 'i18n-iso-countries/langs/fr.json' with { type: 'json' };

countries.registerLocale(fr);

// Free's destination names that i18n-iso-countries cannot resolve, or that are
// sub-national and roll up to a sovereign ISO code. `null` means "no territory
// to draw" (maritime networks).
export const OVERRIDES = {
  'Açores (Les)': 'PT',
  'Madère': 'PT',
  'Alaska': 'US',
  'Hawaï': 'US',
  'Etats-Unis': 'US',
  'Angleterre': 'GB',
  'Ecosse': 'GB',
  'Pays de Galles': 'GB',
  'Irlande du Nord': 'GB',
  'Wight (Ile de)': 'GB',
  'Baléares (Les)': 'ES',
  'Canaries (Les)': 'ES',
  'Bonaire': 'BQ',
  'Saba': 'BQ',
  'Saint-Eustache': 'BQ',
  'Brunei': 'BN',
  'Caïman (Îles)': 'KY',
  'Centrafrique': 'CF',
  'Chatham (Ile)': 'NZ',
  'Chypre du Nord': 'CY',
  'Congo': 'CG',
  'Corfou (Ile)': 'GR',
  'Crète (Ile)': 'GR',
  'Cyclades (Les)': 'GR',
  'Rhodes (Ile)': 'GR',
  'Falkland (Îles Malouines)': 'FK',
  'Féroé (Îles)': 'FO',
  'Guyane': 'GY',
  'Macédoine': 'MK',
  'Réseaux Maritimes (autres)': null,
  'Réseaux Maritimes (zone spéciale)': null,
  'Saint-Kitts-et-Nevis': 'KN',
  'Saint-Martin (Antilles françaises)': 'MF',
  'Saint-Martin (Antilles néerlandaises)': 'SX',
  'Salomon (Îles)': 'SB',
  'Samoa (US)': 'AS',
  'Sardaigne': 'IT',
  'Sicile': 'IT',
  'Swaziland': 'SZ',
  'Tanzanie': 'TZ',
  'Zanzibar': 'TZ',
  'Tasmanie': 'AU',
  'Tibet': 'CN',
  'Timor Oriental': 'TL',
  'Turks et Caïques (Îles)': 'TC',
  'Vatican': 'VA',
};

const strip = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

const byNormalisedName = (() => {
  const m = new Map();
  for (const [code, name] of Object.entries(countries.getNames('fr'))) {
    for (const n of Array.isArray(name) ? name : [name]) m.set(strip(n), code);
  }
  return m;
})();

/** French destination name as Free spells it -> ISO 3166-1 alpha-2, or null for no territory. */
export function toIso(name) {
  if (Object.hasOwn(OVERRIDES, name)) return OVERRIDES[name];
  return (
    countries.getAlpha2Code(name, 'fr') ||
    byNormalisedName.get(strip(name)) ||
    byNormalisedName.get(strip(name.replace(/\s*\(.*\)$/, ''))) ||
    undefined
  );
}

const included = (s) => /^inclus/i.test(s || '');

/**
 * Classify one plan's tariff block from /api/infos-voyage/country-info.
 * 'full' = internet plus local calls, calls to France, received calls, SMS and MMS all
 * included (what Free's legend calls "appels, SMS, MMS illimités"); 'data' = internet
 * only; 'none' = nothing included.
 */
export function classify(plan) {
  if (!plan) return 'none';
  const inet = included(plan.internet?.offer);
  const voice = ['toChooseCountry', 'toFrance', 'received'].every((k) => included(plan.calls?.[k]));
  const messaging = included(plan.sms?.sent?.price) && included(plan.mms?.sent?.price) && included(plan.mms?.received?.price);
  return inet && voice && messaging ? 'full' : inet ? 'data' : 'none';
}

const RANK = { full: 2, data: 1, none: 0 };

/**
 * Build the site dataset: per plan, per ISO code, one status for the map plus the
 * member destinations. When Free lists a sub-region separately (Alaska, Tibet,
 * Chypre du Nord), the map takes the sovereign entry's status when there is one,
 * else the best among members; the tooltip shows every member so a divergence
 * (today only Chypre / Chypre du Nord) stays visible.
 */
export function buildDataset({ fetchedAt, pageProps, countryInfo }) {
  const plans = {
    free5g: { name: pageProps.free5g.name, price: pageProps.free5g.price, roamingFairUseMb: pageProps.free5g.roamingData.fairuse, nationalFairUseMb: pageProps.free5g.nationalData.fairuse, nationalFairUseFreeboxMb: pageProps.free5g.nationalData.fairuseFreebox, apiKey: 'free5g' },
    freeMax: { name: pageProps.freeMax.name, price: pageProps.freeMax.price, roamingFairUseMb: pageProps.freeMax.roamingData.fairuse, nationalFairUseMb: pageProps.freeMax.nationalData.fairuse, nationalFairUseFreeboxMb: pageProps.freeMax.nationalData.fairuseFreebox, apiKey: 'gold' },
  };
  const destinations = {};
  const unmapped = [];
  for (const name of pageProps.destinationsList) {
    const iso = toIso(name);
    if (iso === undefined) unmapped.push(name);
    const info = countryInfo[name];
    const status = {};
    for (const [planId, plan] of Object.entries(plans)) status[planId] = classify(info?.[plan.apiKey]);
    destinations[name] = {
      iso: iso ?? null,
      status,
      operators: (info?.partnerOperators || []).map((o) => ({ name: o.name, lte: !!o.isLte, nr: !!o.is5gNsa, volte: !!o.isVolte })),
      tariffs: info
        ? Object.fromEntries(Object.entries(plans).map(([planId, plan]) => [planId, {
            internet: info[plan.apiKey]?.internet?.offer ?? null,
            internetOverFairUse: info[plan.apiKey]?.internet?.penalty || null,
            callsLocal: info[plan.apiKey]?.calls?.toChooseCountry ?? null,
            callsToFrance: info[plan.apiKey]?.calls?.toFrance ?? null,
            sms: info[plan.apiKey]?.sms?.sent?.price ?? null,
          }]))
        : null,
    };
  }
  const byIso = {};
  for (const [name, d] of Object.entries(destinations)) {
    if (!d.iso) continue;
    const entry = (byIso[d.iso] ||= { members: [], status: Object.fromEntries(Object.keys(plans).map((p) => [p, 'none'])) });
    entry.members.push(name);
    const sovereign = !Object.hasOwn(OVERRIDES, name);
    if (sovereign) entry.sovereign = name;
    for (const [planId, s] of Object.entries(d.status)) {
      if (sovereign) entry.status[planId] = s;
      else if (!entry.sovereign && RANK[s] > RANK[entry.status[planId] ?? 'none']) entry.status[planId] = s;
    }
  }
  const dataset = { fetchedAt, source: 'https://mobile.free.fr/communications-a-l-etranger', plans, destinations, byIso, unmapped };
  return dataset;
}

/** Refuse a dataset that would publish a blank or hollow map (Free renamed a key, empty list). */
export function validate(dataset) {
  const errors = [];
  const names = Object.keys(dataset.destinations);
  if (names.length < 100) errors.push(`only ${names.length} destinations; expected well over 100`);
  for (const planId of Object.keys(dataset.plans)) {
    const included = names.filter((n) => dataset.destinations[n].status[planId] !== 'none').length;
    const full = names.filter((n) => dataset.destinations[n].status[planId] === 'full').length;
    if (included < 50) errors.push(`${planId}: only ${included} included destinations; Free's API shape probably changed`);
    // Europe alone is ~40 fully included destinations; fewer means a voice/SMS/MMS field moved.
    if (full < 40) errors.push(`${planId}: only ${full} fully included destinations; a calls/SMS/MMS field probably moved`);
  }
  if (dataset.unmapped.length) errors.push(`unmapped destination names (add to OVERRIDES): ${dataset.unmapped.join(', ')}`);
  return errors;
}
