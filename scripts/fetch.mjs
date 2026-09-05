// Regenerates site/data.json from Free Mobile's public pages.
// One page load for the destination list and plan data, then one API call per
// destination, sequential and spaced out: Free 503s and then blackholes bursty clients.
import fs from 'node:fs/promises';
import { buildDataset, validate } from './lib.mjs';

const OUT = new URL('../site/data.json', import.meta.url);
const PAGE = 'https://mobile.free.fr/communications-a-l-etranger';
const API = 'https://mobile.free.fr/api/infos-voyage/country-info/';
const HEADERS = { 'user-agent': 'free-roaming-map (+https://github.com/SeanLF/free-roaming-map)', accept: 'application/json,text/html' };
const SPACING_MS = 400;
const MIN_SUCCESS_RATIO = 0.95;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, { retries = 3 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(30_000) });
      if (res.ok) return res;
      if (attempt >= retries || (res.status < 500 && res.status !== 429)) throw new Error(`${res.status} ${url}`);
    } catch (err) {
      if (attempt >= retries) throw err;
    }
    await sleep(2_000 * 2 ** attempt);
  }
}

const html = await (await get(PAGE)).text();
const nextData = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
if (!nextData) throw new Error('No __NEXT_DATA__ on the page; Free changed the page structure');
const pageProps = JSON.parse(nextData[1]).props.pageProps;
if (!Array.isArray(pageProps.destinationsList) || pageProps.destinationsList.length === 0 || !pageProps.free5g || !pageProps.freeMax) {
  throw new Error('pageProps missing destinationsList/free5g/freeMax');
}

const countryInfo = {};
const failures = [];
for (const name of pageProps.destinationsList) {
  try {
    countryInfo[name] = await (await get(API + encodeURIComponent(name))).json();
  } catch (err) {
    failures.push(`${name}: ${err.message}`);
  }
  await sleep(SPACING_MS);
}

const ratio = 1 - failures.length / pageProps.destinationsList.length;
console.error(`fetched ${Object.keys(countryInfo).length}/${pageProps.destinationsList.length} destinations`);
if (failures.length) console.error(failures.join('\n'));
if (ratio < MIN_SUCCESS_RATIO) {
  console.error(`success ratio ${ratio.toFixed(2)} below ${MIN_SUCCESS_RATIO}; keeping previous site/data.json`);
  process.exit(1);
}

const dataset = buildDataset({ fetchedAt: new Date().toISOString(), pageProps, countryInfo });
const errors = validate(dataset);
if (errors.length) {
  console.error(errors.join('\n'));
  console.error('keeping previous site/data.json');
  process.exit(1);
}
await fs.writeFile(OUT, JSON.stringify(dataset, null, 1) + '\n');
console.error(`wrote ${OUT.pathname}`);
