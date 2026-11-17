// Wariant „Kosztorys” — wspólny kod ekranów: dane z kit.json (stan zmian w localStorage), obliczenia z ikpm.js,
// menu, komunikaty, okno potwierdzenia. Ekran: <body data-nav="…"> i boot(() => ({ …komponent Alpine… })).
// Reset danych prototypu: dowolny ekran z ?reset w adresie.
import * as K from './ikpm.js';

export const ROOT = new URL('../', import.meta.url).href;
export const href = (path) => ROOT + path;
const KEY = 'ikpm-kosztorys-v1';
let kit;
export let db;
export const param = (name) => new URLSearchParams(location.search).get(name);
export const idParam = (fallback) => Number(param('id') || fallback);

// ---------- formaty ----------
const PLURAL = new Intl.PluralRules('pl-PL');
const MEASURE = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 });
const ONE_DECIMAL = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: 'always' });
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const plural = (n, one, few, many) => `${n} ${{ one, few }[PLURAL.select(n)] ?? many}`;
const date = (iso) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '—');
const pad = (n) => String(n).padStart(2, '0');
export const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const nowISO = () => { const d = new Date(); return `${todayISO()}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`; };
const addDays = (iso, days) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + days); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

// Sugerowany termin: N dni roboczych od startu (start w weekend → poniedziałek = dzień 1; bez świąt) — Quote#suggested_end_on.
const suggestedEnd = (start, days) => {
  if (!start || !days) return null;
  const d = new Date(`${start}T12:00:00`);
  while ([0, 6].includes(d.getDay())) d.setDate(d.getDate() + 1);
  for (let left = days - 1; left > 0;) { d.setDate(d.getDate() + 1); if (![0, 6].includes(d.getDay())) left -= 1; }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const QUOTE_STATUS = { draft: ['secondary', 'pencil-square'], sent: ['info', 'send'], changes_requested: ['warning', 'chat-left-text'], accepted: ['success', 'check-circle'], rejected: ['danger', 'x-circle'] };
const REAL_STATUS = { planned: ['secondary', 'calendar-event'], in_progress: ['info', 'play-circle'], done: ['success', 'check-circle'], cancelled: ['danger', 'x-octagon'] };
const JOB_STATUS = { to_do: ['secondary', 'circle'], in_progress: ['info', 'hourglass-split'], done: ['success', 'check-circle-fill'], remake: ['warning', 'exclamation-triangle-fill'] };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const badgeHTML = (map, labels, key) => (map[key] ? `<span class="badge text-bg-${map[key][0]}"><i class="bi bi-${map[key][1]}" aria-hidden="true"></i> ${esc(labels[key])}</span>` : '');

// ---------- pokój ----------
const roomSizeParts = (room) => {
  const parts = {};
  const [l, w, h] = [num(room.length) || 0, num(room.width) || 0, num(room.height) || 0];
  const irregular = ['floor_area_override', 'ceiling_area_override', 'wall_area_override', 'perimeter_override'].some((f) => num(room[f]) !== null);
  if (!irregular && l > 0 && w > 0) parts.dimensions = `${[l, w, h].filter((x) => x > 0).map((x) => MEASURE.format(x)).join(' × ')} m`;
  const floor = K.floorArea(room); const walls = K.wallArea(room);
  if (floor > 0) parts.floor = `Podłoga: ${K.formatDecimal(floor)} m²`;
  if (walls > 0) parts.walls = `Ściany: ${K.formatDecimal(walls)} m²`;
  return parts;
};
const irregular = (room) => ['floor_area_override', 'ceiling_area_override', 'wall_area_override', 'perimeter_override'].some((f) => num(room[f]) !== null);

// ---------- wycena ----------
const jobsOf = (q) => q.rooms.flatMap((r) => r.jobs);
const quoteCost = (q) => jobsOf(q).reduce((s, j) => s + K.unitCost(j) * Number(j.quantity), 0);
const roomTotal = (room, markup) => K.roundHalfUp(room.jobs.reduce((s, j) => s + K.lineTotal(j, markup), 0));
const marginPercent = (markup) => (Number(markup) / (100 + Number(markup))) * 100;
const nextRoomName = (q) => { let n = q.rooms.length + 1; while (q.rooms.some((r) => r.name === `Pokój ${n}`)) n += 1; return `Pokój ${n}`; };
const jobNames = (names) => { const u = [...new Set(names)]; return u.slice(0, 5).join(', ') + (u.length > 5 ? ` (+${u.length - 5})` : ''); };

// ---------- katalog ----------
let catIndex = null;
const catJobs = () => {
  if (!catIndex) {
    catIndex = { byId: new Map(), byName: new Map(), order: new Map() };
    db.catalogue.forEach((s, si) => s.jobs.forEach((j, ji) => {
      catIndex.byId.set(j.id, { stage: s, job: j }); catIndex.byName.set(j.name, { stage: s, job: j });
      catIndex.order.set(j.id, (s.order ?? si) * 10000 + (j.order ?? ji));
    }));
  }
  return catIndex;
};
export const resetCatIndex = () => { catIndex = null; };
const sortJobs = (jobs) => [...jobs].sort((a, b) => (catJobs().order.get(a.job_id) ?? 1e9) - (catJobs().order.get(b.job_id) ?? 1e9) || a.id - b.id);
// Prace pokoju pogrupowane po etapach (kolejność cennika): [{ stage, jobs }].
const byStage = (jobs) => {
  const groups = [];
  sortJobs(jobs).forEach((j) => { const last = groups[groups.length - 1]; if (last && last.stage === j.stage) last.jobs.push(j); else groups.push({ stage: j.stage, jobs: [j] }); });
  return groups;
};
const materialUnitCost = (catJob) => String(catJob.materials.reduce((s, m) => s + Number(m.unit_price) * Number(m.quantity_per_unit), 0));
// Materiał zmieniony na /materials albo zmianą cen o % — te same dane w pracach cennika i ich koszt materiałów.
const syncMaterial = (m, oldName, oldPackage) => db.catalogue.forEach((s) => s.jobs.forEach((j) => j.materials.forEach((x) => {
  if (x.name !== oldName || x.package !== oldPackage) return;
  Object.assign(x, { name: m.name, package: m.package, price: m.price, unit_price: m.unit_price });
  j.material_unit_cost = materialUnitCost(j);
})));
const packageOf = (quantity, unit) => `${MEASURE.format(Number(quantity))} ${unit}`;

// Nowa praca w pokoju: ilość z pomiarów (ręczna — 1), cena ekipy i koszt materiałów żywe z cennika.
const newJobLine = (catJob, stageName, room) => ({
  id: nextId('job'), job_id: catJob.id, name: catJob.name, unit: catJob.unit, area_type: catJob.area_type,
  area_type_label: catJob.area_type_label, stage: stageName, quantity: K.defaultQuantity(catJob, room), contractor: null,
  contractor_price: null, average_price: catJob.average_price, effective_material_unit_cost: catJob.material_unit_cost,
  typed: false, matched_quantity: null,
});
// Po zmianie pomiarów: prace liczone z wymiarów dostają nową ilość, wpisana ręcznie zostaje.
const recalcRoom = (room) => room.jobs.forEach((j) => {
  if (j.area_type !== 'manual' && !j.typed) j.quantity = K.defaultQuantity(j, room);
});

// Szablon: wymiary tylko w puste pola, prace, których pokój nie ma, ilość pracy ręcznej najwyżej z szablonu.
const applyTemplate = (room, tpl) => {
  ['length', 'width', 'height', 'holes_area'].forEach((f) => {
    const empty = !num(room[f]) || (f === 'height' && room._defaultHeight);
    if (empty && num(tpl[f]) !== null) room[f] = Number(tpl[f]);
  });
  room._defaultHeight = false;
  let added = 0;
  tpl.jobs.forEach((tj) => {
    const found = catJobs().byName.get(tj.name);
    if (!found) return;
    const existing = room.jobs.find((j) => j.job_id === found.job.id);
    const tq = num(tj.quantity);
    if (existing) { if (existing.area_type === 'manual' && tq && tq > Number(existing.quantity)) existing.quantity = tq; return; }
    const line = newJobLine(found.job, found.stage.name, room);
    if (found.job.area_type === 'manual' && tq) line.quantity = tq;
    room.jobs.push(line); added += 1;
  });
  recalcRoom(room);
  return added;
};

// ---------- dobór wykonawców (plany z kitu) ----------
// Plan z kitu pasuje tylko do wyceny w stanie, dla którego policzyła go aplikacja: te same prace i te same ilości.
const kitPlanState = (q) => { const kq = kit.quotes.find((x) => x.id === q.id); const base = kq?.after_change ?? kq; return base?.matching_plans ? base : null; };
const jobsSignature = (rooms) => rooms.flatMap((r) => r.jobs).map((j) => `${j.id}:${Number(j.quantity)}`).sort().join();
const plansFor = (q) => {
  const base = kitPlanState(q);
  return base && jobsSignature(base.rooms) === jobsSignature(q.rooms) ? { plans: base.matching_plans, after: base.after_matching } : null;
};
const hasKitPlans = (q) => !!kitPlanState(q);
const applyPlan = (q, profile) => {
  const src = plansFor(q);
  const after = src.after[profile];
  const byId = new Map(after.rooms.flatMap((r) => r.jobs).map((j) => [j.id, j]));
  jobsOf(q).forEach((j) => {
    const s = byId.get(j.id);
    if (s && s.contractor) {
      Object.assign(j, { contractor: s.contractor, contractor_price: s.contractor_price, effective_material_unit_cost: s.effective_material_unit_cost, matched_quantity: Number(j.quantity) });
    } else {
      const cat = catJobs().byId.get(j.job_id);
      Object.assign(j, { contractor: null, contractor_price: null, effective_material_unit_cost: cat ? cat.job.material_unit_cost : j.effective_material_unit_cost, matched_quantity: null });
    }
  });
  q.applied_profile_name = profile;
  q.suggested_work_days = src.plans[profile].work_days;
  save();
  return src.plans[profile];
};

// Bramki „Wyślij do klienta” (Quote::Send) — pierwszy błąd albo null.
const sendError = (q) => {
  const jobs = jobsOf(q);
  if (q.status !== 'draft') return 'Wysłać można tylko szkic — przywróć wycenę do edycji i wyślij ją ponownie.';
  if (!q.client) return 'Wycena nie ma klienta — wybierz go przed wysłaniem.';
  if (!q.client.email) return 'Klient nie ma adresu email — dodaj go w danych klienta.';
  if (!jobs.length) return 'Wycena nie ma żadnych prac — dodaj prace przed wysłaniem.';
  const without = jobs.filter((j) => !j.contractor).length;
  if (without) return `Nie wszystkie prace mają przypisanego wykonawcę (${without} bez wykonawcy). Uruchom dobieranie wykonawców (plan zastąpi ręcznie wpisane ceny ekipy cenami z cennika); praca, która dalej zostaje bez wykonawcy, potrzebuje w cenniku ekipy z ceną.`;
  const archived = sortJobs(jobs).filter((j) => db.contractors.find((c) => c.name === j.contractor)?.archived);
  if (archived.length) return `Prace z wykonawcą z archiwum: ${jobNames(archived.map((j) => j.name))}. Uruchom ponownie dobieranie wykonawców.`;
  const changed = sortJobs(jobs).filter((j) => j.matched_quantity !== null && j.matched_quantity !== undefined && Number(j.matched_quantity) !== Number(j.quantity));
  if (changed.length) return `Prace ze zmienioną ilością po doborze wykonawców (także po zmianie wymiarów pokoju): ${jobNames(changed.map((j) => j.name))}. Uruchom ponownie dobieranie wykonawców — plan zastąpi ręcznie wpisane ceny ekipy we wszystkich pracach cenami z cennika.`;
  const unpriced = sortJobs(jobs).filter((j) => K.laborUnitCost(j) <= 0);
  if (unpriced.length) return `Prace bez ceny ekipy: ${jobNames(unpriced.map((j) => j.name))}. Wpisz cenę w builderze albo średnią w cenniku prac.`;
  const invalid = sortJobs(jobs).filter((j) => !(Number(j.quantity) > 0));
  if (invalid.length) return `Prace z błędnymi danymi (np. ilość 0): ${jobNames(invalid.map((j) => j.name))}. Popraw je w builderze.`;
  // Termin zapisuje się od razu po zmianie pola (bez „Zapisz”) — komunikaty wskazują pole.
  if (!q.planned_end_on) return `Wycena nie ma terminu zakończenia — wpisz go w polu „Termin zakończenia” u góry wyceny${q.suggested_work_days && q.planned_start_on ? ' albo kliknij „Użyj” przy sugerowanym terminie' : ''}.`;
  if (q.planned_end_on < todayISO()) return 'Termin zakończenia już minął — popraw go w polu „Termin zakończenia” u góry wyceny.';
  return null;
};
const clientComments = (q) => !!(q.client_general_comment || q.rooms.some((r) => r.client_comment));
// Wysyłka: zamrożenie cen, uwagi klienta do notatek, status „Wysłana”, link na 30 dni.
const sendQuote = (q) => {
  jobsOf(q).forEach((j) => { j.contractor_price = String(K.laborUnitCost(j)); });
  if (clientComments(q)) {
    const lines = [`Uwagi klienta (przed wysyłką ${date(todayISO())}):`];
    if (q.client_general_comment) lines.push(q.client_general_comment);
    q.rooms.filter((r) => r.client_comment).forEach((r) => lines.push(`${r.name}: ${r.client_comment}`));
    q.notes = [q.notes, lines.join('\n')].filter(Boolean).join('\n\n');
    q.client_general_comment = null; q.rooms.forEach((r) => { r.client_comment = null; });
  }
  Object.assign(q, { status: 'sent', sent_at: nowISO(), responded_at: null, link_valid_until: addDays(todayISO(), 30) });
  save();
};
const realizationOf = (q) => db.realizations.find((r) => r.quote_id === q.id);

// ---------- realizacja ----------
const realJobs = (r) => r.rooms.flatMap((x) => x.jobs);
const realCost = (r) => realJobs(r).reduce((s, j) => s + (Number(j.actual_contractor_price ?? j.contractor_price ?? j.average_price ?? 0) + Number(j.effective_material_unit_cost ?? 0)) * Number(j.quantity), 0);
const realActive = (r) => ['planned', 'in_progress'].includes(r.status);
const doneCount = (r) => realJobs(r).filter((j) => j.status === 'done').length;
const progress = (r) => { const all = realJobs(r).length; return all ? Math.floor((doneCount(r) / all) * 100) : 0; };
const currentEnd = (r) => r.expected_end_on || r.promised_end_on;
const endOn = (r) => (r.status === 'done' ? (r.completed_on || r.end_on) : currentEnd(r));
const delayed = (r) => r.status === 'in_progress' && r.promised_end_on && currentEnd(r) > r.promised_end_on;
const setJobStatus = (job, status) => { job.status = status; if (status === 'done' && !job.completed_at) job.completed_at = todayISO(); };

// ---------- stan ----------
const untag = (s) => (typeof s === 'string' ? s.replace(/\s*\[DEMO\]$/, '') : s);
const clone = (o) => JSON.parse(JSON.stringify(o));
const maxId = (list) => list.reduce((m, x) => Math.max(m, x.id || 0), 0);
const parsePackage = (pkg) => { const i = pkg.indexOf(' '); return { quantity: K.parseNumber(pkg.slice(0, i)), unit: pkg.slice(i + 1) }; };

function initialState() {
  const clients = new Map();
  [...kit.quotes, ...kit.realizations].forEach((x) => { if (x.client && !clients.has(x.client.name)) clients.set(x.client.name, { ...x.client, notes: '' }); });
  const crews = new Map();
  kit.catalogue.forEach((s) => s.jobs.forEach((j) => j.crews.forEach((c) => {
    if (!crews.has(c.contractor)) crews.set(c.contractor, { name: c.contractor, archived: c.archived, max_parallel_jobs: c.max_parallel_jobs, email: '', phone: '', notes: '' });
  })));
  const quotes = kit.quotes.map((kq) => {
    const q = clone(kq);
    ['matching_plans', 'after_matching', 'after_change', 'totals', 'total_fields'].forEach((k) => delete q[k]);
    q.notes = untag(q.notes);
    q.link_valid_until = q.sent_at ? addDays(q.sent_at.slice(0, 10), 30) : null;
    q.rooms.forEach((r) => r.jobs.forEach((j) => {
      j.typed = j.area_type !== 'manual' && Number(j.quantity) !== Number(j.default_quantity);
      j.matched_quantity = j.contractor ? Number(j.quantity) : null;
    }));
    return q;
  });
  const realizations = clone(kit.realizations).map((r) => ({ ...r, photos: r.photos.map((p, i) => ({ ...p, id: i + 1, src: null })) }));
  let photoId = 0;
  realizations.forEach((r) => r.photos.forEach((p) => { photoId += 1; p.id = photoId; }));
  const allRooms = [...kit.quotes, ...kit.realizations].flatMap((x) => x.rooms);
  return {
    v: 1,
    quotes,
    realizations,
    catalogue: kit.catalogue.map((s, si) => ({ ...clone(s), order: si + 1, jobs: s.jobs.map((j, ji) => ({ ...clone(j), order: ji + 1, description: '' })) })),
    materials: kit.materials.map((m, i) => ({ id: i + 1, ...m, ...parsePackage(m.package), link: '' })),
    templates: kit.room_templates.map((t, i) => ({ id: i + 1, ...clone(t), description: untag(t.description), order: i + 1, jobs: t.jobs.map((j, ji) => ({ ...j, order: ji + 1 })) })),
    clients: [...clients.values()].sort((a, b) => a.name.localeCompare(b.name, 'pl')).map((c, i) => ({ id: i + 1, ...c })),
    contractors: [...crews.values()].sort((a, b) => a.name.localeCompare(b.name, 'pl')).map((c, i) => ({ id: i + 1, ...c })),
    users: kit.users.map((u, i) => ({ id: i + 1, phone: '', ...clone(u) })),
    seq: {
      quote: maxId(kit.quotes), real: maxId(kit.realizations), room: maxId(allRooms),
      job: maxId(allRooms.flatMap((r) => r.jobs)), catJob: maxId(kit.catalogue.flatMap((s) => s.jobs)), stage: maxId(kit.catalogue),
      photo: photoId, client: clients.size, contractor: crews.size, template: kit.room_templates.length, material: kit.materials.length, user: kit.users.length,
    },
  };
}
export const nextId = (key) => { db.seq[key] += 1; return db.seq[key]; };

let saveTimer;
const flush = () => { clearTimeout(saveTimer); if (!db) return; try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* pełny localStorage — prototyp działa dalej w pamięci */ } };
export const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 150); window.dispatchEvent(new CustomEvent('ikpm-saved')); };
addEventListener('pagehide', flush);

// Szkice: cena ekipy bez własnej ceny i koszt materiałów pracy bez wykonawcy są żywe z cennika (Model cen) —
// zmiana w „Dane” albo nauka cennika zmienia je przy następnym otwarciu ekranu.
const followCatalogue = (state) => {
  const cat = new Map(state.catalogue.flatMap((s) => s.jobs).map((j) => [j.id, j]));
  state.quotes.filter((q) => q.status === 'draft').forEach((q) => jobsOf(q).forEach((line) => {
    const c = cat.get(line.job_id);
    if (!c) return;
    if (line.contractor_price === null) line.average_price = c.average_price;
    if (!line.contractor) line.effective_material_unit_cost = c.material_unit_cost;
  }));
  return state;
};

async function load() {
  if (param('reset') !== null) {
    try { localStorage.removeItem(KEY); } catch (e) { /* brak dostępu */ }
    // Bez ?reset w adresie: Wstecz albo odświeżenie nie kasuje postępu uczestnika.
    const u = new URL(location.href); u.searchParams.delete('reset');
    history.replaceState(history.state, '', u.pathname + u.search + u.hash);
  }
  kit = await (await fetch(href('assets/kit.json'))).json();
  let state = null;
  try { state = JSON.parse(localStorage.getItem(KEY)); } catch (e) { state = null; }
  return followCatalogue(state?.v === 1 ? state : initialState());
}

// ---------- komunikaty ----------
export const flash = (text, kind = 'success') => { try { sessionStorage.setItem('ikpm-flash', JSON.stringify({ text, kind })); } catch (e) { /* brak */ } };
// replace — przekierowanie strażnika (bez nowego wpisu w historii: Wstecz nie wraca w pętli na ten sam ekran).
export const go = (path, text, kind, replace = false) => { if (text) flash(text, kind); flush(); location[replace ? 'replace' : 'assign'](href(path)); };

// Na dole ekranu, nad przyklejonym paskiem sum — nie zasłania przyklejonego nagłówka pokoju.
const placeToast = (box) => { box.style.bottom = `${(document.querySelector('.doc-bar')?.offsetHeight ?? 0) + 12}px`; };

export function toast(text, undo) {
  let box = document.getElementById('toast-box');
  if (!box) {
    box = document.createElement('div'); box.id = 'toast-box'; box.className = 'toast-box'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); document.body.append(box);
    // Pasek sum zawija się do dwóch wierszy (np. po „Zapisano”) — komunikat idzie w górę razem z nim.
    const bar = document.querySelector('.doc-bar'); if (bar) new ResizeObserver(() => placeToast(box)).observe(bar);
  }
  box.innerHTML = '';
  const el = document.createElement('div');
  el.className = 'alert alert-success shadow d-flex align-items-center gap-2 mb-0 py-2';
  el.innerHTML = '<i class="bi bi-check-circle-fill" aria-hidden="true"></i><span class="flex-grow-1"></span>';
  el.querySelector('span').textContent = text;
  if (undo) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-sm btn-outline-success'; b.textContent = 'Cofnij';
    b.addEventListener('click', () => { undo(); el.remove(); });
    el.append(b);
  }
  box.append(el);
  placeToast(box);
  let left = 4000; let started = Date.now(); let timer = setTimeout(() => el.remove(), left);
  const pause = () => { clearTimeout(timer); left -= Date.now() - started; };
  const resume = () => { started = Date.now(); timer = setTimeout(() => el.remove(), Math.max(left, 1000)); };
  el.addEventListener('mouseenter', pause); el.addEventListener('mouseleave', resume);
  el.addEventListener('focusin', pause); el.addEventListener('focusout', resume);
}

export function alertError(text) {
  let box = document.getElementById('alerts');
  if (!box) { box = document.createElement('div'); box.id = 'alerts'; document.querySelector('main')?.prepend(box); }
  box.innerHTML = '';
  const el = document.createElement('div');
  el.className = 'alert alert-danger d-flex align-items-start gap-2 my-3';
  el.setAttribute('role', 'alert');
  el.innerHTML = '<i class="bi bi-exclamation-octagon-fill mt-1" aria-hidden="true"></i><div class="flex-grow-1"></div><button type="button" class="btn-close" aria-label="Zamknij"></button>';
  el.querySelector('div').textContent = text;
  el.querySelector('button').addEventListener('click', () => el.remove());
  box.append(el);
  el.scrollIntoView({ block: 'center' });
}

// Okno potwierdzenia ze skutkami (zamiast okna przeglądarki): Promise<true|false>.
export function ask({ title, text = '', points = [], ok, okClass = 'primary', cancel = 'Wróć' }) {
  return new Promise((resolve) => {
    let d = document.getElementById('confirm-dialog');
    if (!d) { d = document.createElement('dialog'); d.id = 'confirm-dialog'; d.className = 'confirm-dialog shadow'; d.setAttribute('aria-labelledby', 'confirm-title'); document.body.append(d); }
    d.innerHTML = `<form method="dialog" class="p-3 p-md-4"><h2 id="confirm-title" class="h5 mb-3"></h2><p class="confirm-text mb-2"></p>
      <div class="confirm-points"><p class="fw-semibold small mb-1">Po potwierdzeniu:</p><ul class="small mb-0"></ul></div>
      <div class="d-flex flex-wrap gap-2 justify-content-end mt-4"><button value="cancel" class="btn btn-outline-secondary btn-main"></button>
      <button value="ok" class="btn btn-${okClass} btn-main"></button></div></form>`;
    d.querySelector('h2').textContent = title;
    d.querySelector('.confirm-text').textContent = text;
    if (!text) d.querySelector('.confirm-text').remove();
    if (points.length) points.forEach((p) => { const li = document.createElement('li'); li.textContent = p; d.querySelector('ul').append(li); });
    else d.querySelector('.confirm-points').remove();
    d.querySelector('[value=cancel]').textContent = cancel;
    d.querySelector('[value=ok]').textContent = ok;
    d.returnValue = '';
    d.addEventListener('close', () => resolve(d.returnValue === 'ok'), { once: true });
    d.showModal();
    d.querySelector('[value=ok]').focus();
  });
}

// ---------- menu ----------
const NAV = [
  ['start', 'index.html', 'house', 'Start', ''],
  ['quotes', 'screens/quotes-index.html', 'file-earmark-text', 'Wyceny', ''],
  ['clients', 'screens/clients.html', 'person-vcard', 'Klienci', 'wide'],
  ['realizations', 'screens/realizations-index.html', 'hammer', 'Realizacje', ''],
  ['data', 'screens/stages.html', 'table', 'Dane', ''],
  ['finance', 'screens/finance.html', 'graph-up', 'Finanse', 'wide'],
  ['users', 'screens/users.html', 'people', 'Użytkownicy', 'wide'],
];
const cur = (on) => (on ? ' aria-current="page"' : '');
function navHTML(active, user) {
  const link = ([key, path, icon, label, kind]) => `<a href="${href(path)}" class="${kind === 'wide' ? 'nav-wide' : ''}"${cur(key === active)}><i class="bi bi-${icon}" aria-hidden="true"></i><span>${label}</span></a>`;
  const moreKeys = ['clients', 'finance', 'users', 'profile'];
  const more = NAV.filter((n) => n[4] === 'wide').map(([key, path, icon, label]) => `<a href="${href(path)}" class="dropdown-item d-flex align-items-center gap-2"${cur(key === active)}><i class="bi bi-${icon}" aria-hidden="true"></i>${label}</a>`).join('');
  const account = `<div class="dropdown-divider"></div><p class="px-3 py-1 small text-body-secondary mb-0 text-truncate">${esc(user.email)}</p>
    <a href="${href('screens/profile.html')}" class="dropdown-item d-flex align-items-center gap-2"${cur(active === 'profile')}><i class="bi bi-person-circle" aria-hidden="true"></i>Mój profil</a>
    <a href="${href('screens/login.html')}" class="dropdown-item d-flex align-items-center gap-2"><i class="bi bi-box-arrow-right" aria-hidden="true"></i>Wyloguj się</a>`;
  return `<nav class="app-nav bg-dark" aria-label="Menu główne" x-data="{ more: false, acc: false }" @keydown.escape="more = false; acc = false">
    <div class="nav-row container-fluid px-0 px-lg-2">
      <a href="${href('index.html')}" class="brand nav-wide"><span>IKPM<small>System kosztorysów</small></span></a>
      ${NAV.map(link).join('')}
      <button type="button" class="nav-btn nav-narrow${moreKeys.includes(active) ? ' active' : ''}" :aria-expanded="more" aria-controls="nav-more" @click="more = !more" @click.outside="more = false"><i class="bi bi-three-dots" aria-hidden="true"></i><span>Więcej</span></button>
      <button type="button" class="nav-btn nav-wide ms-auto${active === 'profile' ? ' active' : ''}" :aria-expanded="acc" aria-controls="nav-account" @click="acc = !acc" @click.outside="acc = false"><i class="bi bi-person-circle" aria-hidden="true"></i><span class="text-truncate" style="max-width: 14rem">${esc(user.email)}</span><i class="bi bi-chevron-down small" aria-hidden="true"></i></button>
    </div>
    <div id="nav-more" class="more-panel bg-body border rounded shadow nav-narrow" x-show="more" x-cloak>${more}${account}</div>
    <div id="nav-account" class="more-panel bg-body border rounded shadow nav-wide" x-show="acc" x-cloak>${account}</div>
  </nav>`;
}
const DATA_TABS = [['stages', 'stages.html', 'list-check', 'Prace'], ['materials', 'materials.html', 'box-seam', 'Materiały'], ['contractors', 'contractors.html', 'people', 'Wykonawcy'], ['room-templates', 'room-templates.html', 'grid-1x2', 'Szablony pokoi']];
const dataTabsHTML = (active) => `<nav aria-label="Arkusze danych" class="sheet-tabs my-3">${DATA_TABS.map(([key, path, icon, label]) => `<a href="${href(`screens/${path}`)}" class="btn ${key === active ? 'btn-dark' : 'btn-outline-dark'}"${cur(key === active)}><i class="bi bi-${icon}" aria-hidden="true"></i>${label}</a>`).join('')}</nav>`;

// ---------- start ekranu ----------
export async function boot(page) {
  const raw = await load();
  const navEl = document.getElementById('nav');
  if (navEl) navEl.outerHTML = navHTML(document.body.dataset.nav, raw.users[0]);
  const tabs = document.getElementById('data-tabs');
  if (tabs) tabs.outerHTML = dataTabsHTML(tabs.dataset.active);
  document.addEventListener('alpine:init', () => {
    db = window.Alpine.reactive(raw);
    window.db = db;
    if (page) window.Alpine.data('page', page);
  });
  const s = document.createElement('script');
  s.src = href('assets/alpine.min.js');
  document.head.append(s);
  let pending = null;
  try { pending = JSON.parse(sessionStorage.getItem('ikpm-flash')); sessionStorage.removeItem('ikpm-flash'); } catch (e) { pending = null; }
  if (pending) {
    document.addEventListener('alpine:initialized', () => setTimeout(() => (pending.kind === 'error' ? alertError(pending.text) : toast(pending.text)), 50));
  }
}

// Pomocniki dostępne w wyrażeniach Alpine (window.ik).
window.ik = {
  ...K, href, todayISO, addDays, suggestedEnd, plural, date, num, esc,
  pln: (v) => K.formatPLN(Number(v) || 0),
  dec: (v) => K.formatDecimal(Number(v) || 0),
  measure: (v) => (num(v) === null ? '' : MEASURE.format(Number(v))),
  hours: (v) => `${ONE_DECIMAL.format(Number(v) || 0)} h`,
  oneDec: (v) => ONE_DECIMAL.format(Number(v) || 0),
  dateTime: (iso) => (iso ? `${date(iso)} ${iso.slice(11, 16)}` : '—'),
  pct: (v) => `${K.formatDecimal(v)}%`,
  workDays: (n) => plural(n, 'dzień roboczy', 'dni robocze', 'dni roboczych'),
  jobsCount: (n) => plural(n, 'praca', 'prace', 'prac'),
  jobsGenitive: (n) => plural(n, 'pracy', 'prac', 'prac'),
  jobsAccusative: (n) => plural(n, 'pracę', 'prace', 'prac'),
  unfinished: (n) => ({ one: `Została ${n} praca do zrobienia`, few: `Zostały ${n} prace do zrobienia` }[PLURAL.select(n)] ?? `Zostało ${n} prac do zrobienia`),
  quoteBadge: (s) => badgeHTML(QUOTE_STATUS, kit.labels.quote_status, s),
  realBadge: (s) => badgeHTML(REAL_STATUS, kit.labels.realization_status, s),
  jobBadge: (s) => badgeHTML(JOB_STATUS, kit.labels.realization_job_status, s),
  jobStatus: JOB_STATUS,
  labels: () => kit.labels,
  roomSizeParts, irregular, jobsOf, quoteCost, roomTotal, marginPercent, nextRoomName, jobNames, catJobs, sortJobs, byStage,
  newJobLine, recalcRoom, applyTemplate, plansFor, hasKitPlans, applyPlan, sendError, sendQuote, clientComments, realizationOf,
  realJobs, realCost, realActive, doneCount, progress, currentEnd, endOn, delayed, setJobStatus, materialUnitCost, parsePackage,
  syncMaterial, packageOf, priceRound: (x) => Math.max(1, Math.floor(x + 0.5 + 1e-9)),
  clientByName: (name) => db.clients.find((c) => c.name === name),
  quoteUser: (q) => db.users.find((u) => u.display_name === q.user) ?? db.users[0],
};
