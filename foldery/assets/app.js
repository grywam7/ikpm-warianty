// Foldery — wspólny moduł prototypu: dane z kit.json (+ zmiany w localStorage), obliczenia z ikpm.js, szkielet
// (menu boczne, dolne zakładki), komunikaty, okno potwierdzenia, wspólne kolumny list i start Alpine.
import * as K from './ikpm.js';

export const { roundHalfUp, parseNumber, areaFor, defaultQuantity, quoteTotals, lineTotal, clientUnitPrice, unitCost,
  laborUnitCost, formatPLN, formatDecimal } = K;

// ---------- adresy ----------
export const ROOT = new URL('../', import.meta.url).href;
const SEARCH = new URLSearchParams(location.search);
export const param = (k) => SEARCH.get(k);
export const intParam = (k) => (/^\d+$/.test(SEARCH.get(k) ?? '') ? Number(SEARCH.get(k)) : null);
export function link(screen, params = {}) {
  const _path = screen === 'start' ? 'index.html' : `screens/${screen}.html`;
  const _qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();
  return ROOT + _path + (_qs ? `?${_qs}` : '');
}
export const go = (screen, params) => { location.href = link(screen, params); };

// ---------- formaty ----------
export const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
export const pln = (v) => formatPLN(Number(v) || 0);
export const dec = (v) => formatDecimal(Number(v) || 0);
const MEASURE = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 });
export const measure = (v) => MEASURE.format(Number(v) || 0);
const PCT1 = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const pct1 = (v) => PCT1.format(v);
export const hoursText = (h) => `${new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: 'always' }).format(h)} h`;
export const todayISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date());
export function date(v) {
  if (!v) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { const [y, m, d] = v.split('-'); return `${d}.${m}.${y}`; }
  return new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(v));
}
export function dateTime(v) {
  if (!v) return '—';
  const _p = Object.fromEntries(new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit',
    year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(v)).map((p) => [p.type, p.value]));
  return `${_p.day}.${_p.month}.${_p.year} ${_p.hour}:${_p.minute}`;
}
const isoDate = (d) => d.toISOString().slice(0, 10);
const parseISO = (iso) => new Date(`${iso}T00:00:00Z`);
export const addDays = (iso, n) => { const _d = parseISO(iso); _d.setUTCDate(_d.getUTCDate() + n); return isoDate(_d); };
// Dni robocze od startu (start w weekend → poniedziałek = dzień 1, dalej pn–pt, bez świąt) — Quote#suggested_end_on.
export function addWorkDays(startISO, days) {
  if (!startISO || !days) return null;
  const _d = parseISO(startISO);
  const _weekend = () => [0, 6].includes(_d.getUTCDay());
  while (_weekend()) _d.setUTCDate(_d.getUTCDate() + 1);
  for (let _n = 1; _n < days;) { _d.setUTCDate(_d.getUTCDate() + 1); if (!_weekend()) _n += 1; }
  return isoDate(_d);
}
const plForm = (n, one, few, many) => {
  const _n10 = n % 10; const _n100 = n % 100;
  if (n === 1) return one;
  return _n10 >= 2 && _n10 <= 4 && !(_n100 >= 12 && _n100 <= 14) ? few : many;
};
export const jobsNom = (n) => `${n} ${plForm(n, 'praca', 'prace', 'prac')}`;
export const jobsAcc = (n) => `${n} ${plForm(n, 'pracę', 'prace', 'prac')}`;
export const jobsGen = (n) => `${n} ${plForm(n, 'pracy', 'prac', 'prac')}`;
export const workDaysText = (n) => `${n} ${plForm(n, 'dzień roboczy', 'dni robocze', 'dni roboczych')}`;
export const unfinishedText = (n) => plForm(n, `Została ${n} praca do zrobienia`, `Zostały ${n} prace do zrobienia`, `Zostało ${n} prac do zrobienia`);
export const pricesAcc = (n) => `${n} ${plForm(n, 'cenę', 'ceny', 'cen')}`;
export const positionsAcc = (n) => `${n} ${plForm(n, 'pozycję', 'pozycje', 'pozycji')}`;
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const fold = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
const clean = (s) => (s == null ? s : String(s).replace(/\s*\[DEMO\]/g, ''));

// ---------- etykiety i statusy (kolor + ikona + tekst) ----------
export const QUOTE_STATUS = {
  draft: ['Szkic', 'text-bg-secondary', 'bi-pencil'], sent: ['Wysłana', 'text-bg-info', 'bi-send'],
  changes_requested: ['Oczekuje zmiany', 'text-bg-warning', 'bi-chat-left-text'], accepted: ['Zaakceptowana', 'text-bg-success', 'bi-check-circle'],
  rejected: ['Odrzucona', 'text-bg-danger', 'bi-x-circle'],
};
export const CLIENT_STATUS = { sent: 'Czeka na Państwa odpowiedź', changes_requested: 'Czeka na zmianę u wykonawcy', accepted: 'Zaakceptowana', rejected: 'Odrzucona' };
export const REAL_STATUS = {
  planned: ['Planowana', 'text-bg-secondary', 'bi-calendar-event'], in_progress: ['W trakcie', 'text-bg-info', 'bi-play-circle'],
  done: ['Zakończona', 'text-bg-success', 'bi-check-circle'], cancelled: ['Anulowana', 'text-bg-danger', 'bi-x-circle'],
};
export const JOB_STATUS = {
  to_do: ['Do zrobienia', 'text-bg-secondary', 'bi-circle'], in_progress: ['W trakcie', 'text-bg-info', 'bi-hourglass-split'],
  done: ['Zrobione', 'text-bg-success', 'bi-check-circle-fill'], remake: ['Do poprawy', 'text-bg-warning', 'bi-exclamation-triangle-fill'],
};
export const JOB_STATUS_KEYS = ['to_do', 'in_progress', 'done', 'remake'];
const badgeHtml = (def) => (def ? `<span class="badge ${def[1]}"><i class="bi ${def[2]}" aria-hidden="true"></i>${esc(def[0])}</span>` : '');
export const quoteBadge = (q) => badgeHtml(QUOTE_STATUS[q.status]);
export const realBadge = (r) => badgeHtml(REAL_STATUS[r.status]);
export const jobBadge = (status) => badgeHtml(JOB_STATUS[status]);
export const AREA_LABELS = { floor: 'Podłoga (m²)', wall: 'Ściany (m²)', ceiling: 'Sufit (m²)', wall_ceiling: 'Ściany + sufit (m²)', perimeter: 'Obwód (mb)', manual: 'Ręcznie' };
export const AREA_BY_UNIT = { 'm²': ['floor', 'wall', 'ceiling', 'wall_ceiling'], mb: ['perimeter'] };
export const UNITS = ['m²', 'szt', 'mb', 'kg', 'l', 'h'];
export const PROFILES = { cheapest: 'Najtańszy', best_quality: 'Najlepsza jakość', fastest: 'Najszybszy', fewest_crews: 'Minimum ekip' };
export const PROFILE_ICONS = { cheapest: 'bi-piggy-bank', best_quality: 'bi-award', fastest: 'bi-lightning-charge', fewest_crews: 'bi-people' };
export const QUALITY = { 1: '1 - Bardzo niska', 2: '2 - Niska', 3: '3 - Poniżej przeciętnej', 4: '4 - Przeciętna-', 5: '5 - Przeciętna',
  6: '6 - Przeciętna+', 7: '7 - Dobra', 8: '8 - Bardzo dobra', 9: '9 - Doskonała', 10: '10 - Perfekcyjna' };
export const ROLES = { worker: 'Pracownik', accounting: 'Księgowość', admin: 'Administrator' };
export const SETTLEMENTS = { on_completion: 'Po odbiorze', installments: 'Raty w trakcie prac' };
export const DIMENSIONS = [['length', 'Długość (m)'], ['width', 'Szerokość (m)'], ['height', 'Wysokość (m)'], ['holes_area', 'Otwory (m²)']];
export const OVERRIDES = [['floor_area_override', 'Podłoga (m²)', 'floor'], ['ceiling_area_override', 'Sufit (m²)', 'ceiling'],
  ['wall_area_override', 'Ściany (m²)', 'wall'], ['perimeter_override', 'Obwód (mb)', 'perimeter']];

// ---------- dane: kit.json + zmiany prototypu w localStorage ----------
const KEY = 'ikpm-foldery:';
const MENU_KEY = `${KEY}menu`; // zwinięte menu na laptopie i PC — reset przywraca pełne
const TABLES = ['meta', 'clients', 'contractors', 'materials', 'stages', 'templates', 'quotes', 'realizations', 'users'];
export const db = {};
const stored = (t) => { try { const _v = localStorage.getItem(KEY + t); return _v ? JSON.parse(_v) : null; } catch { return null; } };
export function save(...tables) {
  for (const t of tables) {
    try { localStorage.setItem(KEY + t, JSON.stringify(db[t])); } catch (e) { console.warn('Nie zapisano', t, e); }
  }
}
export function resetDb() { for (const k of [...TABLES.map((t) => KEY + t), MENU_KEY]) { try { localStorage.removeItem(k); } catch { /* prywatne okno */ } } }
export function nextId() { db.meta.seq += 1; save('meta'); return db.meta.seq; }

export async function loadDb() {
  // Reset między uczestnikami badania: dowolny ekran z ?reset w adresie (jak w Kreatorze i Kosztorysie).
  if (new URLSearchParams(location.search).has('reset')) {
    resetDb();
    const _u = new URL(location.href); _u.searchParams.delete('reset'); history.replaceState(history.state, '', _u);
  }
  const kit = await (await fetch(`${ROOT}assets/kit.json`)).json();
  db.kit = kit;
  const _sent = kit.quotes.map((q) => q.sent_at).filter(Boolean).map((s) => date(s).split('.').reverse().join('-')).sort();
  db.seedDay = _sent.at(-1) ?? todayISO();
  db.meta = stored('meta') ?? { seq: 100000 };
  db.clients = stored('clients') ?? deriveClients(kit);
  db.contractors = stored('contractors') ?? deriveContractors(kit);
  db.materials = stored('materials') ?? kit.materials.map((m, i) => {
    const [_q, ..._u] = m.package.split(' ');
    return { id: i + 1, name: m.name, price: Number(m.price), quantity: parseNumber(_q), unit: _u.join(' ') || 'szt', link: '' };
  });
  db.stages = stored('stages') ?? kit.catalogue.map((s, i) => ({
    id: s.id, name: s.name, order: i + 1,
    jobs: s.jobs.map((j, k) => ({
      id: j.id, name: j.name, unit: j.unit, area_type: j.area_type, average_price: num(j.average_price),
      average_speed: num(j.average_speed), order: k + 1, description: '',
      materials: j.materials.map((m) => {
        const _same = db.materials.filter((x) => x.name === m.name);
        const _hit = _same.find((x) => x.price === Number(m.price) && materialPackage(x) === m.package.replace('.', ',')) ?? _same.find((x) => x.price === Number(m.price)) ?? _same[0];
        return { material_id: _hit?.id, quantity_per_unit: Number(m.quantity_per_unit) };
      }),
      crews: j.crews.map((c) => ({ contractor_id: contractorByName(c.contractor)?.id, price: num(c.price), speed_min: num(c.speed_min),
        speed_max: num(c.speed_max), quality: c.quality ?? null })),
    })),
  }));
  db.templates = stored('templates') ?? kit.room_templates.map((t, i) => ({
    id: i + 1, name: t.name, order: i + 1, description: clean(t.description) ?? '',
    length: num(t.length), width: num(t.width), height: num(t.height), holes_area: num(t.holes_area),
    jobs: t.jobs.map((j, k) => ({ job_id: allJobs().find((x) => x.name === j.name)?.id, order: k + 1, quantity: num(j.quantity) })).filter((j) => j.job_id),
  }));
  db.quotes = stored('quotes') ?? kit.quotes.map(prepQuote);
  db.realizations = stored('realizations') ?? kit.realizations.map(prepRealization);
  db.users = stored('users') ?? kit.users.map((u, i) => ({ id: i + 1, email: u.email, first_name: u.first_name ?? '', last_name: u.last_name ?? '',
    phone: '', roles: [...u.roles], active: u.active }));
  db.me = db.users[0];
}
function deriveClients(kit) {
  const _map = new Map();
  for (const x of [...kit.quotes, ...kit.realizations]) {
    if (x.client && !_map.has(x.client.name)) _map.set(x.client.name, { id: _map.size + 1, name: x.client.name, email: x.client.email ?? '', phone: x.client.phone ?? '', notes: '' });
  }
  return [..._map.values()];
}
function deriveContractors(kit) {
  const _map = new Map();
  for (const s of kit.catalogue) for (const j of s.jobs) for (const c of j.crews) {
    if (!_map.has(c.contractor)) _map.set(c.contractor, { id: _map.size + 1, name: c.contractor, email: '', phone: '', notes: '', max_parallel_jobs: c.max_parallel_jobs, archived: c.archived });
  }
  return [..._map.values()];
}
const clientByName = (name) => db.clients.find((c) => c.name === name);
const contractorByName = (name) => (name ? db.contractors.find((c) => c.name === name) : null);
function prepJob(j, frozen) {
  return {
    id: j.id, job_id: j.job_id, name: j.name, unit: j.unit, area_type: j.area_type, stage: j.stage, quantity: Number(j.quantity),
    contractor_id: contractorByName(j.contractor)?.id ?? null, contractor_price: num(j.contractor_price), average_price: num(j.average_price),
    material_unit_cost: frozen || j.contractor ? num(j.effective_material_unit_cost) : null,
  };
}
const ROOM_FIELDS = ['id', 'name', 'notes', 'client_comment', 'length', 'width', 'height', 'holes_area', 'floor_area_override',
  'ceiling_area_override', 'wall_area_override', 'perimeter_override'];
const prepRoomBase = (r) => Object.fromEntries(ROOM_FIELDS.map((f) => [f, ['id', 'name', 'notes', 'client_comment'].includes(f) ? (r[f] ?? null) : num(r[f])]));
function prepQuote(q) {
  const _frozen = q.status !== 'draft';
  return {
    id: q.id, notes: clean(q.notes) ?? '', status: q.status, client_id: q.client ? clientByName(q.client.name)?.id : null, user: q.user,
    markup_percent: Number(q.markup_percent), vat_rate: Number(q.vat_rate), site_address: q.site_address ?? '',
    planned_start_on: q.planned_start_on, planned_end_on: q.planned_end_on, suggested_work_days: q.suggested_work_days,
    applied_profile_name: q.applied_profile_name, client_general_comment: q.client_general_comment, sent_at: q.sent_at,
    responded_at: q.responded_at, created_on: null,
    link_valid_until: q.sent_at ? addDays(date(q.sent_at).split('.').reverse().join('-'), 30) : null,
    rooms: q.rooms.map((r) => ({
      ...prepRoomBase(r),
      jobs: r.jobs.map((j) => ({ ...prepJob(j, _frozen), matched_quantity: j.contractor ? Number(j.quantity) : null,
        typed: j.area_type !== 'manual' && Number(j.quantity) !== Number(j.default_quantity) })),
    })),
  };
}
function prepRealization(r) {
  return {
    id: r.id, quote_id: r.quote_id, status: r.status, settlement: r.settlement, client_id: clientByName(r.client?.name)?.id ?? null,
    markup_percent: Number(r.markup_percent), site_address: r.site_address ?? '', planned_start_on: r.planned_start_on,
    promised_end_on: r.promised_end_on, expected_end_on: r.expected_end_on, completed_on: r.status === 'done' ? r.end_on : null,
    total_price: Number(r.total_price), estimated_cost: Number(r.estimated_cost), link_valid_until: null,
    rooms: r.rooms.map((room) => ({
      ...prepRoomBase(room),
      jobs: room.jobs.map((j) => ({ ...prepJob(j, true), status: j.status, notes: j.notes ?? '', internal_notes: j.internal_notes ?? '',
        actual_contractor_price: num(j.actual_contractor_price), completed_on: j.status === 'done' ? db.seedDay : null })),
    })),
    photos: r.photos.map((p, i) => ({ id: i + 1, room_id: r.rooms.find((x) => x.name === p.room)?.id ?? null, client_visible: p.client_visible,
      filename: p.filename, src: null })),
  };
}
export const kitQuote = (id) => db.kit.quotes.find((q) => q.id === id);

// ---------- katalog ----------
export const allJobs = () => db.stages.flatMap((s) => s.jobs);
export const stagesSorted = () => [...db.stages].sort((a, b) => a.order - b.order || a.id - b.id);
export const catJob = (id) => allJobs().find((j) => j.id === id);
export const stageOfJob = (id) => db.stages.find((s) => s.jobs.some((j) => j.id === id));
export const material = (id) => db.materials.find((m) => m.id === id);
export const materialUnitPrice = (m) => (m && m.quantity ? m.price / m.quantity : 0);
export const materialPackage = (m) => `${measure(m.quantity)} ${m.unit}`;
export const jobMaterialCost = (job) => (job ? job.materials.reduce((s, x) => s + materialUnitPrice(material(x.material_id)) * x.quantity_per_unit, 0) : 0);
export const contractor = (id) => db.contractors.find((c) => c.id === id);
export const contractorName = (id) => contractor(id)?.name ?? '—';
export const client = (id) => db.clients.find((c) => c.id === id);
export const clientName = (x) => client(x?.client_id)?.name ?? '(brak klienta)';
export const crewEffectivePrice = (crew, job) => crew.price ?? job.average_price;
export const activeContractors = () => db.contractors.filter((c) => !c.archived).sort((a, b) => a.name.localeCompare(b.name, 'pl') || a.id - b.id);
export const clientsSorted = () => [...db.clients].sort((a, b) => a.name.localeCompare(b.name, 'pl') || a.id - b.id);

// ---------- pokój ----------
export const isIrregular = (room) => OVERRIDES.some(([f]) => room[f] !== null && room[f] !== undefined);
export const hasDimensions = (room) => (room.length ?? 0) > 0 && (room.width ?? 0) > 0;
export const areaText = (v) => `${dec(roundHalfUp(v))} m²`;
export function sizeParts(room) {
  const _parts = {};
  const _floor = areaFor(room, 'floor'); const _walls = areaFor(room, 'wall');
  if (!isIrregular(room) && hasDimensions(room)) {
    _parts.dimensions = `${measure(room.length)} × ${measure(room.width)}${room.height > 0 ? ` × ${measure(room.height)}` : ''} m`;
  }
  if (isIrregular(room) || hasDimensions(room)) {
    if (roundHalfUp(_floor) > 0) _parts.floor = `Podłoga: ${areaText(_floor)}`;
    if (roundHalfUp(_walls) > 0) _parts.walls = `Ściany: ${areaText(_walls)}`;
  }
  return _parts;
}
export const sizeLine = (room) => Object.values(sizeParts(room))[0] ?? '';
export const sizeAll = (room) => Object.values(sizeParts(room)).join(' · ');
const stageOrder = (name) => db.stages.find((s) => s.name === name)?.order ?? 99;
const jobOrder = (id) => catJob(id)?.order ?? 999;
export const sortJobs = (jobs) => [...jobs].sort((a, b) => stageOrder(a.stage) - stageOrder(b.stage) || jobOrder(a.job_id) - jobOrder(b.job_id) || a.job_id - b.job_id || a.id - b.id);
export function jobsByStage(jobs) {
  const _groups = [];
  for (const j of sortJobs(jobs)) {
    let _g = _groups.at(-1);
    if (!_g || _g.stage !== j.stage) { _g = { stage: j.stage, jobs: [] }; _groups.push(_g); }
    _g.jobs.push(j);
  }
  return _groups;
}

// ---------- wycena: kwoty (ikpm.js) ----------
export const effMaterial = (j) => j.material_unit_cost ?? jobMaterialCost(catJob(j.job_id));
export const liveAverage = (j) => catJob(j.job_id)?.average_price ?? j.average_price;
export const calcJob = (j) => ({ contractor_price: j.contractor_price, average_price: liveAverage(j), effective_material_unit_cost: effMaterial(j), quantity: j.quantity });
export const jobUnitPrice = (j, q) => clientUnitPrice(calcJob(j), q.markup_percent);
export const jobValue = (j, q) => lineTotal(calcJob(j), q.markup_percent);
export const jobLabor = (j) => laborUnitCost(calcJob(j));
export const qJobs = (q) => q.rooms.flatMap((r) => r.jobs);
export const totals = (q) => quoteTotals({ markup_percent: q.markup_percent, vat_rate: q.vat_rate, rooms: q.rooms.map((r) => ({ jobs: r.jobs.map(calcJob) })) });
export const netTotal = (q) => totals(q).net;
export const quoteCost = (q) => qJobs(q).reduce((s, j) => s + unitCost(calcJob(j)) * Number(j.quantity), 0);
export const roomTotal = (room, q) => roundHalfUp(room.jobs.reduce((s, j) => s + jobValue(j, q), 0));
export const marginOfMarkup = (m) => (Number(m) / (100 + Number(m))) * 100;
export const suggestedEnd = (q) => addWorkDays(q.planned_start_on, q.suggested_work_days);
export const quotesSorted = () => [...db.quotes].sort((a, b) => b.id - a.id);
export const quoteHref = (q) => (q.status === 'draft' ? link('builder', { id: q.id }) : link('quote-show', { id: q.id }));
export const realizationOf = (q) => db.realizations.find((r) => r.quote_id === q.id);
export const hasClientComments = (q) => !!q.client_general_comment || q.rooms.some((r) => r.client_comment);
export const nameList = (names) => {
  const _u = [...new Set(names)];
  return [_u.slice(0, 5).join(', '), _u.length > 5 ? `(+${_u.length - 5})` : ''].filter(Boolean).join(' ');
};
const sortedNames = (q, pred) => sortJobs(qJobs(q).filter(pred)).map((j) => j.name);
export const changedAfterMatching = (q) => sortedNames(q, (j) => j.matched_quantity != null && roundHalfUp(j.quantity) !== roundHalfUp(j.matched_quantity));
export function nextRoomName(q) {
  for (let _n = q.rooms.length + 1; ; _n += 1) { const _name = `Pokój ${_n}`; if (!q.rooms.some((r) => r.name === _name)) return _name; }
}

// ---------- komunikaty i okno potwierdzenia ----------
let flashArea;
const ensureFlash = () => {
  if (!flashArea) {
    flashArea = document.createElement('div'); flashArea.className = 'flash-area';
    flashArea.setAttribute('aria-live', 'polite'); document.body.append(flashArea);
  }
  return flashArea;
};
export function toast(message, { undo } = {}) {
  const _el = document.createElement('div'); _el.className = 'toast-ok'; _el.setAttribute('role', 'status');
  _el.innerHTML = `<i class="bi bi-check-circle-fill" aria-hidden="true"></i><span class="flex-grow-1">${esc(message)}</span>`;
  if (undo) {
    const _b = document.createElement('button'); _b.type = 'button'; _b.className = 'btn btn-sm btn-outline-dark'; _b.textContent = 'Cofnij';
    _b.addEventListener('click', () => { undo(); _el.remove(); }); _el.append(_b);
  }
  ensureFlash().append(_el);
  let _t;
  const _arm = () => { _t = setTimeout(() => _el.remove(), undo ? 7000 : 4000); };
  _el.addEventListener('mouseenter', () => clearTimeout(_t)); _el.addEventListener('focusin', () => clearTimeout(_t));
  _el.addEventListener('mouseleave', _arm); _el.addEventListener('focusout', _arm);
  _arm();
}
export function alertBox(message) {
  const _el = document.createElement('div'); _el.className = 'alert alert-danger alert-top'; _el.setAttribute('role', 'alert');
  _el.innerHTML = `<i class="bi bi-exclamation-octagon-fill mt-1" aria-hidden="true"></i><span class="flex-grow-1">${esc(message)}</span>
    <button type="button" class="btn-close" aria-label="Zamknij"></button>`;
  _el.querySelector('.btn-close').addEventListener('click', () => _el.remove());
  _el.querySelector('.btn-close').style.cssText = 'min-width:44px;min-height:44px;';
  ensureFlash().append(_el);
}
export function flashNext(type, message) { try { sessionStorage.setItem(`${KEY}flash`, JSON.stringify({ type, message })); } catch { /* bez pamięci */ } }
function showFlash() {
  let _f = null;
  try { _f = JSON.parse(sessionStorage.getItem(`${KEY}flash`) ?? 'null'); sessionStorage.removeItem(`${KEY}flash`); } catch { /* */ }
  if (_f) (_f.type === 'alert' ? alertBox : toast)(_f.message);
}
// Okno potwierdzenia ze skutkami (nie okno przeglądarki): Promise<boolean>.
export function confirmBox({ title, consequences = [], ok, okClass = 'btn-primary', cancel = 'Anuluj' }) {
  return new Promise((resolve) => {
    const _d = document.createElement('dialog'); _d.className = 'confirm'; _d.setAttribute('aria-labelledby', 'confirm-title');
    _d.innerHTML = `<form method="dialog"><div class="c-body"><h2 id="confirm-title" class="fw-bold">${esc(title)}</h2>
      ${consequences.length ? `<ul class="mb-1 ps-3">${consequences.map((c) => `<li class="mb-1">${esc(c)}</li>`).join('')}</ul>` : ''}</div>
      <div class="c-actions"><button value="cancel" class="btn btn-outline-secondary">${esc(cancel)}</button>
      <button value="ok" class="btn ${okClass}" data-confirm-ok>${esc(ok)}</button></div></form>`;
    document.body.append(_d);
    _d.addEventListener('close', () => { resolve(_d.returnValue === 'ok'); _d.remove(); });
    _d.showModal();
  });
}

// ---------- operacje na wycenie ----------
export function newQuote({ client_id, notes, mode }) {
  const _q = { id: Math.max(0, ...db.quotes.map((q) => q.id)) + 1, notes: notes ?? '', status: 'draft', client_id: client_id ?? null,
    user: db.me ? `${db.me.first_name} ${db.me.last_name}`.trim() : null, markup_percent: 20, vat_rate: 8, site_address: '',
    planned_start_on: null, planned_end_on: null, suggested_work_days: null, applied_profile_name: null, client_general_comment: null,
    sent_at: null, responded_at: null, created_on: todayISO(), link_valid_until: null, rooms: [] };
  _q.rooms.push(blankRoom(mode === 'simple' ? 'Cały obiekt' : 'Pokój 1', 0));
  db.quotes.push(_q); save('quotes');
  return _q;
}
export function blankRoom(name, height) {
  return { id: nextId(), name, notes: null, client_comment: null, length: 0, width: 0, height, holes_area: 0, floor_area_override: null,
    ceiling_area_override: null, wall_area_override: null, perimeter_override: null, jobs: [], default_height: height === 2.8 };
}
export function newRoomJob(cj, qty) {
  return { id: nextId(), job_id: cj.id, name: cj.name, unit: cj.unit, area_type: cj.area_type, stage: stageOfJob(cj.id)?.name,
    quantity: qty, contractor_id: null, contractor_price: null, average_price: cj.average_price, material_unit_cost: null,
    matched_quantity: null, typed: false };
}
// Pomiar pokoju zmieniony: przelicza tylko prace auto, których powierzchnia się zmieniła; wpisanej ilości nie rusza.
export function recalcRoom(room, before) {
  for (const j of room.jobs) {
    if (j.area_type === 'manual' || j.typed) continue;
    if (roundHalfUp(areaFor(before, j.area_type)) !== roundHalfUp(areaFor(room, j.area_type))) j.quantity = defaultQuantity(j, room);
  }
}
export const roomSnapshot = (room) => Object.fromEntries([...DIMENSIONS, ...OVERRIDES].map(([f]) => [f, room[f]]));
export function addJobToRoom(room, cj, qty) {
  if (room.jobs.some((j) => j.job_id === cj.id)) return null;
  const _j = newRoomJob(cj, qty ?? defaultQuantity(cj, room));
  room.jobs.push(_j);
  return _j;
}
// Szablon w pokoju (jak modal pokoju): wymiary tylko w puste pola pokoju, który przy otwarciu nie był zmierzony
// (fillDims); pracy ręcznej podnosi ilość tylko, gdy dodał ją szablon w tej wizycie (tplAdded — Set id prac).
export function applyTemplate(room, tpl, { fillDims = true, tplAdded = new Set() } = {}) {
  const _before = roomSnapshot(room);
  if (fillDims) {
    for (const [f] of DIMENSIONS) {
      const _empty = !room[f] || (f === 'height' && room.default_height);
      if (_empty && tpl[f]) room[f] = tpl[f];
    }
    if (tpl.height && room.default_height) room.default_height = false;
  }
  recalcRoom(room, _before);
  let _added = 0;
  for (const tj of tpl.jobs) {
    const _cj = catJob(tj.job_id); if (!_cj) continue;
    const _has = room.jobs.find((j) => j.job_id === _cj.id);
    if (_has) {
      if (_cj.area_type === 'manual' && tplAdded.has(_cj.id) && tj.quantity && tj.quantity > Number(_has.quantity)) _has.quantity = tj.quantity;
    } else {
      addJobToRoom(room, _cj, _cj.area_type === 'manual' ? (tj.quantity ?? 1) : undefined); tplAdded.add(_cj.id); _added += 1;
    }
  }
  return _added;
}
export function duplicateRoom(q, room) {
  const _copy = { ...JSON.parse(JSON.stringify(room)), id: nextId(), name: `${room.name} (kopia)`.slice(0, 100), client_comment: null };
  _copy.jobs = room.jobs.map((j) => ({ ...j, id: nextId(), contractor_id: null, contractor_price: null, material_unit_cost: null, matched_quantity: null }));
  q.rooms.splice(q.rooms.indexOf(room) + 1, 0, _copy);
  return _copy;
}
export function saveRoomAsTemplate(room, name) {
  const _name = (name || room.name).trim().replace(/\s+/g, ' ');
  if (db.templates.some((t) => t.name.trim().replace(/\s+/g, ' ').toLowerCase() === _name.toLowerCase())) {
    return { ok: false, error: 'Nie można zapisać szablonu: Szablon o tej nazwie już istnieje — zmień nazwę.' };
  }
  db.templates.push({ id: Math.max(0, ...db.templates.map((t) => t.id)) + 1, name: _name, order: db.templates.length + 1, description: '',
    length: room.length || null, width: room.width || null, height: room.height || null, holes_area: room.holes_area || null,
    jobs: sortJobs(room.jobs).map((j, i) => ({ job_id: j.job_id, order: i + 1, quantity: j.area_type === 'manual' ? Number(j.quantity) : null })) });
  save('templates');
  return { ok: true, notice: `Szablon '${_name}' został utworzony.` };
}
// Plany doboru z kitu (prawdziwy ContractorMatcher) — tylko dla stanu wyceny, który kit policzył.
const quoteSig = (q) => q.rooms.map((r) => `${r.id}:${r.jobs.map((j) => `${j.job_id}=${roundHalfUp(Number(j.quantity))}`).sort().join(',')}`).sort().join('|');
export function planSource(q) {
  const _kq = kitQuote(q.id); if (!_kq) return null;
  const _sig = quoteSig(q);
  if (_kq.matching_plans && _sig === quoteSig(_kq)) return { plans: _kq.matching_plans, after: _kq.after_matching };
  const _ac = _kq.after_change;
  if (_ac?.matching_plans && _sig === quoteSig(_ac)) return { plans: _ac.matching_plans, after: _ac.after_matching };
  return null;
}
export function applyPlan(q, profile) {
  const _src = planSource(q); const _after = _src?.after?.[profile];
  if (!_after) return { ok: false, error: 'Nieznany profil.' };
  for (const room of q.rooms) {
    const _ar = _after.rooms.find((r) => r.id === room.id);
    for (const j of room.jobs) {
      const _aj = _ar?.jobs.find((x) => x.job_id === j.job_id);
      const _crew = _aj?.contractor ? contractorByName(_aj.contractor) : null;
      j.contractor_id = _crew?.id ?? null;
      j.contractor_price = _crew ? num(_aj.contractor_price) : null;
      j.material_unit_cost = _crew ? num(_aj.effective_material_unit_cost) : null;
      j.matched_quantity = _crew ? j.quantity : null;
    }
  }
  q.applied_profile_name = profile;
  q.suggested_work_days = _after.suggested_work_days;
  save('quotes');
  const _unassigned = _src.plans[profile].summary.unassigned_job_names ?? [];
  return { ok: true, notice: `Zastosowano plan '${PROFILES[profile]}'.${_unassigned.length ? ` Bez wykonawcy (brak w cenniku ekipy z ceną): ${nameList(_unassigned)}.` : ''}` };
}
export function sendGate(q) {
  if (q.status !== 'draft') return 'Wysłać można tylko szkic — przywróć wycenę do edycji i wyślij ją ponownie.';
  const _c = client(q.client_id);
  if (!_c) return 'Wycena nie ma klienta — wybierz go przed wysłaniem.';
  if (!_c.email) return 'Klient nie ma adresu email — dodaj go w danych klienta.';
  const _jobs = qJobs(q);
  if (!_jobs.length) return 'Wycena nie ma żadnych prac — dodaj prace przed wysłaniem.';
  const _without = _jobs.filter((j) => !j.contractor_id).length;
  if (_without) {
    return `Nie wszystkie prace mają przypisanego wykonawcę (${_without} bez wykonawcy). Uruchom dobieranie wykonawców (plan zastąpi ręcznie wpisane ceny ekipy cenami z cennika); praca, która dalej zostaje bez wykonawcy, potrzebuje w cenniku ekipy z ceną.`;
  }
  const _archived = sortedNames(q, (j) => contractor(j.contractor_id)?.archived);
  if (_archived.length) return `Prace z wykonawcą z archiwum: ${nameList(_archived)}. Uruchom ponownie dobieranie wykonawców.`;
  const _changed = changedAfterMatching(q);
  if (_changed.length) {
    return `Prace ze zmienioną ilością po doborze wykonawców (także po zmianie wymiarów pokoju): ${nameList(_changed)}. Uruchom ponownie dobieranie wykonawców — plan zastąpi ręcznie wpisane ceny ekipy we wszystkich pracach cenami z cennika.`;
  }
  const _unpriced = sortedNames(q, (j) => !jobLabor(j));
  if (_unpriced.length) return `Prace bez ceny ekipy: ${nameList(_unpriced)}. Wpisz cenę w builderze albo średnią w cenniku prac.`;
  const _invalid = sortedNames(q, (j) => !(Number(j.quantity) > 0 && Number(j.quantity) <= 1e6));
  if (_invalid.length) return `Prace z błędnymi danymi (np. ilość 0): ${nameList(_invalid)}. Popraw je w builderze.`;
  if (!q.planned_end_on) return 'Wycena nie ma terminu zakończenia — wpisz go w builderze i kliknij „Zapisz”.';
  if (q.planned_end_on < todayISO()) return 'Termin zakończenia już minął — popraw go w builderze i kliknij „Zapisz”.';
  return null;
}
export function sendQuote(q) {
  for (const j of qJobs(q)) { j.contractor_price = jobLabor(j); j.material_unit_cost = effMaterial(j); }
  if (hasClientComments(q)) {
    const _lines = [`Uwagi klienta (przed wysyłką ${date(todayISO())}):`];
    if (q.client_general_comment) _lines.push(q.client_general_comment);
    for (const r of q.rooms) if (r.client_comment) _lines.push(`${r.name}: ${r.client_comment}`);
    q.notes = [q.notes || null, _lines.join('\n')].filter(Boolean).join('\n\n');
    q.client_general_comment = null; for (const r of q.rooms) r.client_comment = null;
  }
  q.status = 'sent'; q.sent_at = new Date().toISOString(); q.responded_at = null; q.link_valid_until = addDays(todayISO(), 30);
  save('quotes');
  return `Wycena wysłana do ${client(q.client_id).email}.`;
}
export function reopenQuote(q) {
  if (q.status === 'draft') return { ok: false, error: 'Wycena jest już szkicem — możesz ją edytować.' };
  if (realizationOf(q)) return { ok: false, error: 'Z tej wyceny powstała już realizacja — nie można jej przywrócić do edycji.' };
  q.status = 'draft'; q.sent_at = null; q.responded_at = null; save('quotes');
  return { ok: true, notice: 'Wycena przywrócona do edycji — link klienta pokaże ją dopiero po ponownej wysyłce.' };
}
export function copyQuote(q) {
  const _copy = newQuote({ client_id: q.client_id, notes: '', mode: 'rooms' });
  _copy.markup_percent = q.markup_percent; _copy.vat_rate = q.vat_rate;
  _copy.rooms = q.rooms.map((r) => ({ ...JSON.parse(JSON.stringify(r)), id: nextId(), client_comment: null,
    jobs: r.jobs.map((j) => ({ ...j, id: nextId(), contractor_id: null, contractor_price: null, material_unit_cost: null, matched_quantity: null })) }));
  save('quotes');
  return { quote: _copy, notice: `Utworzono kopię wyceny #${q.id}. Ceny są z aktualnego cennika — dobierz wykonawców i uzupełnij termin oferty.` };
}
export function convertToRealization(q) {
  if (q.status !== 'accepted') return { ok: false, error: 'W realizację można przekształcić tylko zaakceptowaną wycenę.' };
  if (!q.client_id) return { ok: false, error: 'Wycena nie ma przypisanego klienta — realizacja wymaga klienta.' };
  if (realizationOf(q)) return { ok: false, error: 'Ta wycena ma już realizację.' };
  const _t = totals(q);
  const _r = { id: Math.max(0, ...db.realizations.map((r) => r.id)) + 1, quote_id: q.id, status: 'planned', settlement: 'on_completion',
    client_id: q.client_id, markup_percent: q.markup_percent, site_address: q.site_address, planned_start_on: q.planned_start_on,
    promised_end_on: q.planned_end_on, expected_end_on: q.planned_end_on, completed_on: null, total_price: _t.net,
    estimated_cost: quoteCost(q), link_valid_until: addDays(todayISO(), 30), photos: [],
    rooms: q.rooms.map((r) => ({ ...JSON.parse(JSON.stringify(r)), id: nextId(), client_comment: null,
      jobs: r.jobs.map((j) => ({ ...j, id: nextId(), contractor_price: jobLabor(j), material_unit_cost: effMaterial(j), status: 'to_do',
        notes: '', internal_notes: '', actual_contractor_price: null, completed_on: null })) })) };
  db.realizations.push(_r); save('realizations');
  return { ok: true, realization: _r, notice: 'Utworzono realizację z wyceny.' };
}

// ---------- realizacja ----------
export const rJobs = (r) => r.rooms.flatMap((room) => room.jobs);
export const isActive = (r) => ['planned', 'in_progress'].includes(r.status);
export const progressOf = (jobs) => {
  const _all = jobs.length; const _done = jobs.filter((j) => j.status === 'done').length;
  return { all: _all, done: _done, pct: _all ? Math.floor((_done * 100) / _all) : 0 };
};
export const unfinishedCount = (r) => rJobs(r).filter((j) => j.status !== 'done').length;
export const realJobValue = (j, r) => lineTotal(calcJob(j), r.markup_percent);
export const actualLabor = (j) => j.actual_contractor_price ?? jobLabor(j);
export const realCost = (r) => rJobs(r).reduce((s, j) => s + (actualLabor(j) + effMaterial(j)) * Number(j.quantity), 0);
export const statusCounts = (jobs) => JOB_STATUS_KEYS.map((k) => [k, jobs.filter((j) => j.status === k).length]).filter(([, n]) => n);
export function setJobStatus(r, j, status) {
  if (!isActive(r)) return 'Status nie może się zmienić po zakończeniu lub anulowaniu realizacji';
  j.status = status;
  if (status === 'done' && !j.completed_on) j.completed_on = todayISO();
  save('realizations');
  return null;
}
export function bulkStatus(r, jobs, status) {
  if (!isActive(r)) return { ok: false, error: 'Status nie może się zmienić po zakończeniu lub anulowaniu realizacji' };
  let _updated = 0; let _skipped = 0;
  for (const j of sortJobs(jobs)) {
    if (status === 'done' && j.status === 'remake') { _skipped += 1; continue; }
    j.status = status; if (status === 'done' && !j.completed_on) j.completed_on = todayISO(); _updated += 1;
  }
  save('realizations');
  return { ok: true, notice: `Zaktualizowano ${jobsAcc(_updated)}${_skipped ? `, pominięto ${jobsAcc(_skipped)} „Do poprawy” — sprawdź pojedynczo` : ''}.` };
}
const CATALOGUE_ROUND = (v) => Math.max(1, Math.round(Math.round(v * 1e6) / 1e6));
export function transition(r, to) {
  const _allowed = { planned: ['in_progress', 'cancelled'], in_progress: ['done', 'cancelled'] };
  if (!(_allowed[r.status] ?? []).includes(to)) return { ok: false, error: `Nie można zmienić statusu realizacji na „${REAL_STATUS[to][0]}”.` };
  let _learned = [];
  if (to === 'done') {
    const _n = unfinishedCount(r);
    if (_n) return { ok: false, error: `Nie można zakończyć realizacji. ${unfinishedText(_n)} — wszystkie prace muszą mieć status „Zrobione”.` };
    _learned = learnFromRealization(r);
    r.completed_on = todayISO();
  }
  r.status = to; save('realizations');
  return { ok: true, notice: `Status realizacji zaktualizowany.${_learned.length ? ` Zaktualizowano cennik: ${nameList(_learned)}.` : ''}` };
}
// Nauka cennika (10.4): cena = (cena teraz + stawka faktyczna ważona ilością) / 2, pełne złote, najmniej 1 zł.
function learnFromRealization(r) {
  const _byJob = new Map();
  for (const j of sortJobs(rJobs(r)).filter((x) => x.actual_contractor_price)) {
    const _e = _byJob.get(j.job_id) ?? { name: j.name, qty: 0, sum: 0, crews: new Map() };
    _e.qty += Number(j.quantity); _e.sum += j.actual_contractor_price * Number(j.quantity);
    if (j.contractor_id) { const _c = _e.crews.get(j.contractor_id) ?? { qty: 0, sum: 0 }; _c.qty += Number(j.quantity); _c.sum += j.actual_contractor_price * Number(j.quantity); _e.crews.set(j.contractor_id, _c); }
    _byJob.set(j.job_id, _e);
  }
  const _changed = [];
  for (const [jobId, e] of _byJob) {
    const _cj = catJob(jobId); if (!_cj) continue;
    const _rate = e.sum / e.qty; let _any = false;
    const _avg = _cj.average_price == null ? CATALOGUE_ROUND(_rate) : CATALOGUE_ROUND((_cj.average_price + _rate) / 2);
    for (const [cid, c] of e.crews) {
      const _crew = _cj.crews.find((x) => x.contractor_id === cid); if (!_crew) continue;
      const _now = crewEffectivePrice(_crew, _cj); const _new = _now == null ? CATALOGUE_ROUND(c.sum / c.qty) : CATALOGUE_ROUND((_now + c.sum / c.qty) / 2);
      if (_crew.price == null && _new === _avg) continue; // bez własnej ceny — idzie za nową średnią
      if (_new !== _now) { _crew.price = _new; _any = true; }
    }
    if (_avg !== _cj.average_price) { _cj.average_price = _avg; _any = true; }
    if (_any) _changed.push(e.name);
  }
  if (_changed.length) save('stages');
  return _changed;
}

// ---------- szkielet: menu boczne i dolne zakładki ----------
const NAV = [
  [null, [['start', 'Start', 'bi-house']]],
  ['Wyceny', [['quotes-index', 'Lista wycen', 'bi-file-earmark-text'], ['quotes-new-rooms', 'Nowa wycena (pokoje)', 'bi-plus-square', 'quotes-new', { mode: 'rooms' }],
    ['quotes-new-simple', 'Nowa wycena (prosta)', 'bi-plus-lg', 'quotes-new', { mode: 'simple' }], ['clients', 'Klienci', 'bi-people']]],
  ['Realizacje', [['realizations-index', 'Lista realizacji', 'bi-cone-striped']]],
  ['Dane', [['stages', 'Prace', 'bi-list-task'], ['materials', 'Materiały', 'bi-box-seam'], ['contractors', 'Wykonawcy', 'bi-person-badge'],
    ['room-templates', 'Szablony pokoi', 'bi-grid-1x2']]],
  ['Finanse', [['finance-result', 'Wynik', 'bi-graph-up', 'finance', { raport: 'wynik' }], ['finance-costs', 'Koszty', 'bi-bar-chart', 'finance', { raport: 'koszty' }],
    ['finance-real', 'Realizacje', 'bi-clipboard-data', 'finance', { raport: 'realizacje' }], ['finance-offers', 'Oferty', 'bi-file-earmark-bar-graph', 'finance', { raport: 'oferty' }],
    ['finance-crews', 'Wykonawcy', 'bi-people', 'finance', { raport: 'wykonawcy' }]]],
  ['Administracja', [['users', 'Użytkownicy', 'bi-person-gear']]],
];
const TABS = [['wyceny', 'Wyceny', 'bi-file-earmark-text', 'quotes-index'], ['realizacje', 'Realizacje', 'bi-cone-striped', 'realizations-index'],
  ['dane', 'Dane', 'bi-database', 'data'], ['wiecej', 'Więcej', 'bi-three-dots', 'more']];
const RAIL = [['start', 'Start', 'bi-house', 'start'], ...TABS];
function renderShell() {
  const _b = document.body;
  let _nav = _b.dataset.nav;
  if (_nav === 'quotes-new') _nav = param('mode') === 'simple' ? 'quotes-new-simple' : 'quotes-new-rooms';
  if (_nav === 'finance') _nav = { koszty: 'finance-costs', realizacje: 'finance-real', oferty: 'finance-offers', wykonawcy: 'finance-crews' }[param('raport')] ?? 'finance-result';
  const _tab = _b.dataset.tab;
  const _cur = (on) => (on ? ' aria-current="page"' : '');
  const _full = NAV.map(([section, items]) => `${section ? `<li><p class="nav-section">${section}</p></li>` : ''}${items.map(([key, label, icon, screen, p]) =>
    `<li><a href="${link(screen ?? key, p)}"${_cur(key === _nav)}><i class="bi ${icon}" aria-hidden="true"></i>${label}</a></li>`).join('')}`).join('');
  const _me = db.me;
  const _side = document.createElement('nav'); _side.className = 'side'; _side.setAttribute('aria-label', 'Menu główne');
  _side.innerHTML = `<div class="nav-brand"><a href="${link('start')}"><strong>IKPM</strong><span class="small text-body-secondary nav-brand-sub">System kosztorysów</span></a></div>
    <button type="button" class="nav-toggle"></button>
    <ul class="nav-rail">${RAIL.map(([key, label, icon, screen]) => `<li><a href="${link(screen)}"${_cur(key === _tab)}><i class="bi ${icon}" aria-hidden="true"></i>${label}</a></li>`).join('')}</ul>
    <ul class="nav-full">${_full}<li><p class="nav-section">Konto</p></li><li><div class="nav-user">${esc(_me?.email)}</div></li>
      <li><a href="${link('profile')}"${_cur(_nav === 'profile')}><i class="bi bi-person-circle" aria-hidden="true"></i>Mój profil</a></li>
      <li><a href="${link('login')}"><i class="bi bi-box-arrow-right" aria-hidden="true"></i>Wyloguj się</a></li></ul>`;
  // Od 1200 px menu da się zwinąć do wąskiego paska jak na tablecie (więcej miejsca na kolumny); stan zostaje między ekranami.
  const _toggle = _side.querySelector('.nav-toggle');
  const _paint = () => {
    const _c = _b.classList.contains('menu-collapsed');
    _toggle.setAttribute('aria-expanded', String(!_c));
    _toggle.innerHTML = `<i class="bi ${_c ? 'bi-chevron-double-right' : 'bi-chevron-double-left'}" aria-hidden="true"></i>${_c ? 'Rozwiń menu' : 'Zwiń menu'}`;
  };
  try { _b.classList.toggle('menu-collapsed', localStorage.getItem(MENU_KEY) === 'collapsed'); } catch { /* prywatne okno */ }
  _toggle.addEventListener('click', () => {
    const _c = _b.classList.toggle('menu-collapsed');
    try { localStorage.setItem(MENU_KEY, _c ? 'collapsed' : 'open'); } catch { /* prywatne okno */ }
    _paint();
  });
  _paint();
  const _tabs = document.createElement('nav'); _tabs.className = 'tabbar'; _tabs.setAttribute('aria-label', 'Zakładki');
  _tabs.innerHTML = TABS.map(([key, label, icon, screen]) => `<a href="${link(screen)}"${_cur(key === _tab)}><i class="bi ${icon}" aria-hidden="true"></i>${label}</a>`).join('');
  const _main = document.querySelector('main');
  const _app = document.createElement('div'); _app.className = 'app';
  _main.classList.add('main'); _main.id = 'main';
  _main.before(_app); _app.append(_side, _main);
  _b.prepend(Object.assign(document.createElement('a'), { className: 'skip-link', href: '#main', textContent: 'Przejdź do treści' }));
  _b.append(_tabs);
}

// ---------- wspólne kolumny (wstawiane do [data-partial] przed startem Alpine) ----------
const back = (href, label, extra = '') => `<a class="back-link ${extra}" href="${href}"><i class="bi bi-chevron-left" aria-hidden="true"></i>${label}</a>`;
const PARTIALS = {
  'quote-list': () => `
    <div class="pane-inner">
      <div class="pane-head">${back(link('start'), 'Start', 'back-only-phone')}<h1 class="pane-title">Wyceny</h1></div>
      <div class="group">
        <a class="row-link" :href="link('quotes-new', {mode: 'rooms'})"><span class="row-icon"><i class="bi bi-plus-square" aria-hidden="true"></i></span><span class="row-main row-add">Nowa wycena (pokoje)</span></a>
        <a class="row-link" :href="link('quotes-new', {mode: 'simple'})"><span class="row-icon"><i class="bi bi-plus-lg" aria-hidden="true"></i></span><span class="row-main row-add">Nowa wycena (prosta)</span></a>
        <a class="row-link" :href="link('clients')"><span class="row-icon"><i class="bi bi-people" aria-hidden="true"></i></span><span class="row-main">Klienci</span><i class="bi bi-chevron-right chev" aria-hidden="true"></i></a>
      </div>
      <h2 class="group-title">Lista wycen</h2>
      <p x-show="!db.quotes.length" class="text-body-secondary">Brak wycen. Utwórz pierwszą wycenę.</p>
      <ul class="group">
        <template x-for="lq in quotesSorted()" :key="lq.id">
          <li><a class="row-link" :href="quoteHref(lq)" :aria-current="lq.id === currentQuoteId ? 'page' : null">
            <span class="row-main"><div class="fw-semibold">Wycena #<span x-text="lq.id"></span></div>
              <div x-text="clientName(lq)"></div><div class="small text-body-secondary" x-text="lq.site_address"></div></span>
            <span class="row-end"><span x-html="quoteBadge(lq)"></span><div class="small mt-1" x-text="pln(netTotal(lq))"></div></span>
          </a></li>
        </template>
      </ul>
    </div>`,
  'quote-folder': () => `
    <div class="pane-inner" x-show="q">
      <div class="pane-head">${back(link('quotes-index'), 'Wyceny')}
        <h1 class="pane-title">Wycena #<span x-text="q.id"></span></h1>
        <div class="d-flex flex-wrap gap-2 align-items-center"><span x-html="quoteBadge(q)"></span><span class="pane-sub" x-text="clientName(q)"></span></div>
        <div class="small text-body-secondary" x-show="q.site_address" x-text="q.site_address"></div>
      </div>
      <template x-if="hasClientComments(q)">
        <div class="alert alert-warning" role="note"><div class="fw-bold"><i class="bi bi-chat-left-text" aria-hidden="true"></i> Uwagi klienta</div>
          <div x-text="q.client_general_comment || '(brak komentarza ogólnego — sprawdź komentarze przy pokojach)'"></div>
          <template x-for="cr in q.rooms.filter(r => r.client_comment)" :key="cr.id"><div class="mt-1"><a class="alert-link" :href="link('builder', {id: q.id, room: cr.id})" x-text="cr.name"></a>: <span x-text="cr.client_comment"></span></div></template>
        </div>
      </template>
      <div class="card-plain sum-sticky" aria-label="Podsumowanie wyceny" role="group">
        <div class="d-flex justify-content-between align-items-baseline"><span class="fw-semibold">Suma:</span><span class="fs-4 fw-bold" data-total-net x-text="pln(totals(liveQ()).net)"></span></div>
        <div class="d-flex justify-content-between small"><span>Brutto:</span><span x-text="pln(totals(liveQ()).gross)"></span></div>
      </div>
      <div class="card-plain mt-2">
        <div class="d-flex justify-content-between small"><span>Prace: <b x-text="qJobs(q).length"></b> · Pokoje: <b x-text="q.rooms.length"></b></span></div>
        <div class="d-flex justify-content-between small"><span>Koszt:</span><b x-text="pln(quoteCost(liveQ()))"></b></div>
        <div class="d-flex justify-content-between small"><span>Marża:</span><b x-text="pln(totals(liveQ()).net - quoteCost(liveQ()))"></b></div>
        <div class="row g-2 mt-1">
          <div class="col-6"><label class="form-label small mb-1" for="qf-markup">Narzut:</label>
            <div class="input-group"><input id="qf-markup" class="form-control" type="number" inputmode="decimal" min="0" max="1000" step="0.01" :value="q.markup_percent" :disabled="q.status !== 'draft'" @change="setMarkup($event.target)"><span class="input-group-text">%</span></div>
            <div class="small text-body-secondary" title="Marża jako % ceny dla klienta — wynika z narzutu" x-text="'marża ' + dec(marginOfMarkup(q.markup_percent)) + '%'"></div></div>
          <div class="col-6"><label class="form-label small mb-1" for="qf-vat">VAT:</label>
            <select id="qf-vat" class="form-select" :disabled="q.status !== 'draft'" @change="q.vat_rate = Number($event.target.value); saveQuote('Wycena zaktualizowana.')">
              <option value="8" :selected="Number(q.vat_rate) === 8">8%</option><option value="23" :selected="Number(q.vat_rate) === 23">23%</option></select></div>
        </div>
      </div>
      <h2 class="group-title">Pokoje</h2>
      <ul class="group">
        <li><a class="row-link" :href="link('builder', {id: q.id, view: 'all'})" :aria-current="view === 'all' ? 'page' : null">
          <span class="row-icon"><i class="bi bi-collection" aria-hidden="true"></i></span><span class="row-main">Wszystkie prace</span>
          <span class="row-end small" x-text="jobsNom(qJobs(q).length)"></span><i class="bi bi-chevron-right chev" aria-hidden="true"></i></a></li>
        <template x-for="fr in q.rooms" :key="fr.id">
          <li><a class="row-link" :href="link('builder', {id: q.id, room: fr.id})" :aria-current="room && room.id === fr.id ? 'page' : null">
            <span class="row-icon"><i class="bi bi-door-open" aria-hidden="true"></i></span>
            <span class="row-main"><div class="fw-semibold"><span x-text="fr.name"></span>
              <template x-if="fr.client_comment"><span class="badge text-bg-warning ms-1"><i class="bi bi-chat-left-text" aria-hidden="true"></i>Komentarz klienta</span></template></div>
              <div class="small text-body-secondary" x-text="[sizeLine(fr), jobsNom(fr.jobs.length)].filter(Boolean).join(' · ')"></div></span>
            <span class="row-end small fw-semibold" x-text="pln(roomTotal(liveRoomOf(fr), q))"></span><i class="bi bi-chevron-right chev" aria-hidden="true"></i></a></li>
        </template>
        <li x-show="q.status === 'draft'"><button type="button" class="row-link row-add" @click="addRoomAndOpen()"><span class="row-icon"><i class="bi bi-plus-lg" aria-hidden="true"></i></span>Dodaj pokój</button></li>
      </ul>
      <h2 class="group-title">Wycena</h2>
      <ul class="group">
        <li><a class="row-link" :href="link('builder', {id: q.id, view: 'client'})" :aria-current="view === 'client' ? 'page' : null"><span class="row-icon"><i class="bi bi-person" aria-hidden="true"></i></span>
          <span class="row-main">Klient<div class="small text-body-secondary" x-text="client(q.client_id)?.name ?? 'Wybierz klienta'"></div></span><i class="bi bi-chevron-right chev" aria-hidden="true"></i></a></li>
        <li><a class="row-link" :href="link('builder', {id: q.id, view: 'term'})" :aria-current="view === 'term' ? 'page' : null"><span class="row-icon"><i class="bi bi-calendar-event" aria-hidden="true"></i></span>
          <span class="row-main">Termin i adres<div class="small" :class="q.planned_end_on ? 'text-body-secondary' : 'text-danger-emphasis fw-semibold'" x-text="q.planned_end_on ? 'Termin: ' + date(q.planned_end_on) : 'brak terminu zakończenia'"></div></span><i class="bi bi-chevron-right chev" aria-hidden="true"></i></a></li>
        <li><a class="row-link" :href="link('builder', {id: q.id, view: 'notes'})" :aria-current="view === 'notes' ? 'page' : null"><span class="row-icon"><i class="bi bi-journal-text" aria-hidden="true"></i></span>
          <span class="row-main">Notatki <span class="small text-body-secondary">(klient ich nie widzi)</span><div class="small text-body-secondary text-truncate" x-text="q.notes"></div></span><i class="bi bi-chevron-right chev" aria-hidden="true"></i></a></li>
        <li><a class="row-link" :href="link('match-contractors', {id: q.id})" :aria-current="screen === 'match-contractors' ? 'page' : null"><span class="row-icon"><i class="bi bi-people" aria-hidden="true"></i></span>
          <span class="row-main">Dobierz wykonawców
            <div class="small text-body-secondary" x-text="q.applied_profile_name ? 'Plan: ' + PROFILES[q.applied_profile_name] : 'bez wykonawców'"></div>
            <div class="small text-danger-emphasis fw-semibold" x-show="changedAfterMatching(q).length"><i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i> Uruchom ponownie dobieranie wykonawców</div></span><i class="bi bi-chevron-right chev" aria-hidden="true"></i></a></li>
        <li><a class="row-link" :href="link('quote-show', {id: q.id})"><span class="row-icon"><i class="bi bi-eye" aria-hidden="true"></i></span><span class="row-main">Podgląd</span><i class="bi bi-chevron-right chev" aria-hidden="true"></i></a></li>
        <li><a class="row-link" :href="link('quote-pdf', {id: q.id})" target="_blank" rel="noopener"><span class="row-icon"><i class="bi bi-file-earmark-pdf" aria-hidden="true"></i></span><span class="row-main">PDF<div class="small text-body-secondary"><i class="bi bi-eye" aria-hidden="true"></i> widzi klient — załącznik maila z ofertą</div></span><i class="bi bi-box-arrow-up-right chev" aria-hidden="true"></i></a></li>
      </ul>
      <div class="d-grid gap-2 mt-3">
        <button type="button" class="btn btn-primary btn-main" @click="trySend()"><i class="bi bi-send" aria-hidden="true"></i> Wyślij do klienta</button>
        <div class="d-flex gap-2">
          <button type="button" class="btn btn-outline-secondary flex-fill" @click="doCopy()"><i class="bi bi-copy" aria-hidden="true"></i> Kopiuj</button>
          <button type="button" class="btn btn-outline-danger flex-fill" @click="doDeleteQuote()"><i class="bi bi-trash" aria-hidden="true"></i> Usuń</button>
        </div>
      </div>
    </div>`,
  'realization-list': () => `
    <div class="pane-inner">
      <div class="pane-head">${back(link('start'), 'Start', 'back-only-phone')}<h1 class="pane-title">Realizacje</h1></div>
      <p x-show="!db.realizations.length" class="text-body-secondary">Brak realizacji — przekształć zaakceptowaną wycenę na jej stronie (przycisk „Przekształć w realizację").</p>
      <ul class="group">
        <template x-for="lr in realizationsSorted()" :key="lr.id">
          <li><a class="row-link" :href="link('realization-show', {id: lr.id})" :aria-current="lr.id === currentRealizationId ? 'page' : null">
            <span class="row-main"><div class="fw-semibold">Realizacja #<span x-text="lr.id"></span></div><div x-text="clientName(lr)"></div>
              <div class="small text-body-secondary" x-text="lr.site_address"></div>
              <div class="progress mini-progress mt-1" role="progressbar" :aria-label="'Postęp prac realizacji #' + lr.id" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="progressOf(rJobs(lr)).pct">
                <div class="progress-bar bg-success" :style="'width:' + progressOf(rJobs(lr)).pct + '%'"></div></div></span>
            <span class="row-end"><span x-html="realBadge(lr)"></span><div class="small mt-1" x-text="progressOf(rJobs(lr)).pct + '%'"></div>
              <div class="small" :class="endDelayed(lr) && 'text-danger-emphasis fw-semibold'" x-text="date(lr.status === 'done' ? lr.completed_on : (lr.expected_end_on || lr.promised_end_on))"></div></span>
          </a></li>
        </template>
      </ul>
    </div>`,
  'client-list': () => `
    <div class="pane-inner">
      <div class="pane-head">${back(link('quotes-index'), 'Wyceny', 'back-only-phone')}<h1 class="pane-title">Klienci</h1></div>
      <div class="group"><a class="row-link row-add" :href="link('client-form')"><span class="row-icon"><i class="bi bi-plus-lg" aria-hidden="true"></i></span>Nowy klient</a></div>
      <h2 class="group-title">Lista klientów</h2>
      <ul class="group">
        <template x-for="lc in clientsSorted()" :key="lc.id">
          <li><a class="row-link" :href="link('client-show', {id: lc.id})" :aria-current="lc.id === currentClientId ? 'page' : null">
            <span class="row-main"><div class="fw-semibold" x-text="lc.name"></div><div class="small text-body-secondary" x-text="lc.email || '—'"></div></span>
            <span class="row-end small"><div x-text="'Wyceny: ' + db.quotes.filter(x => x.client_id === lc.id).length"></div><div x-text="'Realizacje: ' + db.realizations.filter(x => x.client_id === lc.id).length"></div></span>
            <i class="bi bi-chevron-right chev" aria-hidden="true"></i></a></li>
        </template>
      </ul>
    </div>`,
  'user-list': () => `
    <div class="pane-inner">
      <div class="pane-head">${back(link('more'), 'Więcej', 'back-only-phone')}<h1 class="pane-title">Użytkownicy</h1></div>
      <div class="group"><a class="row-link row-add" :href="link('user-form')"><span class="row-icon"><i class="bi bi-plus-lg" aria-hidden="true"></i></span>Dodaj użytkownika</a></div>
      <h2 class="group-title">Konta</h2>
      <ul class="group">
        <template x-for="lu in db.users" :key="lu.id">
          <li><a class="row-link" :href="link('user-form', {id: lu.id})" :aria-current="lu.id === currentUserId ? 'page' : null">
            <span class="row-main"><div class="fw-semibold overflow-anywhere"><span x-text="lu.email"></span>
              <span x-show="!lu.active" class="badge text-bg-danger ms-1"><i class="bi bi-slash-circle" aria-hidden="true"></i>Nieaktywne</span></div>
              <div class="small" x-text="[lu.first_name, lu.last_name].join(' ').trim() || '—'"></div>
              <div class="small text-body-secondary" x-text="lu.roles.length ? lu.roles.map(r => ROLES[r]).join(', ') : 'brak'"></div></span>
            <i class="bi bi-chevron-right chev" aria-hidden="true"></i></a></li>
        </template>
      </ul>
    </div>`,
};

// ---------- akcje wyceny (edytor, dobór, podgląd) ----------
export function quoteOps() {
  return {
    q: null,
    savedKey: null,
    markSaved(key) {
      this.savedKey = key; this.announce('Zapisano');
      clearTimeout(this.savedTimer); this.savedTimer = setTimeout(() => { this.savedKey = null; }, 2500);
    },
    saveQuote(message) { save('quotes'); if (message) toast(message); },
    setMarkup(el) {
      const _v = this.readNumber(el);
      if (!(_v >= 0)) { alertBox(_v === null ? 'Narzut nie może być pusty' : 'Narzut musi być większy lub równy 0'); el.value = this.q.markup_percent; return; }
      if (_v > 1000) { alertBox('Narzut musi być mniejszy lub równy 1000'); el.value = this.q.markup_percent; return; }
      this.q.markup_percent = roundHalfUp(_v); el.value = this.q.markup_percent; this.saveQuote('Wycena zaktualizowana.');
    },
    addRoomAndOpen() {
      const _r = blankRoom(nextRoomName(this.q), 2.8);
      this.q.rooms.push(_r); save('quotes');
      flashNext('notice', `Pokój '${_r.name}' utworzony.`); go('builder', { id: this.q.id, room: _r.id });
    },
    async trySend() {
      const _error = sendGate(this.q);
      if (_error) { alertBox(_error); return; }
      const _c = client(this.q.client_id);
      const _ok = await confirmBox({
        title: `Wysłać wycenę do ${_c.email}? Termin zakończenia: ${date(this.q.planned_end_on)}.${hasClientComments(this.q) ? ' Uwagi klienta trafią do notatek wyceny.' : ''}`,
        consequences: [`Klient dostanie e-mail z PDF (wycena-${this.q.id}.pdf) i linkiem do oferty, ważnym 30 dni.`,
          'Ceny prac zostaną zamrożone — oferta nie zmieni się razem z cennikiem.',
          'Wycena przestanie być szkicem: zmienić ją można tylko przez „Przywróć do edycji” i ponowną wysyłkę.'],
        ok: 'Wyślij do klienta',
      });
      if (!_ok) return;
      flashNext('notice', sendQuote(this.q)); go('quote-show', { id: this.q.id });
    },
    doCopy() { const _r = copyQuote(this.q); flashNext('notice', _r.notice); go('builder', { id: _r.quote.id }); },
    async doDeleteQuote() {
      const _ok = await confirmBox({ title: `Usunąć wycenę #${this.q.id}?`, consequences: ['Wycena zniknie razem z pokojami i pracami — tego nie da się cofnąć.'],
        ok: 'Usuń', okClass: 'btn-danger' });
      if (!_ok) return;
      db.quotes.splice(db.quotes.indexOf(this.q), 1); save('quotes');
      flashNext('notice', 'Wycena usunięta.'); go('quotes-index');
    },
    async doReopen() {
      const _ok = await confirmBox({
        title: `Przywrócić wycenę do edycji? Link klienta przestanie pokazywać ofertę do ponownej wysyłki.${this.q.status === 'accepted' ? ' Akceptacja klienta zostanie anulowana.' : ''}`,
        consequences: ['Wycena wróci do statusu „Szkic” — znowu da się zmieniać pokoje, prace, dobór i termin.',
          'Klient pod linkiem zobaczy „Oferta jest aktualizowana” aż do ponownej wysyłki.',
          'Uwagi klienta zostają przy wycenie; przy wysyłce trafią do notatek.'],
        ok: 'Przywróć do edycji',
      });
      if (!_ok) return;
      const _r = reopenQuote(this.q);
      if (!_r.ok) { alertBox(_r.error); return; }
      flashNext('notice', _r.notice); go('builder', { id: this.q.id });
    },
    async doConvert() {
      const _ok = await confirmBox({ title: 'Przekształcić tę wycenę w realizację?',
        consequences: ['Pokoje i prace zostaną skopiowane do realizacji z zamrożonymi cenami.',
          'Zacznie działać link klienta do postępu prac (/r), ważny 30 dni.', 'Tej wyceny nie będzie można już przywrócić do edycji.'],
        ok: 'Przekształć w realizację' });
      if (!_ok) return;
      const _r = convertToRealization(this.q);
      if (!_r.ok) { alertBox(_r.error); return; }
      flashNext('notice', _r.notice); go('realization-show', { id: _r.realization.id });
    },
  };
}

// ---------- wspólne metody stron (Alpine) ----------
const EXPORTS = {
  link, param, intParam, go, pln, dec, measure, pct1, hoursText, date, dateTime, todayISO, addDays, jobsNom, jobsAcc, jobsGen, workDaysText,
  unfinishedText, esc, fold, quoteBadge, realBadge, jobBadge, QUOTE_STATUS, REAL_STATUS, JOB_STATUS, JOB_STATUS_KEYS, CLIENT_STATUS,
  AREA_LABELS, AREA_BY_UNIT, UNITS, PROFILES, PROFILE_ICONS, QUALITY, ROLES, SETTLEMENTS, DIMENSIONS, OVERRIDES, allJobs, stagesSorted,
  catJob, stageOfJob, material, materialUnitPrice, materialPackage, jobMaterialCost, contractor, contractorName, client, clientName,
  clientsSorted, activeContractors, crewEffectivePrice, isIrregular, hasDimensions, areaText, sizeParts, sizeLine, sizeAll, sortJobs,
  jobsByStage, effMaterial, liveAverage, calcJob, jobUnitPrice, jobValue, jobLabor, qJobs, totals, netTotal, quoteCost, roomTotal,
  marginOfMarkup, suggestedEnd, quotesSorted, quoteHref, realizationOf, hasClientComments, changedAfterMatching, rJobs, isActive,
  progressOf, unfinishedCount, realJobValue, actualLabor, realCost, statusCounts, areaFor, defaultQuantity, roundHalfUp, parseNumber,
  toast, alertBox, flashNext, confirmBox, nameList, num,
};
export function base() {
  return {
    ...EXPORTS,
    db,
    screen: document.body.dataset.screen,
    currentQuoteId: null, currentRealizationId: null, currentClientId: null, currentUserId: null,
    // Wycena / pokój z wartościami wpisywanymi, jeszcze nie zapisanymi (edytor pokoju nadpisuje).
    liveQ() { return this.q; },
    liveRoomOf(room) { return room; },
    realizationsSorted() { return [...db.realizations].sort((a, b) => b.id - a.id); },
    endDelayed(r) { return r.status === 'in_progress' && r.promised_end_on && (r.expected_end_on || r.promised_end_on) > r.promised_end_on; },
    // Zapis pola liczbowego: tekst z przecinkiem albo kropką → liczba (NaN = błąd).
    readNumber(el) { if (el.validity && el.validity.badInput) return NaN; return el.value === '' ? null : parseNumber(el.value); },
    announce(text) { const _r = document.getElementById('live-region'); if (_r) { _r.textContent = ''; setTimeout(() => { _r.textContent = text; }, 30); } },
  };
}
const merge = (...objs) => objs.reduce((t, o) => Object.defineProperties(t, Object.getOwnPropertyDescriptors(o)), {});

// ---------- start strony ----------
export async function boot(factory = () => ({}), { shell = true } = {}) {
  try { await loadDb(); } catch (e) { console.error(e); document.body.insertAdjacentHTML('afterbegin', '<div class="alert alert-danger m-3" role="alert">Wystąpił błąd — spróbuj ponownie za chwilę</div>'); return; }
  if (shell) renderShell();
  const _inject = (root) => {
    root.querySelectorAll('[data-partial]').forEach((el) => { el.innerHTML = PARTIALS[el.dataset.partial](); });
    root.querySelectorAll('template').forEach((t) => _inject(t.content));
  };
  _inject(document);
  const _live = document.createElement('div'); _live.id = 'live-region'; _live.className = 'visually-hidden'; _live.setAttribute('aria-live', 'polite');
  document.body.append(_live);
  document.addEventListener('alpine:init', () => { window.Alpine.data('page', () => merge(base(), factory())); });
  // Kolumna listy na tablecie / laptopie przewija się do otwartej pozycji.
  document.addEventListener('alpine:initialized', () => setTimeout(() => {
    document.querySelectorAll('.pane-list, .pane-folder').forEach((pane) => {
      const _cur = pane.querySelector('[aria-current]');
      if (_cur && pane.scrollHeight > pane.clientHeight) pane.scrollTop = Math.max(0, _cur.offsetTop - pane.clientHeight / 3);
    });
  }, 0));
  const _s = document.createElement('script'); _s.src = `${ROOT}assets/alpine.min.js`; document.head.append(_s);
  showFlash();
  // Strona z pamięci przeglądarki („Wstecz”) albo zmiana w innej karcie — dane od nowa, żeby zapis nie cofnął nowszych zmian.
  addEventListener('pageshow', (e) => { if (e.persisted) location.reload(); });
  addEventListener('storage', (e) => { if (e.key?.startsWith(KEY)) location.reload(); });
  guardDecimalComma();
}
// WebKit z regionem innym niż Polska bierze przecinek w polu liczbowym za separator tysięcy („4,25” → 425).
// Gdy po wpisanym przecinku wartość nie ma części ułamkowej, wstawia kropkę w miejscu przecinka.
function guardDecimalComma() {
  const _num = (el) => el instanceof HTMLInputElement && el.type === 'number';
  document.addEventListener('keydown', (e) => {
    if (e.key === ',' && _num(e.target) && !e.target.value.includes('.')) e.target.dataset.commaAt = e.target.value;
  }, true);
  document.addEventListener('input', (e) => {
    const el = e.target; if (!_num(el) || el.dataset.commaAt === undefined) return;
    const _at = el.dataset.commaAt;
    if (el.value === _at) return; // sam przecinek — czekamy na cyfrę
    delete el.dataset.commaAt;
    if (!el.value.includes('.') && el.value.startsWith(_at) && /^\d+$/.test(el.value.slice(_at.length))) {
      el.value = `${_at}.${el.value.slice(_at.length)}`; el.dataset.commaFixed = '1';
    }
  }, true);
  // Po wpisaniu wartości skryptem WebKit nie wysyła „change” przy wyjściu z pola — wysyłamy je sami.
  document.addEventListener('change', (e) => { if (_num(e.target)) delete e.target.dataset.commaFixed; }, true);
  document.addEventListener('focusout', (e) => {
    const el = e.target;
    if (_num(el) && el.dataset.commaFixed) { delete el.dataset.commaFixed; el.dispatchEvent(new Event('change', { bubbles: true })); }
  }, true);
}
