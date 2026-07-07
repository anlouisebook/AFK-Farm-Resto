function dungeonUI() {
  $('floorValue').textContent = s.floor;
  $('dungeonIdle').classList.toggle('hidden', !!s.combat);
  $('combatStage').classList.toggle('hidden', !s.combat);
  if (!s.combat) return;
  $('playerHp').textContent = `${Math.max(0, s.combat.hp)} / ${s.combat.max} HP`;
  $('enemyHp').textContent = `${Math.max(0, s.combat.eh)} / ${s.combat.emax} HP`;
  $('enemyName').textContent = s.combat.name;
}

function townUI() {
  const box = $('choiceEvent');
  box.replaceChildren();
  const e = choice();
  const title = document.createElement('h3');
  const copy = document.createElement('p');
  if (e) {
    title.textContent = e[0];
    copy.textContent = e[1];
    box.append(title, copy);
    const actions = document.createElement('div');
    actions.className = 'event-choice';
    e[2].forEach((o, i) => {
      const button = document.createElement('button');
      button.textContent = o[0];
      button.disabled = o[1];
      if (i === 0) button.className = 'primary';
      button.onclick = () => choose(i);
      actions.append(button);
    });
    box.append(actions);
  } else {
    title.textContent = 'No urgent town choices';
    copy.textContent = `Community ${s.flags.community || 'pending'} · Supplier ${s.flags.supplier || 'pending'}.`;
    box.append(title, copy);
  }

  const eventLog = $('eventLog');
  eventLog.replaceChildren();
  s.logs.forEach(item => {
    const row = document.createElement('div');
    row.className = `log-entry ${item[1]}`;
    row.textContent = item[0];
    eventLog.append(row);
  });
}

function skillsUI() {
  const grid = $('skillGrid');
  grid.replaceChildren();
  Object.keys(s.stats).forEach(k => {
    const card = document.createElement('div');
    card.className = 'skill-card';
    const strong = document.createElement('strong');
    strong.textContent = `${k[0].toUpperCase() + k.slice(1)} ${s.stats[k]}`;
    const progress = document.createElement('div');
    progress.className = 'progress';
    const fill = document.createElement('i');
    fill.style.width = `${Math.min(100, s.sx[k] / skNeed(k) * 100)}%`;
    progress.append(fill);
    const small = document.createElement('small');
    small.textContent = `${Math.floor(s.sx[k])} / ${skNeed(k)} skill XP`;
    card.append(strong, progress, small);
    grid.append(card);
  });
}

function mapUI() {
  const c = $('worldMap');
  const x = c.getContext('2d');
  const S = 32;
  const g = ['#759b57', '#7da35d'];
  for (let y = 0; y < 10; y++) for (let i = 0; i < 16; i++) {
    x.fillStyle = g[(i + y) % 2]; x.fillRect(i * S, y * S, S, S);
  }
  x.fillStyle = '#c3a879';
  for (let i = 0; i < 16; i++) x.fillRect(i * S, 5 * S, S, S);
  for (let y = 2; y < 9; y++) x.fillRect(8 * S, y * S, S, S);
  x.fillStyle = '#5798a9'; x.fillRect(12 * S, S, 3 * S, 3 * S);
  for (let i = 0; i < 6; i++) {
    const a = 1 + i % 3, b = 1 + Math.floor(i / 3);
    x.fillStyle = '#6c4e32'; x.fillRect(a * S + 3, b * S + 3, S - 6, S - 6);
  }
  x.fillStyle = '#8c493f'; x.fillRect(9 * S, S, 3 * S, 3 * S);
  x.fillStyle = '#e0bd72'; x.fillRect(9 * S + 8, S + 16, 3 * S - 16, 2 * S + 12);
  x.fillStyle = '#3b4039'; x.fillRect(2 * S, 7 * S, 3 * S, 2 * S);
  x.fillStyle = '#171b18'; x.beginPath(); x.arc(3.5 * S, 8.5 * S, 24, Math.PI, 0); x.fill();
  [[6, 1], [6, 3], [14, 7], [12, 8], [0, 8]].forEach(([a, b]) => {
    x.fillStyle = '#385b3d'; x.fillRect(a * S + 5, b * S + 5, 22, 22);
    x.fillStyle = '#654a2e'; x.fillRect(a * S + 14, b * S + 23, 6, 9);
  });
  const a = 7 * S + 8, b = 5 * S + 5;
  x.fillStyle = '#6b4b30'; x.fillRect(a + 6, b, 12, 8);
  x.fillStyle = '#e0b183'; x.fillRect(a + 5, b + 8, 14, 8);
  x.fillStyle = '#d9e8ae'; x.fillRect(a + 3, b + 16, 18, 9);
}

function render() {
  hud();
  farmUI();
  kitchenUI();
  restoUI();
  dungeonUI();
  townUI();
  skillsUI();
  mapUI();
}

function done() {
  consequence();
  save();
  render();
}

document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  $(`${t.dataset.tab}Panel`).classList.add('active');
});

$('customRecipeName').oninput = () => {};
$('createRecipe').onclick = createCustomRecipe;
$('serveNow').onclick = manualServe;
$('enterDungeon').onclick = enter;
$('attackBtn').onclick = strike;
$('fleeBtn').onclick = flee;
$('closeOffline').onclick = () => $('offlineModal').classList.add('hidden');
$('resetSave').onclick = () => {
  if (confirm('Reset all progress?')) {
    localStorage.removeItem(KEY);
    s = fresh();
    recipeDraft.ingredients = {};
    done();
  }
};

offline();
render();
setInterval(tick, 1000);
addEventListener('beforeunload', save);
