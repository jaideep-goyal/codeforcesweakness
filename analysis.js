/* ═══════════════════════════════════════════════════
   analysis.js — Data Analysis Engine
   ═══════════════════════════════════════════════════ */

/** Rating buckets for grouping difficulty */
const RATING_BUCKETS = [
  [800, 1000],
  [1000, 1200],
  [1200, 1400],
  [1400, 1600],
  [1600, 1800],
  [1800, 2000],
  [2000, 2200],
  [2200, 2400],
  [2400, 2600],
  [2600, 2800],
  [2800, 3500],
];

function bucketLabel([lo, hi]) {
  return `${lo}–${hi}`;
}

/**
 * Normalize Codeforces raw submissions into an analysis-ready dataset.
 * Each unique (contestId, problem.index) is treated as one problem attempt.
 */
function buildAnalysisData(submissions) {
  // Group by problem key
  const problemMap = {};
  for (const sub of submissions) {
    const p = sub.problem;
    const key = `${sub.contestId || "gym"}-${p.index}`;
    if (!problemMap[key]) {
      problemMap[key] = {
        contestId: sub.contestId,
        index: p.index,
        name: p.name,
        rating: p.rating || null,
        tags: p.tags || [],
        submissions: [],
      };
    }
    problemMap[key].submissions.push(sub);
  }

  const problems = Object.values(problemMap);

  // For each problem, derive metrics
  const analyzed = problems.map((prob) => {
    // Sort subs chronologically
    const subs = prob.submissions.sort(
      (a, b) => a.creationTimeSeconds - b.creationTimeSeconds,
    );
    const accepted = subs.find((s) => s.verdict === "OK");
    const isContest = subs.some(
      (s) => s.author && s.author.participantType === "CONTESTANT",
    );
    const isPractice = !isContest;

    // Verdicts
    const verdictCounts = {};
    for (const s of subs) {
      const v = s.verdict || "UNKNOWN";
      verdictCounts[v] = (verdictCounts[v] || 0) + 1;
    }

    // Solve time (seconds from first submit to AC, only if solved)
    let solveTimeSec = null;
    if (accepted && subs.length > 0) {
      solveTimeSec = accepted.creationTimeSeconds - subs[0].creationTimeSeconds;
      // If only one submission and it's AC, solve time relative to contest start
      if (solveTimeSec === 0 && accepted.relativeTimeSeconds != null) {
        solveTimeSec = accepted.relativeTimeSeconds;
      }
    }

    return {
      ...prob,
      solved: !!accepted,
      totalAttempts: subs.length,
      wrongAttempts: subs.filter((s) => s.verdict !== "OK").length,
      verdictCounts,
      solveTimeSec,
      isContest,
      isPractice,
    };
  });

  return analyzed;
}

/**
 * Aggregate metrics by topic.
 */
function aggregateByTopic(analyzed) {
  const topicMap = {};

  for (const p of analyzed) {
    const tags = p.tags.length > 0 ? p.tags : ["untagged"];
    for (const tag of tags) {
      if (!topicMap[tag]) {
        topicMap[tag] = {
          topic: tag,
          attempted: 0,
          solved: 0,
          totalAttempts: 0,
          wrongAttempts: 0,
          solveTimes: [],
          verdictCounts: {},
        };
      }
      const t = topicMap[tag];
      t.attempted++;
      if (p.solved) t.solved++;
      t.totalAttempts += p.totalAttempts;
      t.wrongAttempts += p.wrongAttempts;
      if (p.solveTimeSec != null && p.solveTimeSec >= 0)
        t.solveTimes.push(p.solveTimeSec);
      for (const [v, c] of Object.entries(p.verdictCounts)) {
        t.verdictCounts[v] = (t.verdictCounts[v] || 0) + c;
      }
    }
  }

  return Object.values(topicMap)
    .map((t) => ({
      ...t,
      successRate: t.attempted > 0 ? t.solved / t.attempted : 0,
      wrongRatio: t.totalAttempts > 0 ? t.wrongAttempts / t.totalAttempts : 0,
      avgSolveTime:
        t.solveTimes.length > 0
          ? t.solveTimes.reduce((a, b) => a + b, 0) / t.solveTimes.length
          : null,
    }))
    .sort((a, b) => a.successRate - b.successRate);
}

/**
 * Aggregate metrics by difficulty bucket.
 */
function aggregateByDifficulty(analyzed) {
  const bucketMap = {};
  for (const bucket of RATING_BUCKETS) {
    const label = bucketLabel(bucket);
    bucketMap[label] = { label, attempted: 0, solved: 0 };
  }
  // Also an "unrated" bucket
  bucketMap["Unrated"] = { label: "Unrated", attempted: 0, solved: 0 };

  for (const p of analyzed) {
    let placed = false;
    if (p.rating) {
      for (const bucket of RATING_BUCKETS) {
        if (p.rating >= bucket[0] && p.rating < bucket[1]) {
          const label = bucketLabel(bucket);
          bucketMap[label].attempted++;
          if (p.solved) bucketMap[label].solved++;
          placed = true;
          break;
        }
      }
    }
    if (!placed) {
      bucketMap["Unrated"].attempted++;
      if (p.solved) bucketMap["Unrated"].solved++;
    }
  }

  return Object.values(bucketMap).filter((b) => b.attempted > 0);
}

/**
 * Build the heatmap matrix: topic × difficulty bucket.
 * Returns { topics, buckets, matrix[topicIdx][bucketIdx] }
 */
function buildHeatmapData(analyzed) {
  const heatmap = {};
  const allTopics = new Set();
  const usedBuckets = new Set();

  for (const p of analyzed) {
    const tags = p.tags.length > 0 ? p.tags : ["untagged"];
    let bucketLbl = "Unrated";
    if (p.rating) {
      for (const bucket of RATING_BUCKETS) {
        if (p.rating >= bucket[0] && p.rating < bucket[1]) {
          bucketLbl = bucketLabel(bucket);
          break;
        }
      }
    }

    for (const tag of tags) {
      allTopics.add(tag);
      usedBuckets.add(bucketLbl);
      const key = `${tag}|${bucketLbl}`;
      if (!heatmap[key])
        heatmap[key] = {
          attempted: 0,
          solved: 0,
          wrongAttempts: 0,
          solveTimes: [],
          verdictCounts: {},
        };
      const cell = heatmap[key];
      cell.attempted++;
      if (p.solved) cell.solved++;
      cell.wrongAttempts += p.wrongAttempts;
      if (p.solveTimeSec != null) cell.solveTimes.push(p.solveTimeSec);
      for (const [v, c] of Object.entries(p.verdictCounts)) {
        cell.verdictCounts[v] = (cell.verdictCounts[v] || 0) + c;
      }
    }
  }

  // Sort topics by overall success rate (worst first)
  const topicAgg = aggregateByTopic(analyzed);
  const topics = topicAgg.map((t) => t.topic).filter((t) => allTopics.has(t));

  // Order buckets naturally
  const bucketOrder = RATING_BUCKETS.map(bucketLabel).filter((b) =>
    usedBuckets.has(b),
  );
  if (usedBuckets.has("Unrated")) bucketOrder.push("Unrated");

  // Build matrix
  const matrix = topics.map((topic) =>
    bucketOrder.map((bucket) => {
      const cell = heatmap[`${topic}|${bucket}`];
      if (!cell || cell.attempted === 0) return null;
      return {
        ...cell,
        successRate: cell.solved / cell.attempted,
        avgAttempts:
          cell.attempted > 0
            ? (cell.solved + cell.wrongAttempts) / cell.attempted
            : 0,
        topVerdict: getTopVerdict(cell.verdictCounts),
      };
    }),
  );

  return { topics, buckets: bucketOrder, matrix };
}

function getTopVerdict(verdictCounts) {
  let top = null,
    topCount = 0;
  for (const [v, c] of Object.entries(verdictCounts)) {
    if (v !== "OK" && c > topCount) {
      top = v;
      topCount = c;
    }
  }
  return top;
}

/**
 * Contest vs Practice breakdown.
 */
function contestVsPractice(analyzed) {
  const contest = { attempted: 0, solved: 0 };
  const practice = { attempted: 0, solved: 0 };
  for (const p of analyzed) {
    if (p.isContest) {
      contest.attempted++;
      if (p.solved) contest.solved++;
    } else {
      practice.attempted++;
      if (p.solved) practice.solved++;
    }
  }
  return { contest, practice };
}

/**
 * Global verdict breakdown.
 */
function globalVerdicts(submissions) {
  const counts = {};
  for (const s of submissions) {
    const v = s.verdict || "UNKNOWN";
    counts[v] = (counts[v] || 0) + 1;
  }
  return counts;
}

/**
 * KPI summary numbers.
 */
function computeKPIs(analyzed, submissions) {
  const totalProblems = analyzed.length;
  const solved = analyzed.filter((p) => p.solved).length;
  const overallSuccess =
    totalProblems > 0 ? ((solved / totalProblems) * 100).toFixed(1) : 0;

  const avgAttempts =
    totalProblems > 0
      ? (
          analyzed.reduce((s, p) => s + p.totalAttempts, 0) / totalProblems
        ).toFixed(1)
      : 0;

  const solveTimes = analyzed
    .filter((p) => p.solveTimeSec != null && p.solveTimeSec > 0)
    .map((p) => p.solveTimeSec);
  const avgSolveMin =
    solveTimes.length > 0
      ? (
          solveTimes.reduce((a, b) => a + b, 0) /
          solveTimes.length /
          60
        ).toFixed(0)
      : "–";

  const topicData = aggregateByTopic(analyzed);
  const weakestTopic = topicData.length > 0 ? topicData[0].topic : "–";

  const contestData = contestVsPractice(analyzed);
  const contestSolveRate =
    contestData.contest.attempted > 0
      ? (
          (contestData.contest.solved / contestData.contest.attempted) *
          100
        ).toFixed(1)
      : "–";

  return {
    totalProblems,
    solved,
    overallSuccess,
    avgAttempts,
    avgSolveMin,
    weakestTopic,
    contestSolveRate,
    totalSubmissions: submissions.length,
  };
}

/**
 * Aggregate submissions by programming language.
 */
function aggregateByLanguage(submissions) {
  const langMap = {};
  for (const s of submissions) {
    const lang = s.programmingLanguage || "Unknown";
    if (!langMap[lang]) {
      langMap[lang] = { language: lang, total: 0, accepted: 0 };
    }
    langMap[lang].total++;
    if (s.verdict === "OK") langMap[lang].accepted++;
  }
  return Object.values(langMap)
    .map((l) => ({
      ...l,
      successRate: l.total > 0 ? l.accepted / l.total : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Build daily submission calendar data (last 12 months).
 */
function buildCalendarData(submissions) {
  const dayCounts = {};
  for (const s of submissions) {
    const d = new Date(s.creationTimeSeconds * 1000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    dayCounts[key] = (dayCounts[key] || 0) + 1;
  }
  return dayCounts;
}

/**
 * Compute peer comparison metrics for two analyzed datasets.
 */
function computePeerComparison(analyzedA, subsA, analyzedB, subsB) {
  const kpiA = computeKPIs(analyzedA, subsA);
  const kpiB = computeKPIs(analyzedB, subsB);
  const topicA = aggregateByTopic(analyzedA);
  const topicB = aggregateByTopic(analyzedB);

  // Build radar data — top 8 topics by combined attempts
  const allTopics = new Map();
  for (const t of topicA)
    allTopics.set(t.topic, (allTopics.get(t.topic) || 0) + t.attempted);
  for (const t of topicB)
    allTopics.set(t.topic, (allTopics.get(t.topic) || 0) + t.attempted);
  const topTopics = [...allTopics.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([t]) => t);

  const radarA = topTopics.map((t) => {
    const found = topicA.find((x) => x.topic === t);
    return found ? +(found.successRate * 100).toFixed(1) : 0;
  });
  const radarB = topTopics.map((t) => {
    const found = topicB.find((x) => x.topic === t);
    return found ? +(found.successRate * 100).toFixed(1) : 0;
  });

  return { kpiA, kpiB, topTopics, radarA, radarB };
}

/* ═══════════════════════════════════════════════════
   NEW ANALYSIS FUNCTIONS (Hackathon Features)
   ═══════════════════════════════════════════════════ */

/**
 * Compute submission streaks (consecutive days with accepted submissions).
 */
function computeStreaks(submissions) {
  const acDates = new Set();
  const allDates = new Set();
  for (const sub of submissions) {
    const d = new Date(sub.creationTimeSeconds * 1000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    allDates.add(key);
    if (sub.verdict === "OK") acDates.add(key);
  }

  if (acDates.size === 0)
    return { currentStreak: 0, bestStreak: 0, activeDays: 0, totalDays: 0 };

  const sorted = [...acDates].sort();
  let best = 1,
    current = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = (curr - prev) / (1000 * 60 * 60 * 24);
    if (Math.round(diff) === 1) {
      current++;
      best = Math.max(best, current);
    } else {
      current = 1;
    }
  }

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const yesterday = new Date(today - 86400000);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

  if (!acDates.has(todayKey) && !acDates.has(yesterdayKey)) {
    current = 0;
  }

  const firstSub = submissions[submissions.length - 1];
  const totalDays = firstSub
    ? Math.ceil(
        (Date.now() - firstSub.creationTimeSeconds * 1000) /
          (1000 * 60 * 60 * 24),
      )
    : 0;

  return {
    currentStreak: current,
    bestStreak: best,
    activeDays: allDates.size,
    totalDays,
  };
}

/**
 * Build time-of-day productivity heatmap data.
 */
function buildTimeOfDayData(submissions) {
  const matrix = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => ({ total: 0, ac: 0 })),
  );

  for (const sub of submissions) {
    const d = new Date(sub.creationTimeSeconds * 1000);
    const day = d.getDay();
    const hour = d.getHours();
    matrix[day][hour].total++;
    if (sub.verdict === "OK") matrix[day][hour].ac++;
  }

  let maxCount = 0;
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      matrix[d][h].rate =
        matrix[d][h].total > 0 ? matrix[d][h].ac / matrix[d][h].total : 0;
      maxCount = Math.max(maxCount, matrix[d][h].total);
    }
  }

  return { matrix, maxCount };
}

/**
 * Build difficulty progression over time.
 */
function buildDifficultyProgression(submissions) {
  const monthly = {};

  for (const sub of submissions) {
    if (sub.verdict !== "OK" || !sub.problem.rating) continue;
    const d = new Date(sub.creationTimeSeconds * 1000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthly[key]) monthly[key] = [];
    monthly[key].push(sub.problem.rating);
  }

  const sorted = Object.keys(monthly).sort();
  const labels = [];
  const avgRatings = [];
  const maxRatings = [];
  const minRatings = [];

  for (const key of sorted) {
    const arr = monthly[key];
    labels.push(key);
    avgRatings.push(Math.round(arr.reduce((a, b) => a + b, 0) / arr.length));
    maxRatings.push(Math.max(...arr));
    minRatings.push(Math.min(...arr));
  }

  return { labels, avgRatings, maxRatings, minRatings };
}

/**
 * Build contest deep dive data.
 */
function buildContestDeepDive(ratingHistory, submissions) {
  const contestSolved = {};
  for (const sub of submissions) {
    if (
      sub.verdict === "OK" &&
      sub.author &&
      sub.author.participantType === "CONTESTANT"
    ) {
      const cId = sub.contestId;
      if (!contestSolved[cId]) contestSolved[cId] = new Set();
      contestSolved[cId].add(`${sub.problem.contestId}-${sub.problem.index}`);
    }
  }

  return ratingHistory.map((r, i) => ({
    index: i + 1,
    contestName: r.contestName,
    contestId: r.contestId,
    rank: r.rank,
    oldRating: r.oldRating,
    newRating: r.newRating,
    delta: r.newRating - r.oldRating,
    problemsSolved: contestSolved[r.contestId]
      ? contestSolved[r.contestId].size
      : 0,
    timestamp: r.ratingUpdateTimeSeconds,
  }));
}

/**
 * Compute achievement badges.
 */
function computeBadges(
  analyzed,
  submissions,
  ratingHistory,
  kpis,
  topicData,
  streaks,
) {
  const badges = [];
  const solved = kpis.solved;
  const maxRating =
    ratingHistory.length > 0
      ? Math.max(...ratingHistory.map((r) => r.newRating))
      : 0;
  const uniqueTopics = new Set();
  for (const sub of submissions) {
    if (sub.verdict === "OK" && sub.problem.tags) {
      sub.problem.tags.forEach((t) => uniqueTopics.add(t));
    }
  }
  const contestCount = ratingHistory.length;

  badges.push({
    id: "solver_10",
    icon: "🌱",
    title: "First Steps",
    description: "Solve 10 problems",
    unlocked: solved >= 10,
    progress: `${Math.min(solved, 10)}/10`,
  });
  badges.push({
    id: "solver_50",
    icon: "📘",
    title: "Steady Solver",
    description: "Solve 50 problems",
    unlocked: solved >= 50,
    progress: `${Math.min(solved, 50)}/50`,
  });
  badges.push({
    id: "solver_100",
    icon: "🔥",
    title: "Centurion",
    description: "Solve 100 problems",
    unlocked: solved >= 100,
    progress: `${Math.min(solved, 100)}/100`,
  });
  badges.push({
    id: "solver_500",
    icon: "⚡",
    title: "Problem Machine",
    description: "Solve 500 problems",
    unlocked: solved >= 500,
    progress: `${Math.min(solved, 500)}/500`,
  });
  badges.push({
    id: "solver_1000",
    icon: "🏆",
    title: "Grand Solver",
    description: "Solve 1000 problems",
    unlocked: solved >= 1000,
    progress: `${Math.min(solved, 1000)}/1000`,
  });

  badges.push({
    id: "rating_1200",
    icon: "🟢",
    title: "Pupil",
    description: "Reach 1200 rating",
    unlocked: maxRating >= 1200,
    progress: `${maxRating}/1200`,
  });
  badges.push({
    id: "rating_1400",
    icon: "🔵",
    title: "Specialist",
    description: "Reach 1400 rating",
    unlocked: maxRating >= 1400,
    progress: `${maxRating}/1400`,
  });
  badges.push({
    id: "rating_1600",
    icon: "🟣",
    title: "Expert",
    description: "Reach 1600 rating",
    unlocked: maxRating >= 1600,
    progress: `${maxRating}/1600`,
  });
  badges.push({
    id: "rating_1900",
    icon: "🟠",
    title: "Candidate Master",
    description: "Reach 1900 rating",
    unlocked: maxRating >= 1900,
    progress: `${maxRating}/1900`,
  });
  badges.push({
    id: "rating_2100",
    icon: "🔴",
    title: "Master",
    description: "Reach 2100 rating",
    unlocked: maxRating >= 2100,
    progress: `${maxRating}/2100`,
  });

  badges.push({
    id: "streak_7",
    icon: "🔥",
    title: "Week Warrior",
    description: "7-day submission streak",
    unlocked: streaks.bestStreak >= 7,
    progress: `${Math.min(streaks.bestStreak, 7)}/7`,
  });
  badges.push({
    id: "streak_30",
    icon: "💎",
    title: "Month Master",
    description: "30-day submission streak",
    unlocked: streaks.bestStreak >= 30,
    progress: `${Math.min(streaks.bestStreak, 30)}/30`,
  });

  badges.push({
    id: "contest_10",
    icon: "🏅",
    title: "Competitor",
    description: "Participate in 10 contests",
    unlocked: contestCount >= 10,
    progress: `${Math.min(contestCount, 10)}/10`,
  });
  badges.push({
    id: "contest_50",
    icon: "🎖️",
    title: "Veteran",
    description: "Participate in 50 contests",
    unlocked: contestCount >= 50,
    progress: `${Math.min(contestCount, 50)}/50`,
  });

  badges.push({
    id: "topics_10",
    icon: "🌐",
    title: "Diversifier",
    description: "Solve in 10+ unique tags",
    unlocked: uniqueTopics.size >= 10,
    progress: `${Math.min(uniqueTopics.size, 10)}/10`,
  });
  badges.push({
    id: "topics_20",
    icon: "🎯",
    title: "Polymath",
    description: "Solve in 20+ unique tags",
    unlocked: uniqueTopics.size >= 20,
    progress: `${Math.min(uniqueTopics.size, 20)}/20`,
  });

  const successPct = parseFloat(kpis.overallSuccess);
  badges.push({
    id: "accuracy_80",
    icon: "🎯",
    title: "Sharpshooter",
    description: "80%+ success rate",
    unlocked: successPct >= 80,
    progress: `${successPct.toFixed(0)}%/80%`,
  });

  const masterTopics = topicData.filter(
    (t) => t.attempted >= 10 && t.successRate >= 0.9,
  );
  badges.push({
    id: "topic_master",
    icon: "👑",
    title: "Topic Master",
    description: "90%+ success in any topic (10+ problems)",
    unlocked: masterTopics.length > 0,
    progress: masterTopics.length > 0 ? masterTopics[0].topic : "None yet",
  });

  badges.push({
    id: "active_100",
    icon: "📅",
    title: "Dedicated",
    description: "Active on 100+ days",
    unlocked: streaks.activeDays >= 100,
    progress: `${Math.min(streaks.activeDays, 100)}/100`,
  });

  const avgMin = kpis.avgSolveMin === "–" ? 999 : parseFloat(kpis.avgSolveMin);
  badges.push({
    id: "speed_demon",
    icon: "⚡",
    title: "Speed Demon",
    description: "Avg solve time < 15 min",
    unlocked: avgMin < 15 && avgMin > 0,
    progress: avgMin === 999 ? "–" : `${avgMin} min`,
  });

  return badges;
}

/**
 * Generate problem recommendations based on weaknesses.
 */
function generateRecommendations(
  problemset,
  analyzed,
  submissions,
  topicData,
  options = {},
) {
  const solvedSet = new Set();
  for (const sub of submissions) {
    if (sub.verdict === "OK") {
      solvedSet.add(`${sub.problem.contestId}-${sub.problem.index}`);
    }
  }

  let targetTopics = [];
  if (options.topic && options.topic !== "auto") {
    targetTopics = [options.topic];
  } else {
    targetTopics = topicData
      .filter((t) => t.attempted >= 3 && t.successRate < 0.7)
      .sort((a, b) => a.successRate - b.successRate)
      .slice(0, 5)
      .map((t) => t.topic);
    if (targetTopics.length === 0) {
      targetTopics = topicData.slice(0, 3).map((t) => t.topic);
    }
  }

  let targetRating = null;
  if (options.difficulty && options.difficulty !== "auto") {
    targetRating = parseInt(options.difficulty);
  } else {
    const weakCells = [];
    const hm = buildHeatmapData(analyzed);
    for (let i = 0; i < hm.topics.length; i++) {
      for (let j = 0; j < hm.buckets.length; j++) {
        const cell = hm.matrix[i][j];
        if (cell && cell.attempted >= 2 && cell.successRate < 0.5) {
          weakCells.push({ rating: parseInt(hm.buckets[j]) || 1200, ...cell });
        }
      }
    }
    if (weakCells.length > 0) {
      weakCells.sort((a, b) => a.successRate - b.successRate);
      targetRating = weakCells[0].rating;
    }
  }

  let candidates = problemset.filter((p) => {
    if (!p.rating) return false;
    const key = `${p.contestId}-${p.index}`;
    if (solvedSet.has(key)) return false;
    if (targetRating && Math.abs(p.rating - targetRating) > 200) return false;
    if (targetTopics.length > 0 && p.tags) {
      if (!p.tags.some((t) => targetTopics.includes(t))) return false;
    }
    return true;
  });

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
    return { ...p, score, matchedTopics };
  });

  candidates.sort((a, b) => b.score - a.score);
  const top = candidates.slice(0, 30);
  for (let i = top.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [top[i], top[j]] = [top[j], top[i]];
  }

  return top.slice(0, 12).map((p) => ({
    contestId: p.contestId,
    index: p.index,
    name: p.name,
    rating: p.rating,
    tags: p.tags || [],
    reason:
      p.matchedTopics.length > 0
        ? `Targets your weak area: ${p.matchedTopics.join(", ")}`
        : "Matches your target difficulty range",
    url: `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`,
  }));
}

/**
 * Generate a "Daily Problem of the Day" based on user weaknesses and rating.
 * Uses the current date as a seed so the problem stays the same all day.
 *
 * @param {Array} problemset  - Full CF problemset from API
 * @param {Array} analyzed    - User's analyzed submissions
 * @param {Array} submissions - Raw submissions
 * @param {Array} topicData   - aggregateByTopic output
 * @param {number|null} userRating - Current user rating (null if unrated)
 * @returns {Object|null} Daily problem object or null
 */
function generateDailyProblem(
  problemset,
  analyzed,
  submissions,
  topicData,
  userRating,
) {
  // Build set of already-solved problems
  const solvedSet = new Set();
  for (const sub of submissions) {
    if (sub.verdict === "OK") {
      solvedSet.add(`${sub.problem.contestId}-${sub.problem.index}`);
    }
  }

  // Determine target rating range based on user rating
  const baseRating = userRating || 1200;
  const ratingLo = Math.max(800, baseRating - 200);
  const ratingHi = baseRating + 300;

  // Find weak topics (success < 70% with at least 3 attempts)
  const weakTopics = topicData
    .filter((t) => t.attempted >= 3 && t.successRate < 0.7)
    .sort((a, b) => a.successRate - b.successRate)
    .slice(0, 8)
    .map((t) => t.topic);

  // If no weak topics, use all topics the user has tried
  const targetTopics =
    weakTopics.length > 0
      ? weakTopics
      : topicData.slice(0, 5).map((t) => t.topic);

  // Filter candidates: unsolved, in rating range, matching weak topics
  let candidates = problemset.filter((p) => {
    if (!p.rating) return false;
    const key = `${p.contestId}-${p.index}`;
    if (solvedSet.has(key)) return false;
    if (p.rating < ratingLo || p.rating > ratingHi) return false;
    if (p.tags && p.tags.length > 0) {
      if (!p.tags.some((t) => targetTopics.includes(t))) return false;
    }
    return true;
  });

  // Fallback: if too few candidates, relax the topic filter
  if (candidates.length < 10) {
    candidates = problemset.filter((p) => {
      if (!p.rating) return false;
      const key = `${p.contestId}-${p.index}`;
      if (solvedSet.has(key)) return false;
      if (p.rating < ratingLo || p.rating > ratingHi) return false;
      return true;
    });
  }

  if (candidates.length === 0) return null;

  // Score each candidate by weakness relevance
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
    // Prefer problems closer to user's rating
    const ratingDist = Math.abs(p.rating - baseRating);
    score -= ratingDist * 0.01;
    return { ...p, score, matchedTopics };
  });

  // Sort by score descending, take top pool
  candidates.sort((a, b) => b.score - a.score);
  const pool = candidates.slice(0, Math.min(candidates.length, 200));

  // Use date-based seed to deterministically pick one problem per day
  const today = new Date();
  const dateSeed =
    today.getFullYear() * 10000 +
    (today.getMonth() + 1) * 100 +
    today.getDate();

  // Simple hash-based index from date seed
  function simpleHash(seed) {
    let h = seed;
    h = ((h >> 16) ^ h) * 0x45d9f3b;
    h = ((h >> 16) ^ h) * 0x45d9f3b;
    h = (h >> 16) ^ h;
    return Math.abs(h);
  }

  const idx = simpleHash(dateSeed) % pool.length;
  const chosen = pool[idx];

  // Build the reason string
  let reason = "";
  if (chosen.matchedTopics.length > 0) {
    reason = `Targets your weak area: ${chosen.matchedTopics.join(", ")}`;
  } else {
    reason = `Matches your current rating range (${ratingLo}–${ratingHi})`;
  }

  // Determine difficulty label
  let difficultyLabel = "Medium";
  if (chosen.rating <= baseRating - 100) difficultyLabel = "Warm-up";
  else if (chosen.rating >= baseRating + 100) difficultyLabel = "Challenge";

  return {
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
}

/**
 * Generate a structured practice sheet: Rating × Topic grid.
 * Each cell contains unsolved problems prioritized by user weakness.
 *
 * @param {Array} problemset  - Full CF problemset
 * @param {Array} analyzed    - User's analyzed data
 * @param {Array} submissions - Raw submissions
 * @param {Array} topicData   - aggregateByTopic output
 * @param {number|null} userRating - Current rating
 * @returns {Object} { ratings, topics, grid, solvedCounts }
 */
function generatePracticeSheet(
  problemset,
  analyzed,
  submissions,
  topicData,
  userRating,
) {
  // Build solved set
  const solvedSet = new Set();
  for (const sub of submissions) {
    if (sub.verdict === "OK") {
      solvedSet.add(`${sub.problem.contestId}-${sub.problem.index}`);
    }
  }

  // Rating buckets for columns
  const sheetRatings = [
    800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000,
    2100, 2200, 2400,
  ];

  // Top topics (sorted by weakness first)
  const topTopics = topicData
    .filter((t) => t.attempted >= 1)
    .sort((a, b) => a.successRate - b.successRate)
    .slice(0, 15)
    .map((t) => t.topic);

  // Build grid: topic → rating → list of problems
  const grid = {};
  const solvedCounts = {};
  for (const topic of topTopics) {
    grid[topic] = {};
    solvedCounts[topic] = {};
    for (const r of sheetRatings) {
      grid[topic][r] = [];
      solvedCounts[topic][r] = { solved: 0, total: 0 };
    }
  }

  // Count solved per cell from user's data
  for (const sub of submissions) {
    const p = sub.problem;
    if (!p.rating || !p.tags) continue;
    const rBucket = sheetRatings.find((r) => Math.abs(p.rating - r) <= 50);
    if (!rBucket) continue;
    for (const tag of p.tags) {
      if (grid[tag] && grid[tag][rBucket]) {
        solvedCounts[tag][rBucket].total++;
        if (sub.verdict === "OK") {
          solvedCounts[tag][rBucket].solved++;
        }
      }
    }
  }

  // Fill grid with unsolved problems from problemset
  for (const p of problemset) {
    if (!p.rating || !p.tags || p.tags.length === 0) continue;
    const key = `${p.contestId}-${p.index}`;
    if (solvedSet.has(key)) continue;

    const rBucket = sheetRatings.find((r) => Math.abs(p.rating - r) <= 50);
    if (!rBucket) continue;

    for (const tag of p.tags) {
      if (grid[tag] && grid[tag][rBucket] && grid[tag][rBucket].length < 5) {
        grid[tag][rBucket].push({
          contestId: p.contestId,
          index: p.index,
          name: p.name,
          rating: p.rating,
          url: `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`,
        });
      }
    }
  }

  return {
    ratings: sheetRatings,
    topics: topTopics,
    grid,
    solvedCounts,
    userRating: userRating || 1200,
  };
}
