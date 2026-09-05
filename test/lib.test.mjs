import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toIso, classify, buildDataset, validate } from '../scripts/lib.mjs';

const pageProps = JSON.parse(readFileSync(new URL('./fixtures/page-props.json', import.meta.url)));
const countryInfo = JSON.parse(readFileSync(new URL('./fixtures/country-info.json', import.meta.url)));

test('every destination Free lists resolves to an ISO code or an explicit null', () => {
  const unmapped = pageProps.destinationsList.filter((n) => toIso(n) === undefined);
  assert.deepEqual(unmapped, []);
});

test('lookalike names do not collide', () => {
  assert.equal(toIso('Niger'), 'NE');
  assert.equal(toIso('Nigeria'), 'NG');
  assert.equal(toIso('Guyane'), 'GY');
  assert.equal(toIso('Guyane Française'), 'GF');
  assert.equal(toIso('Samoa (Îles)'), 'WS');
  assert.equal(toIso('Samoa (US)'), 'AS');
  assert.equal(toIso('Congo'), 'CG');
  assert.equal(toIso('République démocratique du Congo'), 'CD');
  assert.equal(toIso('Dominique (Île de la)'), 'DM');
  assert.equal(toIso('République Dominicaine'), 'DO');
});

test('classify: Spain is full, Vietnam is data-only, Afghanistan is none on 5G+', () => {
  assert.equal(classify(countryInfo['Espagne'].free5g), 'full');
  assert.equal(classify(countryInfo['Vietnam'].free5g), 'data');
  assert.equal(classify(countryInfo['Afghanistan'].free5g), 'none');
  assert.equal(classify(undefined), 'none');
});

test('buildDataset rolls sub-regions up to the best status and lists members', () => {
  const ds = buildDataset({ fetchedAt: 'now', pageProps, countryInfo });
  assert.deepEqual(ds.unmapped, []);
  assert.ok(ds.byIso.US.members.includes('Alaska'));
  assert.ok(ds.byIso.US.members.includes('Etats-Unis'));
  assert.equal(ds.plans.free5g.roamingFairUseMb, 35000);
  assert.equal(ds.plans.freeMax.roamingFairUseMb, -1);
  assert.equal(ds.plans.free5g.nationalFairUseMb, 350000);
  assert.equal(ds.plans.free5g.nationalFairUseFreeboxMb, -1);
  assert.equal(ds.destinations['Espagne'].status.free5g, 'full');
});

test('a sovereign entry decides the map colour even when a sub-region diverges', () => {
  const props = { ...pageProps, destinationsList: ['Chypre du Nord', 'Chypre', 'Alaska', 'Etats-Unis', 'Hawaï'] };
  const full = countryInfo['Espagne'];
  const dataOnly = countryInfo['Vietnam'];
  const ds = buildDataset({ fetchedAt: 'now', pageProps: props, countryInfo: { 'Chypre': full, 'Chypre du Nord': dataOnly, 'Alaska': dataOnly, 'Etats-Unis': full, 'Hawaï': dataOnly } });
  assert.equal(ds.byIso.CY.status.free5g, 'full');
  assert.equal(ds.byIso.CY.sovereign, 'Chypre');
  assert.deepEqual(ds.byIso.CY.members, ['Chypre du Nord', 'Chypre']);
  assert.equal(ds.destinations['Chypre du Nord'].status.free5g, 'data');
  // Etats-Unis is itself in OVERRIDES, so US has no sovereign entry and takes the best member.
  assert.equal(ds.byIso.US.status.free5g, 'full');
});

test('an ISO made only of sub-national entries that are all excluded still has an explicit status', () => {
  const props = { ...pageProps, destinationsList: ['Bonaire', 'Saba'] };
  const ds = buildDataset({ fetchedAt: 'now', pageProps: props, countryInfo: { Bonaire: countryInfo['Afghanistan'], Saba: countryInfo['Afghanistan'] } });
  assert.deepEqual(ds.byIso.BQ.status, { free5g: 'none', freeMax: 'none' });
});

test('validate refuses a hollow dataset (e.g. Free renames the "gold" key)', () => {
  const renamed = Object.fromEntries(Object.entries(countryInfo).map(([n, v]) => [n, { ...v, gold: undefined }]));
  const ds = buildDataset({ fetchedAt: 'now', pageProps, countryInfo: renamed });
  assert.ok(validate(ds).some((e) => e.startsWith('freeMax:')));
  const empty = buildDataset({ fetchedAt: 'now', pageProps: { ...pageProps, destinationsList: [] }, countryInfo: {} });
  assert.ok(validate(empty).length > 0);
});

test('validate refuses a dataset where a voice field moved and nothing is "full" any more', () => {
  const moved = Object.fromEntries(Object.entries(countryInfo).map(([n, v]) => [n, { ...v, free5g: v.free5g && { ...v.free5g, calls: { ...v.free5g.calls, received: undefined } } }]));
  const ds = buildDataset({ fetchedAt: 'now', pageProps, countryInfo: moved });
  assert.ok(validate(ds).some((e) => /free5g: only \d+ fully included/.test(e)));
});

test('prototype names are not treated as overrides', () => {
  assert.equal(toIso('constructor'), undefined);
});
