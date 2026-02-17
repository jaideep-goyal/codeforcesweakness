/* ═══════════════════════════════════════════════════
   insights.js — Advanced Insights Engine
   ═══════════════════════════════════════════════════ */

/**
 * Generate human-readable insights from the analyzed data.
 * Returns array of { type: 'critical'|'warning'|'positive'|'info', icon, title, body, tagLabel }
 */
function generateInsights(analyzed, topicData, heatmapData, cvp, kpis) {
  const insights = [];

  // ── 1. Weakest topic-difficulty combos ──
  const weakCells = [];
  const { topics, buckets, matrix } = heatmapData;
  for (let i = 0; i < topics.length; i++) {
    for (let j = 0; j < buckets.length; j++) {
      const cell = matrix[i][j];
      if (cell && cell.attempted >= 3 && cell.successRate < 0.4) {
        weakCells.push({ topic: topics[i], bucket: buckets[j], ...cell });
      }
    }
  }
  weakCells.sort((a, b) => a.successRate - b.successRate);

  if (weakCells.length > 0) {
    const top3 = weakCells.slice(0, 3);
    const lines = top3.map((c) => {
      const pct = (c.successRate * 100).toFixed(0);
      const vShort = c.topVerdict
        ? verdictShort(c.topVerdict)
        : "various errors";
      return `<strong>${c.topic}</strong> at rating <strong>${c.bucket}</strong> — only ${pct}% success (main fail: ${vShort})`;
    });
    insights.push({
      type: "critical",
      icon: "🚨",
      title: "Critical Weakness Zones",
      body: `You struggle the most in these areas:<br/>• ${lines.join("<br/>• ")}`,
      tagLabel: "Critical",
    });
  }

  // ── 2. Topic-specific failure pattern analysis ──
  for (const t of topicData.slice(0, 5)) {
    if (t.attempted < 5) continue;
    const dominantVerdict = getDominantFailVerdict(t.verdictCounts);
    if (dominantVerdict) {
      const vName = verdictFull(dominantVerdict.verdict);
      const vPct = (dominantVerdict.ratio * 100).toFixed(0);
      if (dominantVerdict.ratio > 0.35) {
        insights.push({
          type: "warning",
          icon: "🔍",
          title: `${capitalize(t.topic)} — ${vName} Pattern`,
          body:
            `${vPct}% of your failed submissions in <strong>${t.topic}</strong> are <strong>${vName}</strong>. ` +
            getVerdictAdvice(dominantVerdict.verdict, t.topic),
          tagLabel: "Pattern",
        });
      }
    }
  }

  // ── 3. Contest vs Practice gap ──
  if (cvp.contest.attempted >= 5 && cvp.practice.attempted >= 5) {
    const contestRate = cvp.contest.solved / cvp.contest.attempted;
    const practiceRate = cvp.practice.solved / cvp.practice.attempted;
    const gap = practiceRate - contestRate;
    if (gap > 0.15) {
      insights.push({
        type: "warning",
        icon: "⏰",
        title: "Contest Performance Gap",
        body:
          `Your contest solve rate (${(contestRate * 100).toFixed(0)}%) is significantly lower than practice (${(practiceRate * 100).toFixed(0)}%). ` +
          `This suggests time pressure or stress affects your performance. Consider doing virtual contests to improve under pressure.`,
        tagLabel: "Warning",
      });
    } else if (gap < -0.05) {
      insights.push({
        type: "positive",
        icon: "🏆",
        title: "Strong Contest Performer",
        body: `You actually perform better in contests (${(contestRate * 100).toFixed(0)}%) than in practice (${(practiceRate * 100).toFixed(0)}%). You thrive under pressure!`,
        tagLabel: "Strength",
      });
    }
  }

  // ── 4. Implementation vs Algorithmic weakness ──
  const implTopics = [
    "implementation",
    "brute force",
    "constructive algorithms",
    "strings",
  ];
  const algoTopics = [
    "dp",
    "graphs",
    "trees",
    "flows",
    "shortest paths",
    "divide and conquer",
    "binary search",
  ];
  const implData = topicData.filter((t) => implTopics.includes(t.topic));
  const algoData = topicData.filter((t) => algoTopics.includes(t.topic));

  if (implData.length > 0 && algoData.length > 0) {
    const avgImpl =
      implData.reduce((s, t) => s + t.successRate, 0) / implData.length;
    const avgAlgo =
      algoData.reduce((s, t) => s + t.successRate, 0) / algoData.length;
    if (avgAlgo < avgImpl - 0.15) {
      insights.push({
        type: "warning",
        icon: "🧩",
        title: "Algorithmic Thinking Gap",
        body:
          `Your algorithmic topics (avg ${(avgAlgo * 100).toFixed(0)}% success) are weaker than implementation topics (${(avgImpl * 100).toFixed(0)}%). ` +
          `Focus on studying: ${
            algoData
              .filter((t) => t.successRate < 0.5)
              .map((t) => t.topic)
              .join(", ") || "advanced algorithms"
          }.`,
        tagLabel: "Gap",
      });
    } else if (avgImpl < avgAlgo - 0.15) {
      insights.push({
        type: "warning",
        icon: "🔧",
        title: "Implementation Weakness",
        body:
          `Your implementation skills (avg ${(avgImpl * 100).toFixed(0)}% success) lag behind algorithmic skills (${(avgAlgo * 100).toFixed(0)}%). ` +
          `Practice careful coding, edge cases, and parsing. Your algorithm knowledge is strong — focus on translating ideas to code cleanly.`,
        tagLabel: "Gap",
      });
    }
  }

  // ── 5. Solve time outliers ──
  const slowTopics = [...topicData]
    .filter((t) => t.avgSolveTime != null && t.attempted >= 3)
    .sort((a, b) => b.avgSolveTime - a.avgSolveTime)
    .slice(0, 3);

  if (slowTopics.length > 0 && slowTopics[0].avgSolveTime > 1800) {
    insights.push({
      type: "info",
      icon: "⏱️",
      title: "Slowest Topics",
      body:
        `Your slowest topics: ${slowTopics.map((t) => `<strong>${t.topic}</strong> (avg ${(t.avgSolveTime / 60).toFixed(0)} min)`).join(", ")}. ` +
        `Consider practicing speed drills on these categories.`,
      tagLabel: "Info",
    });
  }

  // ── 6. Strength recognition ──
  const strongTopics = topicData.filter(
    (t) => t.attempted >= 5 && t.successRate >= 0.8,
  );
  if (strongTopics.length > 0) {
    insights.push({
      type: "positive",
      icon: "💪",
      title: "Your Strongest Topics",
      body: `Great performance in: ${strongTopics
        .slice(0, 5)
        .map(
          (t) =>
            `<strong>${t.topic}</strong> (${(t.successRate * 100).toFixed(0)}%)`,
        )
        .join(", ")}. Keep it up!`,
      tagLabel: "Strength",
    });
  }

  // ── 7. Rating ceiling detection ──
  const diffData = aggregateByDifficulty(analyzed);
  const ceilingBucket = diffData.find((d) => {
    const rate = d.attempted > 0 ? d.solved / d.attempted : 1;
    return d.attempted >= 3 && rate < 0.3;
  });
  if (ceilingBucket) {
    insights.push({
      type: "warning",
      icon: "📊",
      title: "Rating Ceiling Detected",
      body:
        `Your solve rate drops sharply at <strong>${ceilingBucket.label}</strong> problems (${((ceilingBucket.solved / ceilingBucket.attempted) * 100).toFixed(0)}% success with ${ceilingBucket.attempted} attempts). ` +
        `This is likely your current skill ceiling. Practice problems in this range to break through.`,
      tagLabel: "Ceiling",
    });
  }

  // ── 8. Consistency metric ──
  if (topicData.length >= 5) {
    const rates = topicData
      .filter((t) => t.attempted >= 3)
      .map((t) => t.successRate);
    if (rates.length >= 5) {
      const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
      const variance =
        rates.reduce((s, r) => s + (r - mean) ** 2, 0) / rates.length;
      const std = Math.sqrt(variance);
      if (std > 0.25) {
        insights.push({
          type: "info",
          icon: "📉",
          title: "Inconsistent Across Topics",
          body:
            `Your success rates vary widely across topics (std dev: ${(std * 100).toFixed(0)}%). ` +
            `You're very strong in some areas but weak in others. Focus on bringing up your weakest topics for more balanced performance.`,
          tagLabel: "Info",
        });
      } else if (std < 0.1) {
        insights.push({
          type: "positive",
          icon: "🎯",
          title: "Consistent Performer",
          body: `Your success rates are remarkably consistent across topics (std dev: ${(std * 100).toFixed(0)}%). You have a well-rounded skill set.`,
          tagLabel: "Strength",
        });
      }
    }
  }

  // ── 9. High wrong-attempt topics ──
  const highWrong = topicData.filter(
    (t) => t.attempted >= 5 && t.wrongRatio > 0.65,
  );
  if (highWrong.length > 0) {
    insights.push({
      type: "warning",
      icon: "🔴",
      title: "High Wrong Submission Topics",
      body:
        `These topics have very high wrong submission rates: ${highWrong
          .slice(0, 4)
          .map(
            (t) =>
              `<strong>${t.topic}</strong> (${(t.wrongRatio * 100).toFixed(0)}%)`,
          )
          .join(", ")}. ` +
        `Review your approach before submitting — consider testing with custom cases.`,
      tagLabel: "Warning",
    });
  }

  // Ensure at least one insight
  if (insights.length === 0) {
    insights.push({
      type: "info",
      icon: "📋",
      title: "Analysis Complete",
      body: "Your performance looks balanced overall. Keep solving problems across diverse topics and difficulty levels to continue improving!",
      tagLabel: "Info",
    });
  }

  return insights;
}

/* ─── Helpers ─── */

function getDominantFailVerdict(verdictCounts) {
  const fails = Object.entries(verdictCounts).filter(([v]) => v !== "OK");
  const totalFails = fails.reduce((s, [, c]) => s + c, 0);
  if (totalFails === 0) return null;
  const sorted = fails.sort((a, b) => b[1] - a[1]);
  const top = sorted[0];
  return { verdict: top[0], count: top[1], ratio: top[1] / totalFails };
}

function verdictFull(v) {
  const map = {
    WRONG_ANSWER: "Wrong Answer",
    TIME_LIMIT_EXCEEDED: "Time Limit Exceeded",
    RUNTIME_ERROR: "Runtime Error",
    MEMORY_LIMIT_EXCEEDED: "Memory Limit Exceeded",
    COMPILATION_ERROR: "Compilation Error",
    IDLENESS_LIMIT_EXCEEDED: "Idleness Limit",
  };
  return map[v] || v.replace(/_/g, " ").toLowerCase();
}

function getVerdictAdvice(verdict, topic) {
  const advice = {
    WRONG_ANSWER: `This typically indicates logical errors or missed edge cases. For <strong>${topic}</strong>, double-check boundary conditions and problem constraints.`,
    TIME_LIMIT_EXCEEDED: `Your solutions are too slow. For <strong>${topic}</strong>, study more efficient algorithms or optimize your current approach (consider better data structures).`,
    RUNTIME_ERROR: `You likely have out-of-bounds access, division by zero, or stack overflow. For <strong>${topic}</strong>, add bounds checking and test with extreme inputs.`,
    MEMORY_LIMIT_EXCEEDED: `Your data structures use too much memory. For <strong>${topic}</strong>, consider more space-efficient approaches or avoid unnecessary copies.`,
    COMPILATION_ERROR: `Review syntax and language-specific gotchas. Make sure to compile locally before submitting.`,
  };
  return (
    advice[verdict] ||
    "Review your approach and test thoroughly before submitting."
  );
}

function capitalize(s) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ─── Render insights to DOM ─── */
function renderInsights(insights) {
  const container = document.getElementById("insightsContainer");
  container.innerHTML = insights
    .map(
      (ins) => `
    <div class="insight-card ${ins.type}">
      <div class="insight-icon">${ins.icon}</div>
      <div class="insight-body">
        <h4>${ins.title}</h4>
        <p>${ins.body}</p>
        <span class="insight-tag ${ins.type}">${ins.tagLabel}</span>
      </div>
    </div>
  `,
    )
    .join("");
}
