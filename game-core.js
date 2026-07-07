'use strict';

const KEY = 'hh-afk-v1';
const CAP = 8 * 60 * 60;

const C = {
  lettuce: ['Lettuce', 3, 12, 5],
  tomato: ['Tomato', 5, 22, 8],
  corn: ['Corn', 8, 36, 12],
  carrot: ['Carrot', 10, 52, 15],
  potato: ['Potato', 14, 75, 21]
};

const BASE_R = {
  salad: ['Garden Salad', { lettuce: 1, tomato: 1 }, 18],
  soup: ['Corn Soup', { corn: 1, carrot: 1 }, 28],
  plate: ['Tomato Plate', { tomato: 2, carrot: 1 }, 31],
  stew: ['Harvest Stew', { carrot: 1, corn: 1, potato: 1 }, 48],
  feast: ['Farm Feast', { lettuce: 1, tomato: 1, corn: 1, carrot: 1, potato: 1 }, 82]
};

const WORKERS = {
  farmer: ['Farmhand', 100, 1, 5, 'Harvests one ready crop per check.'],
  cook: ['Cook', 140, 2, 15, 'Cooks the selected target recipe.'],
  server: ['Server', 120, 1, 12, 'Serves one available menu dish.']
};

const fresh = () => ({
  coins: 120,
  xp: 0,
  level: 1,
  energy: 25,
  rep: 50,
  favor: 0,
  rel: { mira: 0, bram: 0 },
  stats: { farming: 1, cooking: 1, charisma: 1, stamina: 1 },
  sx: { farming: 0, cooking: 0, charisma: 0, stamina: 0 },
  crops: Object.fromEntries(Object.keys(C).map(k => [k, 0])),
  dishes: Object.fromEntries(Object.keys(BASE_R).map(k => [k, 0])),
  customRecipes: {},
  plots: Array.from({ length: 6 }, () => ({ crop: null, at: 0, status: 'empty' })),
  pick: 'lettuce',
  menu: ['salad'],
  autoRecipe: 'salad',
  workers: { farmer: false, cook: false, server: false },
  workerProgress: { farmer: 0, cook: 0, server: 0 },
  served: 0,
  floor: 1,
  combat: null,
  flags: { community: null, supplier: null, debt: false },
  logs: [['You inherited a tiny farm and restaurant.', 'good']],
  seen: Date.now(),
  tick: Date.now()
});

function recipeBook(st = s) {
  return { ...BASE_R, ...(st.customRecipes || {}) };
}

function load() {
  const base = fresh();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (!raw) return base;

    const st = {
      ...base,
      ...raw,
      rel: { ...base.rel, ...(raw.rel || {}) },
      stats: { ...base.stats, ...(raw.stats || {}) },
      sx: { ...base.sx, ...(raw.sx || {}) },
      flags: { ...base.flags, ...(raw.flags || {}) },
      workers: { ...base.workers, ...(raw.workers || {}) },
      workerProgress: { ...base.workerProgress, ...(raw.workerProgress || {}) },
      customRecipes: raw.customRecipes || {}
    };

    st.crops = { ...base.crops, ...(raw.crops || {}) };
    const book = recipeBook(st);
    st.dishes = {
      ...Object.fromEntries(Object.keys(book).map(k => [k, 0])),
      ...(raw.dishes || {})
    };
    st.menu = (raw.menu || base.menu).filter(k => book[k]).slice(0, 3);
    st.autoRecipe = book[raw.autoRecipe] ? raw.autoRecipe : Object.keys(book)[0];
    st.workerProgress.server = raw.workerProgress?.server ?? raw.progress ?? 0;
    st.plots = Array.isArray(raw.plots) && raw.plots.length === 6 ? raw.plots : base.plots;
    st.tick = Date.now();
    return st;
  } catch {
    return base;
  }
}

let s = load();
let toastTimer;
const recipeDraft = { ingredients: {} };

const $ = id => document.getElementById(id);
const cap = (v, a, b) => Math.max(a, Math.min(b, v));
const maxE = () => 20 + s.stats.stamina * 5;
const need = () => 80 + s.level * 20;
const skNeed = k => 20 + s.stats[k] * 15;
const has = req => Object.entries(req).every(([k, n]) => s.crops[k] >= n);
const reqText = o => Object.entries(o).map(([k, n]) => `${n} ${C[k][0]}`).join(' + ');
const esc = value => String(value).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));

function save() {
  s.seen = Date.now();
  localStorage.setItem(KEY, JSON.stringify(s));
  if ($('saveState')) $('saveState').textContent = 'Autosaved';
}

function log(text, tone = '') {
  s.logs.unshift([text, tone]);
  s.logs = s.logs.slice(0, 40);
}

function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

function xp(n) {
  s.xp += n;
  while (s.xp >= need()) {
    s.xp -= need();
    s.level++;
    s.energy = maxE();
    log(`Level ${s.level} reached!`, 'good');
    toast(`Level ${s.level}!`);
  }
}

function skill(k, n) {
  s.sx[k] += n;
  while (s.sx[k] >= skNeed(k)) {
    s.sx[k] -= skNeed(k);
    s.stats[k]++;
    if (k === 'stamina') s.energy = maxE();
    log(`${k} increased to ${s.stats[k]}.`, 'good');
  }
}

function energy(n) {
  if (s.energy < n) {
    toast('Not enough Energy.');
    return false;
  }
  s.energy -= n;
  return true;
}

function seed(k) {
  const m = s.flags.supplier === 'bulk' ? 0.8 : s.flags.supplier === 'local' ? 1.1 : 1;
  return Math.max(1, Math.round(C[k][1] * m));
}

function witherWindow(k) {
  return C[k][2] * (s.flags.supplier === 'bulk' ? 1.4 : 2);
}

function plant(i) {
  const p = s.plots[i];
  const k = s.pick;
  const cost = seed(k);
  if (p.status !== 'empty') return;
  if (s.coins < cost) return toast('Not enough coins.');
  if (!energy(1)) return;
  s.coins -= cost;
  Object.assign(p, { crop: k, at: Date.now(), status: 'growing' });
  skill('farming', 1);
  done();
}

function grow(now = Date.now()) {
  s.plots.forEach(p => {
    if (!p.crop) return;
    const age = (now - p.at) / 1000;
    const g = C[p.crop][2];
    p.status = age >= g + witherWindow(p.crop) ? 'withered' : age >= g ? 'ready' : 'growing';
  });
}

function collectPlot(i, automated = false, quiet = false) {
  const p = s.plots[i];
  if (p.status !== 'ready') return false;
  const count = 1 + Math.floor(s.stats.farming / 3);
  s.crops[p.crop] += count;
  xp(automated ? 3 : 6);
  skill('farming', automated ? 2 : 4);
  if (!quiet) log(`${automated ? 'Farmhand harvested' : 'Harvested'} ${count} ${C[p.crop][0]}.`, 'good');
  Object.assign(p, { crop: null, at: 0, status: 'empty' });
  return true;
}

function harvest(i) {
  const p = s.plots[i];
  if (p.status === 'withered') {
    s.rep = cap(s.rep - 1, 0, 100);
    log(`${C[p.crop][0]} withered. Reputation -1.`, 'bad');
    Object.assign(p, { crop: null, at: 0, status: 'empty' });
    return done();
  }
  if (collectPlot(i, false, false)) done();
}

function sell(k) {
  if (!s.crops[k]) return;
  s.crops[k]--;
  s.coins += C[k][3];
  done();
}

function cookChance() {
  return Math.min(0.96, 0.68 + s.stats.cooking * 0.045);
}

function attemptCook(k, automated = false, quiet = false) {
  const r = recipeBook()[k];
  if (!r || !has(r[1])) return false;
  if (!automated && !energy(1)) return false;
  if (automated) s.coins -= WORKERS.cook[2];

  Object.entries(r[1]).forEach(([crop, n]) => s.crops[crop] -= n);
  const success = Math.random() < cookChance();
  if (success) {
    s.dishes[k] = (s.dishes[k] || 0) + 1;
    xp(automated ? 4 : 8);
    skill('cooking', automated ? 2 : 5);
    if (!quiet) log(`${automated ? 'Cook prepared' : 'Cooked'} ${r[0]}.`, 'good');
  } else {
    s.rep = cap(s.rep - 1, 0, 100);
    skill('cooking', automated ? 1 : 2);
    if (!quiet) log(`${r[0]} failed. Ingredients lost.`, 'bad');
  }
  return true;
}

function cook(k) {
  if (attemptCook(k, false, false)) done();
  else if (!has(recipeBook()[k]?.[1] || {})) toast('Missing ingredients.');
}

function menu(k) {
  if (s.menu.includes(k)) s.menu = s.menu.filter(x => x !== k);
  else if (s.menu.length < 3) s.menu.push(k);
  else return toast('Menu limit is 3.');
  done();
}

function serveOne(automated = false, quiet = false) {
  const book = recipeBook();
  const available = s.menu.filter(k => book[k] && s.dishes[k] > 0);
  if (!available.length) return null;
  if (!automated && !energy(1)) return null;
  if (automated) s.coins -= WORKERS.server[2];

  const k = available[Math.floor(Math.random() * available.length)];
  const r = book[k];
  s.dishes[k]--;
  s.coins += r[2];
  s.served++;

  const happyChance = Math.min(0.97, 0.66 + s.stats.charisma * 0.035 + s.rep / 500);
  const happy = Math.random() < happyChance;
  if (happy) {
    s.rep = cap(s.rep + 1, 0, 100);
    skill('charisma', automated ? 1 : 2);
    xp(automated ? 2 : 4);
  } else {
    s.rep = cap(s.rep - 2, 0, 100);
    if (!quiet) log('An unhappy customer left. Reputation -2.', 'bad');
  }
  return { happy, coin: r[2] - (automated ? WORKERS.server[2] : 0) };
}

function manualServe() {
  if (!s.menu.some(k => s.dishes[k] > 0)) return toast('No menu dish is ready.');
  if (serveOne(false, false)) done();
}

function hireWorker(k) {
  const w = WORKERS[k];
  if (!w || s.workers[k]) return;
  if (s.coins < w[1]) return toast('Not enough coins to hire.');
  s.coins -= w[1];
  s.workers[k] = true;
  log(`Hired ${w[0]} for ${w[1]} coins.`, 'good');
  done();
}

function workerHarvest(quiet = false) {
  grow();
  const i = s.plots.findIndex(p => p.status === 'ready');
  if (i < 0) return false;
  s.coins -= WORKERS.farmer[2];
  return collectPlot(i, true, quiet);
}

function workerCook(quiet = false) {
  const book = recipeBook();
  if (!book[s.autoRecipe]) s.autoRecipe = Object.keys(book)[0];
  return attemptCook(s.autoRecipe, true, quiet);
}

function workerServe(quiet = false) {
  return !!serveOne(true, quiet);
}

function runWorkers(dt) {
  Object.keys(WORKERS).forEach(k => {
    if (!s.workers[k]) return;
    s.workerProgress[k] += dt;
    const interval = WORKERS[k][3];
    let loops = 0;
    while (s.workerProgress[k] >= interval && loops++ < 5) {
      s.workerProgress[k] -= interval;
      if (k === 'farmer') workerHarvest(true);
      if (k === 'cook') workerCook(true);
      if (k === 'server') workerServe(true);
    }
  });
}

function customPrice(req) {
  if (!Object.keys(req).length) return 0;
  const ingredientValue = Object.entries(req).reduce((sum, [k, n]) => sum + C[k][3] * n, 0);
  return Math.max(8, Math.round(ingredientValue * 1.8));
}

function createCustomRecipe() {
  const name = $('customRecipeName').value.trim();
  const req = { ...recipeDraft.ingredients };
  if (!name) return toast('Enter a recipe name.');
  if (!Object.keys(req).length) return toast('Choose at least one ingredient.');

  const duplicate = Object.values(recipeBook()).some(r => r[0].toLowerCase() === name.toLowerCase());
  if (duplicate) return toast('That recipe name already exists.');

  const id = `custom_${Date.now().toString(36)}`;
  const price = customPrice(req);
  s.customRecipes[id] = [name, req, price];
  s.dishes[id] = 0;
  s.autoRecipe = id;
  recipeDraft.ingredients = {};
  $('customRecipeName').value = '';
  log(`Created recipe ${name}. Auto price: ${price} coins.`, 'good');
  done();
}
