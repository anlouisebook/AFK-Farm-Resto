function enter() {
  if (s.combat || !energy(6)) return;
  const hp = 18 + s.level * 4 + s.stats.stamina * 2;
  const eh = 8 + s.floor * 6;
  s.combat = {
    hp,
    max: hp,
    eh,
    emax: eh,
    name: s.floor === 3 ? 'Cellar Warden' : s.floor === 2 ? 'Root Goblin' : 'Moss Slime'
  };
  skill('stamina', 2);
  done();
}

function strike() {
  const c = s.combat;
  if (!c) return;
  c.eh -= 2 + s.level + Math.floor(s.stats.farming / 2) + Math.floor(Math.random() * 4);
  if (c.eh <= 0) {
    const n = 12 + s.floor * 9;
    s.coins += n;
    xp(14 + s.floor * 5);
    log(`Cleared floor ${s.floor}. +${n} coins.`, 'good');
    s.floor = s.floor === 3 ? 1 : s.floor + 1;
    s.combat = null;
    toast('Victory!');
    return done();
  }
  c.hp -= 1 + s.floor + Math.floor(Math.random() * 4);
  if (c.hp <= 0) {
    const n = Math.min(Math.max(0, s.coins + 50), 15 + s.floor * 7);
    s.coins -= n;
    s.rep = cap(s.rep - 3, 0, 100);
    s.floor = 1;
    s.combat = null;
    log(`Dungeon defeat. Lost ${n} coins and 3 reputation.`, 'bad');
  }
  done();
}

function flee() {
  if (!s.combat) return;
  s.combat = null;
  s.rep = cap(s.rep - 1, 0, 100);
  log('Fled the dungeon. Reputation -1.', 'bad');
  done();
}

function choice() {
  if (s.level >= 2 && !s.flags.community) {
    return ['Community Supper', 'Mira asks for support. This choice is permanent.', [
      ['Donate 60 coins', s.coins < 60, () => {
        s.coins -= 60; s.favor += 2; s.rel.mira += 3; s.flags.community = 'donated';
        log('Funded the supper. Town +2, Mira +3.', 'good');
      }],
      ['Decline', false, () => {
        s.rep = cap(s.rep - 2, 0, 100); s.rel.mira -= 2; s.flags.community = 'declined';
        log('Declined the supper. Reputation -2, Mira -2.', 'bad');
      }]
    ]];
  }
  if (s.served >= 10 && !s.flags.supplier) {
    return ['Seed Supplier', 'Choose one permanent contract.', [
      ['Local: +10% seed cost', false, () => {
        s.flags.supplier = 'local'; s.favor++; s.rel.bram += 2;
        log('Local supplier chosen.', 'good');
      }],
      ['Bulk: -20% seed cost', false, () => {
        s.flags.supplier = 'bulk'; s.favor--; s.rel.bram--;
        log('Bulk seeds are cheaper but wither sooner.', 'bad');
      }]
    ]];
  }
  return null;
}

function choose(i) {
  const e = choice();
  if (!e) return;
  e[2][i][2]();
  done();
}

function consequence() {
  if (!s.flags.debt && s.coins <= -50) {
    s.flags.debt = true;
    s.rep = cap(s.rep - 10, 0, 100);
    s.menu = [];
    log('Debt crisis: service stopped, reputation -10.', 'bad');
  }
}

function offlineFarmer(start, now) {
  if (!s.workers.farmer) return 0;
  let count = 0;
  s.plots.forEach((p, i) => {
    if (!p.crop) return;
    const g = C[p.crop][2];
    const ageAtStart = (start - p.at) / 1000;
    const readyAt = p.at + g * 1000;
    if (ageAtStart < g + witherWindow(p.crop) && readyAt <= now) {
      s.coins -= WORKERS.farmer[2];
      p.status = 'ready';
      if (collectPlot(i, true, true)) count++;
    }
  });
  return count;
}

function offline() {
  const now = Date.now();
  const start = s.seen || now;
  const sec = Math.min(CAP, Math.max(0, (now - start) / 1000));
  if (sec < 15) return;

  s.energy = Math.min(maxE(), s.energy + sec / 30);
  const harvested = offlineFarmer(start, now);
  grow(now);

  let cooked = 0;
  if (s.workers.cook) {
    const attempts = Math.min(3000, Math.floor((s.workerProgress.cook + sec) / WORKERS.cook[3]));
    for (let i = 0; i < attempts; i++) {
      if (!workerCook(true)) break;
      cooked++;
    }
    s.workerProgress.cook = (s.workerProgress.cook + sec) % WORKERS.cook[3];
  }

  let served = 0;
  let bad = 0;
  if (s.workers.server) {
    const attempts = Math.min(3000, Math.floor((s.workerProgress.server + sec) / WORKERS.server[3]));
    for (let i = 0; i < attempts; i++) {
      const beforeRep = s.rep;
      if (!workerServe(true)) break;
      served++;
      if (s.rep < beforeRep) bad++;
    }
    s.workerProgress.server = (s.workerProgress.server + sec) % WORKERS.server[3];
  }

  if (s.workers.farmer) s.workerProgress.farmer = (s.workerProgress.farmer + sec) % WORKERS.farmer[3];
  consequence();
  s.seen = now;
  save();

  $('offlineSummary').innerHTML = `<ul>
    <li>Away ${duration(sec)} (8h cap)</li>
    <li>${harvested} crops auto-harvested</li>
    <li>${cooked} auto-cook attempts</li>
    <li>${served} customers auto-served</li>
    <li>${bad} unhappy customers</li>
    <li>Energy recovery applied</li>
  </ul>`;
  $('offlineModal').classList.remove('hidden');
}

function duration(n) {
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  return h ? `${h}h ${m}m` : m ? `${m}m` : `${Math.floor(n)}s`;
}

function tick() {
  const now = Date.now();
  const dt = Math.min(5, (now - s.tick) / 1000);
  s.tick = now;
  grow(now);
  s.energy = Math.min(maxE(), s.energy + dt / 30);
  runWorkers(dt);
  consequence();
  save();
  render();
}
