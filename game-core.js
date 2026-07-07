'use strict';

/* YAGNI progression extension for the existing game.js */
var P_UNLOCK = { farmer: 2, cook: 3, server: 4 };
var P_HELPER_COST = { farmer: 180, cook: 220, server: 200 };
var P_FARM_COST = { 2: 250, 3: 500 };
var P_OLD = {
  take: take,
  job: job,
  workers: workers,
  hire: hire,
  newRecipe: newRecipe,
  farmUI: farmUI,
  kitchenUI: kitchenUI,
  restoUI: restoUI
};

function pInitState() {
  s.plan = Object.assign(Object.fromEntries(Object.keys(C).map(k => [k, 0])), s.plan || {});
  s.farmLevel = Math.max(1, Math.min(3, s.farmLevel || 1));
  s.helperLevel = Object.assign({ farmer: 1, cook: 1, server: 1 }, s.helperLevel || {});
  s.progressSeen = s.progressSeen || Date.now();
  pResizePlots();
}

function pResizePlots() {
  var wanted = s.farmLevel === 3 ? 10 : s.farmLevel === 2 ? 8 : 6;
  while (s.plots.length < wanted) s.plots.push({ crop: null, at: 0, status: 'empty' });
}

function pInterval(k) {
  return W[k][3] * (s.helperLevel[k] >= 2 ? 0.75 : 1);
}

function pRecipeRules() {
  if (s.level < 8) return { slots: 0, crops: [] };
  if (s.level < 10) return { slots: 2, crops: ['lettuce', 'tomato'] };
  if (s.level < 12) return { slots: 3, crops: ['lettuce', 'tomato', 'corn'] };
  if (s.level < 15) return { slots: 4, crops: ['lettuce', 'tomato', 'corn', 'carrot'] };
  return { slots: 5, crops: Object.keys(C) };
}

function pGrowingCount(k) {
  return s.plots.filter(p => p.crop === k && p.status !== 'withered').length;
}

function pPickCrop() {
  var best = null, bestGap = 0;
  Object.keys(C).forEach(k => {
    var gap = Math.max(0, Number(s.plan[k] || 0) - s.crops[k] - pGrowingCount(k));
    if (gap > bestGap) { best = k; bestGap = gap; }
  });
  return best;
}

function pFarmJob(now) {
  grow(now || Date.now());
  var ready = s.plots.findIndex(p => p.status === 'ready');
  if (ready >= 0) {
    s.coins -= W.farmer[2];
    return take(ready, 1, 1);
  }
  var empty = s.plots.findIndex(p => p.status === 'empty');
  var crop = pPickCrop();
  if (empty < 0 || !crop) return 0;
  var cost = C[crop][1] + W.farmer[2];
  if (s.coins < cost) return 0;
  s.coins -= cost;
  Object.assign(s.plots[empty], { crop: crop, at: now || Date.now(), status: 'growing' });
  return 1;
}

take = function(i, auto, quiet) {
  var p = s.plots[i];
  if (p.status !== 'ready') return 0;
  var n = 1 + Math.floor(s.stats.farming / 3) + (s.farmLevel - 1);
  s.crops[p.crop] += n;
  xp(auto ? 3 : 6);
  sk('farming', auto ? 2 : 4);
  if (!quiet) log((auto ? 'Farmhand: ' : 'Harvested ') + n + ' ' + C[p.crop][0], 'good');
  Object.assign(p, { crop: null, at: 0, status: 'empty' });
  return 1;
};

job = function(k) {
  if (k === 'farmer') return pFarmJob(Date.now());
  return P_OLD.job(k);
};

workers = function(dt) {
  Object.keys(W).forEach(k => {
    if (!s.workers[k]) return;
    s.wp[k] += dt;
    var interval = pInterval(k), guard = 0;
    while (s.wp[k] >= interval && guard++ < 5) {
      s.wp[k] -= interval;
      job(k);
    }
  });
};

hire = function(k) {
  if (s.level < P_UNLOCK[k]) return toast('Unlocks at player level ' + P_UNLOCK[k] + '.');
  return P_OLD.hire(k);
};

newRecipe = function() {
  var rules = pRecipeRules();
  if (!rules.slots) return toast('Custom recipes unlock at level 8.');
  var keys = Object.keys(D);
  if (keys.length > rules.slots) return toast('Max ' + rules.slots + ' ingredients at this level.');
  if (keys.some(k => !rules.crops.includes(k))) return toast('One ingredient is still level-locked.');
  return P_OLD.newRecipe();
};

function pUpgradeFarm() {
  var next = s.farmLevel + 1;
  if (next > 3) return;
  var req = next === 2 ? 5 : 7, cost = P_FARM_COST[next];
  if (s.level < req) return toast('Farm level ' + next + ' unlocks at player level ' + req + '.');
  if (s.coins < cost) return toast('Not enough coins.');
  s.coins -= cost;
  s.farmLevel = next;
  pResizePlots();
  log('Farm upgraded to level ' + next + '.', 'good');
  done();
}

function pUpgradeHelper(k) {
  if (!s.workers[k]) return toast('Hire this helper first.');
  if (s.helperLevel[k] >= 2) return;
  if (s.level < 6) return toast('Helper level 2 unlocks at player level 6.');
  var cost = P_HELPER_COST[k];
  if (s.coins < cost) return toast('Not enough coins.');
  s.coins -= cost;
  s.helperLevel[k] = 2;
  log(W[k][0] + ' upgraded to level 2.', 'good');
  done();
}
