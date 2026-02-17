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
function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  html.setAttribute("data-theme", next);
  $("themeToggle").textContent = next === "dark" ? "🌙" : "☀️";
  localStorage.setItem("cf-theme", next);
}

// Restore theme on load
(function () {
  const saved = localStorage.getItem("cf-theme");
  if (saved) {
    document.documentElement.setAttribute("data-theme", saved);
    document.addEventListener("DOMContentLoaded", () => {
      const btn = $("themeToggle");
      if (btn) btn.textContent = saved === "dark" ? "🌙" : "☀️";
    });
  }
})();

/* ─── Tab Navigation ─── */
function switchTab(tabId) {
  // Update sub-nav buttons
  document.querySelectorAll(".sub-nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });
  // Update topbar links
  document.querySelectorAll(".topbar-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.tab === tabId);
  });
  // Update sidebar quick nav
  document.querySelectorAll(".sb-nav-link").forEach((link) => {
    const href = link.getAttribute("onclick") || "";
    const match = href.match(/switchTab\('(\w+)'\)/);
    if (match) {
      link.classList.toggle("active", match[1] === tabId);
    }
  });
  // Update legacy tab buttons (if any)
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

    // Save state for recommendations + POTD
    _appState.analyzed = analyzed;
    _appState.submissions = submissions;
    _appState.topicData = topicData;
    _appState.userRating = userInfo.rating || null;
    _appState.recommendLoaded = false;
    _appState.potdSkipCount = 0;
    _appState.upcomingLoaded = false;
    _appState.sheetLoaded = false;
    _appState.sheetData = null;

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
  rankEl.textContent = `${rankText} • Rating: ${user.rating || "–"} (max: ${user.maxRating || "–"})`;
  rankEl.style.color = rankColor(user.rank);

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
