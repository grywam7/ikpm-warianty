// Prototyp „Kreator” — wspólny moduł: dane z kit.json, stan prototypu (localStorage), reguły aplikacji potrzebne
// ekranom, formatowanie, nagłówek z nawigacją, okno potwierdzenia, komunikaty. Liczby liczy ikpm.js (jak aplikacja).
import * as ikpm from './ikpm.js';

export { ikpm };
const { roundHalfUp, formatPLN, formatDecimal, laborUnitCost, lineTotal, areaFor, defaultQuantity, parseNumber } = ikpm;

export const ROOT = new URL('../', import.meta.url).href;
export const link = (path) => ROOT + path;

// Znacznik seeda „[DEMO]” to nie część danych, które zobaczy uczestnik badania.
const _raw = await (await fetch(new URL('kit.json', import.meta.url))).text();
export const kit = JSON.parse(_raw.replaceAll(' [DEMO]', ''));

// ---------------------------------------------------------------- stan prototypu
const KEY = 'ikpm-kreator-v1';
const blank = () => ({
  quotes: {}, realizations: {}, jobEdits: {}, newJobs: [], newStages: [], stageEdits: {}, clients: [], templates: [], templateEdits: {},
  contractorEdits: {}, newContractors: [], materialEdits: {}, newMaterials: [], users: [],
  seq: { quote: Math.max(...kit.quotes.map((q) => q.id)) + 1, realization: Math.max(...kit.realizations.map((r) => r.id)) + 1, id: 900000 },
});
const read = () => {
  try { return { ...blank(), ...(JSON.parse(localStorage.getItem(KEY)) ?? {}) }; } catch { return blank(); }
};
export const state = read();
export const persist = () => {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* prywatne okno — stan tylko w pamięci */ }
};
export const nextId = () => { state.seq.id += 1; return state.seq.id; };
if (new URLSearchParams(location.search).has('reset')) {
  try { localStorage.removeItem(KEY); sessionStorage.clear(); } catch { /* bez pamięci */ }
  const _u = new URL(location.href); _u.searchParams.delete('reset'); location.replace(_u); // reszta adresu (id, krok) zostaje
}

// ---------------------------------------------------------------- formatowanie
const MEASURE = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2, useGrouping: 'always' });
const ONE = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: 'always' });
export const clone = (value) => JSON.parse(JSON.stringify(value));
const num = (value) => (value === null || value === undefined || value === '' ? 0 : Number(value));
export const has = (value) => value !== null && value !== undefined && value !== '' && Number(value) !== 0;

export const plural = (n, one, few, many) => {
  if (n === 1) return one;
  const _ten = n % 10; const _hundred = n % 100;
  return _ten >= 2 && _ten <= 4 && (_hundred < 12 || _hundred > 14) ? few : many;
};
export const workDaysText = (n) => `${n} ${plural(n, 'dzień roboczy', 'dni robocze', 'dni roboczych')}`;
export const jobsAccusative = (n) => `${n} ${plural(n, 'pracę', 'prace', 'prac')}`;
export const jobsText = (n) => `${n} ${plural(n, 'praca', 'prace', 'prac')}`;

const pad = (n) => String(n).padStart(2, '0');
export const isoDay = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const todayISO = () => isoDay(new Date());
export const dateText = (value, blankText = '—') => {
  if (!value) return blankText;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) { const [y, m, d] = value.split('-'); return `${d}.${m}.${y}`; }
  return new Date(value).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Warsaw' });
};
export const dateTimeText = (value) => (value ? `${dateText(value)} ${new Date(value).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' })}` : '—');
export const addDays = (iso, days) => { const _d = new Date(`${iso}T12:00:00`); _d.setDate(_d.getDate() + days); return isoDay(_d); };

// Quote#suggested_end_on: N dni roboczych od startu (start w weekend → poniedziałek = dzień 1), pn–pt, bez świąt.
export const addWorkDays = (startIso, n) => {
  if (!startIso || !n) return null;
  const _d = new Date(`${startIso}T12:00:00`);
  while ([0, 6].includes(_d.getDay())) _d.setDate(_d.getDate() + 1);
  let _left = n - 1;
  while (_left > 0) { _d.setDate(_d.getDate() + 1); if (![0, 6].includes(_d.getDay())) _left -= 1; }
  return isoDay(_d);
};

// Status = kolor + ikona + tekst; ikona i kolor z ikpm-ui.css (.ikpm-st-<rodzaj>-<status>).
const LABELS = { quote: kit.labels.quote_status, realization: kit.labels.realization_status, job: kit.labels.realization_job_status };
const KIND = { quote: 'quote', realization: 'real', job: 'job', user: 'user' };
export const statusLabel = (kind, status) => LABELS[kind][status] ?? status;
export const statusClass = (kind, status) => `ikpm-st-${KIND[kind]}-${status}`;
export const badge = (kind, status, label, extra = '') => `<span class="ikpm-status ${statusClass(kind, status)}${extra ? ` ${extra}` : ''}">${escapeHtml(label ?? statusLabel(kind, status))}</span>`;

export const pln = (value) => formatPLN(roundHalfUp(num(value)));
export const dec = (value) => formatDecimal(num(value));
export const qtyText = (value, unit) => `${formatDecimal(num(value))}${unit ? ` ${unit}` : ''}`;
export const measure = (value) => MEASURE.format(num(value));
export const oneDec = (value) => ONE.format(num(value));
export const hoursText = (value) => `${ONE.format(num(value))} h`;
export const percentText = (value) => `${new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}%`;
export const escapeHtml = (text) => String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ---------------------------------------------------------------- pokój (Room)
export const OVERRIDES = ['floor_area_override', 'ceiling_area_override', 'wall_area_override', 'perimeter_override'];
export const DIMENSIONS = ['length', 'width', 'height', 'holes_area'];
export const isIrregular = (room) => OVERRIDES.some((f) => room[f] !== null && room[f] !== undefined && room[f] !== '');
export const roomSizeParts = (room) => {
  const _floor = roundHalfUp(areaFor(room, 'floor')); const _walls = roundHalfUp(areaFor(room, 'wall'));
  const _parts = {};
  if (!isIrregular(room) && num(room.length) > 0 && num(room.width) > 0) {
    _parts.dimensions = `${measure(room.length)} × ${measure(room.width)}${num(room.height) > 0 ? ` × ${measure(room.height)}` : ''} m`;
  }
  if (_floor > 0) _parts.floor = `Podłoga: ${dec(_floor)} m²`;
  if (_walls > 0) _parts.walls = `Ściany: ${dec(_walls)} m²`;
  return _parts;
};
export const roomSize = (room) => { const _p = roomSizeParts(room); return _p.dimensions ?? _p.floor ?? ''; };
export const roomErrors = (room) => {
  const _errors = [];
  if ([...DIMENSIONS, ...OVERRIDES].some((f) => num(room[f]) < 0)) _errors.push('Wymiary i powierzchnie nie mogą być ujemne.');
  const _computedWalls = (room.perimeter_override !== null && room.perimeter_override !== undefined && room.perimeter_override !== ''
    ? num(room.perimeter_override) : 2 * (num(room.length) + num(room.width))) * num(room.height);
  if (num(room.holes_area) > 0 && num(room.holes_area) > _computedWalls) _errors.push('Powierzchnia otworów przekracza powierzchnię ścian — popraw wymiary.');
  return _errors;
};

// ---------------------------------------------------------------- katalog (cennik)
let _catalogue;
export const catalogue = () => {
  if (_catalogue) return _catalogue;
  const _stages = clone(kit.catalogue);
  for (const stage of state.newStages) _stages.push({ ...stage, jobs: [] });
  for (const stage of _stages) {
    stage.jobs = stage.jobs.map((job) => state.jobEdits[job.id] ?? { ...job, stage_id: stage.id }).filter((job) => !job.deleted);
  }
  for (const job of state.newJobs) if (!job.deleted) _stages.find((s) => s.id === job.stage_id)?.jobs.push(job);
  _stages.forEach((stage, i) => { Object.assign(stage, state.stageEdits[stage.id] ?? {}); stage.order = Number(stage.order ?? i + 1); });
  _stages.sort((a, b) => a.order - b.order || a.id - b.id);
  // praca przeniesiona do innego etapu (pole „Etap” w edycji)
  for (const stage of _stages) {
    for (const job of stage.jobs.filter((j) => j.stage_id !== stage.id)) {
      stage.jobs = stage.jobs.filter((j) => j !== job);
      _stages.find((s) => s.id === job.stage_id)?.jobs.push(job);
    }
  }
  for (const stage of _stages) {
    for (const job of stage.jobs) {
      job.crews = (job.crews ?? []).map((c) => {
        const _e = state.contractorEdits[c.contractor];
        return _e ? { ...c, archived: _e.archived ?? c.archived, max_parallel_jobs: _e.max_parallel_jobs ?? c.max_parallel_jobs } : c;
      });
    }
  }
  _catalogue = _stages;
  return _stages;
};
export const resetCatalogueCache = () => { _catalogue = undefined; };
// Etap: nazwa i kolejność (Zapisz etap).
export const saveStage = (id, fields) => {
  const _new = state.newStages.find((s) => s.id === id);
  if (_new) Object.assign(_new, fields); else state.stageEdits[id] = { ...(state.stageEdits[id] ?? {}), ...fields };
  persist(); resetCatalogueCache();
};
export const saveCatalogueJob = (job) => {
  if (state.newJobs.some((j) => j.id === job.id)) state.newJobs = state.newJobs.map((j) => (j.id === job.id ? job : j));
  else if (kit.catalogue.some((s) => s.jobs.some((j) => j.id === job.id))) state.jobEdits[job.id] = job;
  else state.newJobs.push(job);
  persist();
  resetCatalogueCache();
};
// Zmiana jednej pracy z cennika (cena, ekipy, materiały) — zapis jak „Zapisz pracę”.
export const updateCatalogueJob = (id, change) => {
  const { stage, ...job } = clone(jobById(id));
  change(job);
  for (const c of job.crews) c.effective_price = c.price ?? job.average_price;
  saveCatalogueJob(job);
};
export const jobsInUseByCrew = (name) => [...quotes().flatMap(quoteJobs), ...realizations().flatMap(realJobs)].some((j) => j.contractor === name);
export const jobInUse = (jobId) => [...quotes().flatMap(quoteJobs), ...realizations().flatMap(realJobs)].some((j) => j.job_id === jobId);
export const allJobs = () => catalogue().flatMap((stage) => stage.jobs.map((job) => ({ ...job, stage: stage.name, stage_id: stage.id })));
export const jobById = (id) => allJobs().find((job) => job.id === Number(id));
export const jobByName = (name) => allJobs().find((job) => job.name === name);
export const units = () => [...new Set([...allJobs().map((j) => j.unit), 'kg', 'l'])];
export const materialUnit = (material) => String(material.package ?? '').replace(/^[\d.,\s]+/, '') || 'szt';
// Materiały: z kitu (klucz = pozycja w kicie) + dodane i zmienione w prototypie.
export const materials = () => [
  ...kit.materials.map((m, i) => ({ link: null, ...m, key: `k${i}`, ...(state.materialEdits[`k${i}`] ?? {}) })),
  ...state.newMaterials.map((m) => ({ ...m, ...(state.materialEdits[m.key] ?? {}) })),
].filter((m) => !m.deleted);
export const saveMaterial = (m) => {
  const _qty = Number.parseFloat(String(m.package).replace(',', '.')) || 1;
  const _rec = { name: m.name, price: String(m.price), package: m.package, unit_price: String(Number(m.price) / _qty), link: m.link || null, deleted: m.deleted || undefined };
  if (!m.key) { state.newMaterials.push({ ..._rec, key: `n${nextId()}` }); } else state.materialEdits[m.key] = { ...(state.materialEdits[m.key] ?? {}), ..._rec };
  persist();
};

// Wykonawcy z cennika (karta ekipy i jej prace); kit nie niesie e-maila ani telefonu ekipy.
export const contractors = () => {
  const _map = new Map();
  const _add = (name, crew = {}) => {
    if (!_map.has(name)) {
      _map.set(name, { name, email: null, phone: null, notes: null, archived: Boolean(crew.archived), archived_on: null, max_parallel_jobs: crew.max_parallel_jobs ?? 1, jobs: [], ...(state.contractorEdits[name] ?? {}) });
    }
    return _map.get(name);
  };
  for (const job of allJobs()) {
    for (const crew of job.crews) _add(crew.contractor, crew).jobs.push({ ...crew, job: job.name, job_id: job.id, unit: job.unit, stage: job.stage, average_price: job.average_price });
  }
  for (const c of state.newContractors) _add(c.name, c);
  return [..._map.values()].filter((c) => !c.deleted).sort((a, b) => a.name.localeCompare(b.name, 'pl'));
};
// Dane ekipy (nazwa, e-mail, telefon, prace naraz, notatki, archiwum); zmiana nazwy idzie do cennika.
export const saveContractor = (oldName, fields) => {
  const _name = fields.name ?? oldName;
  const _edits = { ...(state.contractorEdits[oldName] ?? {}), ...fields };
  delete _edits.name;
  if (oldName && _name !== oldName) {
    for (const job of allJobs().filter((j) => j.crews.some((c) => c.contractor === oldName))) {
      updateCatalogueJob(job.id, (j) => { for (const c of j.crews) if (c.contractor === oldName) c.contractor = _name; });
    }
    state.newContractors = state.newContractors.map((c) => (c.name === oldName ? { ...c, name: _name } : c));
    delete state.contractorEdits[oldName];
  }
  if (!oldName) state.newContractors.push({ name: _name, max_parallel_jobs: fields.max_parallel_jobs ?? 1 });
  state.contractorEdits[_name] = _edits;
  persist(); resetCatalogueCache();
};

// Tempo ekipy z cennika (h/j.): min – max; bez danych „—”.
export const tempoText = (crew) => {
  const _parts = [crew.speed_min, crew.speed_max].filter((v) => v !== null && v !== undefined && v !== '').map((v) => measure(v));
  return _parts.length ? `${_parts.join(' – ')} h/j.` : '—';
};

const STAGE_POS = () => new Map(catalogue().map((stage, i) => [stage.name, i]));
const JOB_POS = () => new Map(allJobs().map((job, i) => [job.id, i]));
export const sortJobs = (jobs) => {
  const _stage = STAGE_POS(); const _job = JOB_POS();
  return [...jobs].sort((a, b) => (_stage.get(a.stage) ?? 99) - (_stage.get(b.stage) ?? 99) || (_job.get(a.job_id) ?? 9999) - (_job.get(b.job_id) ?? 9999) || a.id - b.id);
};
export const byStage = (jobs) => {
  const _groups = [];
  for (const job of sortJobs(jobs)) {
    let _g = _groups.find((g) => g.stage === job.stage);
    if (!_g) { _g = { stage: job.stage, jobs: [] }; _groups.push(_g); }
    _g.jobs.push(job);
  }
  return _groups;
};

// Nowa praca w pokoju wyceny — cena żywa z cennika (contractor_price nil), ilość z pomiarów albo podana.
export const newQuoteJob = (catalogueJob, room, quantity) => ({
  id: nextId(), job_id: catalogueJob.id, name: catalogueJob.name, unit: catalogueJob.unit,
  area_type: catalogueJob.area_type, area_type_label: catalogueJob.area_type_label, stage: catalogueJob.stage,
  quantity: quantity ?? defaultQuantity(catalogueJob, room), contractor: null, contractor_price: null,
  average_price: catalogueJob.average_price, effective_material_unit_cost: catalogueJob.material_unit_cost,
  matched_quantity: null,
  typed: quantity !== undefined && quantity !== null && catalogueJob.area_type !== 'manual' && num(quantity) !== defaultQuantity(catalogueJob, room),
});

// ---------------------------------------------------------------- klienci
const clientsFromKit = () => {
  const _map = new Map();
  for (const record of [...kit.quotes, ...kit.realizations]) {
    if (record.client && !_map.has(record.client.name)) _map.set(record.client.name, { ...record.client, notes: null });
  }
  return [..._map.values()].sort((a, b) => a.name.localeCompare(b.name, 'pl')).map((c, i) => ({ id: i + 1, ...c }));
};
export const clients = () => [...clientsFromKit().map((c) => state.clients.find((s) => s.id === c.id) ?? c), ...state.clients.filter((c) => c.id > 1000)]
  .sort((a, b) => a.name.localeCompare(b.name, 'pl'));
export const clientById = (id) => clients().find((c) => c.id === Number(id));
export const clientByName = (name) => clients().find((c) => c.name === name);
export const saveClient = (client) => {
  const _old = client.id ? clientById(client.id) : null;
  if (!client.id) client.id = 1000 + state.clients.length + 1;
  state.clients = [...state.clients.filter((c) => c.id !== client.id), client];
  persist();
  // Wyceny i realizacje pokazują aktualne dane klienta (w aplikacji — przez client_id).
  if (_old) {
    const _data = { name: client.name, email: client.email || null, phone: client.phone || null };
    for (const q of quotes()) if (q.client?.name === _old.name) { q.client = { ...q.client, ..._data }; saveQuote(q); }
    for (const r of realizations()) if (r.client?.name === _old.name) { r.client = { ...r.client, ..._data }; saveRealization(r); }
  }
  return client;
};

// ---------------------------------------------------------------- wyceny
const stripQuote = (q) => {
  const { matching_plans, after_matching, after_change, totals, total_fields, ...shallow } = q;
  const rest = clone(shallow);
  for (const room of rest.rooms) {
    for (const job of room.jobs) if (job.matched_quantity === undefined) job.matched_quantity = job.contractor ? job.quantity : null;
  }
  return rest;
};
export const getQuote = (id) => {
  const _id = Number(id);
  if (state.quotes[_id]) return clone(state.quotes[_id]);
  const _kit = kit.quotes.find((q) => q.id === _id);
  return _kit ? stripQuote(_kit) : null;
};
export const saveQuote = (q) => { state.quotes[q.id] = clone(q); persist(); };
export const quotes = () => [...new Set([...kit.quotes.map((q) => q.id), ...Object.keys(state.quotes).map(Number)])]
  .map(getQuote).filter((q) => q && !q.deleted).sort((a, b) => b.id - a.id);
export const quoteLabel = (q) => `Wycena #${q.id}`;

export const quoteJobs = (q) => q.rooms.flatMap((room) => room.jobs);
export const totals = (q) => ikpm.quoteTotals(q);
export const roomTotal = (q, room) => roundHalfUp(room.jobs.reduce((sum, job) => sum + lineTotal(job, q.markup_percent), 0));
export const jobCost = (job) => (laborUnitCost(job) + num(job.effective_material_unit_cost)) * num(job.quantity);
export const quoteCost = (q) => roundHalfUp(quoteJobs(q).reduce((sum, job) => sum + jobCost(job), 0));
export const marginPercent = (markup) => (num(markup) / (100 + num(markup))) * 100;
export const vatLabel = (q) => `VAT ${Number(q.vat_rate)}%`;
export const hasClientComments = (q) => Boolean(q.client_general_comment) || q.rooms.some((r) => r.client_comment);
export const nextRoomName = (q) => {
  let _n = q.rooms.length + 1;
  while (q.rooms.some((r) => r.name === `Pokój ${_n}`)) _n += 1;
  return `Pokój ${_n}`;
};
export const changedAfterMatching = (q) => quoteJobs(q).filter((j) => j.matched_quantity !== null && j.matched_quantity !== undefined && num(j.matched_quantity) !== num(j.quantity));
export const realizationOf = (q) => realizations().find((r) => r.quote_id === q.id);
export const jobNames = (jobs) => {
  const _names = [...new Set(sortJobs(jobs).map((j) => j.name))];
  return _names.slice(0, 5).join(', ') + (_names.length > 5 ? ` (+${_names.length - 5})` : '');
};

// Plany doboru tylko z eksportu aplikacji: stan wyceny, którego ilości zgadzają się z obecnymi (szkic z kitu albo
// oferta Z5 po poprawce klienta). Innych planów prototyp nie wymyśla.
export const planSource = (q) => {
  const _kit = kit.quotes.find((k) => k.id === q.id);
  if (!_kit) return null;
  const _jobs = quoteJobs(q);
  const _same = (candidate) => {
    const _cj = new Map(candidate.rooms.flatMap((r) => r.jobs).map((j) => [j.id, num(j.quantity)]));
    return _cj.size === _jobs.length && _jobs.every((j) => _cj.has(j.id) && Math.abs(_cj.get(j.id) - num(j.quantity)) < 1e-9);
  };
  return [_kit.matching_plans ? _kit : null, _kit.after_change].filter(Boolean).find(_same) ?? null;
};

export const applyPlan = (q, profile) => {
  const _after = planSource(q).after_matching[profile];
  const _jobs = new Map(_after.rooms.flatMap((r) => r.jobs).map((j) => [j.id, j]));
  for (const room of q.rooms) {
    room.jobs = room.jobs.map((job) => {
      const _a = _jobs.get(job.id);
      return { ...job, contractor: _a.contractor, contractor_price: _a.contractor_price, effective_material_unit_cost: _a.effective_material_unit_cost, matched_quantity: _a.contractor ? _a.quantity : null };
    });
  }
  q.applied_profile_name = profile;
  q.suggested_work_days = _after.suggested_work_days;
  return q;
};

// Bramki Quote::Send (teksty z aplikacji), z krokiem kreatora, który je naprawia.
export const sendProblems = (q) => {
  const _p = [];
  const _jobs = quoteJobs(q);
  if (q.status !== 'draft') _p.push({ step: 'sprawdz', msg: 'Wysłać można tylko szkic — przywróć wycenę do edycji i wyślij ją ponownie.' });
  if (!q.client) _p.push({ step: 'klient', msg: 'Wycena nie ma klienta — wybierz go przed wysłaniem.' });
  else if (!q.client.email) _p.push({ step: 'klient', msg: 'Klient nie ma adresu email — dodaj go w danych klienta.' });
  if (_jobs.length === 0) _p.push({ step: 'prace', msg: 'Wycena nie ma żadnych prac — dodaj prace przed wysłaniem.' });
  const _without = _jobs.filter((j) => !j.contractor);
  if (_jobs.length && _without.length) _p.push({ step: 'wykonawcy', msg: `Nie wszystkie prace mają przypisanego wykonawcę (${_without.length} bez wykonawcy). Uruchom dobieranie wykonawców (plan zastąpi ręcznie wpisane ceny ekipy cenami z cennika); praca, która dalej zostaje bez wykonawcy, potrzebuje w cenniku ekipy z ceną.` });
  const _archivedCrews = new Set(contractors().filter((c) => c.archived).map((c) => c.name));
  const _archived = _jobs.filter((j) => _archivedCrews.has(j.contractor));
  if (_archived.length) _p.push({ step: 'wykonawcy', msg: `Prace z wykonawcą z archiwum: ${jobNames(_archived)}. Uruchom ponownie dobieranie wykonawców.` });
  const _changed = changedAfterMatching(q);
  if (_changed.length) _p.push({ step: 'wykonawcy', msg: `Prace ze zmienioną ilością po doborze wykonawców (także po zmianie wymiarów pokoju): ${jobNames(_changed)}. Uruchom ponownie dobieranie wykonawców — plan zastąpi ręcznie wpisane ceny ekipy we wszystkich pracach cenami z cennika.` });
  const _unpriced = _jobs.filter((j) => laborUnitCost(j) <= 0);
  if (_unpriced.length) _p.push({ step: 'prace', msg: `Prace bez ceny ekipy: ${jobNames(_unpriced)}. Wpisz cenę w builderze albo średnią w cenniku prac.` });
  const _invalid = _jobs.filter((j) => !(num(j.quantity) > 0));
  if (_invalid.length) _p.push({ step: 'prace', msg: `Prace z błędnymi danymi (np. ilość 0): ${jobNames(_invalid)}. Popraw je w builderze.` });
  if (!q.planned_end_on) _p.push({ step: 'termin', msg: 'Wycena nie ma terminu zakończenia — wpisz go w builderze i kliknij „Zapisz”.' });
  else if (q.planned_end_on < todayISO()) _p.push({ step: 'termin', msg: 'Termin zakończenia już minął — popraw go w builderze i kliknij „Zapisz”.' });
  return _p;
};

// Następny krok szkicu — ekran startowy i lista wycen.
export const nextStep = (q) => {
  if (!q.client) return { step: 'klient', label: 'Wybierz klienta' };
  if (q.rooms.length === 0) return { step: 'pokoje', label: 'Dodaj pokoje' };
  if (quoteJobs(q).length === 0) return { step: 'prace', label: 'Dodaj prace' };
  if (quoteJobs(q).some((j) => !j.contractor) || changedAfterMatching(q).length) return { step: 'wykonawcy', label: 'Dobierz wykonawców' };
  if (!q.planned_end_on) return { step: 'termin', label: 'Ustaw termin' };
  return { step: 'sprawdz', label: 'Sprawdź i wyślij' };
};
export const lastSentQuote = () => quotes().filter((q) => q.sent_at && q.status !== 'draft').sort((a, b) => Date.parse(b.sent_at) - Date.parse(a.sent_at))[0];
export const sender = (q) => kit.users.find((u) => u.display_name === q.user) ?? null;
export const builderLink = (q, step) => link(`screens/${step === 'wykonawcy' ? 'match-contractors' : 'builder'}.html?id=${q.id}&krok=${step}`);

export const sendQuote = (q) => {
  const _now = new Date();
  for (const job of quoteJobs(q)) {
    job.contractor_price = String(laborUnitCost(job));
    job.effective_material_unit_cost = String(num(job.effective_material_unit_cost));
  }
  if (hasClientComments(q)) {
    const _lines = [`Uwagi klienta (przed wysyłką ${dateText(isoDay(_now))}):`];
    if (q.client_general_comment) _lines.push(q.client_general_comment);
    for (const room of q.rooms) if (room.client_comment) _lines.push(`${room.name}: ${room.client_comment}`);
    q.notes = [q.notes, _lines.join('\n')].filter(Boolean).join('\n\n');
    q.client_general_comment = null;
    for (const room of q.rooms) room.client_comment = null;
  }
  q.status = 'sent'; q.sent_at = _now.toISOString(); q.responded_at = null;
  q.link_valid_until = addDays(isoDay(_now), 30);
  saveQuote(q);
  return `Wycena wysłana do ${q.client.email}.`;
};
export const reopenQuote = (q) => {
  q.status = 'draft'; q.sent_at = null; q.responded_at = null;
  saveQuote(q);
};
export const copyQuote = (q) => {
  const _copy = {
    id: state.seq.quote++, notes: null, status: 'draft', client: q.client, user: kit.users[0].display_name,
    markup_percent: q.markup_percent, vat_rate: q.vat_rate, site_address: null, planned_start_on: null, planned_end_on: null,
    suggested_work_days: null, applied_profile_name: null, client_general_comment: null, sent_at: null, responded_at: null,
    rooms: q.rooms.map((room) => ({
      ...room, id: nextId(), client_comment: null,
      jobs: room.jobs.map((job) => {
        const _cat = jobById(job.job_id) ?? job;
        return newQuoteJob({ ..._cat, stage: job.stage }, room, job.quantity);
      }),
    })),
  };
  saveQuote(_copy);
  return _copy;
};
export const newQuote = (client) => {
  const _q = {
    id: state.seq.quote++, notes: null, status: 'draft', client: client ?? null, user: kit.users[0].display_name,
    markup_percent: '20.0', vat_rate: '8.0', site_address: null, planned_start_on: null, planned_end_on: null,
    suggested_work_days: null, applied_profile_name: null, client_general_comment: null, sent_at: null, responded_at: null,
    created_on: todayISO(), rooms: [],
  };
  saveQuote(_q);
  return _q;
};
export const blankRoom = (q, name, extra = {}) => ({
  id: nextId(), name: name ?? nextRoomName(q), notes: null, client_comment: null,
  length: null, width: null, height: '2.8', holes_area: null,
  floor_area_override: null, ceiling_area_override: null, wall_area_override: null, perimeter_override: null, jobs: [], ...extra,
});

// Szablon pokoju: wymiary tylko w puste pola, prace, których pokój nie ma, ilość pracy ręcznej z szablonu (tylko w górę).
// Szablony: z kitu (klucz k<n>) z poprawkami + utworzone w prototypie (klucz s<n>); kolejność „Kolejność”, potem nazwa.
export const templates = () => [
  ...kit.room_templates.map((t, i) => ({ order: i + 1, ...t, key: `k${i}`, ...(state.templateEdits[`k${i}`] ?? {}) })),
  ...state.templates.map((t, i) => ({ order: kit.room_templates.length + i + 1, ...t, key: `s${i}` })),
].filter((t) => !t.deleted).sort((a, b) => Number(a.order) - Number(b.order) || a.name.localeCompare(b.name, 'pl'));
export const saveTemplate = (t) => {
  const { key, ...rec } = clone(t);
  if (key?.startsWith('k')) state.templateEdits[key] = rec;
  else if (key?.startsWith('s')) state.templates[Number(key.slice(1))] = rec;
  else state.templates.push(rec);
  persist();
};
export const applyTemplate = (room, template) => {
  for (const f of DIMENSIONS) {
    if (!has(room[f]) && has(template[f])) room[f] = template[f];
  }
  for (const tj of template.jobs) {
    const _cat = jobByName(tj.name);
    if (!_cat) continue;
    const _existing = room.jobs.find((j) => j.job_id === _cat.id);
    const _quantity = _cat.area_type === 'manual' ? num(tj.quantity ?? 1) || 1 : undefined;
    if (_existing) {
      if (_cat.area_type === 'manual' && _quantity > num(_existing.quantity)) _existing.quantity = _quantity;
    } else {
      room.jobs.push(newQuoteJob(_cat, room, _quantity));
      if (_quantity !== undefined) room.jobs.at(-1).typed = false;
    }
  }
  recalcRoom(room);
};
// Zmiana pomiaru: przelicza prace auto, których ilości nikt nie wpisał ręcznie.
export const recalcRoom = (room) => {
  for (const job of room.jobs) {
    if (job.area_type !== 'manual' && !job.typed) job.quantity = defaultQuantity(job, room);
  }
};

// „Zapisz jako szablon”: wymiary i prace pokoju, ilości tylko prac ręcznych; nazwa unikalna bez wielkości liter.
export const saveRoomAsTemplate = (room, name) => {
  const _name = (name || room.name).trim().replace(/\s+/g, ' ');
  if (templates().some((t) => t.name.toLowerCase() === _name.toLowerCase())) {
    return { error: 'Nie można zapisać szablonu: Szablon o tej nazwie już istnieje — zmień nazwę.' };
  }
  state.templates.push({
    name: _name, description: null, order: templates().length + 1, length: room.length, width: room.width, height: room.height, holes_area: room.holes_area,
    jobs: sortJobs(room.jobs).map((j) => ({ name: j.name, unit: j.unit, area_type: j.area_type, area_type_label: j.area_type_label, quantity: j.area_type === 'manual' ? String(j.quantity) : null })),
  });
  persist();
  return { notice: `Szablon '${_name}' został utworzony.` };
};

// ---------------------------------------------------------------- realizacje
export const getRealization = (id) => {
  const _id = Number(id);
  if (state.realizations[_id]) return clone(state.realizations[_id]);
  const _kit = kit.realizations.find((r) => r.id === _id);
  return _kit ? clone(_kit) : null;
};
export const saveRealization = (r) => { state.realizations[r.id] = clone(r); persist(); };
export const realizations = () => [...new Set([...kit.realizations.map((r) => r.id), ...Object.keys(state.realizations).map(Number)])]
  .map(getRealization).filter((r) => r && !r.deleted).sort((a, b) => b.id - a.id);
export const realJobs = (r) => r.rooms.flatMap((room) => room.jobs);
export const progress = (r, room) => {
  const _jobs = room ? room.jobs : realJobs(r);
  const _done = _jobs.filter((j) => j.status === 'done').length;
  return { done: _done, all: _jobs.length, pct: _jobs.length ? Math.floor((_done * 100) / _jobs.length) : 0 };
};
export const isActive = (r) => ['planned', 'in_progress'].includes(r.status);
export const actualUnitCost = (job) => num(job.actual_contractor_price) || laborUnitCost(job);
export const realCost = (r) => roundHalfUp(realJobs(r).reduce((s, j) => s + (actualUnitCost(j) + num(j.effective_material_unit_cost)) * num(j.quantity), 0));
export const assignStatus = (job, status) => {
  job.status = status;
  job.status_label = statusLabel('job', status);
  if (status === 'done' && !job.completed_at) job.completed_at = new Date().toISOString();
};
export const endDateText = (r) => {
  if (r.status === 'cancelled') return null;
  if (r.status === 'done') return `Zakończono ${dateText(r.end_on)}`;
  const _current = r.expected_end_on || r.promised_end_on;
  if (r.promised_end_on && _current && _current !== r.promised_end_on) return `Pierwotnie obiecany ${dateText(r.promised_end_on)}, aktualnie przewidywany ${dateText(_current)}`;
  return _current ? dateText(_current) : null;
};
export const unfinishedText = (n) => `${plural(n, 'Została', 'Zostały', 'Zostało')} ${jobsText(n)} do zrobienia`;
export const convertQuote = (q) => {
  const _r = {
    id: state.seq.realization++, quote_id: q.id, status: 'planned', status_label: 'Planowana', settlement: 'on_completion',
    settlement_label: 'Po odbiorze', client: q.client, markup_percent: q.markup_percent, site_address: q.site_address,
    planned_start_on: q.planned_start_on, promised_end_on: q.planned_end_on, expected_end_on: q.planned_end_on,
    end_on: q.planned_end_on, total_price: String(totals(q).net), estimated_cost: String(quoteCost(q)),
    link_valid_until: addDays(todayISO(), 30),
    rooms: q.rooms.map((room) => ({
      ...room, id: nextId(), client_comment: null,
      jobs: room.jobs.map((job) => ({ ...job, id: nextId(), contractor_price: String(laborUnitCost(job)), status: 'to_do', status_label: 'Do zrobienia', notes: null, internal_notes: null, actual_contractor_price: null })),
    })),
    photos: [],
  };
  saveRealization(_r);
  state.seq.realization = Math.max(state.seq.realization, _r.id + 1);
  persist();
  return _r;
};

// Zdjęcia z telefonu: bramki Realization::AddPhotos (teksty z aplikacji), potem zmniejszenie do 800 px w przeglądarce,
// żeby zmieściły się w pamięci prototypu (aplikacja zmniejsza do 2000 px na serwerze).
const shrink = (file) => new Promise((resolve, reject) => {
  const _img = new Image();
  _img.onload = () => {
    const _scale = Math.min(1, 800 / Math.max(_img.width, _img.height));
    const _c = document.createElement('canvas');
    _c.width = Math.round(_img.width * _scale); _c.height = Math.round(_img.height * _scale);
    _c.getContext('2d').drawImage(_img, 0, 0, _c.width, _c.height);
    URL.revokeObjectURL(_img.src);
    resolve(_c.toDataURL('image/jpeg', 0.7));
  };
  _img.onerror = () => reject(new Error('read'));
  _img.src = URL.createObjectURL(file);
});
export const readPhotos = async (fileList) => {
  const _files = [...fileList];
  if (!_files.length) return { error: 'Wybierz co najmniej jedno zdjęcie.' };
  if (_files.length > 20) return { error: 'Wybierz najwyżej 20 zdjęć naraz.' };
  for (const f of _files) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return { error: `Nie dodano zdjęć — ${f.name}: Zdjęcie ma nieobsługiwany format (dozwolone: JPG, PNG, WebP).` };
    if (f.size > 20 * 1024 * 1024) return { error: `Nie dodano zdjęć — ${f.name}: Zdjęcie jest za duże (maks. 20 MB)` };
  }
  const _photos = [];
  for (const f of _files) {
    try { _photos.push({ key: `${Date.now()}-${_photos.length}-${f.name}`, filename: f.name, content_type: f.type, src: await shrink(f), client_visible: false }); }
    catch { return { error: `Nie dodano zdjęć — ${f.name}: nie da się odczytać pliku jako zdjęcia.` }; }
  }
  return { photos: _photos };
};

// ---------------------------------------------------------------- powłoka strony
const NAV = [
  { key: 'start', label: 'Start', icon: 'house', href: 'index.html' },
  { key: 'quotes', label: 'Wyceny', icon: 'file-earmark-text', href: 'screens/quotes-index.html' },
  { key: 'clients', label: 'Klienci', icon: 'people', href: 'screens/clients.html', more: true },
  { key: 'realizations', label: 'Realizacje', icon: 'cone-striped', href: 'screens/realizations-index.html' },
  { key: 'data', label: 'Dane', icon: 'database', href: 'screens/stages.html' },
  { key: 'finance', label: 'Finanse', icon: 'graph-up', href: 'screens/finance.html', more: true },
  { key: 'users', label: 'Użytkownicy', icon: 'person-gear', href: 'screens/users.html', more: true },
];
export const DATA_NAV = [
  { key: 'stages', label: 'Prace', icon: 'list-task', href: 'screens/stages.html' },
  { key: 'materials', label: 'Materiały', icon: 'box-seam', href: 'screens/materials.html' },
  { key: 'contractors', label: 'Wykonawcy', icon: 'person-badge', href: 'screens/contractors.html' },
  { key: 'templates', label: 'Szablony pokoi', icon: 'grid-1x2', href: 'screens/room-templates.html' },
];
const USER = kit.users[0];
export const users = () => [...kit.users.map((u) => ({ phone: null, ...u, ...(state.users.find((x) => x.orig === u.email) ?? {}) })),
  ...state.users.filter((x) => !x.orig)];

// Menu zawsze widoczne z podpisami: laptop i PC — wszystkie sekcje w pasku u góry; tablet — Start, Wyceny, Realizacje,
// Dane, Więcej; telefon — te same pięć jako dolne zakładki.
const headerHtml = (section) => {
  const _cur = (key) => (section === key ? ' aria-current="page"' : '');
  const _link = (n, cls = '') => `<a class="ikpm-nav-link${cls}" href="${link(n.href)}"${_cur(n.key)}><i class="bi bi-${n.icon}" aria-hidden="true"></i>${n.label}</a>`;
  const _moreActive = ['clients', 'finance', 'users', 'account'].includes(section);
  const _accountItems = `
    <li><span class="dropdown-item-text ikpm-meta">${escapeHtml(USER.email)}</span></li>
    <li><a class="dropdown-item" href="${link('screens/profile.html')}"${_cur('account')}><i class="bi bi-person-circle" aria-hidden="true"></i>Mój profil</a></li>
    <li><a class="dropdown-item" href="${link('screens/login.html')}"><i class="bi bi-box-arrow-right" aria-hidden="true"></i>Wyloguj się</a></li>`;
  const _moreItems = NAV.filter((n) => n.more).map((n) => `<li><a class="dropdown-item" href="${link(n.href)}"${_cur(n.key)}><i class="bi bi-${n.icon}" aria-hidden="true"></i>${n.label}</a></li>`).join('')
    + `<li><hr class="dropdown-divider"></li>${_accountItems}`;
  const _more = (cls, drop) => `<div class="${drop}${cls}">
      <button type="button" class="ikpm-nav-link dropdown-toggle${_moreActive ? ' active' : ''}" data-bs-toggle="dropdown" aria-expanded="false"><i class="bi bi-three-dots" aria-hidden="true"></i>Więcej</button>
      <ul class="dropdown-menu dropdown-menu-end">${_moreItems}</ul></div>`;
  return `
  <a class="ikpm-skip" href="#main">Przejdź do treści</a>
  <header class="app-header">
    <a class="ikpm-brand" href="${link('index.html')}"><strong>IKPM</strong><span>System kosztorysów</span></a>
    <nav class="ikpm-topnav" aria-label="Menu główne">
      ${NAV.map((n) => _link(n, n.more ? ' nav-wide' : '')).join('')}
      ${_more(' nav-narrow', 'dropdown')}
      <div class="dropdown nav-wide">
        <button type="button" class="ikpm-nav-link dropdown-toggle${section === 'account' ? ' active' : ''}" data-bs-toggle="dropdown" aria-expanded="false"><i class="bi bi-person-circle" aria-hidden="true"></i><span class="account-short">Konto</span><span class="account-email">${escapeHtml(USER.email)}</span></button>
        <ul class="dropdown-menu dropdown-menu-end">${_accountItems}</ul>
      </div>
    </nav>
  </header>
  <nav class="ikpm-tabbar" aria-label="Menu główne">
    ${NAV.filter((n) => !n.more).map((n) => _link(n)).join('')}
    ${_more('', 'dropup')}
  </nav>`;
};

const overlaysHtml = `
  <div x-data class="ikpm-toast-region" role="status" aria-live="polite">
    <template x-if="$store.toast.msg"><div class="ikpm-toast" @pointerenter="$event.pointerType === 'mouse' && $store.toast.hold()" @pointerleave="$event.pointerType === 'mouse' && $store.toast.release()" @focusin="$store.toast.hold()" @focusout="$store.toast.release()">
      <span class="ikpm-toast-msg" x-text="$store.toast.msg"></span>
      <template x-if="!!$store.toast.undo"><button type="button" class="btn ikpm-toast-action" @click="$store.toast.runUndo()">Cofnij</button></template>
      <button type="button" class="btn-close" aria-label="Zamknij" @click="$store.toast.msg = ''"></button>
    </div></template>
  </div>
  <dialog x-data class="ikpm-dialog" id="confirm-dialog" aria-labelledby="confirm-title" @cancel.prevent="$store.confirm.cancel()">
    <div class="ikpm-dialog-body">
      <h2 class="ikpm-dialog-title" id="confirm-title" x-text="$store.confirm.title"></h2>
      <ul class="ikpm-dialog-consequences" x-show="$store.confirm.lines.length">
        <template x-for="line in $store.confirm.lines"><li x-text="line"></li></template>
      </ul>
    </div>
    <div class="ikpm-dialog-actions">
      <button type="button" class="btn btn-outline-secondary" @click="$store.confirm.cancel()" x-text="$store.confirm.cancelLabel"></button>
      <button type="button" class="btn" :class="'btn-' + $store.confirm.variant" autofocus @click="$store.confirm.ok()" x-text="$store.confirm.okLabel"></button>
    </div>
  </dialog>`;

const footerHtml = `<footer class="app-footer">IKPM — prototyp „Kreator” do badania układu ekranów ·
  <a href="${link('index.html')}?reset=1">Prototyp: przywróć dane początkowe</a></footer>`;

const alertHtml = `
  <div x-data class="alert-zone" x-show="$store.alert.msg" x-cloak>
    <div class="alert alert-danger alert-dismissible d-flex gap-2" role="alert">
      <i class="bi bi-exclamation-octagon-fill" aria-hidden="true"></i><div class="flex-grow-1" x-text="$store.alert.msg"></div>
      <button type="button" class="btn-close" aria-label="Zamknij" @click="$store.alert.msg = ''"></button>
    </div>
  </div>`;

// Fokus pod lepkim paskiem u dołu (pasek kroku, zakładki): przeglądarka przewija pole tylko do krawędzi okna, więc
// zostałoby pod paskiem (WCAG 2.4.11) — przewiń je na środek. Pasek, który nie przylega do dołu, niczego nie zasłania.
const hiddenUnderBars = (el) => {
  const _r = el.getBoundingClientRect();
  if (!_r.height && !_r.width) return false;
  const _tab = document.querySelector('.ikpm-tabbar')?.getBoundingClientRect();
  const _floor = _tab?.height ? _tab.top : innerHeight;
  if (_r.bottom > _floor || _r.top < 0) return true;
  return [...document.querySelectorAll('.ikpm-actionbar')].some((bar) => {
    const _b = bar.getBoundingClientRect();
    return _b.height > 0 && _b.bottom >= _floor - 1 && _r.bottom > _b.top && _r.right > _b.left && _r.left < _b.right;
  });
};
document.addEventListener('focusin', (e) => {
  const _el = e.target;
  if (!(_el instanceof Element) || _el.closest('.ikpm-actionbar, .ikpm-tabbar, .ikpm-toast-region, dialog, .dropdown-menu')) return;
  const _fix = () => { if (hiddenUnderBars(_el)) _el.scrollIntoView({ block: 'center', behavior: 'instant' }); }; // Bootstrap: płynne przewijanie
  _fix(); requestAnimationFrame(_fix);
});

export const flash = (msg, kind = 'notice') => { try { sessionStorage.setItem('ikpm-flash', JSON.stringify({ msg, kind })); } catch { /* bez pamięci */ } };
export const go = (path, msg, kind) => { if (msg) flash(msg, kind); location.href = path.startsWith('http') ? path : link(path); };

export const helpers = {
  link, pln, dec, oneDec, qtyText, measure, hoursText, percentText, dateText, dateTimeText, badge, statusLabel, statusClass, plural, jobsText,
  workDaysText, jobsAccusative, roomSize, roomSizeParts, kit, Number, has, tempoText,
};

// Start strony: powłoka (menu, stopka, komunikaty, okno potwierdzenia), opcjonalny fragment HTML, komponent strony, Alpine.
export const start = async (component = () => ({}), { partial } = {}) => {
  const _section = document.body.dataset.section;
  const _internal = !['public', 'guest', 'mail'].includes(_section);
  if (_internal) document.body.insertAdjacentHTML('afterbegin', headerHtml(_section));
  document.getElementById('app').insertAdjacentHTML('beforebegin', alertHtml);
  if (_internal) document.getElementById('main').insertAdjacentHTML('afterend', footerHtml);
  document.body.insertAdjacentHTML('beforeend', overlaysHtml);
  if (partial) document.getElementById('app').innerHTML = await (await fetch(new URL(partial, import.meta.url))).text();
  let _flash = null;
  try { _flash = JSON.parse(sessionStorage.getItem('ikpm-flash')); sessionStorage.removeItem('ikpm-flash'); } catch { /* bez pamięci */ }
  document.addEventListener('alpine:init', () => {
    const A = window.Alpine;
    // Jeden komunikat naraz (nowy zastępuje poprzedni): 4 s, z „Cofnij” 8 s; najechanie myszą albo fokus wstrzymuje.
    A.store('toast', {
      msg: '', undo: null, timer: null,
      show(msg, { undo = null } = {}) { this.msg = msg; this.undo = undo; this.release(); },
      hold() { clearTimeout(this.timer); },
      release() { clearTimeout(this.timer); this.timer = setTimeout(() => { this.msg = ''; this.undo = null; }, this.undo ? 8000 : 4000); },
      runUndo() { const _u = this.undo; this.msg = ''; this.undo = null; _u?.(); },
    });
    // Następne kliknięcie poza komunikatem go zamyka — nie zostaje nad kolejnym krokiem.
    document.addEventListener('click', (e) => { if (!e.target.closest?.('.ikpm-toast')) { A.store('toast').msg = ''; A.store('toast').undo = null; } }, true);
    A.store('alert', { msg: _flash?.kind === 'alert' ? _flash.msg : '' });
    A.store('confirm', {
      open: false, title: '', lines: [], okLabel: 'Potwierdź', cancelLabel: 'Anuluj', variant: 'primary', run: null,
      ask({ title, lines = [], ok, cancel = 'Anuluj', variant = 'primary', run }) {
        Object.assign(this, { title, lines, okLabel: ok, cancelLabel: cancel, variant, run, open: true });
        const _d = document.getElementById('confirm-dialog');
        if (!_d.open) _d.showModal();
      },
      close() { this.open = false; const _d = document.getElementById('confirm-dialog'); if (_d.open) _d.close(); },
      ok() { const _run = this.run; this.close(); _run?.(); },
      cancel() { this.close(); },
    });
    // Bez rozpakowania {...}: rozpakowanie wywołałoby gettery komponentu raz, przed init.
    A.data('page', () => { const _c = component(); for (const [k, v] of Object.entries(helpers)) if (!(k in _c)) _c[k] = v; return _c; });
    if (_flash?.kind !== 'alert' && _flash?.msg) queueMicrotask(() => A.store('toast').show(_flash.msg));
  });
  const _bs = document.createElement('script'); _bs.src = link('assets/bootstrap/bootstrap.bundle.min.js'); document.head.append(_bs);
  const _alpine = document.createElement('script'); _alpine.src = link('assets/alpine.min.js'); document.head.append(_alpine);
};

// Zwykły tekst liczby z pola (type=number zwraca kropkę; ręczny tekst — przecinek albo kropkę) albo null.
export const fieldNumber = (input) => {
  if (input.value === '' && input.validity?.badInput) return undefined; // niedokończona liczba — bez zmian
  const _n = parseNumber(input.value);
  return Number.isFinite(_n) ? _n : null;
};
