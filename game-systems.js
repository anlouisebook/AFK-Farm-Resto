'use strict';

function pEnsureFarmUI() {
  if ($('farmPlanPanel')) return;
  var panel = E('div', null, 'subpanel');
  panel.id = 'farmPlanPanel';
  var farm = $('farmPanel');
  farm.insertBefore(panel, $('cropPicker'));
}

function pRenderFarmPlan() {
  pEnsureFarmUI();
  var panel = clear('farmPlanPanel');
  panel.append(E('h3', 'Farm planning · target inventory'));
  var grid = E('div', null, 'ingredient-picker');
  Object.entries(C).forEach(([k, v]) => {
    var row = E('label', null, 'ingredient-row');
    var input = E('input');
    input.type = 'number'; input.min = 0; input.max = 99; input.value = s.plan[k] || 0;
    input.onchange = () => { s.plan[k] = Math.max(0, Math.min(99, Number(input.value) || 0)); save(); };
    row.append(E('span', v[0]), input);
    grid.append(row);
  });
  panel.append(grid);
  var next = Math.min(3, s.farmLevel + 1);
  var req = next === 2 ? 5 : 7;
  var text = 'Farm Lv ' + s.farmLevel + ' · ' + s.plots.length + ' plots · +' + (s.farmLevel - 1) + ' yield';
  panel.append(E('p', text, 'muted-copy'));
  if (s.farmLevel < 3) panel.append(B('Upgrade farm · ' + P_FARM_COST[next] + 'c · Lv ' + req, pUpgradeFarm, s.level < req));
  else panel.append(E('strong', 'Farm fully upgraded'));
}

farmUI = function() {
  P_OLD.farmUI();
  pRenderFarmPlan();
};

kitchenUI = function() {
  P_OLD.kitchenUI();
  var rules = pRecipeRules();
  var locked = !rules.slots;
  $('customRecipeName').disabled = locked;
  $('createRecipe').disabled = locked;
  $('createRecipe').textContent = locked ? 'Unlocks Lv 8' : 'Create recipe';
  Object.keys(C).forEach((k, i) => {
    var row = $('customIngredientPicker').children[i];
    if (!row) return;
    var allow = rules.crops.includes(k);
    var check = row.querySelector('input'), select = row.querySelector('select');
    if (!allow) { delete D[k]; check.checked = false; }
    check.disabled = !allow;
    select.disabled = !allow || !check.checked;
    row.title = allow ? '' : 'Ingredient unlocks later';
  });
  if (Object.keys(D).length > rules.slots) Object.keys(D).slice(rules.slots).forEach(k => delete D[k]);
  $('customPricePreview').textContent = locked ? 'Custom recipes unlock at Lv 8' : 'Slots ' + Object.keys(D).length + '/' + rules.slots + ' · Auto price: ' + price(D) + 'c';
};

restoUI = function() {
  P_OLD.restoUI();
  Object.keys(W).forEach((k, i) => {
    var card = $('workerGrid').children[i];
    if (!card) return;
    var hireBtn = card.querySelector('button');
    if (!s.workers[k] && s.level < P_UNLOCK[k]) {
      hireBtn.disabled = true;
      hireBtn.textContent = 'Unlock Lv ' + P_UNLOCK[k];
    }
    if (s.workers[k]) {
      var lvl = s.helperLevel[k] || 1;
      card.append(E('small', 'Helper Lv ' + lvl + ' · ' + pInterval(k).toFixed(1) + 's interval'));
      if (lvl < 2) card.append(B('Upgrade Lv 2 · ' + P_HELPER_COST[k] + 'c', () => pUpgradeHelper(k), s.level < 6));
    }
  });
};

function pRenderRoadmap() {
  var host = $('skillGrid').parentElement;
  var old = $('unlockRoadmap');
  if (old) old.remove();
  var box = E('div', null, 'subpanel'); box.id = 'unlockRoadmap';
  box.append(E('h3', 'Level unlocks'));
  var items = [
    [2, 'Farmhand'], [3, 'Cook'], [4, 'Server'], [5, 'Farm Upgrade Lv 2'],
    [6, 'Helper Upgrade Lv 2'], [7, 'Farm Upgrade Lv 3'], [8, 'Custom Recipes'],
    [10, '3 recipe ingredients + Corn'], [12, '4 ingredients + Carrot'], [15, '5 ingredients + Potato']
  ];
  items.forEach(x => { var row = E('small', (s.level >= x[0] ? '✓ ' : '🔒 ') + 'Lv ' + x[0] + ' · ' + x[1]); row.style.display = 'block'; box.append(row); });
  host.append(box);
}

var P_OLD_RENDER = render;
render = function() {
  pResizePlots();
  P_OLD_RENDER();
  pRenderRoadmap();
};

function pOfflineProgression() {
  var now = Date.now();
  var sec = Math.min(28800, Math.max(0, (now - s.progressSeen) / 1000));
  if (sec < 15) { s.progressSeen = now; save(); return; }
  if (s.workers.farmer) {
    var interval = pInterval('farmer');
    var attempts = Math.min(3000, Math.floor(sec / interval));
    var start = now - sec * 1000;
    for (var i = 1; i <= attempts; i++) pFarmJob(start + i * interval * 1000);
  }
  ['cook', 'server'].forEach(k => {
    if (!s.workers[k] || s.helperLevel[k] < 2) return;
    var extra = Math.max(0, Math.floor(sec / pInterval(k)) - Math.floor(sec / W[k][3]));
    for (var i = 0; i < Math.min(1000, extra); i++) if (!P_OLD.job(k)) break;
  });
  s.progressSeen = now;
  debt();
  save();
}

pInitState();
pOfflineProgression();
setInterval(() => { s.progressSeen = Date.now(); }, 5000);
render();
