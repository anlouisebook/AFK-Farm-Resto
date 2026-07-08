'use strict';

function pSetPlan(k, value) {
  s.plan[k] = Math.max(0, Math.min(99, Number(value) || 0));
  done();
}

function pEditPlan(span, k) {
  span.contentEditable = 'true';
  span.focus();
  var range = document.createRange();
  range.selectNodeContents(span);
  var selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  span.onkeydown = e => {
    if (e.key === 'Enter') { e.preventDefault(); span.blur(); }
  };
  span.onblur = () => {
    span.contentEditable = 'false';
    pSetPlan(k, span.textContent);
  };
}

function pEnsureFarmUI() {
  if ($('farmPlanPanel')) return;
  var panel = E('div', null, 'subpanel');
  panel.id = 'farmPlanPanel';
  $('farmPanel').insertBefore(panel, $('cropPicker'));
}

function pRenderFarmPlan() {
  pEnsureFarmUI();
  var panel = clear('farmPlanPanel');
  panel.append(E('h3', 'Farm planning · target inventory'));
  Object.entries(C).forEach(([k, v]) => {
    var row = E('div', null, 'action-row');
    var controls = E('div', null, 'event-choice');
    var minus = B('−', () => pSetPlan(k, s.plan[k] - 1), s.plan[k] <= 0);
    var value = E('strong', String(s.plan[k] || 0), 'price');
    var plus = B('+', () => pSetPlan(k, s.plan[k] + 1), s.plan[k] >= 99);
    minus.className = plus.className = 'tab';
    value.title = 'Click to edit';
    value.tabIndex = 0;
    value.onclick = () => pEditPlan(value, k);
    value.onkeydown = e => { if (e.key === 'Enter') pEditPlan(value, k); };
    controls.append(minus, value, plus);
    row.append(E('span', v[0]), controls);
    panel.append(row);
  });
  var next = Math.min(3, s.farmLevel + 1);
  var req = next === 2 ? 5 : 7;
  panel.append(E('p', 'Farm Lv ' + s.farmLevel + ' · ' + s.plots.length + ' plots · +' + (s.farmLevel - 1) + ' yield', 'muted-copy'));
  if (s.farmLevel < 3) panel.append(B('Upgrade farm · ' + P_FARM_COST[next] + 'c · Lv ' + req, pUpgradeFarm, s.level < req));
  else panel.append(E('strong', 'Farm fully upgraded'));
}

farmUI = function() {
  P_OLD.farmUI();
  pRenderFarmPlan();
};

kitchenUI = function() {
  P_OLD.kitchenUI();
  var rules = pRecipeRules(), locked = !rules.slots;
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
  var grid = clear('workerGrid');
  Object.keys(W).forEach(k => {
    var role = E('article', null, 'worker-card' + (s.helpers[k].length ? ' hired' : ''));
    role.append(E('h3', W[k][0]));
    role.append(E('small', s.helpers[k].length + '/' + pMaxHelpers() + ' helpers · ' + W[k][2] + 'c wage/helper/day'));

    if (s.level < P_UNLOCK[k]) {
      role.append(B('Unlock Lv ' + P_UNLOCK[k], () => {}, true));
    } else if (s.helpers[k].length < pMaxHelpers()) {
      var candidate = s.helperCandidates[k];
      var cost = W[k][1] * candidate;
      role.append(B('Hire Lv ' + candidate + ' · ' + cost + 'c', () => hire(k), false));
    } else {
      role.append(E('small', 'More capacity at player Lv ' + (Math.floor(s.level / 5 + 1) * 5)));
    }

    s.helpers[k].forEach((helper, i) => {
      var row = E('div', null, 'subpanel');
      row.append(E('strong', W[k][0] + ' #' + (i + 1) + ' · Lv ' + helper.level));
      row.append(E('small', pInterval(k, helper).toFixed(1) + 's interval'));
      var maxLevel = Math.min(s.level, 10);
      if (s.level >= 6 && helper.level < maxLevel) {
        row.append(B('Upgrade · ' + (P_HELPER_COST[k] * helper.level) + 'c', () => pUpgradeHelper(k, i), false));
      }
      role.append(row);
    });
    grid.append(role);
  });

  var ok = s.menu.some(k => s.dishes[k]);
  $('serviceTimer').textContent = s.helpers.server.length ? s.helpers.server.length + ' server(s)' : 'Manual only';
  $('servedValue').textContent = s.served;
  $('debtValue').textContent = s.coins < 0 ? Math.abs(Math.floor(s.coins)) + 'c debt' : 'Stable';
  $('serveNow').disabled = !ok;
};

function pRenderRoadmap() {
  var host = $('skillGrid').parentElement;
  var old = $('unlockRoadmap');
  if (old) old.remove();
  var box = E('div', null, 'subpanel'); box.id = 'unlockRoadmap';
  var left = Math.max(0, P_DAY_SECONDS - s.dayProgress);
  var mm = Math.floor(left / 60), ss = Math.floor(left % 60);
  box.append(E('h3', 'Day ' + s.gameDay + ' · wages in ' + mm + ':' + String(ss).padStart(2, '0')));
  box.append(E('p', 'Daily helper wages: ' + pDailyWage() + 'c · helper cap ' + pMaxHelpers() + '/role', 'muted-copy'));
  var items = [
    [2, 'Farmhand'], [3, 'Cook'], [4, 'Server'], [5, 'Farm Upgrade Lv 2'],
    [6, 'Manual Helper Upgrades'], [7, 'Farm Upgrade Lv 3'], [8, 'Custom Recipes'],
    [10, '3 recipe ingredients + Corn'], [12, '4 ingredients + Carrot'], [15, '5 ingredients + Potato']
  ];
  items.forEach(x => {
    var row = E('small', (s.level >= x[0] ? '✓ ' : '🔒 ') + 'Lv ' + x[0] + ' · ' + x[1]);
    row.style.display = 'block';
    box.append(row);
  });
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
  sessionStorage.removeItem('hh-afk-offline-start');
  if (sec < 15) { s.progressSeen = now; save(); return; }

  s.energy = Math.min(maxE(), s.energy + sec / 30);
  var days = pAdvanceDay(sec);
  var events = [];
  Object.keys(W).forEach(k => {
    s.helpers[k].forEach((helper, helperIndex) => {
      var interval = pInterval(k, helper);
      var oldProgress = helper.progress || 0;
      var attempts = Math.min(3000, Math.floor((oldProgress + sec) / interval));
      var first = Math.max(0, interval - oldProgress);
      for (var i = 0; i < attempts && events.length < 5000; i++) {
        events.push({ time: s.progressSeen + (first + i * interval) * 1000, role: k, helper: helperIndex });
      }
      helper.progress = (oldProgress + sec) % interval;
    });
  });
  events.sort((a, b) => a.time - b.time);
  var counts = { farmer: 0, cook: 0, server: 0 };
  events.forEach(e => { if (pDoJob(e.role, e.time)) counts[e.role]++; });
  grow(now);
  s.progressSeen = now;
  debt();
  save();
  $('offlineSummary').textContent = 'Away: farm jobs ' + counts.farmer + ', cooked ' + counts.cook + ', served ' + counts.server + ', days ' + days;
  $('offlineModal').classList.remove('hidden');
}

pInitState();
pOfflineProgression();
setInterval(() => { s.progressSeen = Date.now(); }, 5000);
render();
