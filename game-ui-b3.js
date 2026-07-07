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
