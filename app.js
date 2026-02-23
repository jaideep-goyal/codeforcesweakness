/* ═══════════════════════════════════════════════════
   app.js — Main Application Controller
   ═══════════════════════════════════════════════════ */

/* ─── Helpers ─── */
function $(id) {
  return document.getElementById(id);
}
function show(el) {
  el.classList.remove("hidden");
}
function hide(el) {
  el.classList.add("hidden");
}

function setHandle(handle) {
  $("handleInput").value = handle;
}

function backToLanding() {
  hide($("dashboard"));
  show($("landing"));
  $("handleInput").value = "";
  const compareInput = $("compareHandleInput");
  if (compareInput) compareInput.value = "";
  const toggle = $("compareToggle");
  if (toggle) {
    toggle.checked = false;
    hide($("compareInputArea"));
  }
  // Reset tabs
  switchTab("overview");
}

/* ─── Go to Battle Mode directly from landing ─── */
function goToBattleDirect() {
  hide($("landing"));
  show($("dashboard"));
  switchTab("battle");
}

/* ─── Compare Toggle ─── */
function toggleCompare() {
  const area = $("compareInputArea");
  if ($("compareToggle").checked) {
    show(area);
    $("compareHandleInput").focus();
  } else {
    hide(area);
  }
}

/* ─── Theme Toggle ─── */
const _sunSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
const _moonSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

function _setThemeIcons(theme) {
  const icon = theme === "dark" ? _moonSVG : _sunSVG;
  const btns = [
    document.getElementById("themeToggle"),
    document.getElementById("landingThemeToggle"),
  ];
  btns.forEach((b) => {
    if (b) b.innerHTML = icon;
  });
}

function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  html.setAttribute("data-theme", next);
  _setThemeIcons(next);
  localStorage.setItem("cf-theme", next);
}

// Restore theme on load
(function () {
  const saved = localStorage.getItem("cf-theme");
  if (saved) {
    document.documentElement.setAttribute("data-theme", saved);
    document.addEventListener("DOMContentLoaded", () => _setThemeIcons(saved));
  }
})();

/* ─── Tab Navigation ─── */
function switchTab(tabId) {
  // Update tab buttons
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });
  // Update content
  document.querySelectorAll(".tab-content").forEach((tc) => {
    tc.classList.toggle("active", tc.id === `tab-${tabId}`);
  });
  // Auto-load recommendations when switching to recommend tab
  if (
    tabId === "recommend" &&
    _appState.analyzed &&
    !_appState.recommendLoaded
  ) {
    loadRecommendations();
  }
  // Auto-load upcoming contests
  if (tabId === "upcoming" && !_appState.upcomingLoaded) {
    loadUpcomingContests();
  }
  // Auto-load practice sheet
  if (tabId === "sheet" && _appState.analyzed && !_appState.sheetLoaded) {
    loadPracticeSheet();
  }
  // Auto-load integrity check
  if (
    tabId === "integrity" &&
    _appState.cheatData &&
    !_appState.integrityRendered
  ) {
    renderIntegrityCheck(_appState.cheatData);
    _appState.integrityRendered = true;
  }
  // Auto-load skill card
  if (tabId === "card" && _appState.analyzed && !_appState.cardRendered) {
    initSkillCard(
      _appState.userInfo,
      _appState.analyzed,
      _appState.topicData,
      _appState.kpis,
      _appState.ratingHistory,
    );
    _appState.cardRendered = true;
  }
  // Auto-load 7-day roadmap
  if (tabId === "roadmap" && _appState.analyzed && !_appState.roadmapLoaded) {
    renderStudyRoadmap();
  }
  // Initialize battle mode
  if (tabId === "battle") {
    initBattle();
  }
}

/* ─── Rank color mapping ─── */
function rankColor(rank) {
  if (!rank) return "#94a3b8";
  const r = rank.toLowerCase();
  if (r.includes("legendary")) return "#ff0000";
  if (r.includes("international grandmaster")) return "#ff0000";
  if (r.includes("grandmaster")) return "#ff3333";
  if (r.includes("international master")) return "#ff8c00";
  if (r.includes("master")) return "#ff8c00";
  if (r.includes("candidate master")) return "#aa00aa";
  if (r.includes("expert")) return "#0000ff";
  if (r.includes("specialist")) return "#03a89e";
  if (r.includes("pupil")) return "#008000";
  if (r.includes("newbie")) return "#808080";
  return "#94a3b8";
}

/* ─── Enter key support ─── */
document.addEventListener("DOMContentLoaded", () => {
  $("handleInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") startAnalysis();
  });
});

/* ─── Loading Screen ─── */
const FUN_FACTS = [
  "Did you know? Tourist has solved 4000+ problems!",
  "The fastest CF submissions are under 15ms!",
  "Codeforces has over 200,000 registered users!",
  "DP is the most dreaded topic for beginners!",
  "The first Codeforces round was held in 2010!",
  "Binary search solves 90% of 'find the answer' problems!",
  "Jiangly won IOI gold at age 16!",
  "The hardest CF problem has rating 3500!",
  "Python solutions are 3-5x slower than C++ on average!",
  "Graph problems appear in 40% of Div 2 contests!",
];

function showLoading(step, progress) {
  const overlay = $("loadingOverlay");
  show(overlay);
  $("loadingStep").textContent = step;
  $("loadingBar").style.width = `${progress}%`;
  if (Math.random() < 0.3) {
    $("loadingFun").textContent =
      FUN_FACTS[Math.floor(Math.random() * FUN_FACTS.length)];
  }
}

function hideLoading() {
  hide($("loadingOverlay"));
}

/* ─── Animated Counter ─── */
function animateCounter(el, target, duration = 1000) {
  const start = 0;
  const startTime = performance.now();
  const isFloat = String(target).includes(".");

  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease out cubic
    const current = start + (target - start) * eased;
    el.textContent = isFloat ? current.toFixed(1) : Math.round(current);
    if (progress < 1) requestAnimationFrame(update);
    else el.classList.add("count-animate");
  }
  requestAnimationFrame(update);
}

/* ─── App State (for cross-function access) ─── */
const _appState = {
  analyzed: null,
  submissions: null,
  topicData: null,
  userRating: null,
  recommendLoaded: false,
  potdSkipCount: 0,
  upcomingLoaded: false,
  sheetLoaded: false,
  sheetData: null,
  handle: null,
  ratingHistory: null,
  userInfo: null,
  roadmapLoaded: false,
  kpis: null,
};

/* ─── Main Analysis Flow ─── */
async function startAnalysis() {
  const handle = $("handleInput").value.trim();
  if (!handle) {
    showError("Please enter a Codeforces handle.");
    return;
  }

  const btn = $("analyzeBtn");
  const btnText = btn.querySelector(".btn-text");
  const btnLoader = btn.querySelector(".btn-loader");
  const errorMsg = $("errorMsg");

  hide(errorMsg);
  btnText.textContent = "Analyzing…";
  show(btnLoader);
  btn.disabled = true;

  try {
    // Show loading overlay
    showLoading("Fetching user info...", 5);

    // Fetch data SEQUENTIALLY with delays to avoid CF rate limiting
    const userInfo = await fetchUserInfo(handle);
    showLoading("Fetching submissions...", 15);
    await delay(300);

    const submissions = await fetchAllSubmissions(handle);
    showLoading("Fetching rating history...", 25);
    await delay(300);

    const ratingHistory = await fetchRatingHistory(handle);

    showLoading("Processing submissions...", 30);

    if (submissions.length === 0) {
      throw new Error("No submissions found for this user.");
    }

    // Run core analysis
    const analyzed = buildAnalysisData(submissions);
    const topicData = aggregateByTopic(analyzed);
    const diffData = aggregateByDifficulty(analyzed);
    const heatmapData = buildHeatmapData(analyzed);
    const cvp = contestVsPractice(analyzed);
    const verdicts = globalVerdicts(submissions);
    const kpis = computeKPIs(analyzed, submissions);
    const langData = aggregateByLanguage(submissions);
    const calendarData = buildCalendarData(submissions);

    showLoading("Generating insights...", 50);

    const insights = generateInsights(
      analyzed,
      topicData,
      heatmapData,
      cvp,
      kpis,
    );

    // New analysis features
    showLoading("Computing streaks & badges...", 60);
    const streaks = computeStreaks(submissions);
    const todData = buildTimeOfDayData(submissions);
    const diffProgression = buildDifficultyProgression(submissions);
    const contestDeepDive = buildContestDeepDive(ratingHistory, submissions);
    const badges = computeBadges(
      analyzed,
      submissions,
      ratingHistory,
      kpis,
      topicData,
      streaks,
    );

    // Cheat / integrity analysis
    const cheatData = buildCheatAnalysis(submissions, ratingHistory);

    // Save state for recommendations + POTD
    _appState.analyzed = analyzed;
    _appState.submissions = submissions;
    _appState.topicData = topicData;
    _appState.userRating = userInfo.rating || null;
    _appState.handle = handle;
    _appState.userInfo = userInfo;
    _appState.ratingHistory = ratingHistory;
    _appState.kpis = kpis;
    _appState.recommendLoaded = false;
    _appState.potdSkipCount = 0;
    _appState.upcomingLoaded = false;
    _appState.sheetLoaded = false;
    _appState.sheetData = null;
    _appState.cheatData = cheatData;
    _appState.integrityRendered = false;
    _appState.cardRendered = false;
    _appState.roadmapLoaded = false;

    // Populate topic dropdown for recommender
    populateTopicDropdown(topicData);

    showLoading("Checking peer comparison...", 70);

    // Peer comparison
    const compareHandle = $("compareToggle").checked
      ? $("compareHandleInput").value.trim()
      : "";
    let peerData = null;
    if (compareHandle) {
      try {
        showLoading(`Fetching ${compareHandle}'s data...`, 75);
        const peerInfo = await fetchUserInfo(compareHandle);
        await delay(300);
        const peerSubs = await fetchAllSubmissions(compareHandle);
        const peerAnalyzed = buildAnalysisData(peerSubs);
        peerData = {
          handleB: compareHandle,
          comparison: computePeerComparison(
            analyzed,
            submissions,
            peerAnalyzed,
            peerSubs,
          ),
        };
      } catch (e) {
        console.warn("Peer comparison failed:", e.message);
      }
    }

    showLoading("Rendering dashboard...", 85);

    // Switch to dashboard
    hide($("landing"));
    show($("dashboard"));

    // Render user card
    renderUserCard(userInfo, ratingHistory, kpis);

    // Render streaks
    renderStreaks(streaks);

    // Render KPIs with animated counters
    renderKPIs(kpis);

    showLoading("Drawing charts...", 90);

    // Render all charts
    requestAnimationFrame(() => {
      // Overview tab
      renderHeatmap(heatmapData);
      renderTopicSuccessChart(topicData);
      renderWrongSubChart(topicData);
      renderRadarChart(topicData);
      renderVerdictChart(verdicts);
      renderWeaknessTable(heatmapData);

      // Analysis tab
      renderSolveTimeChart(topicData);
      renderContestPracticeChart(cvp);
      renderDifficultyChart(diffData);
      renderLanguageChart(langData);
      renderLangSuccessChart(langData);
      renderTimeOfDayHeatmap(todData);

      // Timeline tab
      renderRatingTimeline(ratingHistory);
      renderDifficultyProgression(diffProgression);
      renderCalendar(calendarData);
      renderRatingPrediction(ratingHistory, userInfo);

      // Contests tab
      renderContestDeepDive(contestDeepDive, ratingHistory);

      // Badges tab
      renderBadges(badges);

      // Insights tab
      renderInsights(insights);

      // Peer comparison
      const peerCard = $("peerComparisonCard");
      if (peerData) {
        show(peerCard);
        $("peerCompareLabel").textContent = `${handle} vs ${peerData.handleB}`;
        renderPeerColumns(peerData.comparison, handle, peerData.handleB);
        renderPeerRadar(peerData.comparison, handle, peerData.handleB);
      } else {
        hide(peerCard);
      }

      // Fire confetti for badges
      const unlockedCount = badges.filter((b) => b.unlocked).length;
      if (unlockedCount >= 5 && typeof confetti !== "undefined") {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#6c63ff", "#38bdf8", "#22c55e", "#f59e0b"],
        });
      }

      hideLoading();

      // Load Daily Problem of the Day (async, non-blocking)
      loadDailyProblem();
    });
  } catch (err) {
    hideLoading();
    console.error("Analysis failed:", err);
    let message = err.message || "Something went wrong. Please try again.";
    if (
      message.includes("Failed to fetch") ||
      message.includes("NetworkError")
    ) {
      message =
        "Network error — check your internet connection or try again. Codeforces may be down.";
    }
    showError(message);
  } finally {
    btnText.textContent = "Analyze";
    hide(btnLoader);
    btn.disabled = false;
  }
}

function showError(msg) {
  const el = $("errorMsg");
  el.textContent = msg;
  show(el);
}

/* ─── Populate topic dropdown for recommender ─── */
function populateTopicDropdown(topicData) {
  const select = $("recommendTopic");
  // Clear existing options except first
  while (select.options.length > 1) select.remove(1);
  for (const t of topicData) {
    const opt = document.createElement("option");
    opt.value = t.topic;
    opt.textContent = `${t.topic} (${(t.successRate * 100).toFixed(0)}%)`;
    select.appendChild(opt);
  }
}

/* ─── Load recommendations ─── */
async function loadRecommendations() {
  if (!_appState.analyzed) return;
  const grid = $("recommendGrid");
  grid.innerHTML =
    '<p class="recommend-placeholder">⏳ Fetching problemset from Codeforces...</p>';

  try {
    const problemset = await fetchProblemset();
    const difficulty = $("recommendDifficulty").value;
    const topic = $("recommendTopic").value;
    const recs = generateRecommendations(
      problemset,
      _appState.analyzed,
      _appState.submissions,
      _appState.topicData,
      { difficulty, topic },
    );
    renderRecommendations(recs);
    _appState.recommendLoaded = true;
  } catch (e) {
    grid.innerHTML = `<p class="recommend-placeholder">Failed to load recommendations: ${e.message}</p>`;
  }
}

function refreshRecommendations() {
  _appState.recommendLoaded = false;
  loadRecommendations();
}

/* ─── Load Daily Problem of the Day ─── */
async function loadDailyProblem() {
  if (!_appState.analyzed) return;
  try {
    const problemset = await fetchProblemset();
    const potd = generateDailyProblem(
      problemset,
      _appState.analyzed,
      _appState.submissions,
      _appState.topicData,
      _appState.userRating,
    );
    renderDailyProblem(potd);
  } catch (e) {
    console.warn("Failed to load daily problem:", e.message);
    const card = $("potdCard");
    if (card) {
      card.innerHTML = `
        <div class="potd-inner potd-empty">
          <div class="potd-icon">📝</div>
          <div class="potd-body">
            <h3 class="potd-title">Daily Problem of the Day</h3>
            <p class="potd-subtitle">Could not load — ${e.message}</p>
          </div>
        </div>`;
    }
  }
}

/* ─── Skip / Re-roll Daily Problem ─── */
function skipDailyProblem() {
  if (!_appState.analyzed) return;
  _appState.potdSkipCount++;

  // Re-generate by temporarily offsetting the date seed
  // We monkey-patch generateDailyProblem to use an offset
  const origGenerate = generateDailyProblem;
  const skipCount = _appState.potdSkipCount;

  // Override: add skipCount to the date seed for variety
  window._potdSkipOffset = skipCount;

  fetchProblemset()
    .then((problemset) => {
      // Build a custom version that offsets the seed
      const solvedSet = new Set();
      for (const sub of _appState.submissions) {
        if (sub.verdict === "OK") {
          solvedSet.add(`${sub.problem.contestId}-${sub.problem.index}`);
        }
      }

      const userRating = _appState.userRating || 1200;
      const ratingLo = Math.max(800, userRating - 200);
      const ratingHi = userRating + 300;
      const topicData = _appState.topicData;

      const weakTopics = topicData
        .filter((t) => t.attempted >= 3 && t.successRate < 0.7)
        .sort((a, b) => a.successRate - b.successRate)
        .slice(0, 8)
        .map((t) => t.topic);
      const targetTopics =
        weakTopics.length > 0
          ? weakTopics
          : topicData.slice(0, 5).map((t) => t.topic);

      let candidates = problemset.filter((p) => {
        if (!p.rating) return false;
        if (solvedSet.has(`${p.contestId}-${p.index}`)) return false;
        if (p.rating < ratingLo || p.rating > ratingHi) return false;
        if (p.tags && p.tags.length > 0) {
          if (!p.tags.some((t) => targetTopics.includes(t))) return false;
        }
        return true;
      });

      if (candidates.length < 10) {
        candidates = problemset.filter((p) => {
          if (!p.rating) return false;
          if (solvedSet.has(`${p.contestId}-${p.index}`)) return false;
          if (p.rating < ratingLo || p.rating > ratingHi) return false;
          return true;
        });
      }

      if (candidates.length === 0) {
        renderDailyProblem(null);
        return;
      }

      candidates = candidates.map((p) => {
        let score = 0;
        const matchedTopics = [];
        if (p.tags) {
          for (const t of p.tags) {
            const td = topicData.find((x) => x.topic === t);
            if (td && td.successRate < 0.7) {
              score += (1 - td.successRate) * 10;
              matchedTopics.push(t);
            }
          }
        }
        score -= Math.abs(p.rating - userRating) * 0.01;
        return { ...p, score, matchedTopics };
      });

      candidates.sort((a, b) => b.score - a.score);
      const pool = candidates.slice(0, Math.min(candidates.length, 200));

      const today = new Date();
      const dateSeed =
        today.getFullYear() * 10000 +
        (today.getMonth() + 1) * 100 +
        today.getDate() +
        skipCount * 7919; // offset by prime

      function simpleHash(seed) {
        let h = seed;
        h = ((h >> 16) ^ h) * 0x45d9f3b;
        h = ((h >> 16) ^ h) * 0x45d9f3b;
        h = (h >> 16) ^ h;
        return Math.abs(h);
      }

      const idx = simpleHash(dateSeed) % pool.length;
      const chosen = pool[idx];

      let reason = "";
      if (chosen.matchedTopics && chosen.matchedTopics.length > 0) {
        reason = `Targets your weak area: ${chosen.matchedTopics.join(", ")}`;
      } else {
        reason = `Matches your rating range (${ratingLo}–${ratingHi})`;
      }

      let difficultyLabel = "Medium";
      if (chosen.rating <= userRating - 100) difficultyLabel = "Warm-up";
      else if (chosen.rating >= userRating + 100) difficultyLabel = "Challenge";

      const potd = {
        contestId: chosen.contestId,
        index: chosen.index,
        name: chosen.name,
        rating: chosen.rating,
        tags: chosen.tags || [],
        matchedTopics: chosen.matchedTopics || [],
        reason,
        difficultyLabel,
        url: `https://codeforces.com/problemset/problem/${chosen.contestId}/${chosen.index}`,
        date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`,
      };

      renderDailyProblem(potd);
    })
    .catch((e) => {
      console.warn("Skip failed:", e.message);
    });
}

/* ─── Render Streaks ─── */
function renderStreaks(streaks) {
  const els = {
    currentStreak: $("currentStreak"),
    bestStreak: $("bestStreak"),
    activeDays: $("activeDays"),
    totalDays: $("totalDays"),
  };
  animateCounter(els.currentStreak, streaks.currentStreak, 800);
  animateCounter(els.bestStreak, streaks.bestStreak, 800);
  animateCounter(els.activeDays, streaks.activeDays, 1000);
  animateCounter(els.totalDays, streaks.totalDays, 1000);
}

/* ─── User Card ─── */
function renderUserCard(user, ratingHistory, kpis) {
  $("userHandle").textContent = user.handle;

  const avatar = $("userAvatar");
  if (user.titlePhoto) {
    let photo = user.titlePhoto;
    if (photo.startsWith("//")) photo = "https:" + photo;
    avatar.src = photo;
    avatar.alt = user.handle;
    avatar.style.display = "";
  } else {
    avatar.style.display = "none";
  }

  $("userName").textContent =
    `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.handle;

  const rankEl = $("userRank");
  const rankText = user.rank ? capitalize(user.rank) : "Unrated";
  rankEl.textContent = rankText;
  rankEl.style.background = rankColor(user.rank);
  rankEl.style.color = "#fff";

  // Profile meta (max rating)
  const meta = $("profileMeta");
  if (meta) {
    meta.innerHTML = `🏆 Rating: <strong>${user.rating || "–"}</strong> &nbsp;·&nbsp; Max: <strong>${user.maxRating || "–"}</strong>`;
  }

  const stats = $("userStats");
  const contestCount = ratingHistory.length;
  stats.innerHTML = `
    <div class="user-stat"><div class="user-stat-val">${kpis.totalProblems}</div><div class="user-stat-lbl">Problems</div></div>
    <div class="user-stat"><div class="user-stat-val">${kpis.solved}</div><div class="user-stat-lbl">Solved</div></div>
    <div class="user-stat"><div class="user-stat-val">${kpis.totalSubmissions}</div><div class="user-stat-lbl">Submissions</div></div>
    <div class="user-stat"><div class="user-stat-val">${contestCount}</div><div class="user-stat-lbl">Contests</div></div>
  `;
}

/* ─── KPIs ─── */
function renderKPIs(kpis) {
  const strip = $("kpiStrip");
  const successClass =
    kpis.overallSuccess >= 70
      ? "kpi-good"
      : kpis.overallSuccess >= 50
        ? "kpi-warn"
        : "kpi-bad";
  const contestClass =
    kpis.contestSolveRate !== "–"
      ? parseFloat(kpis.contestSolveRate) >= 60
        ? "kpi-good"
        : parseFloat(kpis.contestSolveRate) >= 40
          ? "kpi-warn"
          : "kpi-bad"
      : "kpi-info";

  strip.innerHTML = `
    <div class="kpi ${successClass}">
      <div class="kpi-value">${kpis.overallSuccess}%</div>
      <div class="kpi-label">Overall Success</div>
    </div>
    <div class="kpi kpi-info">
      <div class="kpi-value">${kpis.avgAttempts}</div>
      <div class="kpi-label">Avg Attempts / Problem</div>
    </div>
    <div class="kpi kpi-info">
      <div class="kpi-value">${kpis.avgSolveMin === "–" ? "–" : kpis.avgSolveMin + " min"}</div>
      <div class="kpi-label">Avg Solve Time</div>
    </div>
    <div class="kpi kpi-bad">
      <div class="kpi-value">${kpis.weakestTopic}</div>
      <div class="kpi-label">Weakest Topic</div>
    </div>
    <div class="kpi ${contestClass}">
      <div class="kpi-value">${kpis.contestSolveRate === "–" ? "–" : kpis.contestSolveRate + "%"}</div>
      <div class="kpi-label">Contest Solve Rate</div>
    </div>
  `;
}

/* ─── Export as PNG ─── */
async function exportAsPNG() {
  const dashboard = $("dashboard");
  // Show all tabs temporarily for full export
  const allTabs = document.querySelectorAll(".tab-content");
  allTabs.forEach((t) => (t.style.display = "block"));

  const btn = event.target;
  btn.textContent = "⏳ ...";
  try {
    const canvas = await html2canvas(dashboard, {
      backgroundColor:
        getComputedStyle(document.documentElement)
          .getPropertyValue("--bg")
          .trim() || "#0b0f19",
      scale: 2,
      useCORS: true,
      logging: false,
      scrollY: -window.scrollY,
      windowHeight: dashboard.scrollHeight,
    });
    const link = document.createElement("a");
    link.download = `cf-analysis-${$("userHandle").textContent}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (e) {
    console.error("PNG export failed:", e);
    alert("Export failed. Try again.");
  } finally {
    btn.textContent = "📸 PNG";
    // Restore tab visibility
    allTabs.forEach((t) => (t.style.display = ""));
  }
}

/* ─── Export as PDF ─── */
async function exportAsPDF() {
  const dashboard = $("dashboard");
  const allTabs = document.querySelectorAll(".tab-content");
  allTabs.forEach((t) => (t.style.display = "block"));

  const btn = event.target;
  btn.textContent = "⏳ ...";
  try {
    const canvas = await html2canvas(dashboard, {
      backgroundColor:
        getComputedStyle(document.documentElement)
          .getPropertyValue("--bg")
          .trim() || "#0b0f19",
      scale: 2,
      useCORS: true,
      logging: false,
      scrollY: -window.scrollY,
      windowHeight: dashboard.scrollHeight,
    });
    const imgData = canvas.toDataURL("image/png");
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? "l" : "p",
      unit: "px",
      format: [canvas.width, canvas.height],
    });
    pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
    pdf.save(`cf-analysis-${$("userHandle").textContent}.pdf`);
  } catch (e) {
    console.error("PDF export failed:", e);
    alert("Export failed. Try again.");
  } finally {
    btn.textContent = "📄 PDF";
    allTabs.forEach((t) => (t.style.display = ""));
  }
}

/* ─── Load Upcoming Contests ─── */
async function loadUpcomingContests() {
  const wrapper = $("upcomingContestsWrapper");
  if (wrapper)
    wrapper.innerHTML =
      '<p class="sheet-empty">⏳ Fetching upcoming contests from Codeforces...</p>';
  try {
    const contests = await fetchContestList();
    renderUpcomingContests(contests);
    _appState.upcomingLoaded = true;
  } catch (e) {
    console.warn("Failed to load upcoming contests:", e.message);
    if (wrapper)
      wrapper.innerHTML = `<p class="sheet-empty">Failed to load contests: ${e.message}</p>`;
  }
}

function refreshUpcomingContests() {
  _appState.upcomingLoaded = false;
  _contestListCache = null;
  _contestListTime = 0;
  loadUpcomingContests();
}

/* ─── Load Practice Sheet ─── */
async function loadPracticeSheet() {
  const wrapper = $("practiceSheetWrapper");
  if (wrapper)
    wrapper.innerHTML =
      '<p class="sheet-empty">⏳ Generating your personalized practice sheet...</p>';
  try {
    const problemset = await fetchProblemset();
    const sheetData = generatePracticeSheet(
      problemset,
      _appState.analyzed,
      _appState.submissions,
      _appState.topicData,
      _appState.userRating,
    );
    _appState.sheetData = sheetData;
    renderPracticeSheet(sheetData);
    _appState.sheetLoaded = true;
  } catch (e) {
    console.warn("Failed to load practice sheet:", e.message);
    if (wrapper)
      wrapper.innerHTML = `<p class="sheet-empty">Failed to load practice sheet: ${e.message}</p>`;
  }
}

/* ─── Filter Practice Sheet (client-side) ─── */
function filterPracticeSheet() {
  if (!_appState.sheetData) return;
  const ratingFilter = $("sheetRatingFilter")?.value || "all";
  const topicFilter = $("sheetTopicFilter")?.value || "all";
  const table = $("sheetTable");
  if (!table) return;

  // Filter rows by topic
  table.querySelectorAll("tbody tr").forEach((row) => {
    const topic = row.getAttribute("data-topic");
    if (topicFilter !== "all" && topic !== topicFilter) {
      row.style.display = "none";
    } else {
      row.style.display = "";
    }
  });

  // Filter columns by rating
  const { ratings, userRating } = _appState.sheetData;
  const nearRatings = ratings.filter((r) => Math.abs(r - userRating) <= 400);

  table.querySelectorAll("th, td").forEach((cell) => {
    const rating = cell.getAttribute("data-rating");
    if (!rating) return; // skip topic column
    const rNum = parseInt(rating);
    if (ratingFilter === "all") {
      cell.style.display = "";
    } else if (ratingFilter === "near") {
      cell.style.display = nearRatings.includes(rNum) ? "" : "none";
    } else {
      cell.style.display = rNum === parseInt(ratingFilter) ? "" : "none";
    }
  });

  // Also hide/show header columns
  const headerCells = table.querySelectorAll("thead th");
  headerCells.forEach((th, idx) => {
    if (idx === 0) return; // topic header
    const rNum = ratings[idx - 1];
    if (!rNum) return;
    if (ratingFilter === "all") {
      th.style.display = "";
    } else if (ratingFilter === "near") {
      th.style.display = nearRatings.includes(rNum) ? "" : "none";
    } else {
      th.style.display = rNum === parseInt(ratingFilter) ? "" : "none";
    }
  });
}

/* ═══════════════════════════════════════════════════
   Integrity Check — Render cheat analysis
   ═══════════════════════════════════════════════════ */
function renderIntegrityCheck(data) {
  const wrapper = $("integrityWrapper");
  if (!wrapper) return;

  const {
    score,
    verdict,
    verdictClass,
    skippedContests,
    skippedCount,
    totalSkippedProblems,
    fastSolves,
    ratingJumps,
    totalContests,
    totalSubmissions,
  } = data;

  // Score ring color
  const ringColor = verdictClass === "suspect" ? "#f59e0b" : "#22c55e";
  const ringDeg = Math.round((score / 100) * 360);

  // Verdict label
  const verdictLabel =
    verdict === "SUSPICIOUS" ? "⚠️ SUSPICIOUS ACTIVITY" : "✅ CLEAN PROFILE";

  // Build skipped contest rows
  let skippedHtml = "";
  if (skippedContests.length > 0) {
    skippedHtml = `
      <div class="integ-section">
        <h4 class="integ-section-title integ-danger">⚠️ SKIPPED Verdicts — Suspicious Activity (${totalSkippedProblems} total)</h4>
        <p class="integ-section-desc">Codeforces marks solutions as <strong>SKIPPED</strong> when suspicious activity is detected. These contests were flagged:</p>
        <div class="integ-contest-list">
          ${skippedContests
            .map(
              (c) => `
            <div class="integ-contest-item integ-item-danger">
              <div class="integ-contest-header">
                <a href="https://codeforces.com/contest/${c.contestId}" target="_blank" class="integ-contest-link">
                  🔗 ${c.contestName}
                </a>
                <span class="integ-badge integ-badge-danger">${c.problems.length} problem${c.problems.length > 1 ? "s" : ""} SKIPPED</span>
              </div>
              <div class="integ-problems">
                ${c.problems.map((p) => `<span class="integ-problem-tag">❌ ${p}</span>`).join("")}
              </div>
              <div class="integ-date">${new Date(c.time * 1000).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</div>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>`;
  }

  // Fast solves (just cool stats, NOT cheating flags)
  let fastHtml = "";
  if (fastSolves.length > 0) {
    fastHtml = `
      <div class="integ-section">
        <h4 class="integ-section-title integ-info">⚡ Fastest Contest Solves (${fastSolves.length})</h4>
        <p class="integ-section-desc">Problems rated 1400+ solved in under 2 minutes from contest start. Just stats — fast solves are normal for strong players.</p>
        <div class="integ-contest-list">
          ${fastSolves
            .map(
              (f) => `
            <div class="integ-contest-item integ-item-info">
              <div class="integ-contest-header">
                <a href="https://codeforces.com/contest/${f.contestId}" target="_blank" class="integ-contest-link">
                  🔗 ${f.contestName}
                </a>
                <span class="integ-badge integ-badge-info">${f.solveTimeSec}s solve</span>
              </div>
              <div class="integ-problems">
                <span class="integ-problem-tag">⚡ ${f.problem} <span class="integ-rating">(${f.rating})</span></span>
              </div>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>`;
  }

  // Rating jumps (just stats, NOT cheating flags)
  let jumpHtml = "";
  if (ratingJumps.length > 0) {
    jumpHtml = `
      <div class="integ-section">
        <h4 class="integ-section-title integ-info">📈 Biggest Rating Jumps — +250 or more (${ratingJumps.length})</h4>
        <p class="integ-section-desc">Impressive rating gains in a single contest. This is just a stat — big jumps are normal for improving players.</p>
        <div class="integ-contest-list">
          ${ratingJumps
            .map(
              (j) => `
            <div class="integ-contest-item integ-item-info">
              <div class="integ-contest-header">
                <a href="https://codeforces.com/contest/${j.contestId}" target="_blank" class="integ-contest-link">
                  🔗 ${j.contestName}
                </a>
                <span class="integ-badge integ-badge-info">+${j.delta} rating</span>
              </div>
              <div class="integ-problems">
                <span class="integ-problem-tag">${j.oldRating} → ${j.newRating} &nbsp;·&nbsp; Rank #${j.rank}</span>
              </div>
              <div class="integ-date">${new Date(j.time * 1000).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</div>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>`;
  }

  // Clean message (only when NO skipped verdicts)
  const cleanMsg =
    skippedContests.length === 0
      ? `<div class="integ-clean-msg">
        <div class="integ-clean-icon">✅</div>
        <h3>No Suspicious Activity</h3>
        <p>This profile has zero SKIPPED verdicts — no suspicious activity was detected by Codeforces. Clean record!</p>
      </div>`
      : "";

  wrapper.innerHTML = `
    <div class="integ-card">
      <!-- Top: Score + Verdict -->
      <div class="integ-top">
        <div class="integ-score-ring" style="--ring-color: ${ringColor}; --ring-deg: ${ringDeg}deg;">
          <div class="integ-score-inner">
            <span class="integ-score-num">${score}</span>
            <span class="integ-score-label">/ 100</span>
          </div>
        </div>
        <div class="integ-verdict-area">
          <div class="integ-verdict integ-verdict-${verdictClass}">${verdictLabel}</div>
          <div class="integ-stats">
            <span>📊 ${totalSubmissions.toLocaleString()} submissions scanned</span>
            <span>🏆 ${totalContests} contests analyzed</span>
            <span>🚩 ${skippedCount} contest${skippedCount !== 1 ? "s" : ""} with SKIPPED verdicts</span>
            <span>${totalSkippedProblems} total SKIPPED submission${totalSkippedProblems !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      <!-- How it works -->
      <div class="integ-how">
        <h4>How does this work?</h4>
        <div class="integ-how-grid">
          <div class="integ-how-item">
            <span class="integ-how-icon">🚩</span>
            <div><strong>SKIPPED Verdicts</strong><br>When Codeforces flags suspicious activity, solutions get verdict <strong>SKIPPED</strong>. This is the ONLY signal — it comes directly from CF's system.</div>
          </div>
          <div class="integ-how-item">
            <span class="integ-how-icon">🛡️</span>
            <div><strong>Integrity Score</strong><br>Starts at 100, deducted -20 per contest with SKIPPED verdicts. Score is based ONLY on SKIPPED verdicts — fast solves and big rating gains do NOT affect it.</div>
          </div>
          <div class="integ-how-item">
            <span class="integ-how-icon">⚡</span>
            <div><strong>Fast Solves (Stats Only)</strong><br>1400+ rated problems solved in < 2 min. Shown as fun stats — strong players regularly do this, it's completely normal.</div>
          </div>
          <div class="integ-how-item">
            <span class="integ-how-icon">📈</span>
            <div><strong>Rating Jumps (Stats Only)</strong><br>+250 or more in one contest. Totally normal for improving players and does NOT affect the integrity score.</div>
          </div>
        </div>
      </div>

      <!-- Flag sections -->
      ${skippedHtml}
      ${fastHtml}
      ${jumpHtml}
      ${cleanMsg}
    </div>
  `;
}

/* ═══════════════════════════════════════════════════
   🔮 RATING PREDICTOR + GLOBAL PERCENTILE
   ═══════════════════════════════════════════════════ */
function getRatingPercentile(rating) {
  if (!rating || rating === 0) return 100;
  if (rating >= 2600) return 1;
  if (rating >= 2400) return 2;
  if (rating >= 2300) return 3;
  if (rating >= 2100) return 5;
  if (rating >= 1900) return 10;
  if (rating >= 1600) return 22;
  if (rating >= 1400) return 40;
  if (rating >= 1200) return 60;
  return 85;
}

function renderRatingPrediction(ratingHistory, userInfo) {
  const container = $("predictionWidget");
  if (!container) return;

  const currentRating = (userInfo && userInfo.rating) || 0;
  const rank = (userInfo && (userInfo.rank || userInfo.maxRank)) || "unrated";
  const percentile = getRatingPercentile(currentRating);

  if (!ratingHistory || ratingHistory.length < 3) {
    container.innerHTML = `
      <div class="pred-widget">
        <div class="pred-top-row">
          <div class="pred-stat-card">
            <div class="pred-stat-icon">🌍</div>
            <div class="pred-stat-val">Top ${percentile}%</div>
            <div class="pred-stat-label">of CF users</div>
          </div>
          <div class="pred-stat-card">
            <div class="pred-stat-icon">📊</div>
            <div class="pred-stat-val">${currentRating || "—"}</div>
            <div class="pred-stat-label">Current Rating</div>
          </div>
        </div>
        <p class="pred-note">Need at least 3 rated contests for milestone prediction.</p>
      </div>`;
    return;
  }

  const recent = ratingHistory.slice(-10);
  const n = recent.length;
  const xs = recent.map((_, i) => i);
  const ys = recent.map((r) => r.newRating);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((s, x, i) => s + (x - xMean) * (ys[i] - yMean), 0);
  const den = xs.reduce((s, x) => s + (x - xMean) ** 2, 0);
  const m = den !== 0 ? num / den : 0;
  const trendPerContest = Math.round(m * 10) / 10;

  const milestones = [
    { rating: 1200, name: "Pupil", color: "#008000" },
    { rating: 1400, name: "Specialist", color: "#03a89e" },
    { rating: 1600, name: "Expert", color: "#4169e1" },
    { rating: 1900, name: "Candidate Master", color: "#aa00aa" },
    { rating: 2100, name: "Master", color: "#ff8c00" },
    { rating: 2300, name: "International Master", color: "#ff8c00" },
    { rating: 2400, name: "Grandmaster", color: "#ff3333" },
    { rating: 2600, name: "LGM", color: "#ff0000" },
  ];
  const nextMilestone = milestones.find((ms) => ms.rating > currentRating);

  let milestoneHtml = "";
  if (m > 0 && nextMilestone) {
    const contestsNeeded = Math.ceil(
      (nextMilestone.rating - currentRating) / m,
    );
    const monthsNeeded = Math.max(1, Math.round(contestsNeeded / 2));
    milestoneHtml = `
      <div class="pred-milestone">
        <div class="pred-milestone-left">
          <div class="pred-milestone-icon">🎯</div>
          <div>
            <div class="pred-milestone-title">Next Goal: <span style="color:${nextMilestone.color};font-weight:700">${nextMilestone.name}</span></div>
            <div class="pred-milestone-detail">At +${trendPerContest}/contest → ~${contestsNeeded} contest${contestsNeeded !== 1 ? "s" : ""} away (~${monthsNeeded} month${monthsNeeded !== 1 ? "s" : ""})</div>
          </div>
        </div>
        <div class="pred-milestone-rating" style="color:${nextMilestone.color}">${nextMilestone.rating}</div>
      </div>`;
  } else if (m <= 0 && nextMilestone) {
    milestoneHtml = `
      <div class="pred-milestone pred-decline">
        <div class="pred-milestone-left">
          <div class="pred-milestone-icon">💪</div>
          <div>
            <div class="pred-milestone-title">Declining Trend — Next: <span style="color:${nextMilestone.color}">${nextMilestone.name} (${nextMilestone.rating})</span></div>
            <div class="pred-milestone-detail">Avg ${Math.abs(trendPerContest)} pts lost/contest recently. Keep grinding to reverse the trend!</div>
          </div>
        </div>
      </div>`;
  }

  const trendIcon = m > 5 ? "📈" : m < -5 ? "📉" : "➡️";
  const trendClass =
    m > 5 ? "pred-trend-up" : m < -5 ? "pred-trend-down" : "pred-trend-flat";
  const trendLabel = m > 5 ? `+${trendPerContest}` : `${trendPerContest}`;

  // Rating bar milestones visual
  const maxRating =
    userInfo && userInfo.maxRating ? userInfo.maxRating : currentRating;
  const barPct = Math.min(
    100,
    Math.max(0, ((currentRating - 800) / (3000 - 800)) * 100),
  );

  container.innerHTML = `
    <div class="pred-widget">
      <div class="pred-top-row">
        <div class="pred-stat-card pred-stat-highlight">
          <div class="pred-stat-icon">🌍</div>
          <div class="pred-stat-val">Top ${percentile}%</div>
          <div class="pred-stat-label">of CF users</div>
        </div>
        <div class="pred-stat-card">
          <div class="pred-stat-icon">${trendIcon}</div>
          <div class="pred-stat-val ${trendClass}">${trendLabel}/contest</div>
          <div class="pred-stat-label">Recent trend (last ${n})</div>
        </div>
        <div class="pred-stat-card">
          <div class="pred-stat-icon">⭐</div>
          <div class="pred-stat-val">${maxRating}</div>
          <div class="pred-stat-label">Peak Rating</div>
        </div>
        <div class="pred-stat-card">
          <div class="pred-stat-icon">🏆</div>
          <div class="pred-stat-val">${currentRating || "—"}</div>
          <div class="pred-stat-label">Current</div>
        </div>
      </div>
      ${milestoneHtml}
      <div class="pred-bar-section">
        <div class="pred-bar-label">Rating Journey</div>
        <div class="pred-bar-track">
          <div class="pred-bar-fill" style="width:${barPct}%"></div>
          ${milestones
            .map((ms) => {
              const pct = ((ms.rating - 800) / (3000 - 800)) * 100;
              const isNext =
                nextMilestone && ms.rating === nextMilestone.rating;
              return `<div class="pred-bar-marker ${isNext ? "pred-bar-marker-next" : ""}" style="left:${pct}%" title="${ms.name}: ${ms.rating}">
                <div class="pred-bar-marker-dot" style="background:${ms.color}"></div>
                <div class="pred-bar-marker-label" style="color:${ms.color}">${ms.name}</div>
              </div>`;
            })
            .join("")}
        </div>
        <div class="pred-bar-endpoints"><span>800</span><span>3000+</span></div>
      </div>
    </div>`;
}

/* ═══════════════════════════════════════════════════
   🃏 CF WRAPPED SHARE CARD
   ═══════════════════════════════════════════════════ */
function initSkillCard(userInfo, analyzed, topicData, kpis, ratingHistory) {
  const wrapper = $("skillCardWrapper");
  if (!wrapper) return;

  const handle = userInfo.handle;
  const currentRating = userInfo.rating || 0;
  const maxRating = userInfo.maxRating || currentRating;
  const rank = userInfo.maxRank || userInfo.rank || "unrated";
  const solved = kpis ? kpis.solved : analyzed.filter((p) => p.solved).length;
  const totalContests = ratingHistory ? ratingHistory.length : 0;
  const rColor = rankColor(rank);
  const percentile = getRatingPercentile(currentRating);

  const solvedTopics = topicData
    .filter((t) => t.solved > 0)
    .sort((a, b) => b.solved - a.solved);
  const favTopic = solvedTopics[0] ? capitalize(solvedTopics[0].topic) : "N/A";
  const favTopic2 = solvedTopics[1] ? capitalize(solvedTopics[1].topic) : null;

  const weakTopics = topicData
    .filter((t) => t.attempted >= 5)
    .sort((a, b) => a.solved / a.attempted - b.solved / b.attempted);
  const weakTopic = weakTopics[0] ? capitalize(weakTopics[0].topic) : "N/A";

  const solvedWithTime = analyzed.filter(
    (p) => p.solved && p.solveTimeSec != null && p.solveTimeSec > 60,
  );
  const avgTimeMins =
    solvedWithTime.length > 0
      ? Math.round(
          solvedWithTime.reduce((s, p) => s + p.solveTimeSec, 0) /
            solvedWithTime.length /
            60,
        )
      : 0;

  wrapper.innerHTML = `
    <div class="sc-page">
      <div class="sc-card" id="skillCardEl">
        <div class="sc-bg-glow"></div>
        <div class="sc-inner">
          <div class="sc-header-row">
            <div class="sc-avatar" style="background:linear-gradient(135deg,${rColor}44,${rColor}22);border:2.5px solid ${rColor}88;">
              <span style="color:${rColor};font-size:1.6rem;font-weight:900">${handle.charAt(0).toUpperCase()}</span>
            </div>
            <div class="sc-handle-info">
              <div class="sc-handle-text">${handle}</div>
              <div class="sc-rank-text" style="color:${rColor}">${capitalize(rank)}</div>
            </div>
            <div class="sc-current-rating">
              <div class="sc-cr-num" style="color:${rColor}">${currentRating || "—"}</div>
              <div class="sc-cr-label">Current</div>
            </div>
          </div>

          <div class="sc-stats-grid">
            <div class="sc-stat-box">
              <div class="sc-stat-num">${solved.toLocaleString()}</div>
              <div class="sc-stat-lbl">Problems Solved</div>
            </div>
            <div class="sc-stat-box">
              <div class="sc-stat-num">${maxRating}</div>
              <div class="sc-stat-lbl">Peak Rating</div>
            </div>
            <div class="sc-stat-box">
              <div class="sc-stat-num">${totalContests}</div>
              <div class="sc-stat-lbl">Contests</div>
            </div>
            <div class="sc-stat-box sc-stat-highlight">
              <div class="sc-stat-num">Top ${percentile}%</div>
              <div class="sc-stat-lbl">Globally</div>
            </div>
          </div>

          <div class="sc-topics-row">
            <div class="sc-topic-pill sc-topic-strength">
              <span class="sc-tp-icon">💪</span>
              <div>
                <div class="sc-tp-label">STRONGEST</div>
                <div class="sc-tp-val">${favTopic}${favTopic2 ? " · " + favTopic2 : ""}</div>
              </div>
            </div>
            <div class="sc-topic-pill sc-topic-weakness">
              <span class="sc-tp-icon">🎯</span>
              <div>
                <div class="sc-tp-label">NEEDS WORK</div>
                <div class="sc-tp-val">${weakTopic}</div>
              </div>
            </div>
            <div class="sc-topic-pill">
              <span class="sc-tp-icon">⏱️</span>
              <div>
                <div class="sc-tp-label">AVG SOLVE</div>
                <div class="sc-tp-val">${avgTimeMins > 0 ? avgTimeMins + " min" : "—"}</div>
              </div>
            </div>
          </div>

          <div class="sc-footer-row">
            <span class="sc-watermark">⚡ CF Analytics Platform</span>
            <span class="sc-year">${new Date().getFullYear()}</span>
          </div>
        </div>
      </div>

      <div class="sc-actions">
        <button class="sc-btn-download" id="downloadCardBtn" onclick="downloadSkillCard()">
          📸 Download Card (PNG)
        </button>
        <p class="sc-hint">Tip: Share this card on Twitter, Discord, or LinkedIn to flex your CP journey!</p>
      </div>
    </div>`;
}

async function downloadSkillCard() {
  const cardEl = $("skillCardEl");
  if (!cardEl) return;
  const btn = $("downloadCardBtn");
  if (btn) {
    btn.textContent = "⏳ Generating…";
    btn.disabled = true;
  }
  try {
    const canvas = await html2canvas(cardEl, {
      backgroundColor: null,
      scale: 2,
      logging: false,
      useCORS: true,
    });
    const link = document.createElement("a");
    link.download = `cf-wrapped-${_appState.handle || "profile"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (e) {
    alert("Could not generate image: " + e.message);
  } finally {
    if (btn) {
      btn.textContent = "📸 Download Card (PNG)";
      btn.disabled = false;
    }
  }
}

/* ═══════════════════════════════════════════════════
   📚 7-DAY STUDY ROADMAP GENERATOR
   ═══════════════════════════════════════════════════ */
async function renderStudyRoadmap() {
  const wrapper = $("roadmapWrapper");
  if (!wrapper || !_appState.analyzed) return;
  _appState.roadmapLoaded = true;

  wrapper.innerHTML =
    '<p class="sheet-empty">⏳ Building your personalized roadmap…</p>';

  const topicData = _appState.topicData;
  const userRating = _appState.userRating || 1200;

  const weakTopics = topicData
    .filter((t) => t.attempted >= 3)
    .sort((a, b) => a.solved / a.attempted - b.solved / b.attempted)
    .slice(0, 6)
    .map((t) => t.topic);

  if (weakTopics.length === 0) {
    wrapper.innerHTML =
      '<p class="sheet-empty">Not enough data. Solve more problems to generate a roadmap.</p>';
    return;
  }

  let problemset = [];
  try {
    problemset = await fetchProblemset();
  } catch (e) {
    wrapper.innerHTML = `<p class="sheet-empty">Could not load problems: ${e.message}</p>`;
    return;
  }

  const plan = generateWeeklyPlan(weakTopics, userRating, problemset);
  const storageKey = `cf-roadmap-${_appState.handle || "anon"}`;
  const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");

  const dayNames = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  const dayIcons = ["🎯", "🔥", "💡", "⚡", "🧠", "🏆", "📊"];
  const dayThemes = [
    `Deep dive: ${capitalize(weakTopics[0] || "")}`,
    `Drill: ${capitalize(weakTopics[0] || "")}`,
    `Focus: ${capitalize(weakTopics[1] || weakTopics[0] || "")}`,
    `Drill: ${capitalize(weakTopics[1] || weakTopics[0] || "")}`,
    `Focus: ${capitalize(weakTopics[2] || weakTopics[0] || "")}`,
    "Mixed practice — all weak areas",
    "Contest simulation — harder problems",
  ];

  let totalProblems = 0;
  let checkedProblems = 0;

  const daysHtml = plan
    .map((day, i) => {
      if (day.problems.length === 0) {
        return `<div class="rm-day-card">
          <div class="rm-day-header">
            <div class="rm-day-left"><span class="rm-day-icon">${dayIcons[i]}</span>
              <div><div class="rm-day-name">Day ${i + 1} — ${dayNames[i]}</div><div class="rm-day-theme">${dayThemes[i]}</div></div>
            </div>
          </div>
          <p class="rm-empty-day">No problems found for this configuration. Try adjusting your rating range.</p>
        </div>`;
      }
      totalProblems += day.problems.length;
      const probsHtml = day.problems
        .map((p, j) => {
          const checkKey = `d${i}-p${j}`;
          const isChecked = !!saved[checkKey];
          if (isChecked) checkedProblems++;
          return `
            <div class="rm-problem ${isChecked ? "rm-done" : ""}" id="rmp-${i}-${j}">
              <label class="rm-cb-wrap">
                <input type="checkbox" class="rm-checkbox" ${isChecked ? "checked" : ""}
                  onchange="toggleRoadmapProblem('${i}','${j}',this)">
                <span class="rm-checkmark"></span>
              </label>
              <a href="https://codeforces.com/problemset/problem/${p.contestId}/${p.index}"
                target="_blank" class="rm-prob-link">
                <span class="rm-prob-name">${p.index}. ${p.name}</span>
              </a>
              <span class="rm-rating-tag" style="--r:${ratingTagColor(p.rating)}">${p.rating}</span>
              <span class="rm-topic-tag">${p.tags && p.tags[0] ? p.tags[0] : ""}</span>
            </div>`;
        })
        .join("");
      return `
        <div class="rm-day-card">
          <div class="rm-day-header">
            <div class="rm-day-left">
              <span class="rm-day-icon">${dayIcons[i]}</span>
              <div>
                <div class="rm-day-name">Day ${i + 1} — ${dayNames[i]}</div>
                <div class="rm-day-theme">${dayThemes[i]}</div>
              </div>
            </div>
            <div class="rm-day-meta">
              <span>⏱ ${day.problems.length * 25}–${day.problems.length * 45} min</span>
              <span>${day.problems.length} problems</span>
            </div>
          </div>
          <div class="rm-problems">${probsHtml}</div>
        </div>`;
    })
    .join("");

  const progressPct =
    totalProblems > 0 ? Math.round((checkedProblems / totalProblems) * 100) : 0;

  wrapper.innerHTML = `
    <div class="roadmap-wrap">
      <div class="rm-top">
        <div>
          <h3 class="rm-title">🗓️ Your 7-Day Study Plan</h3>
          <p class="rm-subtitle">Targeting: <strong>${weakTopics.slice(0, 3).map(capitalize).join(", ")}</strong></p>
        </div>
        <div class="rm-progress-box">
          <div class="rm-prog-label">${checkedProblems} / ${totalProblems} done</div>
          <div class="rm-prog-track">
            <div class="rm-prog-fill" id="rmProgFill" style="width:${progressPct}%"></div>
          </div>
          <div class="rm-prog-pct" id="rmProgPct">${progressPct}%</div>
        </div>
      </div>
      <div class="rm-days">${daysHtml}</div>
      <div class="rm-actions">
        <button class="btn-recommend" onclick="resetRoadmapProgress()">🔄 Reset Progress</button>
        <button class="btn-recommend" onclick="regenRoadmap()">✨ New Plan</button>
      </div>
    </div>`;
}

function generateWeeklyPlan(weakTopics, userRating, problemset) {
  const solved = new Set(
    (_appState.submissions || [])
      .filter((s) => s.verdict === "OK")
      .map((s) => `${s.problem.contestId}-${s.problem.index}`),
  );

  const dayTopicSets = [
    [weakTopics[0]],
    [weakTopics[0]],
    [weakTopics[1] || weakTopics[0]],
    [weakTopics[1] || weakTopics[0]],
    [weakTopics[2] || weakTopics[0]],
    weakTopics.slice(0, 3),
    weakTopics.slice(0, 2),
  ];

  return dayTopicSets.map((topics, d) => {
    const isHard = d === 6;
    const lo = isHard ? userRating + 100 : Math.max(800, userRating - 200);
    const hi = isHard ? userRating + 400 : userRating + 250;

    let pool = problemset.filter(
      (p) =>
        p.rating >= lo &&
        p.rating <= hi &&
        !solved.has(`${p.contestId}-${p.index}`) &&
        p.contestId &&
        p.index &&
        p.tags &&
        p.tags.some((tag) =>
          topics.some((t) =>
            tag.toLowerCase().includes(t.toLowerCase().split(" ")[0]),
          ),
        ),
    );

    // Shuffle deterministically using today's date seed
    const today = new Date();
    const seed =
      today.getFullYear() * 10000 +
      (today.getMonth() + 1) * 100 +
      today.getDate() +
      d * 31337;
    let s = seed | 0;
    const rng = () => {
      s = (s * 1664525 + 1013904223) | 0;
      return (s >>> 0) / 0x100000000;
    };
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    return { day: d + 1, topics, problems: pool.slice(0, isHard ? 3 : 4) };
  });
}

function ratingTagColor(rating) {
  if (!rating) return "#6b7280";
  if (rating < 1200) return "#6b7280";
  if (rating < 1400) return "#22c55e";
  if (rating < 1600) return "#38bdf8";
  if (rating < 1900) return "#818cf8";
  if (rating < 2100) return "#a78bfa";
  if (rating < 2400) return "#f59e0b";
  return "#f43f5e";
}

function toggleRoadmapProblem(dayIdx, probIdx, checkbox) {
  const storageKey = `cf-roadmap-${_appState.handle || "anon"}`;
  const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
  const checkKey = `d${dayIdx}-p${probIdx}`;
  saved[checkKey] = checkbox.checked;
  localStorage.setItem(storageKey, JSON.stringify(saved));

  const el = $(`rmp-${dayIdx}-${probIdx}`);
  if (el) el.classList.toggle("rm-done", checkbox.checked);

  const total = document.querySelectorAll(".rm-checkbox").length;
  const done = document.querySelectorAll(".rm-checkbox:checked").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const fill = $("rmProgFill");
  const pctEl = $("rmProgPct");
  const label = document.querySelector(".rm-prog-label");
  if (fill) fill.style.width = pct + "%";
  if (pctEl) pctEl.textContent = pct + "%";
  if (label) label.textContent = `${done} / ${total} done`;
}

function resetRoadmapProgress() {
  const storageKey = `cf-roadmap-${_appState.handle || "anon"}`;
  localStorage.removeItem(storageKey);
  _appState.roadmapLoaded = false;
  renderStudyRoadmap();
}

function regenRoadmap() {
  _appState.roadmapLoaded = false;
  renderStudyRoadmap();
}
/* ═══════════════════════════════════════════════════
   FEATURE 1: Animated Background Particles
   ═══════════════════════════════════════════════════ */
function initParticles() {
  const canvas = $("particleCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let w, h, particles;
  const PARTICLE_COUNT = 60;

  function resize() {
    const section = canvas.parentElement;
    w = canvas.width = section.offsetWidth;
    h = canvas.height = section.offsetHeight;
  }

  function createParticles() {
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 2 + 0.5,
        dx: (Math.random() - 0.5) * 0.4,
        dy: (Math.random() - 0.5) * 0.4,
        opacity: Math.random() * 0.5 + 0.1,
        color: Math.random() > 0.5 ? "108,99,255" : "0,224,255",
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    for (const p of particles) {
      p.x += p.dx;
      p.y += p.dy;
      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h;
      if (p.y > h) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color},${p.opacity})`;
      ctx.fill();
    }
    // Draw connecting lines for nearby particles
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(108,99,255,${0.08 * (1 - dist / 120)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }

  resize();
  createParticles();
  draw();
  window.addEventListener("resize", () => {
    resize();
    createParticles();
  });
}

document.addEventListener("DOMContentLoaded", initParticles);

/* ═══════════════════════════════════════════════════
   FEATURE 2: Typewriter Hero Effect
   ═══════════════════════════════════════════════════ */
function initTypewriter() {
  const el = $("typewriterTarget");
  if (!el) return;

  const words = ["Weakness", "Potential", "Strength", "Growth", "Edge"];
  let wordIdx = 0;
  let charIdx = 0;
  let isDeleting = false;
  let cursor = document.createElement("span");
  cursor.className = "typewriter-cursor";

  function tick() {
    const currentWord = words[wordIdx];
    if (isDeleting) {
      charIdx--;
      el.textContent = currentWord.substring(0, charIdx);
      el.appendChild(cursor);
      if (charIdx === 0) {
        isDeleting = false;
        wordIdx = (wordIdx + 1) % words.length;
        setTimeout(tick, 400);
        return;
      }
      setTimeout(tick, 50);
    } else {
      charIdx++;
      el.textContent = currentWord.substring(0, charIdx);
      el.appendChild(cursor);
      if (charIdx === currentWord.length) {
        isDeleting = true;
        setTimeout(tick, 2000); // Pause before deleting
        return;
      }
      setTimeout(tick, 100);
    }
  }

  // Start after initial display
  setTimeout(() => {
    isDeleting = true;
    charIdx = words[0].length;
    tick();
  }, 2000);
}

document.addEventListener("DOMContentLoaded", initTypewriter);

/* ═══════════════════════════════════════════════════
   FEATURE 3: Toast Notification System
   ═══════════════════════════════════════════════════ */
function showToast(type, title, message, duration = 4000) {
  const container = $("toastContainer");
  if (!container) return;

  const icons = {
    success: "✅",
    error: "❌",
    warning: "⚠️",
    info: "ℹ️",
  };

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.style.position = "relative";
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || "ℹ️"}</span>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${message}</div>
    </div>
    <button class="toast-close" onclick="this.parentElement.classList.add('toast-exit');setTimeout(()=>this.parentElement.remove(),300)">✕</button>
    <div class="toast-progress" style="animation-duration:${duration}ms"></div>
  `;

  container.appendChild(toast);

  // Auto-remove
  setTimeout(() => {
    if (toast.parentElement) {
      toast.classList.add("toast-exit");
      setTimeout(() => toast.remove(), 300);
    }
  }, duration);
}

/* ═══════════════════════════════════════════════════
   FEATURE 4: Recent Search History
   ═══════════════════════════════════════════════════ */
const RECENT_STORAGE_KEY = "cf-recent-searches";
const MAX_RECENT = 8;

function getRecentSearches() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRecentSearch(handle) {
  let recent = getRecentSearches();
  // Remove if already exists
  recent = recent.filter(
    (r) => r.handle.toLowerCase() !== handle.toLowerCase(),
  );
  // Add to front
  recent.unshift({ handle, time: Date.now() });
  // Trim
  if (recent.length > MAX_RECENT) recent = recent.slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recent));
}

function showRecentSearches() {
  const recent = getRecentSearches();
  const container = $("recentSearches");
  const list = $("recentList");
  if (!container || !list || recent.length === 0) {
    if (container) hide(container);
    return;
  }

  list.innerHTML = recent
    .map((r) => {
      const ago = timeAgo(r.time);
      return `<button class="recent-item" onclick="selectRecentSearch('${r.handle}')">
        <span class="recent-item-icon">🕐</span>
        <span class="recent-item-handle">${r.handle}</span>
        <span class="recent-item-time">${ago}</span>
      </button>`;
    })
    .join("");

  show(container);
}

function selectRecentSearch(handle) {
  $("handleInput").value = handle;
  hide($("recentSearches"));
  startAnalysis();
}

function clearRecentSearches() {
  localStorage.removeItem(RECENT_STORAGE_KEY);
  hide($("recentSearches"));
  showToast("info", "Cleared", "Recent search history has been cleared.");
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// Close recent searches when clicking outside
document.addEventListener("click", (e) => {
  const container = $("recentSearches");
  const input = $("handleInput");
  if (container && !container.contains(e.target) && e.target !== input) {
    hide(container);
  }
});

/* ═══════════════════════════════════════════════════
   FEATURE 5: Friends Leaderboard
   ═══════════════════════════════════════════════════ */
let _lbHandles = [];

function addToLeaderboard() {
  const input = $("lbHandleInput");
  const handle = input.value.trim();
  if (!handle) return;
  if (_lbHandles.find((h) => h.toLowerCase() === handle.toLowerCase())) {
    showToast("warning", "Duplicate", `${handle} is already in the list.`);
    return;
  }
  _lbHandles.push(handle);
  input.value = "";
  renderLbTags();
  showToast("success", "Added", `${handle} added to leaderboard.`);
}

function removeLbHandle(handle) {
  _lbHandles = _lbHandles.filter(
    (h) => h.toLowerCase() !== handle.toLowerCase(),
  );
  renderLbTags();
}

function renderLbTags() {
  const container = $("lbHandleTags");
  if (!container) return;
  container.innerHTML = _lbHandles
    .map(
      (h) =>
        `<span class="lb-tag">${h}<button class="lb-tag-remove" onclick="removeLbHandle('${h}')">&times;</button></span>`,
    )
    .join("");
}

async function loadLeaderboard() {
  if (_lbHandles.length < 2) {
    showToast("warning", "Need more", "Add at least 2 handles to compare!");
    return;
  }

  const wrapper = $("leaderboardWrapper");
  wrapper.innerHTML =
    '<div class="lb-loading">⏳ Fetching data for all users...</div>';

  try {
    const results = [];
    for (const handle of _lbHandles) {
      try {
        const userInfo = await fetchUserInfo(handle);
        await delay(400);
        const subs = await fetchAllSubmissions(handle);
        await delay(400);
        const ratingHistory = await fetchRatingHistory(handle);

        const solved = new Set();
        let totalSubs = subs.length;
        for (const s of subs) {
          if (s.verdict === "OK") {
            solved.add(`${s.problem.contestId}-${s.problem.index}`);
          }
        }

        results.push({
          handle: userInfo.handle,
          rating: userInfo.rating || 0,
          maxRating: userInfo.maxRating || 0,
          rank: userInfo.rank || "unrated",
          avatar: userInfo.titlePhoto
            ? userInfo.titlePhoto.startsWith("//")
              ? "https:" + userInfo.titlePhoto
              : userInfo.titlePhoto
            : "",
          solved: solved.size,
          totalSubs,
          contests: ratingHistory.length,
        });
      } catch (e) {
        results.push({
          handle,
          rating: 0,
          maxRating: 0,
          rank: "error",
          avatar: "",
          solved: 0,
          totalSubs: 0,
          contests: 0,
          error: e.message,
        });
      }
    }

    // Sort by rating descending
    results.sort((a, b) => b.rating - a.rating);
    const maxSolved = Math.max(...results.map((r) => r.solved), 1);

    let html = `<table class="lb-table">
      <thead><tr>
        <th>#</th><th>User</th><th>Rating</th><th>Max</th><th>Solved</th><th>Contests</th><th>Progress</th>
      </tr></thead><tbody>`;

    results.forEach((r, i) => {
      const rankClass = i < 3 ? `lb-rank-${i + 1}` : "";
      const medal =
        i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
      const rColor = rankColor(r.rank);
      const barPct = Math.round((r.solved / maxSolved) * 100);

      html += `<tr>
        <td class="lb-rank ${rankClass}">${medal}</td>
        <td>
          <div class="lb-handle-cell">
            ${r.avatar ? `<img class="lb-avatar" src="${r.avatar}" alt="${r.handle}"/>` : ""}
            <div>
              <div class="lb-handle-name" style="color:${rColor}">${r.handle}</div>
              <div class="lb-handle-rank" style="color:${rColor}">${r.error ? "❌ Error" : capitalize(r.rank)}</div>
            </div>
          </div>
        </td>
        <td class="lb-rating-val" style="color:${rColor}">${r.rating || "–"}</td>
        <td style="color:var(--text2)">${r.maxRating || "–"}</td>
        <td><strong>${r.solved.toLocaleString()}</strong></td>
        <td>${r.contests}</td>
        <td class="lb-bar-cell">
          <div class="lb-bar-track">
            <div class="lb-bar-fill" style="width:${barPct}%;background:${rColor}"></div>
          </div>
        </td>
      </tr>`;
    });

    html += "</tbody></table>";
    wrapper.innerHTML = html;
    showToast(
      "success",
      "Leaderboard Ready",
      `${results.length} users compared!`,
    );
  } catch (e) {
    wrapper.innerHTML = `<p class="sheet-empty">Failed: ${e.message}</p>`;
    showToast("error", "Error", e.message);
  }
}

// Auto-add current user to leaderboard if analyzed
function autoAddSelfToLeaderboard() {
  if (
    _appState.handle &&
    !_lbHandles.find((h) => h.toLowerCase() === _appState.handle.toLowerCase())
  ) {
    _lbHandles.unshift(_appState.handle);
    renderLbTags();
  }
}

/* ═══════════════════════════════════════════════════
   FEATURE 6: Problem Bookmarks
   ═══════════════════════════════════════════════════ */
const BOOKMARKS_KEY = "cf-bookmarks";

function getBookmarks() {
  try {
    return JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || "[]");
  } catch {
    return [];
  }
}

function toggleBookmark(contestId, index, name, rating) {
  let bookmarks = getBookmarks();
  const key = `${contestId}-${index}`;
  const exists = bookmarks.find((b) => b.key === key);

  if (exists) {
    bookmarks = bookmarks.filter((b) => b.key !== key);
    showToast("info", "Removed", `${name} removed from bookmarks.`);
  } else {
    bookmarks.push({
      key,
      contestId,
      index,
      name,
      rating,
      time: Date.now(),
      url: `https://codeforces.com/problemset/problem/${contestId}/${index}`,
    });
    showToast("success", "Bookmarked", `${name} saved for later!`);
  }

  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
  // Update button state
  const btn = document.querySelector(`[data-bookmark-key="${key}"]`);
  if (btn) {
    btn.textContent = exists ? "🔖" : "⭐";
    btn.classList.toggle("bookmarked", !exists);
  }
}

function isBookmarked(contestId, index) {
  const bookmarks = getBookmarks();
  return bookmarks.some((b) => b.key === `${contestId}-${index}`);
}

function createBookmarkBtn(contestId, index, name, rating) {
  const key = `${contestId}-${index}`;
  const marked = isBookmarked(contestId, index);
  return `<button class="bookmark-btn ${marked ? "bookmarked" : ""}" data-bookmark-key="${key}"
    onclick="toggleBookmark(${contestId},'${index}','${(name || "").replace(/'/g, "\\'")}',${rating || 0})"
    title="${marked ? "Remove bookmark" : "Bookmark for later"}">${marked ? "⭐" : "🔖"}</button>`;
}

/* ═══════════════════════════════════════════════════
   Integrate toasts into existing analysis flow
   ═══════════════════════════════════════════════════ */
const _origStartAnalysis = startAnalysis;
startAnalysis = async function () {
  const handle = $("handleInput").value.trim();
  if (handle) {
    saveRecentSearch(handle);
    hide($("recentSearches"));
  }
  try {
    await _origStartAnalysis.call(this);
    if (handle) {
      showToast(
        "success",
        "Analysis Complete",
        `${handle}'s profile analyzed successfully!`,
      );
    }
  } catch (e) {
    showToast("error", "Analysis Failed", e.message || "Something went wrong.");
    throw e;
  }
};

// Auto-add self to leaderboard on tab switch
const _origSwitchTab = switchTab;
switchTab = function (tabId) {
  _origSwitchTab(tabId);
  if (tabId === "leaderboard") {
    autoAddSelfToLeaderboard();
  }
};

// Keyboard shortcut: Enter key in leaderboard input
document.addEventListener("DOMContentLoaded", () => {
  const lbInput = $("lbHandleInput");
  if (lbInput) {
    lbInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addToLeaderboard();
    });
  }
});
