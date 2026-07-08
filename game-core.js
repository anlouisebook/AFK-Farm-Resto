'use strict';

var P_DAY_SECONDS = 600;
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
  restoUI: restoUI,
  cook1: cook1,
  serve: serve
};

function pMaxHelpers() {
  return 1 + Math.floor(s.level / 5);
}

function pRollHelperLevel() {
  return 1 + Math.floor(Math.random() * Math.max(1, Math.min(s.level, 10)));
}

function pInitState() {
  s.plan = Object.assign(Object.fromEntries(Object.keys(C).map(k => [k, 0])), s.plan || {});
  s.farmLevel = Math.max(1, Math.min(3, s.farmLevel || 1));
  s.helpers = s.helpers || {};
  s.helperCandidates = s.helperCandidates || {};
  Object.keys(W).forEach(k => {
    if (!Array.isArray(s.helpers[k])) {
      s.helpers[k] = [];
      if (s.workers[k]) {
        s.helpers[k].push({
          level: Math.max(1, Math.min(10, Number((s.helperLevel || {})[k]) || 1)),
          progress: Math.max(0, Number((s.wp || {})[k]) || 0)
        });
      }
    }
    s.helpers[k] = s.helpers[k].map(h => ({
      level: Math.max(1, Math.min(10, Number(h.level) || 1)),
      progress: Math.max(0, Number(h.progress) || 0)
    }));
    s.workers[k] = s.helpers[k].length > 0;
    var maxRoll = Math.max(1, Math.min(s.level, 10));
    var candidate = Number(s.helperCandidates[k]) || 0;
    if (candidate < 1 || candidate > maxRoll) s.helperCandidates[k] = pRollHelperLevel();
  });
  s.gameDay = Math.max(1, Number(s.gameDay) || 1);
  s.dayProgress = Math.max(0, Math.min(P_DAY_SECONDS - 0.001, Number(s.dayProgress) || 0));
  var captured = Number(sessionStorage.getItem('hh-afk-offline-start')) || 0;
  s.progressSeen = captured || Number(s.progressSeen) || Date.now();
  pResizePlots();
}

function pResizePlots() {
  var wanted = s.farmLevel === 3 ? 10 : s.farmLevel === 2 ? 8 : 6;
  while (s.plots.length < wanted) s.plots.push({ crop: null, at: 0, status: 'empty' });
}

function pInterval(k, helper) {
  var level = Math.max(1, Number(helper.level) || 1);
  return W[k][3] / (1 + 0.25 * (level - 1));
}

function pDailyWage() {
  return Object.keys(W).reduce((sum, k) => sum + s.helpers[k].length * W[k][2], 0);
}

function pAdvanceDay(sec) {
  if (sec <= 0) return 0;
  var total = s.dayProgress + sec;
  var days = Math.floor(total / P_DAY_SECONDS);
  s.dayProgress = total % P_DAY_SECONDS;
  var wage = pDailyWage();
  for (var i = 0; i < days; i++) {
    s.gameDay++;
    if (wage > 0) {
      s.coins -= wage;
      log('Day ' + s.gameDay + ' wages paid: ' + wage + 'c.', 'bad');
    }
  }
  return days;
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
  if (ready >= 0) return take(ready, 1, 1);
  var empty = s.plots.findIndex(p => p.status === 'empty');
  var crop = pPickCrop();
  if (empty < 0 || !crop || s.coins < C[crop][1]) return 0;
  s.coins -= C[crop][1];
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

cook1 = function(k, auto, quiet) {
  var ok = P_OLD.cook1(k, auto, quiet);
  if (auto && ok) s.coins += W.cook[2];
  return ok;
};

serve = function(auto, quiet) {
  var ok = P_OLD.serve(auto, quiet);
  if (auto && ok) s.coins += W.server[2];
  return ok;
};

function pDoJob(k, now) {
  if (k === 'farmer') return pFarmJob(now || Date.now());
  return P_OLD.job(k);
}

job = function(k) {
  return pDoJob(k, Date.now());
};

workers = function(dt) {
  pAdvanceDay(dt);
  Object.keys(W).forEach(k => {
    s.helpers[k].forEach(helper => {
      helper.progress += dt;
      var interval = pInterval(k, helper), guard = 0;
      while (helper.progress >= interval && guard++ < 5) {
        helper.progress -= interval;
        pDoJob(k, Date.now());
      }
    });
  });
};

hire = function(k) {
  if (s.level < P_UNLOCK[k]) return toast('Unlocks at player level ' + P_UNLOCK[k] + '.');
  if (s.helpers[k].length >= pMaxHelpers()) return toast('Helper limit reached for this player level.');
  var level = Number(s.helperCandidates[k]) || pRollHelperLevel();
  var cost = W[k][1] * level;
  if (s.coins < cost) return toast('Not enough coins.');
  s.coins -= cost;
  s.helpers[k].push({ level: level, progress: 0 });
  s.workers[k] = true;
  s.helperCandidates[k] = pRollHelperLevel();
  log('Hired ' + W[k][0] + ' Lv ' + level + ' for ' + cost + 'c.', 'good');
  done();
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

function pUpgradeHelper(k, index) {
  var helper = s.helpers[k][index];
  if (!helper) return;
  if (s.level < 6) return toast('Helper upgrades unlock at player level 6.');
  var maxLevel = Math.min(s.level, 10);
  if (helper.level >= maxLevel) return toast('This helper is at the current level cap.');
  var cost = P_HELPER_COST[k] * helper.level;
  if (s.coins < cost) return toast('Not enough coins.');
  s.coins -= cost;
  helper.level++;
  log(W[k][0] + ' #' + (index + 1) + ' upgraded to Lv ' + helper.level + '.', 'good');
  done();
}
