/* ═══════════════════════════════════════════════════
   battle.js — 1v1 Real-Time Battle Mode
   No backend needed — uses CF API + deterministic room codes
   Two players share a room code, solve same problems,
   progress tracked via Codeforces API polling.
   ═══════════════════════════════════════════════════ */

const BATTLE_DURATIONS = [15, 20, 30, 45, 60];

let _battle = {
  phase: "lobby", // lobby | setup | active | results
  settings: null,
  roomCode: "",
  myHandle: "",
  opponentHandle: "",
  problems: [],
  startTime: null,
  endTime: null,
  myScore: {},
  oppScore: {},
  pollTimer: null,
  countdownTimer: null,
  timeLeft: 0,
};

/* ═══════ ROOM CODE ENCODING ═══════
   Packs settings into a short alphanumeric code:
   seed(16 bits) | ratingMin bucket(5) | ratingMax bucket(5) | duration idx(3) | numProblems(2)
   = 31 bits → base36 → 6 chars → formatted as XXX-XXX
*/

function battleGenerateCode(rMin, rMax, dur, nProb) {
  const seed = Math.floor(Math.random() * 0xffff);
  const lo = Math.floor((rMin - 800) / 100);
  const hi = Math.floor((rMax - 800) / 100);
  const dIdx = BATTLE_DURATIONS.indexOf(dur);
  const n = nProb - 3;
  const packed =
    ((seed & 0xffff) << 15) |
    ((lo & 0x1f) << 10) |
    ((hi & 0x1f) << 5) |
    (((dIdx >= 0 ? dIdx : 2) & 0x7) << 2) |
    (n & 0x3);
  const code = Math.abs(packed).toString(36).toUpperCase().padStart(6, "0");
  return code.slice(0, 3) + "-" + code.slice(3, 6);
}

function battleParseCode(raw) {
  const clean = raw.replace(/[^A-Za-z0-9]/g, "");
  if (clean.length < 5) return null;
  const packed = parseInt(clean.toUpperCase(), 36);
  if (isNaN(packed) || packed < 0) return null;
  const n = (packed & 0x3) + 3;
  const dIdx = (packed >> 2) & 0x7;
  const hi = ((packed >> 5) & 0x1f) * 100 + 800;
  const lo = ((packed >> 10) & 0x1f) * 100 + 800;
  const seed = (packed >> 15) & 0xffff;
  if (lo < 800 || hi > 3500 || lo > hi) return null;
  return {
    seed,
    ratingMin: lo,
    ratingMax: hi,
    duration: BATTLE_DURATIONS[dIdx] || 30,
    numProblems: Math.min(n, 6),
  };
}

/* ═══════ SEEDED RNG ═══════ */
function battleRNG(seed) {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return (s >>> 0) / 0x100000000;
  };
}

/* ═══════ SELECT PROBLEMS ═══════
   Uses seeded RNG so both players get IDENTICAL problems from same room code.
*/
function battleSelectProblems(problemset, settings) {
  const { ratingMin, ratingMax, numProblems, seed } = settings;
  const rng = battleRNG(seed);

  let pool = problemset.filter(
    (p) =>
      p.rating &&
      p.rating >= ratingMin &&
      p.rating <= ratingMax &&
      p.contestId &&
      p.index,
  );

  // Fisher-Yates shuffle with seeded RNG (deterministic!)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // Spread across rating range
  const selected = [];
  const step = Math.max(100, (ratingMax - ratingMin) / numProblems);

  for (let k = 0; k < numProblems; k++) {
    const tLo = ratingMin + k * step;
    const tHi = tLo + step;
    const bucket = pool.filter(
      (p) => p.rating >= tLo && p.rating < tHi + 1 && !selected.includes(p),
    );
    if (bucket.length > 0) selected.push(bucket[0]);
  }

  // Fill remaining if needed
  for (const p of pool) {
    if (selected.length >= numProblems) break;
    if (!selected.includes(p)) selected.push(p);
  }

  // Sort by rating (easiest first)
  selected.sort((a, b) => (a.rating || 0) - (b.rating || 0));

  return selected.slice(0, numProblems).map((p, i) => ({
    id: String.fromCharCode(65 + i), // A, B, C, D...
    contestId: p.contestId,
    index: p.index,
    name: p.name,
    rating: p.rating,
    tags: p.tags || [],
    url: `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`,
    key: `${p.contestId}-${p.index}`,
  }));
}

/* ═══════ FETCH RECENT SUBMISSIONS ═══════ */
async function battleFetchSubs(handle) {
  const url = buildUrl("user.status", { handle, from: 1, count: 50 });
  const res = await fetchWithTimeout(url, 12000);
  const data = await res.json();
  return data.status === "OK" ? data.result : [];
}

/* ═══════ CREATE BATTLE (Direct — handles + settings on same page) ═══════ */
async function battleCreateDirect() {
  const my = $("battleMyHandle").value.trim();
  const opp = $("battleOppHandle").value.trim();

  if (!my || !opp) {
    alert("Both Codeforces handles are required!");
    return;
  }
  if (my.toLowerCase() === opp.toLowerCase()) {
    alert("Handles must be different!");
    return;
  }

  const ratingVal = $("battleRatingTarget").value;
  const [rMinStr, rMaxStr] = ratingVal.split("-");
  const rMin = parseInt(rMinStr) || 800;
  const rMax = parseInt(rMaxStr) || 1400;
  const nProb = parseInt($("battleNumProblems").value) || 3;
  const dur = 30; // default 30 min

  const code = battleGenerateCode(rMin, rMax, dur, nProb);
  _battle.settings = battleParseCode(code);
  _battle.roomCode = code;
  _battle.myHandle = my;
  _battle.opponentHandle = opp;

  // Go straight to starting the battle
  _battle.phase = "setup";
  battleRenderSetup();
}

/* ═══════ LEGACY CREATE (keep for compatibility) ═══════ */
async function battleCreate() {
  const rMin = parseInt(($("battleRatingMin") || {}).value) || 800;
  const rMax = parseInt(($("battleRatingMax") || {}).value) || 1400;
  const dur = parseInt(($("battleDuration") || {}).value) || 30;
  const nProb = parseInt(($("battleNumProblems") || {}).value) || 4;

  if (rMin >= rMax) {
    alert("Min rating must be less than max rating!");
    return;
  }
  if (rMax - rMin < 100) {
    alert("Rating range too narrow! Need at least 100 gap.");
    return;
  }

  const code = battleGenerateCode(rMin, rMax, dur, nProb);
  _battle.settings = battleParseCode(code);
  _battle.roomCode = code;
  _battle.phase = "setup";

  // Auto-fill handle if user already analyzed
  const h = $("userHandle");
  if (h && h.textContent) _battle.myHandle = h.textContent;

  battleRenderSetup();
}

/* ═══════ JOIN BATTLE ═══════ */
function battleJoin() {
  const code = $("battleJoinCode").value.trim();
  if (!code) {
    alert("Enter a room code!");
    return;
  }
  const settings = battleParseCode(code);
  if (!settings) {
    alert("Invalid room code! Check and try again.");
    return;
  }

  _battle.settings = settings;
  _battle.roomCode = code.toUpperCase().includes("-")
    ? code.toUpperCase()
    : code.slice(0, 3).toUpperCase() + "-" + code.slice(3).toUpperCase();
  _battle.phase = "setup";

  const h = $("userHandle");
  if (h && h.textContent) _battle.myHandle = h.textContent;

  battleRenderSetup();
}

/* ═══════ START BATTLE ═══════ */
async function battleStart() {
  const my = _battle.myHandle;
  const opp = _battle.opponentHandle;

  if (!my || !opp) {
    alert("Both Codeforces handles are required!");
    return;
  }
  if (my.toLowerCase() === opp.toLowerCase()) {
    alert("Handles must be different!");
    return;
  }

  const btn = $("battleStartBtn");
  if (btn) {
    btn.textContent = "⏳ Verifying handles...";
    btn.disabled = true;
  }

  try {
    // Verify both handles exist on CF
    await fetchUserInfo(my);
    await delay(400);
    await fetchUserInfo(opp);
    await delay(400);

    btn.textContent = "⏳ Loading problems...";

    // Fetch problemset & select problems deterministically
    const ps = await fetchProblemset();
    _battle.problems = battleSelectProblems(ps, _battle.settings);

    if (_battle.problems.length === 0) {
      alert("No problems found for this rating range! Try a wider range.");
      btn.textContent = "⚔️ Start Battle";
      btn.disabled = false;
      return;
    }

    // GO!
    _battle.phase = "active";
    _battle.startTime = Math.floor(Date.now() / 1000);
    _battle.endTime = _battle.startTime + _battle.settings.duration * 60;
    _battle.timeLeft = _battle.settings.duration * 60;
    _battle.myScore = {};
    _battle.oppScore = {};

    battleRenderActive();

    // Countdown timer (every second)
    _battle.countdownTimer = setInterval(() => {
      _battle.timeLeft = Math.max(
        0,
        _battle.endTime - Math.floor(Date.now() / 1000),
      );
      battleUpdateTimer();
      if (_battle.timeLeft <= 0) battleEnd();
    }, 1000);

    // Start polling (every 20 seconds)
    battlePoll(); // immediate first poll
    _battle.pollTimer = setInterval(battlePoll, 20000);
  } catch (e) {
    alert("Error: " + e.message);
    btn.textContent = "⚔️ Start Battle";
    btn.disabled = false;
  }
}

/* ═══════ POLL PROGRESS ═══════
   Fetches recent submissions for both players,
   checks if any battle problems were solved after start time.
*/
async function battlePoll() {
  if (_battle.phase !== "active") return;

  const indicator = $("battlePollIndicator");
  if (indicator) indicator.classList.add("polling");

  try {
    const mySubs = await battleFetchSubs(_battle.myHandle);
    await delay(500);
    const oppSubs = await battleFetchSubs(_battle.opponentHandle);

    for (const prob of _battle.problems) {
      // Check my solves
      if (!_battle.myScore[prob.key]) {
        const solve = mySubs.find(
          (s) =>
            s.problem.contestId === prob.contestId &&
            s.problem.index === prob.index &&
            s.verdict === "OK" &&
            s.creationTimeSeconds >= _battle.startTime - 120,
        );
        if (solve) _battle.myScore[prob.key] = solve.creationTimeSeconds;
      }

      // Check opponent solves
      if (!_battle.oppScore[prob.key]) {
        const solve = oppSubs.find(
          (s) =>
            s.problem.contestId === prob.contestId &&
            s.problem.index === prob.index &&
            s.verdict === "OK" &&
            s.creationTimeSeconds >= _battle.startTime - 120,
        );
        if (solve) _battle.oppScore[prob.key] = solve.creationTimeSeconds;
      }
    }

    battleUpdateScoreboard();

    // Auto-end if ALL problems solved by BOTH
    const myCount = Object.keys(_battle.myScore).length;
    const oppCount = Object.keys(_battle.oppScore).length;
    if (
      myCount === _battle.problems.length &&
      oppCount === _battle.problems.length
    ) {
      battleEnd();
    }
  } catch (e) {
    console.warn("Battle poll error:", e.message);
  } finally {
    if (indicator) {
      setTimeout(() => indicator.classList.remove("polling"), 800);
    }
  }
}

/* ═══════ END BATTLE ═══════ */
function battleEnd() {
  _battle.phase = "results";
  if (_battle.pollTimer) {
    clearInterval(_battle.pollTimer);
    _battle.pollTimer = null;
  }
  if (_battle.countdownTimer) {
    clearInterval(_battle.countdownTimer);
    _battle.countdownTimer = null;
  }

  // One final poll then show results
  battleFetchSubs(_battle.myHandle)
    .then((mySubs) => {
      return delay(300).then(() =>
        battleFetchSubs(_battle.opponentHandle).then((oppSubs) => {
          for (const prob of _battle.problems) {
            if (!_battle.myScore[prob.key]) {
              const s = mySubs.find(
                (sub) =>
                  sub.problem.contestId === prob.contestId &&
                  sub.problem.index === prob.index &&
                  sub.verdict === "OK" &&
                  sub.creationTimeSeconds >= _battle.startTime - 120,
              );
              if (s) _battle.myScore[prob.key] = s.creationTimeSeconds;
            }
            if (!_battle.oppScore[prob.key]) {
              const s = oppSubs.find(
                (sub) =>
                  sub.problem.contestId === prob.contestId &&
                  sub.problem.index === prob.index &&
                  sub.verdict === "OK" &&
                  sub.creationTimeSeconds >= _battle.startTime - 120,
              );
              if (s) _battle.oppScore[prob.key] = s.creationTimeSeconds;
            }
          }
          battleRenderResults();
        }),
      );
    })
    .catch(() => {
      battleRenderResults();
    });
}

/* ═══════ RESET ═══════ */
function battleReset() {
  if (_battle.pollTimer) clearInterval(_battle.pollTimer);
  if (_battle.countdownTimer) clearInterval(_battle.countdownTimer);
  _battle = {
    phase: "lobby",
    settings: null,
    roomCode: "",
    myHandle: "",
    opponentHandle: "",
    problems: [],
    startTime: null,
    endTime: null,
    myScore: {},
    oppScore: {},
    pollTimer: null,
    countdownTimer: null,
    timeLeft: 0,
  };
  battleRenderLobby();
}

/* ═══════ TIMER UPDATE ═══════ */
function battleUpdateTimer() {
  const el = $("battleTimer");
  if (!el) return;
  const m = Math.floor(_battle.timeLeft / 60);
  const s = _battle.timeLeft % 60;
  el.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  el.classList.toggle("battle-timer-urgent", _battle.timeLeft <= 60);
  el.classList.toggle(
    "battle-timer-warning",
    _battle.timeLeft <= 300 && _battle.timeLeft > 60,
  );
}

/* ═══════ SCOREBOARD UPDATE ═══════ */
function battleUpdateScoreboard() {
  for (const prob of _battle.problems) {
    const myCell = $(`battle-my-${prob.key}`);
    const oppCell = $(`battle-opp-${prob.key}`);

    if (myCell && _battle.myScore[prob.key]) {
      const t = _battle.myScore[prob.key] - _battle.startTime;
      const m = Math.floor(t / 60);
      myCell.innerHTML = `<span class="battle-solved">✅ ${m}m</span>`;
      myCell.className = "battle-cell battle-cell-solved";
    }
    if (oppCell && _battle.oppScore[prob.key]) {
      const t = _battle.oppScore[prob.key] - _battle.startTime;
      const m = Math.floor(t / 60);
      oppCell.innerHTML = `<span class="battle-solved">✅ ${m}m</span>`;
      oppCell.className = "battle-cell battle-cell-solved";
    }
  }

  const myTotal = $("battleMyTotal");
  const oppTotal = $("battleOppTotal");
  if (myTotal) myTotal.textContent = Object.keys(_battle.myScore).length;
  if (oppTotal) oppTotal.textContent = Object.keys(_battle.oppScore).length;
}

/* ═══════ COPY ROOM CODE ═══════ */
function battleCopyCode() {
  const code = _battle.roomCode;
  navigator.clipboard
    .writeText(code)
    .then(() => {
      const btn = $("battleCopyBtn");
      if (btn) {
        btn.textContent = "✅ Copied!";
        setTimeout(() => (btn.textContent = "📋 Copy"), 2000);
      }
    })
    .catch(() => {
      // Fallback for file:// or insecure contexts
      const ta = document.createElement("textarea");
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      const btn = $("battleCopyBtn");
      if (btn) {
        btn.textContent = "✅ Copied!";
        setTimeout(() => (btn.textContent = "📋 Copy"), 2000);
      }
    });
}

/* ═══════ RATING COLORS ═══════ */
function battleRatingColor(r) {
  if (r >= 2400) return "#ff3333";
  if (r >= 2100) return "#ff8c00";
  if (r >= 1900) return "#aa00aa";
  if (r >= 1600) return "#0000ff";
  if (r >= 1400) return "#03a89e";
  if (r >= 1200) return "#008000";
  return "#808080";
}

function battleRatingBg(r) {
  if (r >= 2400) return "rgba(255,51,51,.12)";
  if (r >= 2100) return "rgba(255,140,0,.12)";
  if (r >= 1900) return "rgba(170,0,170,.12)";
  if (r >= 1600) return "rgba(0,0,255,.12)";
  if (r >= 1400) return "rgba(3,168,158,.12)";
  if (r >= 1200) return "rgba(0,128,0,.12)";
  return "rgba(128,128,128,.12)";
}

/* ═══════════════════════════════════════════════════
   RENDER FUNCTIONS — Build UI for each battle phase
   ═══════════════════════════════════════════════════ */

/* ─── LOBBY ─── */
function battleRenderLobby() {
  const c = $("battleContainer");
  if (!c) return;

  // Auto-fill handle from profile if available
  const profileHandle = $("userHandle");
  const myHandleVal = profileHandle ? profileHandle.textContent : "";

  c.innerHTML = `
    <div class="battle-lobby">
      <!-- Hero -->
      <div class="battle-hero">
        <div class="battle-badge-pill">⚔ 1v1 Battle Mode</div>
        <h2 class="battle-hero-title">Coding Duel</h2>
        <p class="battle-hero-sub">Same problems, same timer — who solves faster wins!</p>
      </div>

      <!-- Create Room -->
      <div class="battle-lobby-card">
        <h3 class="battle-card-heading">⚡ Create a Battle Room</h3>

        <div class="battle-handles-row">
          <div class="battle-handle-group">
            <label>Your CF Handle</label>
            <div class="battle-input-icon-wrap">
              <span class="battle-input-icon">👤</span>
              <input type="text" id="battleMyHandle" class="battle-input" placeholder="your_handle"
                value="${myHandleVal}" />
            </div>
          </div>
          <div class="battle-handle-group">
            <label>Friend's CF Handle</label>
            <div class="battle-input-icon-wrap">
              <span class="battle-input-icon">👤</span>
              <input type="text" id="battleOppHandle" class="battle-input" placeholder="friend_handle" />
            </div>
          </div>
        </div>

        <div class="battle-settings-row">
          <div class="battle-form-row">
            <label>Problems</label>
            <select id="battleNumProblems" class="battle-select">
              <option value="3" selected>3 problems</option>
              <option value="4">4 problems</option>
              <option value="5">5 problems</option>
            </select>
          </div>
          <div class="battle-form-row">
            <label>Target Rating</label>
            <select id="battleRatingTarget" class="battle-select">
              <option value="800-1000">~800</option>
              <option value="900-1200">~1000</option>
              <option value="1000-1300">~1200</option>
              <option value="1200-1500" selected>~1400</option>
              <option value="1400-1700">~1600</option>
              <option value="1600-1900">~1800</option>
              <option value="1800-2200">~2000</option>
              <option value="2200-2800">~2400</option>
            </select>
          </div>
        </div>

        <button class="battle-btn battle-btn-create" onclick="battleCreateDirect()">
          ⚔ Generate Battle Room
        </button>
      </div>

      <!-- Divider -->
      <div class="battle-divider">
        <span class="battle-divider-line"></span>
        <span class="battle-divider-text">or join existing</span>
        <span class="battle-divider-line"></span>
      </div>

      <!-- Join Room -->
      <div class="battle-lobby-card">
        <h3 class="battle-card-heading">🔗 Join a Room</h3>
        <div class="battle-join-row">
          <input type="text" id="battleJoinCode" class="battle-input battle-code-input" placeholder="Paste room code..."
            maxlength="8" onkeydown="if(event.key==='Enter')battleJoin()" />
          <button class="battle-btn battle-btn-join" onclick="battleJoin()">▶ Join</button>
        </div>
      </div>
    </div>
  `;
}

/* ─── SETUP (Room created/joined, enter handles) ─── */
function battleRenderSetup() {
  const c = $("battleContainer");
  if (!c) return;
  const s = _battle.settings;

  const hasHandles = _battle.myHandle && _battle.opponentHandle;

  c.innerHTML = `
    <div class="battle-setup">
      <div class="battle-room-header">
        <div class="battle-badge-pill">⚔ BATTLE ROOM</div>
        <div class="battle-room-code-display">
          <span class="battle-room-code-label">Room Code</span>
          <span class="battle-room-code">${_battle.roomCode}</span>
          <button class="battle-btn-small" id="battleCopyBtn" onclick="battleCopyCode()">📋 Copy</button>
        </div>
        <p class="battle-share-hint">📤 Share this code with your opponent!</p>
      </div>

      <div class="battle-settings-summary">
        <div class="battle-setting-chip"><span>📊</span> ${s.ratingMin}–${s.ratingMax}</div>
        <div class="battle-setting-chip"><span>⏱️</span> ${s.duration} min</div>
        <div class="battle-setting-chip"><span>📝</span> ${s.numProblems} problems</div>
      </div>

      <div class="battle-handles-form">
        <div class="battle-handle-group">
          <label>👤 Your CF Handle</label>
          <input type="text" id="battleSetupMyHandle" class="battle-input" placeholder="e.g. tourist"
            value="${_battle.myHandle}" onkeydown="if(event.key==='Enter')document.getElementById('battleSetupOppHandle').focus()" />
        </div>
        <div class="battle-vs-badge">VS</div>
        <div class="battle-handle-group">
          <label>👤 Opponent's CF Handle</label>
          <input type="text" id="battleSetupOppHandle" class="battle-input" placeholder="e.g. jiangly"
            value="${_battle.opponentHandle}" onkeydown="if(event.key==='Enter')battleStartFromSetup()" />
        </div>
      </div>

      <div class="battle-start-area">
        <button class="battle-btn battle-btn-start" id="battleStartBtn" onclick="battleStartFromSetup()">⚔️ Start Battle</button>
        <button class="battle-btn battle-btn-ghost" onclick="battleReset()">← Back to Lobby</button>
      </div>
    </div>
  `;

  // Auto-focus
  if (!_battle.myHandle) {
    const myInput = $("battleSetupMyHandle");
    if (myInput) myInput.focus();
  } else if (!_battle.opponentHandle) {
    const oppInput = $("battleSetupOppHandle");
    if (oppInput) oppInput.focus();
  }

  // Auto-start if both handles are pre-filled
  if (hasHandles) {
    battleStartFromSetup();
  }
}

/* Bridge from setup page to actual start */
async function battleStartFromSetup() {
  const my = $("battleSetupMyHandle").value.trim();
  const opp = $("battleSetupOppHandle").value.trim();
  if (my) _battle.myHandle = my;
  if (opp) _battle.opponentHandle = opp;
  await battleStart();
}

/* ─── ACTIVE BATTLE ─── */
function battleRenderActive() {
  const c = $("battleContainer");
  if (!c) return;

  const problemRows = _battle.problems
    .map(
      (p) => `
    <tr>
      <td class="battle-prob-id">${p.id}</td>
      <td class="battle-prob-name">
        <a href="${p.url}" target="_blank" rel="noopener">${p.contestId}${p.index}. ${p.name}</a>
      </td>
      <td class="battle-prob-rating">
        <span class="battle-rating-badge" style="background:${battleRatingBg(p.rating)};color:${battleRatingColor(p.rating)}">${p.rating}</span>
      </td>
      <td class="battle-cell" id="battle-my-${p.key}"><span class="battle-pending">⏳</span></td>
      <td class="battle-cell" id="battle-opp-${p.key}"><span class="battle-pending">⏳</span></td>
    </tr>
  `,
    )
    .join("");

  c.innerHTML = `
    <div class="battle-active">
      <!-- Timer & Status Bar -->
      <div class="battle-status-bar">
        <div class="battle-timer-wrap">
          <div class="battle-timer-label">⏱️ TIME LEFT</div>
          <div class="battle-timer" id="battleTimer">
            ${String(Math.floor(_battle.timeLeft / 60)).padStart(2, "0")}:${String(_battle.timeLeft % 60).padStart(2, "0")}
          </div>
        </div>
        <div class="battle-poll-wrap">
          <span class="battle-poll-dot" id="battlePollIndicator"></span>
          <span class="battle-poll-text">Live tracking (20s)</span>
        </div>
      </div>

      <!-- Score Header -->
      <div class="battle-score-bar">
        <div class="battle-player-card battle-player-me">
          <div class="battle-player-avatar">👤</div>
          <div class="battle-player-info">
            <div class="battle-player-name">${_battle.myHandle}</div>
            <div class="battle-player-label">YOU</div>
          </div>
          <div class="battle-player-score" id="battleMyTotal">0</div>
        </div>

        <div class="battle-vs-live">
          <span class="battle-vs-text">VS</span>
          <span class="battle-vs-glow"></span>
        </div>

        <div class="battle-player-card battle-player-opp">
          <div class="battle-player-score" id="battleOppTotal">0</div>
          <div class="battle-player-info">
            <div class="battle-player-name">${_battle.opponentHandle}</div>
            <div class="battle-player-label">OPPONENT</div>
          </div>
          <div class="battle-player-avatar">👤</div>
        </div>
      </div>

      <!-- Problems Table -->
      <div class="battle-table-wrap">
        <table class="battle-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Problem</th>
              <th>Rating</th>
              <th>🟢 ${_battle.myHandle}</th>
              <th>🔴 ${_battle.opponentHandle}</th>
            </tr>
          </thead>
          <tbody>${problemRows}</tbody>
        </table>
      </div>

      <!-- Actions -->
      <div class="battle-active-actions">
        <button class="battle-btn battle-btn-danger" onclick="if(confirm('End battle early?'))battleEnd()">🛑 End Battle</button>
        <button class="battle-btn battle-btn-ghost" onclick="battlePoll()">🔄 Refresh Now</button>
      </div>

      <p class="battle-hint">
        💡 Open the problem links above, solve them on Codeforces, and submit. The app will auto-detect your submissions!
      </p>
    </div>
  `;
}

/* ─── RESULTS ─── */
function battleRenderResults() {
  const c = $("battleContainer");
  if (!c) return;

  const myCount = Object.keys(_battle.myScore).length;
  const oppCount = Object.keys(_battle.oppScore).length;

  // Total solve times
  let myTotalTime = 0;
  let oppTotalTime = 0;
  for (const key of Object.keys(_battle.myScore)) {
    myTotalTime += _battle.myScore[key] - _battle.startTime;
  }
  for (const key of Object.keys(_battle.oppScore)) {
    oppTotalTime += _battle.oppScore[key] - _battle.startTime;
  }

  // Determine winner
  let winner, winnerIcon, resultClass, subtitle;
  if (myCount > oppCount) {
    winner = _battle.myHandle;
    winnerIcon = "🏆";
    resultClass = "battle-result-win";
    subtitle = `${myCount} vs ${oppCount} problems solved`;
  } else if (oppCount > myCount) {
    winner = _battle.opponentHandle;
    winnerIcon = "🏆";
    resultClass = "battle-result-lose";
    subtitle = `${oppCount} vs ${myCount} problems solved`;
  } else if (myCount === oppCount && myCount > 0) {
    // Tiebreak by total solve time
    if (myTotalTime < oppTotalTime) {
      winner = _battle.myHandle;
      winnerIcon = "⚡";
      resultClass = "battle-result-win";
      subtitle = `Tied ${myCount}-${oppCount} — won by faster total time!`;
    } else if (oppTotalTime < myTotalTime) {
      winner = _battle.opponentHandle;
      winnerIcon = "⚡";
      resultClass = "battle-result-lose";
      subtitle = `Tied ${myCount}-${oppCount} — won by faster total time!`;
    } else {
      winner = null;
      winnerIcon = "🤝";
      resultClass = "battle-result-draw";
      subtitle = `Both solved ${myCount} problems in same time!`;
    }
  } else {
    winner = null;
    winnerIcon = "🤝";
    resultClass = "battle-result-draw";
    subtitle =
      myCount === 0
        ? "No problems solved by either player"
        : "It's a perfect draw!";
  }

  const winnerText = winner
    ? `${winnerIcon} ${winner} WINS!`
    : `${winnerIcon} It's a Draw!`;

  const problemDetails = _battle.problems
    .map((p) => {
      const myTime = _battle.myScore[p.key]
        ? Math.floor((_battle.myScore[p.key] - _battle.startTime) / 60) + "m"
        : "❌";
      const oppTime = _battle.oppScore[p.key]
        ? Math.floor((_battle.oppScore[p.key] - _battle.startTime) / 60) + "m"
        : "❌";
      const myClass = _battle.myScore[p.key]
        ? "battle-cell-solved"
        : "battle-cell-unsolved";
      const oppClass = _battle.oppScore[p.key]
        ? "battle-cell-solved"
        : "battle-cell-unsolved";

      return `
      <tr>
        <td class="battle-prob-id">${p.id}</td>
        <td class="battle-prob-name"><a href="${p.url}" target="_blank">${p.contestId}${p.index}. ${p.name}</a></td>
        <td class="battle-prob-rating">${p.rating}</td>
        <td class="battle-cell ${myClass}">${_battle.myScore[p.key] ? "✅ " + myTime : "❌"}</td>
        <td class="battle-cell ${oppClass}">${_battle.oppScore[p.key] ? "✅ " + oppTime : "❌"}</td>
      </tr>
    `;
    })
    .join("");

  c.innerHTML = `
    <div class="battle-results ${resultClass}">
      <div class="battle-result-hero">
        <div class="battle-result-trophy">${winnerIcon}</div>
        <h2 class="battle-result-title">${winnerText}</h2>
        <p class="battle-result-sub">${subtitle}</p>
      </div>

      <div class="battle-final-score">
        <div class="battle-final-player ${myCount >= oppCount && myCount > 0 ? "battle-final-winner" : ""}">
          <div class="battle-final-handle">${_battle.myHandle}</div>
          <div class="battle-final-num">${myCount}<span>/${_battle.problems.length}</span></div>
          <div class="battle-final-label">solved</div>
          <div class="battle-final-time">${myTotalTime > 0 ? Math.floor(myTotalTime / 60) + " min total" : "—"}</div>
        </div>
        <div class="battle-final-vs">VS</div>
        <div class="battle-final-player ${oppCount >= myCount && oppCount > 0 ? "battle-final-winner" : ""}">
          <div class="battle-final-handle">${_battle.opponentHandle}</div>
          <div class="battle-final-num">${oppCount}<span>/${_battle.problems.length}</span></div>
          <div class="battle-final-label">solved</div>
          <div class="battle-final-time">${oppTotalTime > 0 ? Math.floor(oppTotalTime / 60) + " min total" : "—"}</div>
        </div>
      </div>

      <div class="battle-table-wrap">
        <table class="battle-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Problem</th>
              <th>Rating</th>
              <th>${_battle.myHandle}</th>
              <th>${_battle.opponentHandle}</th>
            </tr>
          </thead>
          <tbody>${problemDetails}</tbody>
        </table>
      </div>

      <div class="battle-result-actions">
        <button class="battle-btn battle-btn-primary" onclick="battleReset()">🔄 New Battle</button>
        <button class="battle-btn battle-btn-ghost" onclick="switchTab('overview')">📊 Back to Dashboard</button>
      </div>
    </div>
  `;

  // Confetti for the winner!
  if (winner && typeof confetti !== "undefined") {
    setTimeout(
      () =>
        confetti({
          particleCount: 120,
          spread: 90,
          origin: { y: 0.45 },
          colors: ["#6c63ff", "#38bdf8", "#22c55e", "#f59e0b", "#f43f5e"],
        }),
      300,
    );
    setTimeout(
      () =>
        confetti({
          particleCount: 60,
          spread: 60,
          origin: { x: 0.2, y: 0.55 },
        }),
      800,
    );
    setTimeout(
      () =>
        confetti({
          particleCount: 60,
          spread: 60,
          origin: { x: 0.8, y: 0.55 },
        }),
      1200,
    );
  }
}

/* ═══════ INIT (called when tab is first activated) ═══════ */
function initBattle() {
  if (_battle.phase === "lobby") battleRenderLobby();
}
