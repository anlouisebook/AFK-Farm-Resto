function uiEl(tag, text, cls) {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = text;
  if (cls) node.className = cls;
  return node;
}
function uiClear(id) { const node = $(id); node.replaceChildren(); return node; }
function uiButton(text, fn, disabled) {
  const b = uiEl('button', text);
  b.disabled = !!disabled;
  b.onclick = fn;
  return b;
}
function hud() {
  $('levelValue').textContent = s.level;
  $('xpValue').textContent = Math.floor(s.xp) + ' / ' + need();
  $('coinsValue').textContent = Math.floor(s.coins);
  $('energyValue').textContent = Math.floor(s.energy) + ' / ' + maxE();
  $('repValue').textContent = Math.floor(s.rep);
  $('favorValue').textContent = s.favor;
  $('miraValue').textContent = Math.round(s.rel.mira);
  $('bramValue').textContent = Math.round(s.rel.bram);
}
function farmUI() {
  const picker = uiClear('cropPicker');
  Object.entries(C).forEach(([k, v]) => {
    const b = uiButton(v[0] + ' · ' + seed(k) + 'c · ' + v[2] + 's', () => { s.pick = k; done(); });
    b.className = 'crop-chip' + (s.pick === k ? ' selected' : '');
    picker.append(b);
  });
  const plots = uiClear('plotGrid');
  s.plots.forEach((p, i) => {
    const card = uiEl('div', null, 'plot ' + p.status);
    if (!p.crop) {
      card.append(uiEl('strong', 'Plot ' + (i + 1)), uiEl('small', 'Empty soil'), uiButton('Plant ' + C[s.pick][0], () => plant(i)));
    } else {
      const v = C[p.crop];
      const age = (Date.now() - p.at) / 1000;
      const label = p.status === 'ready' ? 'Ready!' : p.status === 'withered' ? 'Withered' : Math.max(0, Math.ceil(v[2] - age)) + 's left';
      card.append(uiEl('strong', v[0]), uiEl('small', label), uiButton(p.status === 'withered' ? 'Clear' : 'Harvest', () => harvest(i), p.status === 'growing'));
    }
    plots.append(card);
  });
  const inv = uiClear('cropInventory');
  Object.entries(C).forEach(([k, v]) => {
    const card = uiEl('div', null, 'inventory-item');
    card.append(uiEl('strong', v[0] + ': ' + s.crops[k]), uiEl('small', 'Market ' + v[3] + 'c'), uiButton('Sell 1', () => sell(k), !s.crops[k]));
    inv.append(card);
  });
}
function builderUI() {
  const box = uiClear('customIngredientPicker');
  Object.entries(C).forEach(([k, v]) => {
    const row = uiEl('label', null, 'ingredient-row');
    const check = uiEl('input'); check.type = 'checkbox'; check.checked = !!recipeDraft.ingredients[k];
    const qty = uiEl('select'); qty.disabled = !check.checked;
    [1,2,3].forEach(n => { const o = uiEl('option', '×' + n); o.value = n; o.selected = (recipeDraft.ingredients[k] || 1) === n; qty.append(o); });
    check.onchange = () => { if (check.checked) recipeDraft.ingredients[k] = 1; else delete recipeDraft.ingredients[k]; builderUI(); };
    qty.onchange = () => { recipeDraft.ingredients[k] = +qty.value; builderUI(); };
    row.append(check, uiEl('span', v[0]), qty); box.append(row);
  });
  $('customPricePreview').textContent = 'Auto price: ' + customPrice(recipeDraft.ingredients) + 'c';
}
function kitchenUI() {
  const book = recipeBook();
  const grid = uiClear('recipeGrid');
  Object.entries(book).forEach(([k, v]) => {
    const card = uiEl('article', null, 'card');
    card.append(uiEl('h3', v[0]), uiEl('small', (s.customRecipes[k] ? 'Custom · ' : '') + reqText(v[1])), uiEl('p', 'Price ' + v[2] + 'c · Success ' + Math.round(cookChance() * 100) + '%'), uiEl('strong', 'Stock: ' + (s.dishes[k] || 0)), uiButton('Cook · 1 Energy', () => cook(k), !has(v[1])));
    grid.append(card);
  });
  const select = uiClear('autoRecipeSelect');
  Object.entries(book).forEach(([k, v]) => { const o = uiEl('option', v[0]); o.value = k; o.selected = s.autoRecipe === k; select.append(o); });
  select.onchange = () => { s.autoRecipe = select.value; done(); };
  builderUI();
}
function restoUI() {
  const book = recipeBook();
  $('menuCount').textContent = s.menu.length + ' / 3';
  const menuBox = uiClear('menuGrid');
  Object.entries(book).forEach(([k, v]) => {
    const label = uiEl('label', null, 'menu-item' + (s.menu.includes(k) ? ' selected' : ''));
    const check = uiEl('input'); check.type = 'checkbox'; check.checked = s.menu.includes(k); check.onchange = () => menu(k);
    label.append(check, uiEl('span', v[0] + ' · ' + (s.dishes[k] || 0) + ' ready · ' + v[2] + 'c')); menuBox.append(label);
  });
  const workers = uiClear('workerGrid');
  Object.entries(WORKERS).forEach(([k, w]) => {
    const card = uiEl('article', null, 'worker-card' + (s.workers[k] ? ' hired' : ''));
    card.append(uiEl('h3', w[0]), uiEl('small', 'Hire ' + w[1] + 'c · Wage ' + w[2] + 'c/job'), uiEl('p', w[4] + ' Every ' + w[3] + 's.'), uiButton(s.workers[k] ? 'Hired' : 'Hire ' + w[1] + 'c', () => hireWorker(k), s.workers[k]));
    workers.append(card);
  });
  const hasDish = s.menu.some(k => s.dishes[k] > 0);
  $('serviceTimer').textContent = !s.workers.server ? 'Manual only' : !hasDish ? 'Waiting for dish' : Math.max(0, Math.ceil(WORKERS.server[3] - s.workerProgress.server)) + 's';
  $('servedValue').textContent = s.served;
  $('debtValue').textContent = s.coins < 0 ? Math.abs(Math.floor(s.coins)) + 'c debt' : 'Stable';
  $('serveNow').disabled = !hasDish || s.energy < 1;
}
