// Kreator wyceny: klient → pokoje → wymiary → prace → wykonawcy → termin → sprawdź → wyślij. Jeden komponent dla
// ekranów quotes-new, builder i match-contractors (różni je krok startowy).
import {
  ikpm, kit, link, go, getQuote, saveQuote, newQuote, blankRoom, applyTemplate, recalcRoom, templates, clients,
  saveClient, allJobs, newQuoteJob, byStage, totals, roomTotal, quoteCost, marginPercent, vatLabel, quoteJobs,
  hasClientComments, planSource, applyPlan, sendProblems, sendQuote, changedAfterMatching, addWorkDays, roomErrors,
  isIrregular, roomSize, roomSizeParts, DIMENSIONS, OVERRIDES, fieldNumber, jobsText, workDaysText, hoursText, pln,
  dec, dateText, clone,
} from './app.js';

const { lineTotal, areaFor, roundHalfUp, laborUnitCost } = ikpm;

export const STEPS = [
  { key: 'klient', label: 'Klient', question: 'Dla kogo jest wycena?' },
  { key: 'pokoje', label: 'Pokoje', question: 'Jakie pokoje obejmuje wycena?' },
  { key: 'wymiary', label: 'Wymiary', question: 'Wymiary pokoju' },
  { key: 'prace', label: 'Prace', question: 'Prace w pokoju' },
  { key: 'wykonawcy', label: 'Wykonawcy', question: 'Który plan doboru wykonawców?' },
  { key: 'termin', label: 'Termin', question: 'Termin i adres inwestycji' },
  { key: 'sprawdz', label: 'Sprawdź', question: 'Sprawdź wycenę' },
  { key: 'wyslij', label: 'Wyślij', question: 'Wysłać wycenę do klienta?' },
];
const DIM_LABELS = kit.labels.dimension;
const OVERRIDE_LABELS = { floor_area_override: 'Podłoga (m²)', ceiling_area_override: 'Sufit (m²)', wall_area_override: 'Ściany (m²)', perimeter_override: 'Obwód (mb)' };
const PROFILE_ICONS = { cheapest: 'piggy-bank', best_quality: 'award', fastest: 'lightning-charge', fewest_crews: 'people' };

export const wizard = () => ({
  STEPS, DIMENSIONS, OVERRIDES, DIM_LABELS, OVERRIDE_LABELS, PROFILE_ICONS,
  q: null, step: 'klient', roomId: null, fromCheck: false, isNew: false, mode: null, showSteps: false,
  clientSearch: '', laterPicked: false, newClientOpen: false, newClient: { name: '', email: '', phone: '', notes: '' }, newClientError: '',
  jobSearch: '', stepError: '', savedAt: '',

  init() {
    const _p = new URLSearchParams(location.search);
    const _id = _p.get('id');
    if (_id) {
      const _q = getQuote(_id);
      if (!_q) { location.replace(link('screens/error-404.html')); return; }
      if (_q.status !== 'draft') { go(`screens/quote-show.html?id=${_q.id}`, 'Wycena jest u klienta — przywróć ją do edycji, aby ją zmienić.', 'alert'); return; }
      for (const room of _q.rooms) room._irregular = isIrregular(room);
      this.q = _q;
      this.step = _p.get('krok') || document.body.dataset.step || 'sprawdz';
    } else {
      this.isNew = true;
      this.mode = _p.get('mode');
      this.q = { id: null, status: 'draft', client: null, rooms: [], markup_percent: '20.0', vat_rate: '8.0', notes: null };
      this.step = 'klient';
    }
    this.roomId = Number(_p.get('pokoj')) || this.q.rooms[0]?.id || null;
    this.syncUrl();
    window.addEventListener('popstate', () => this.fromUrl());
  },
  // Wstecz przeglądarki / gest systemu: o jeden krok wstecz (każda zmiana kroku to wpis w historii).
  fromUrl() {
    const _p = new URLSearchParams(location.search);
    if (!this.q.id || _p.get('id') !== String(this.q.id)) { location.reload(); return; }
    this.step = _p.get('krok') || 'sprawdz';
    this.roomId = Number(_p.get('pokoj')) || this.q.rooms[0]?.id || null;
    this.fromCheck = false; this.showSteps = false; this.stepError = '';
    this.syncUrl();
    this.$nextTick(() => { window.scrollTo(0, 0); document.getElementById('wz-h1')?.focus(); });
  },

  // ---------------------------------------------------------- nawigacja kroków
  get stepIndex() { return STEPS.findIndex((s) => s.key === this.step); },
  get stepLabel() { return STEPS[this.stepIndex].label; },
  get room() { return this.q?.rooms.find((r) => r.id === this.roomId) ?? this.q?.rooms[0] ?? null; },
  get roomList() { return this.room ? [this.room] : []; },
  get roomIndex() { return this.q.rooms.indexOf(this.room); },
  get perRoom() { return ['wymiary', 'prace'].includes(this.step); },
  get question() {
    if (this.step === 'wymiary' && this.room) return `Wymiary: ${this.room.name}`;
    if (this.step === 'prace' && this.room) return `Prace: ${this.room.name}`;
    if (this.step === 'wyslij' && this.q.client?.email) return `Wysłać wycenę do ${this.q.client.email}?`;
    return STEPS[this.stepIndex].question;
  },
  get heading() { return this.q.id ? `Wycena #${this.q.id}${this.q.client ? ` · ${this.q.client.name}` : ''}` : 'Nowa wycena'; },
  stepDone(key) {
    const _q = this.q; const _jobs = quoteJobs(_q);
    return {
      klient: Boolean(_q.client),
      pokoje: _q.rooms.length > 0,
      wymiary: _q.rooms.length > 0 && _q.rooms.every((r) => roomErrors(r).length === 0),
      prace: _jobs.length > 0,
      wykonawcy: _jobs.length > 0 && _jobs.every((j) => j.contractor) && changedAfterMatching(_q).length === 0,
      termin: Boolean(_q.planned_end_on),
      sprawdz: _q.id && sendProblems(_q).length === 0,
      wyslij: _q.status === 'sent',
    }[key];
  },
  stepClass(key) {
    return { current: this.step === key, done: this.step !== key && this.stepDone(key), warn: key === 'wykonawcy' && changedAfterMatching(this.q).length > 0 && this.step !== key };
  },
  syncUrl(push = false) {
    if (!this.q.id) return;
    const _file = this.step === 'wykonawcy' ? 'match-contractors' : 'builder';
    const _room = this.perRoom && this.room ? `&pokoj=${this.room.id}` : '';
    const _url = link(`screens/${_file}.html?id=${this.q.id}&krok=${this.step}${_room}`);
    if (push && _url !== location.href) history.pushState(null, '', _url); else history.replaceState(null, '', _url);
    document.title = `${this.stepLabel} — Wycena #${this.q.id} — IKPM`;
  },
  go(key, { fromCheck = false, replace = false } = {}) {
    if (this.isNew && key !== 'klient') { this.stepError = 'Najpierw wybierz klienta albo „Wybierz później” i przejdź dalej.'; return; }
    this.stepError = '';
    this.fromCheck = fromCheck;
    this.step = key;
    this.showSteps = false;
    if (this.perRoom && !this.room) this.roomId = this.q.rooms[0]?.id ?? null;
    this.syncUrl(!replace);
    this.$nextTick(() => { window.scrollTo(0, 0); document.getElementById('wz-h1')?.focus(); });
  },
  change(key) { this.go(key, { fromCheck: true }); },
  selectRoom(id) { this.roomId = id; this.syncUrl(); this.$nextTick(() => document.getElementById('wz-h1')?.focus()); },
  get nextLabel() {
    if (this.fromCheck) return 'Wróć do „Sprawdź”';
    if (this.perRoom && this.roomIndex < this.q.rooms.length - 1) return 'Następny pokój';
    if (this.step === 'wyslij') return 'Wyślij do klienta';
    return `Dalej: ${STEPS[this.stepIndex + 1].label}`;
  },
  next() {
    this.stepError = '';
    if (this.step === 'klient' && this.isNew) return this.createQuote();
    if (this.step === 'pokoje' && this.q.rooms.length === 0) { this.stepError = 'Dodaj co najmniej jeden pokój — z szablonu albo nowy.'; return; }
    if (this.step === 'wymiary' && this.room && roomErrors(this.room).length) { this.stepError = roomErrors(this.room)[0]; return; }
    if (this.step === 'wyslij') return this.send();
    if (this.fromCheck) return this.go('sprawdz');
    if (this.perRoom && this.roomIndex < this.q.rooms.length - 1) return this.selectRoom(this.q.rooms[this.roomIndex + 1].id);
    const _next = STEPS[this.stepIndex + 1].key;
    if (['wymiary', 'prace'].includes(_next)) this.roomId = this.q.rooms[0]?.id ?? null;
    if (_next === 'wymiary' && this.isWholeObject) return this.go('prace');
    this.go(_next);
  },
  back() {
    if (this.perRoom && this.roomIndex > 0) return this.selectRoom(this.q.rooms[this.roomIndex - 1].id);
    if (this.stepIndex === 0) { location.href = link('index.html'); return; }
    const _prev = STEPS[this.stepIndex - 1].key;
    if (['wymiary', 'prace'].includes(_prev)) this.roomId = this.q.rooms.at(-1)?.id ?? null;
    this.go(_prev);
  },
  get isWholeObject() { return this.q.rooms.length === 1 && this.q.rooms[0].name === 'Cały obiekt' && !roomSize(this.q.rooms[0]); },
  save() {
    if (!this.q.id) return;
    saveQuote(this.q);
    this.savedAt = new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  },

  // ---------------------------------------------------------- krok 1: klient
  get clientList() {
    const _s = this.clientSearch.trim().toLowerCase();
    return clients().filter((c) => !_s || c.name.toLowerCase().includes(_s) || (c.email ?? '').toLowerCase().includes(_s));
  },
  pickClient(c) {
    this.laterPicked = c === null;
    this.q.client = c ? { name: c.name, email: c.email, phone: c.phone } : null;
    this.save();
  },
  addClient() {
    if (!this.newClient.name.trim()) { this.newClientError = 'Nazwa nie może być pusta'; return; }
    if (this.newClient.email && !/^[^@\s]+@[^@\s]+$/.test(this.newClient.email)) { this.newClientError = 'Email jest nieprawidłowy'; return; }
    const _c = saveClient({ ...this.newClient, name: this.newClient.name.trim() });
    this.q.client = { name: _c.name, email: _c.email || null, phone: _c.phone || null };
    this.newClientOpen = false; this.newClientError = '';
    this.newClient = { name: '', email: '', phone: '', notes: '' };
    this.save();
    this.$store.toast.show(this.q.id ? 'Klient utworzony i przypisany do wyceny.' : 'Klient utworzony.');
  },
  createQuote() {
    const _q = newQuote(this.q.client);
    const _simple = this.mode === 'simple';
    if (_simple) _q.rooms.push(blankRoom(_q, 'Cały obiekt', { length: '0', width: '0', height: '0' }));
    saveQuote(_q);
    this.q = _q; this.isNew = false;
    this.roomId = _q.rooms[0]?.id ?? null;
    this.$store.toast.show('Wycena utworzona. Możesz teraz dodawać pokoje i prace.');
    this.go(_simple ? 'prace' : 'pokoje', { replace: true });
  },

  // ---------------------------------------------------------- krok 2: pokoje
  templates: templates(),
  templateInfo(t) {
    const _dims = [t.length, t.width, t.height].every((v) => Number(v) > 0) ? ` · ${roomSize(t)}` : '';
    return `${t.description ? `${t.description} · ` : ''}${jobsText(t.jobs.length)}${_dims}`;
  },
  uniqueName(name) {
    let _name = name; let _n = 2;
    while (this.q.rooms.some((r) => r.name === _name)) { _name = `${name} ${_n}`; _n += 1; }
    return _name;
  },
  addRoomFromTemplate(t) {
    const _room = blankRoom(this.q, this.uniqueName(t.name), { height: null });
    applyTemplate(_room, t);
    _room._irregular = false;
    this.q.rooms.push(_room);
    this.save();
    this.$store.toast.show(`Pokój '${_room.name}' utworzony.`);
  },
  addEmptyRoom() {
    const _room = blankRoom(this.q);
    _room._irregular = false;
    this.q.rooms.push(_room);
    this.save();
    this.$store.toast.show(`Pokój '${_room.name}' utworzony.`);
  },
  addWholeObject() {
    this.q.rooms.push({ ...blankRoom(this.q, 'Cały obiekt', { length: '0', width: '0', height: '0' }), _irregular: false });
    this.save();
    this.$store.toast.show("Pokój 'Cały obiekt' utworzony.");
  },
  renameRoom(room, value) { if (value.trim()) { room.name = value.trim().slice(0, 100); this.save(); } },
  roomInfo(room) { return [roomSize(room), jobsText(room.jobs.length)].filter(Boolean).join(' · '); },
  removeRoom(room) {
    this.$store.confirm.ask({
      title: 'Czy na pewno usunąć ten pokój i wszystkie jego prace?',
      lines: [`Pokój „${room.name}” i ${jobsText(room.jobs.length)} znikną z wyceny.`],
      ok: 'Usuń pokój', variant: 'danger',
      run: () => {
        this.q.rooms = this.q.rooms.filter((r) => r.id !== room.id);
        if (this.roomId === room.id) this.roomId = this.q.rooms[0]?.id ?? null;
        this.save();
        this.$store.toast.show('Pokój usunięty.');
      },
    });
  },

  // ---------------------------------------------------------- krok 3: wymiary
  setDim(room, field, el) {
    const _v = fieldNumber(el);
    if (_v === undefined) return;
    room[field] = _v === null ? null : String(_v);
    recalcRoom(room);
    this.save();
  },
  setIrregular(room, on) {
    room._irregular = on;
    if (!on) { for (const f of OVERRIDES) room[f] = null; recalcRoom(room); }
    this.save();
  },
  computedArea(room, field) {
    const _plain = { ...room };
    for (const f of OVERRIDES) _plain[f] = null;
    const _type = { floor_area_override: 'floor', ceiling_area_override: 'ceiling', wall_area_override: 'wall', perimeter_override: 'perimeter' }[field];
    return dec(roundHalfUp(areaFor(_plain, _type)));
  },
  areaPreview(room) {
    return [`Podłoga: ${dec(roundHalfUp(areaFor(room, 'floor')))} m²`, `Sufit: ${dec(roundHalfUp(areaFor(room, 'ceiling')))} m²`,
      `Ściany: ${dec(roundHalfUp(areaFor(room, 'wall')))} m²`, `Obwód: ${dec(roundHalfUp(areaFor(room, 'perimeter')))} mb`];
  },
  roomErrors,

  // ---------------------------------------------------------- krok 4: prace
  get roomGroups() { return this.room ? byStage(this.room.jobs) : []; },
  line(job) { return lineTotal(job, this.q.markup_percent); },
  roomSum(room) { return roomTotal(this.q, room); },
  isAuto(job) { return job.area_type !== 'manual'; },
  changedJob(job) { return job.matched_quantity !== null && job.matched_quantity !== undefined && Number(job.matched_quantity) !== Number(job.quantity); },
  setQty(job, el) {
    const _v = fieldNumber(el);
    if (_v === undefined) return;
    job.quantity = _v === null ? null : roundHalfUp(_v);
    job.typed = true;
    this.save();
  },
  fixQty(job, el) { if (job.quantity !== null && String(el.value) !== String(job.quantity)) el.value = job.quantity; },
  setPrice(job, el) {
    const _v = fieldNumber(el);
    if (_v === undefined) return;
    job.contractor_price = _v === null ? null : String(roundHalfUp(_v));
    this.save();
  },
  materialPerUnit(job) { return `mat. ${pln(job.effective_material_unit_cost)}/${job.unit}`; },
  get availableJobs() {
    if (!this.room) return [];
    const _have = new Set(this.room.jobs.map((j) => j.job_id));
    const _s = this.jobSearch.trim().toLowerCase();
    return allJobs().filter((j) => !_have.has(j.id) && (!_s || j.name.toLowerCase().includes(_s) || j.stage.toLowerCase().includes(_s)));
  },
  get availableGroups() {
    const _groups = [];
    for (const j of this.availableJobs) {
      let _g = _groups.find((g) => g.stage === j.stage);
      if (!_g) { _g = { stage: j.stage, jobs: [] }; _groups.push(_g); }
      _g.jobs.push(j);
    }
    return _groups;
  },
  get stagesFull() {
    const _have = new Set(this.room?.jobs.map((j) => j.stage));
    const _open = new Set(this.availableJobs.map((j) => j.stage));
    return [..._have].filter((s) => !_open.has(s));
  },
  addJob(j) {
    this.room.jobs.push(newQuoteJob(j, this.room));
    this.save();
    this.$store.toast.show('Praca dodana.');
  },
  removeJob(job) {
    this.$store.confirm.ask({
      title: 'Usunąć tę pracę z wyceny?', lines: [`„${job.name}” zniknie z pokoju „${this.room.name}”.`], ok: 'Usuń pracę', variant: 'danger',
      run: () => { this.room.jobs = this.room.jobs.filter((x) => x.id !== job.id); this.save(); },
    });
  },
  addTemplateJobs(t) {
    applyTemplate(this.room, t);
    this.save();
    this.$store.toast.show(`Dodano prace z szablonu „${t.name}”.`);
  },

  // ---------------------------------------------------------- krok 5: wykonawcy
  get jobsCount() { return quoteJobs(this.q).length; },
  get plans() {
    const _src = this.q.id ? planSource(this.q) : null;
    return _src ? Object.entries(_src.matching_plans).map(([key, plan]) => ({ key, plan })) : null;
  },
  get changedNames() { return changedAfterMatching(this.q).map((j) => j.name); },
  workDays: workDaysText,
  hours: hoursText,
  cumulative(plan) { let _sum = 0; return plan.stage_schedule.map((s) => { _sum += s.duration_hours; return Math.round(_sum * 10) / 10; }); },
  barWidth(plan, s) { return `${Math.max(2, (s.duration_hours / Math.max(plan.summary.makespan_hours, 0.1)) * 100)}%`; },
  askPlan(key, plan) {
    const _again = this.q.applied_profile_name === key;
    this.$store.confirm.ask({
      title: _again ? `Zastosować ponownie plan '${plan.label}'?` : `Zastosować plan '${plan.label}'?`,
      lines: [
        `Przypisze wykonawców do ${plan.assignments.length} ${this.plural(plan.assignments.length, 'pracy', 'prac', 'prac')}; cennik zastąpi ręcznie wpisane ceny ekipy.`,
        `Ceny ekip i koszt materiałów zostaną zamrożone z cennika — późniejsze zmiany cennika nie zmienią tej wyceny.`,
        `Sugerowany termin: ${this.workDays(plan.work_days)} od planowanego startu.`,
      ],
      ok: _again ? 'Zastosuj ponownie' : 'Zastosuj ten plan',
      run: () => {
        applyPlan(this.q, key);
        this.save();
        const _missing = plan.summary.unassigned_job_names;
        this.$store.toast.show(`Zastosowano plan '${plan.label}'.${_missing.length ? ` Bez wykonawcy (${kit.labels.unassigned_reason}): ${_missing.join(', ')}.` : ''}`);
        this.next();
      },
    });
  },
  crewHours(plan, stage) { return plan.stage_schedule.find((s) => s.stage === stage)?.duration_hours; },
  get compareStages() { const _p = this.plans; return _p ? [...new Set(_p.flatMap((x) => x.plan.stage_schedule.map((s) => s.stage)))] : []; },
  get compareRows() {
    const _p = this.plans; if (!_p) return [];
    return quoteJobs(this.q).map((job) => ({
      id: job.id, room: this.q.rooms.find((r) => r.jobs.includes(job)).name, name: job.name, qty: `${dec(job.quantity)} ${job.unit}`,
      cells: _p.map(({ key, plan }) => { const _a = plan.assignments.find((a) => a.quote_job_id === job.id); return { key, text: _a ? `${_a.contractor} — ${pln(_a.price)} · ${hoursText(_a.job_hours)}` : 'brak' }; }),
    }));
  },

  // ---------------------------------------------------------- krok 6: termin
  get suggestedEnd() { return addWorkDays(this.q.planned_start_on, this.q.suggested_work_days); },
  setField(field, value) { this.q[field] = value || null; this.save(); },
  get dateError() {
    if (this.q.planned_start_on && this.q.planned_end_on && this.q.planned_end_on < this.q.planned_start_on) return 'Termin zakończenia nie może być wcześniejszy niż planowany start.';
    return '';
  },
  useSuggested() {
    this.q.planned_end_on = this.suggestedEnd;
    this.save();
    this.$store.toast.show(`Termin zakończenia: ${dateText(this.suggestedEnd)}.`);
  },

  // ---------------------------------------------------------- krok 7–8: sprawdź, wyślij
  get problems() { return this.q.id ? sendProblems(this.q) : []; },
  get sums() { const _t = totals(this.q); const _cost = quoteCost(this.q); return { ..._t, cost: _cost, margin: roundHalfUp(_t.net - _cost) }; },
  get marginLine() { return `marża ${dec(marginPercent(this.q.markup_percent))}%`; },
  vatLabel() { return vatLabel(this.q); },
  get appliedLabel() { return this.q.applied_profile_name ? kit.labels.matching_profile[this.q.applied_profile_name] : null; },
  get withoutCrew() { return quoteJobs(this.q).filter((j) => !j.contractor).length; },
  setMarkup(el) {
    const _v = fieldNumber(el);
    if (_v === undefined || _v === null || _v < 0 || _v > 1000) return;
    this.q.markup_percent = String(_v);
    this.save();
  },
  setVat(value) { this.q.vat_rate = `${value}.0`; this.save(); this.$store.toast.show('Wycena zaktualizowana.'); },
  hasComments() { return hasClientComments(this.q); },
  get commentRooms() { return this.q.rooms.filter((r) => r.client_comment); },
  send() {
    if (this.problems.length) { this.go('sprawdz'); return; }
    const _msg = sendQuote(this.q);
    go(`screens/quote-show.html?id=${this.q.id}`, _msg);
  },
  laborUnitCost,
  roomSizeParts,
  clone,
});
