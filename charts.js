/* ═══════════════════════════════════════════════════
   charts.js — Chart & Heatmap Rendering
   ═══════════════════════════════════════════════════ */

// Chart.js defaults
Chart.defaults.color = "#7b8499";
Chart.defaults.borderColor = "rgba(255,255,255,.06)";
Chart.defaults.font.family =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";

const CHART_PALETTE = [
  "#6c63ff",
  "#38bdf8",
  "#f43f5e",
  "#22c55e",
  "#f59e0b",
  "#fb923c",
  "#a78bfa",
  "#e879f9",
  "#14b8a6",
  "#64748b",
  "#ec4899",
  "#84cc16",
  "#06b6d4",
  "#ef4444",
  "#8b5cf6",
];

/** Destroy chart if exists */
const chartInstances = {};
function getOrCreateChart(canvasId, config) {
  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
  }
  const ctx = document.getElementById(canvasId).getContext("2d");
  chartInstances[canvasId] = new Chart(ctx, config);
  return chartInstances[canvasId];
}

/* ─── Topic Success Rate (Horizontal Bar) ─── */
function renderTopicSuccessChart(topicData) {
  const top = topicData.slice(0, 20);
  getOrCreateChart("topicSuccessChart", {
    type: "bar",
    data: {
      labels: top.map((t) => t.topic),
      datasets: [
        {
          label: "Success Rate %",
          data: top.map((t) => (t.successRate * 100).toFixed(1)),
          backgroundColor: top.map((t) => {
            const r = t.successRate;
            if (r < 0.4) return "#f43f5e";
            if (r < 0.6) return "#f59e0b";
            if (r < 0.8) return "#38bdf8";
            return "#22c55e";
          }),
          borderRadius: 4,
          barThickness: 18,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) =>
              `${ctx.raw}% (${top[ctx.dataIndex].solved}/${top[ctx.dataIndex].attempted})`,
          },
        },
      },
      scales: {
        x: { max: 100, grid: { color: "rgba(255,255,255,.04)" } },
        y: { grid: { display: false } },
      },
    },
  });
}

/* ─── Wrong Submission Ratio (Horizontal Bar) ─── */
function renderWrongSubChart(topicData) {
  const sorted = [...topicData]
    .sort((a, b) => b.wrongRatio - a.wrongRatio)
    .slice(0, 20);
  getOrCreateChart("wrongSubChart", {
    type: "bar",
    data: {
      labels: sorted.map((t) => t.topic),
      datasets: [
        {
          label: "Wrong Submission %",
          data: sorted.map((t) => (t.wrongRatio * 100).toFixed(1)),
          backgroundColor: sorted.map((t) => {
            const r = t.wrongRatio;
            if (r > 0.7) return "#f43f5e";
            if (r > 0.5) return "#f59e0b";
            return "#38bdf8";
          }),
          borderRadius: 4,
          barThickness: 18,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => `${ctx.raw}%` } },
      },
      scales: {
        x: { max: 100, grid: { color: "rgba(255,255,255,.04)" } },
        y: { grid: { display: false } },
      },
    },
  });
}

/* ─── Average Solve Time (Bar) ─── */
function renderSolveTimeChart(topicData) {
  const withTime = topicData
    .filter((t) => t.avgSolveTime != null)
    .sort((a, b) => b.avgSolveTime - a.avgSolveTime)
    .slice(0, 20);
  getOrCreateChart("solveTimeChart", {
    type: "bar",
    data: {
      labels: withTime.map((t) => t.topic),
      datasets: [
        {
          label: "Avg Solve Time (min)",
          data: withTime.map((t) => (t.avgSolveTime / 60).toFixed(1)),
          backgroundColor: withTime.map(
            (_, i) => CHART_PALETTE[i % CHART_PALETTE.length],
          ),
          borderRadius: 4,
          barThickness: 18,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => `${ctx.raw} min` } },
      },
      scales: {
        x: { grid: { color: "rgba(255,255,255,.04)" } },
        y: { grid: { display: false } },
      },
    },
  });
}

/* ─── Contest vs Practice (Doughnut) ─── */
function renderContestPracticeChart(cvp) {
  const contestRate =
    cvp.contest.attempted > 0
      ? ((cvp.contest.solved / cvp.contest.attempted) * 100).toFixed(1)
      : 0;
  const practiceRate =
    cvp.practice.attempted > 0
      ? ((cvp.practice.solved / cvp.practice.attempted) * 100).toFixed(1)
      : 0;

  getOrCreateChart("contestPracticeChart", {
    type: "doughnut",
    data: {
      labels: [
        `Contest Solved (${cvp.contest.solved})`,
        `Contest Unsolved (${cvp.contest.attempted - cvp.contest.solved})`,
        `Practice Solved (${cvp.practice.solved})`,
        `Practice Unsolved (${cvp.practice.attempted - cvp.practice.solved})`,
      ],
      datasets: [
        {
          data: [
            cvp.contest.solved,
            cvp.contest.attempted - cvp.contest.solved,
            cvp.practice.solved,
            cvp.practice.attempted - cvp.practice.solved,
          ],
          backgroundColor: ["#22c55e", "#f43f5e", "#38bdf8", "#f59e0b"],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: "bottom", labels: { padding: 16 } },
        tooltip: {
          callbacks: {
            afterBody: () =>
              `Contest: ${contestRate}%  |  Practice: ${practiceRate}%`,
          },
        },
      },
    },
  });
}

/* ─── Difficulty Distribution (Vertical Bar) ─── */
function renderDifficultyChart(diffData) {
  getOrCreateChart("difficultyChart", {
    type: "bar",
    data: {
      labels: diffData.map((d) => d.label),
      datasets: [
        {
          label: "Solved",
          data: diffData.map((d) => d.solved),
          backgroundColor: "#22c55e",
          borderRadius: 4,
        },
        {
          label: "Unsolved",
          data: diffData.map((d) => d.attempted - d.solved),
          backgroundColor: "#f43f5e",
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top" },
      },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: { stacked: true, grid: { color: "rgba(255,255,255,.04)" } },
      },
    },
  });
}

/* ─── Verdict Breakdown (Pie) ─── */
function renderVerdictChart(verdictCounts) {
  const entries = Object.entries(verdictCounts).sort((a, b) => b[1] - a[1]);
  const VERDICT_COLORS = {
    OK: "#22c55e",
    WRONG_ANSWER: "#f43f5e",
    TIME_LIMIT_EXCEEDED: "#f59e0b",
    RUNTIME_ERROR: "#fb923c",
    MEMORY_LIMIT_EXCEEDED: "#e879f9",
    COMPILATION_ERROR: "#64748b",
    CHALLENGED: "#ef4444",
    SKIPPED: "#475569",
    TESTING: "#94a3b8",
    IDLENESS_LIMIT_EXCEEDED: "#a78bfa",
  };

  getOrCreateChart("verdictChart", {
    type: "pie",
    data: {
      labels: entries.map(([v]) => v.replace(/_/g, " ")),
      datasets: [
        {
          data: entries.map(([, c]) => c),
          backgroundColor: entries.map(
            ([v], i) =>
              VERDICT_COLORS[v] || CHART_PALETTE[i % CHART_PALETTE.length],
          ),
          borderWidth: 1,
          borderColor: "rgba(0,0,0,.3)",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: "right",
          labels: { padding: 10, font: { size: 11 } },
        },
      },
    },
  });
}

/* ─── Heatmap (Custom HTML Table) ─── */
function renderHeatmap(heatmapData) {
  const { topics, buckets, matrix } = heatmapData;
  const wrapper = document.getElementById("heatmapWrapper");
  const legend = document.getElementById("heatmapLegend");

  if (topics.length === 0) {
    wrapper.innerHTML =
      '<p style="color:var(--text2)">Not enough data to generate heatmap.</p>';
    return;
  }

  // Build table
  let html = '<table class="heatmap-table"><thead><tr><th>Topic</th>';
  for (const b of buckets) html += `<th>${b}</th>`;
  html += "</tr></thead><tbody>";

  for (let i = 0; i < topics.length; i++) {
    html += `<tr><td style="text-align:left;font-weight:600;background:var(--bg3)">${topics[i]}</td>`;
    for (let j = 0; j < buckets.length; j++) {
      const cell = matrix[i][j];
      if (!cell) {
        html += '<td style="background:var(--bg2);color:var(--text2)">—</td>';
      } else {
        const pct = (cell.successRate * 100).toFixed(0);
        const bg = successRateColor(cell.successRate);
        const textColor = cell.successRate < 0.5 ? "#fff" : "#111";
        const topV = cell.topVerdict ? verdictShort(cell.topVerdict) : "";
        html += `<td style="background:${bg};color:${textColor};font-weight:700">
          ${pct}%
          <div class="heatmap-cell-tip">
            ${topics[i]} @ ${buckets[j]}<br/>
            Attempted: ${cell.attempted} | Solved: ${cell.solved}<br/>
            Success: ${pct}% | Top Error: ${topV || "N/A"}
          </div>
        </td>`;
      }
    }
    html += "</tr>";
  }
  html += "</tbody></table>";
  wrapper.innerHTML = html;

  // Legend
  const stops = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
  legend.innerHTML =
    "<span>Worse</span>" +
    stops
      .map(
        (s) =>
          `<div class="heatmap-legend-block" style="background:${successRateColor(s)}"></div>`,
      )
      .join("") +
    "<span>Better</span>";
}

function successRateColor(rate) {
  // Red → Orange → Yellow → Green gradient
  if (rate <= 0) return "#991b1b";
  if (rate < 0.25) return "#dc2626";
  if (rate < 0.4) return "#ea580c";
  if (rate < 0.55) return "#d97706";
  if (rate < 0.7) return "#ca8a04";
  if (rate < 0.85) return "#65a30d";
  return "#16a34a";
}

function verdictShort(v) {
  const map = {
    WRONG_ANSWER: "WA",
    TIME_LIMIT_EXCEEDED: "TLE",
    RUNTIME_ERROR: "RE",
    MEMORY_LIMIT_EXCEEDED: "MLE",
    COMPILATION_ERROR: "CE",
    IDLENESS_LIMIT_EXCEEDED: "ILE",
  };
  return map[v] || v;
}

/* ─── Weakness Table ─── */
function renderWeaknessTable(heatmapData) {
  const { topics, buckets, matrix } = heatmapData;
  const tbody = document.querySelector("#weaknessTable tbody");
  const rows = [];

  for (let i = 0; i < topics.length; i++) {
    for (let j = 0; j < buckets.length; j++) {
      const cell = matrix[i][j];
      if (!cell || cell.attempted < 2) continue;
      rows.push({
        topic: topics[i],
        bucket: buckets[j],
        ...cell,
      });
    }
  }

  // Sort by success rate ascending (weakest first)
  rows.sort((a, b) => a.successRate - b.successRate);

  tbody.innerHTML = rows
    .slice(0, 40)
    .map((r) => {
      const pct = (r.successRate * 100).toFixed(1);
      const badgeClass =
        r.successRate < 0.4
          ? "badge-danger"
          : r.successRate < 0.7
            ? "badge-warning"
            : "badge-success";
      const avgAtt =
        r.attempted > 0
          ? ((r.solved + r.wrongAttempts) / r.attempted).toFixed(1)
          : "–";
      const topV = r.topVerdict ? verdictShort(r.topVerdict) : "–";
      return `<tr>
      <td><strong>${r.topic}</strong></td>
      <td>${r.bucket}</td>
      <td>${r.attempted}</td>
      <td>${r.solved}</td>
      <td><span class="badge ${badgeClass}">${pct}%</span></td>
      <td>${avgAtt}</td>
      <td>${topV}</td>
    </tr>`;
    })
    .join("");
}

/* ─── Rating Timeline (Line Chart) ─── */
function renderRatingTimeline(ratingHistory) {
  // Clean up any previous "no data" message
  const canvas = document.getElementById("ratingTimelineChart");
  const prev = canvas.parentElement.querySelector(".rating-timeline-empty");
  if (prev) prev.remove();

  if (!ratingHistory || ratingHistory.length === 0) {
    canvas.parentElement
      .querySelector("h3")
      .insertAdjacentHTML(
        "afterend",
        '<p class="rating-timeline-empty" style="color:var(--text2);font-size:.85rem">No contest history available.</p>',
      );
    return;
  }

  const labels = ratingHistory.map((r) => {
    const d = new Date(r.ratingUpdateTimeSeconds * 1000);
    return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  });

  const ratings = ratingHistory.map((r) => r.newRating);
  const contestNames = ratingHistory.map((r) => r.contestName);

  // Color segments based on rating
  const segmentColors = ratings.map((r) => {
    if (r >= 2400) return "#ff0000";
    if (r >= 2100) return "#ff8c00";
    if (r >= 1900) return "#aa00aa";
    if (r >= 1600) return "#0000ff";
    if (r >= 1400) return "#03a89e";
    if (r >= 1200) return "#008000";
    return "#808080";
  });

  getOrCreateChart("ratingTimelineChart", {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Rating",
          data: ratings,
          borderColor: "#6c63ff",
          backgroundColor: "rgba(108,99,255,.1)",
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 7,
          pointBackgroundColor: segmentColors,
          pointBorderColor: segmentColors,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => contestNames[items[0].dataIndex] || "",
            label: (ctx) => `Rating: ${ctx.raw}`,
            afterLabel: (ctx) => {
              const i = ctx.dataIndex;
              if (i > 0) {
                const diff = ratings[i] - ratings[i - 1];
                return `Change: ${diff >= 0 ? "+" : ""}${diff}`;
              }
              return "";
            },
          },
        },
      },
      scales: {
        x: { grid: { color: "rgba(255,255,255,.04)" }, ticks: { maxTicksLimit: 15 } },
        y: { grid: { color: "rgba(255,255,255,.04)" } },
      },
    },
  });
}

/* ─── Skill Radar Chart ─── */
function renderRadarChart(topicData) {
  const top = topicData
    .filter((t) => t.attempted >= 3)
    .sort((a, b) => b.attempted - a.attempted)
    .slice(0, 10);

  if (top.length < 3) return;

  getOrCreateChart("radarChart", {
    type: "radar",
    data: {
      labels: top.map((t) => t.topic),
      datasets: [
        {
          label: "Success Rate %",
          data: top.map((t) => +(t.successRate * 100).toFixed(1)),
          backgroundColor: "rgba(108,99,255,.2)",
          borderColor: "#6c63ff",
          borderWidth: 2,
          pointBackgroundColor: "#6c63ff",
          pointRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
          grid: { color: "#232d45" },
          angleLines: { color: "#232d45" },
          pointLabels: { color: "#94a3b8", font: { size: 11 } },
          ticks: { display: false },
        },
      },
    },
  });
}

/* ─── Language Usage (Doughnut) ─── */
function renderLanguageChart(langData) {
  const top = langData.slice(0, 8);
  getOrCreateChart("languageChart", {
    type: "doughnut",
    data: {
      labels: top.map((l) => l.language),
      datasets: [
        {
          data: top.map((l) => l.total),
          backgroundColor: top.map(
            (_, i) => CHART_PALETTE[i % CHART_PALETTE.length],
          ),
          borderWidth: 1,
          borderColor: "rgba(0,0,0,.3)",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: "right",
          labels: { padding: 10, font: { size: 11 } },
        },
      },
    },
  });
}

/* ─── Language Success Rate (Horizontal Bar) ─── */
function renderLangSuccessChart(langData) {
  const filtered = langData.filter((l) => l.total >= 5).slice(0, 15);
  getOrCreateChart("langSuccessChart", {
    type: "bar",
    data: {
      labels: filtered.map((l) => l.language),
      datasets: [
        {
          label: "Success Rate %",
          data: filtered.map((l) => +(l.successRate * 100).toFixed(1)),
          backgroundColor: filtered.map((l) => {
            if (l.successRate < 0.3) return "#f43f5e";
            if (l.successRate < 0.5) return "#f59e0b";
            if (l.successRate < 0.7) return "#38bdf8";
            return "#22c55e";
          }),
          borderRadius: 4,
          barThickness: 20,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) =>
              `${ctx.raw}% (${filtered[ctx.dataIndex].accepted}/${filtered[ctx.dataIndex].total})`,
          },
        },
      },
      scales: {
        x: { max: 100, grid: { color: "rgba(255,255,255,.04)" } },
        y: { grid: { display: false } },
      },
    },
  });
}

/* ─── Activity Calendar Heatmap ─── */
function renderCalendar(dayCounts) {
  const wrapper = document.getElementById("calendarWrapper");
  const legend = document.getElementById("calendarLegend");

  const today = new Date();
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  // Find max for color scale
  const allCounts = Object.values(dayCounts);
  const maxCount = allCounts.length > 0 ? Math.max(...allCounts) : 1;

  // Build weeks/days
  let html = '<div class="calendar-grid">';
  const cursor = new Date(oneYearAgo);
  // Align to Sunday
  cursor.setDate(cursor.getDate() - cursor.getDay());

  while (cursor <= today) {
    html += '<div class="calendar-week">';
    for (let dow = 0; dow < 7; dow++) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      const count = dayCounts[key] || 0;
      const intensity = count > 0 ? Math.min(count / maxCount, 1) : 0;
      const bg = calendarColor(intensity);
      const dateStr = cursor.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      html += `<div class="calendar-day" style="background:${bg}">
        <div class="cal-tip">${dateStr}: ${count} submission${count !== 1 ? "s" : ""}</div>
      </div>`;
      cursor.setDate(cursor.getDate() + 1);
    }
    html += "</div>";
  }
  html += "</div>";
  wrapper.innerHTML = html;

  // Legend
  const stops = [0, 0.25, 0.5, 0.75, 1.0];
  legend.innerHTML =
    "<span>Less</span>" +
    stops
      .map(
        (s) =>
          `<div class="cal-legend-block" style="background:${calendarColor(s)}"></div>`,
      )
      .join("") +
    "<span>More</span>";
}

function calendarColor(intensity) {
  if (intensity <= 0) return "rgba(0,0,0,.3)";
  if (intensity < 0.25) return "#1a3a2a";
  if (intensity < 0.5) return "#1e6f3e";
  if (intensity < 0.75) return "#2ea043";
  return "#3bd158";
}

/* ─── Peer Comparison Radar ─── */
function renderPeerRadar(comparison, handleA, handleB) {
  getOrCreateChart("peerRadarChart", {
    type: "radar",
    data: {
      labels: comparison.topTopics,
      datasets: [
        {
          label: handleA,
          data: comparison.radarA,
          backgroundColor: "rgba(108,99,255,.2)",
          borderColor: "#6c63ff",
          borderWidth: 2,
          pointBackgroundColor: "#6c63ff",
        },
        {
          label: handleB,
          data: comparison.radarB,
          backgroundColor: "rgba(56,189,248,.2)",
          borderColor: "#38bdf8",
          borderWidth: 2,
          pointBackgroundColor: "#38bdf8",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: "top" },
      },
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
          grid: { color: "#232d45" },
          angleLines: { color: "#232d45" },
          pointLabels: { color: "#94a3b8", font: { size: 11 } },
          ticks: { display: false },
        },
      },
    },
  });
}

/* ─── Peer Stat Columns ─── */
function renderPeerColumns(comparison, handleA, handleB) {
  const metrics = [
    {
      label: "Total Problems",
      a: comparison.kpiA.totalProblems,
      b: comparison.kpiB.totalProblems,
      higher: true,
    },
    {
      label: "Solved",
      a: comparison.kpiA.solved,
      b: comparison.kpiB.solved,
      higher: true,
    },
    {
      label: "Overall Success",
      a: comparison.kpiA.overallSuccess + "%",
      b: comparison.kpiB.overallSuccess + "%",
      higherVal: [
        +comparison.kpiA.overallSuccess,
        +comparison.kpiB.overallSuccess,
      ],
      higher: true,
    },
    {
      label: "Avg Attempts",
      a: comparison.kpiA.avgAttempts,
      b: comparison.kpiB.avgAttempts,
      higher: false,
    },
    {
      label: "Contest Solve Rate",
      a: comparison.kpiA.contestSolveRate + "%",
      b: comparison.kpiB.contestSolveRate + "%",
      higherVal: [
        +comparison.kpiA.contestSolveRate || 0,
        +comparison.kpiB.contestSolveRate || 0,
      ],
      higher: true,
    },
    {
      label: "Weakest Topic",
      a: comparison.kpiA.weakestTopic,
      b: comparison.kpiB.weakestTopic,
      noCompare: true,
    },
  ];

  function buildCol(handle, side) {
    let html = `<div class="peer-name">${handle}</div>`;
    for (const m of metrics) {
      const val = side === "a" ? m.a : m.b;
      let cls = "";
      if (!m.noCompare) {
        const vA = m.higherVal ? m.higherVal[0] : +m.a;
        const vB = m.higherVal ? m.higherVal[1] : +m.b;
        const myVal = side === "a" ? vA : vB;
        const otherVal = side === "a" ? vB : vA;
        if (m.higher) {
          cls =
            myVal > otherVal ? "better" : myVal < otherVal ? "worse" : "equal";
        } else {
          cls =
            myVal < otherVal ? "better" : myVal > otherVal ? "worse" : "equal";
        }
      }
      html += `<div class="peer-stat-row">
        <span class="peer-stat-label">${m.label}</span>
        <span class="peer-stat-val ${cls}">${val}</span>
      </div>`;
    }
    return html;
  }

  document.getElementById("peerColA").innerHTML = buildCol(handleA, "a");
  document.getElementById("peerColB").innerHTML = buildCol(handleB, "b");
}

/* ═══════════════════════════════════════════════════
   NEW CHART RENDERERS (Hackathon Features)
   ═══════════════════════════════════════════════════ */

/* ─── Time-of-Day Productivity Heatmap ─── */
function renderTimeOfDayHeatmap(todData) {
  const wrapper = document.getElementById("todHeatmapWrapper");
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const { matrix, maxCount } = todData;

  function todColor(count) {
    if (count === 0) return "transparent";
    const intensity = Math.min(count / Math.max(maxCount * 0.7, 1), 1);
    const r = Math.round(108 + (56 - 108) * intensity);
    const g = Math.round(99 + (189 - 99) * intensity);
    const b = Math.round(255 + (248 - 255) * intensity);
    const a = 0.2 + intensity * 0.8;
    return `rgba(${r},${g},${b},${a})`;
  }

  let html = '<table class="tod-table"><thead><tr><th></th>';
  for (let h = 0; h < 24; h++) {
    html += `<th>${h}:00</th>`;
  }
  html += "</tr></thead><tbody>";

  for (let d = 0; d < 7; d++) {
    html += `<tr><th>${dayNames[d]}</th>`;
    for (let h = 0; h < 24; h++) {
      const cell = matrix[d][h];
      const bg = todColor(cell.total);
      const ratePct = (cell.rate * 100).toFixed(0);
      html += `<td style="background:${bg};">
        ${cell.total > 0 ? cell.total : ""}
        <div class="tod-cell-tip">${dayNames[d]} ${h}:00 — ${cell.total} subs, ${cell.ac} AC (${ratePct}%)</div>
      </td>`;
    }
    html += "</tr>";
  }

  html += "</tbody></table>";
  wrapper.innerHTML = html;
}

/* ─── Difficulty Progression Chart ─── */
function renderDifficultyProgression(diffProg) {
  if (!diffProg.labels.length) return;
  getOrCreateChart("diffProgressionChart", {
    type: "line",
    data: {
      labels: diffProg.labels,
      datasets: [
        {
          label: "Max Difficulty",
          data: diffProg.maxRatings,
          borderColor: "#f43f5e",
          backgroundColor: "rgba(244,63,94,0.1)",
          fill: "+1",
          tension: 0.3,
          pointRadius: 2,
          borderWidth: 2,
        },
        {
          label: "Avg Difficulty",
          data: diffProg.avgRatings,
          borderColor: "#6c63ff",
          backgroundColor: "rgba(108,99,255,0.1)",
          fill: "+1",
          tension: 0.3,
          pointRadius: 2,
          borderWidth: 2,
        },
        {
          label: "Min Difficulty",
          data: diffProg.minRatings,
          borderColor: "#22c55e",
          backgroundColor: "rgba(34,197,94,0.1)",
          fill: false,
          tension: 0.3,
          pointRadius: 2,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "top" },
        tooltip: { mode: "index", intersect: false },
      },
      scales: {
        x: {
          grid: { color: "#232d45" },
          ticks: { maxTicksLimit: 12 },
        },
        y: {
          grid: { color: "#232d45" },
          title: { display: true, text: "Problem Rating" },
        },
      },
    },
  });
}

/* ─── Contest Table + Stats ─── */
function renderContestDeepDive(contestData, ratingHistory) {
  // Stats strip
  const strip = document.getElementById("contestStatsStrip");
  const totalContests = contestData.length;
  const positiveDeltas = contestData.filter((c) => c.delta > 0).length;
  const negativeDeltas = contestData.filter((c) => c.delta < 0).length;
  const bestDelta = contestData.length
    ? Math.max(...contestData.map((c) => c.delta))
    : 0;
  const worstDelta = contestData.length
    ? Math.min(...contestData.map((c) => c.delta))
    : 0;
  const avgDelta = contestData.length
    ? Math.round(
        contestData.reduce((s, c) => s + c.delta, 0) / contestData.length,
      )
    : 0;

  strip.innerHTML = `
    <div class="contest-stat-card"><div class="contest-stat-val neutral">${totalContests}</div><div class="contest-stat-lbl">Total Contests</div></div>
    <div class="contest-stat-card"><div class="contest-stat-val positive">+${positiveDeltas}</div><div class="contest-stat-lbl">Rating Gained</div></div>
    <div class="contest-stat-card"><div class="contest-stat-val negative">${negativeDeltas}</div><div class="contest-stat-lbl">Rating Lost</div></div>
    <div class="contest-stat-card"><div class="contest-stat-val positive">+${bestDelta}</div><div class="contest-stat-lbl">Best Delta</div></div>
    <div class="contest-stat-card"><div class="contest-stat-val negative">${worstDelta}</div><div class="contest-stat-lbl">Worst Delta</div></div>
    <div class="contest-stat-card"><div class="contest-stat-val ${avgDelta >= 0 ? "positive" : "negative"}">${avgDelta >= 0 ? "+" : ""}${avgDelta}</div><div class="contest-stat-lbl">Avg Delta</div></div>
  `;

  // Table (most recent first)
  const tbody = document.getElementById("contestTableBody");
  const reversed = [...contestData].reverse();
  tbody.innerHTML = reversed
    .slice(0, 50)
    .map((c) => {
      const deltaClass =
        c.delta > 0
          ? "delta-positive"
          : c.delta < 0
            ? "delta-negative"
            : "delta-zero";
      const deltaText = c.delta > 0 ? `+${c.delta}` : c.delta.toString();
      return `<tr>
      <td>${c.index}</td>
      <td><a href="https://codeforces.com/contest/${c.contestId}" target="_blank">${c.contestName}</a></td>
      <td>${c.rank}</td>
      <td>${c.oldRating}</td>
      <td>${c.newRating}</td>
      <td class="${deltaClass}">${deltaText}</td>
      <td>${c.problemsSolved}</td>
    </tr>`;
    })
    .join("");

  // Rating Delta Distribution Chart
  renderRatingDeltaChart(contestData);
  renderContestRankChart(contestData);
}

/* ─── Rating Delta Distribution ─── */
function renderRatingDeltaChart(contestData) {
  const deltas = contestData.map((c) => c.delta);
  // Bucket into ranges
  const buckets = {};
  for (const d of deltas) {
    const bucket = Math.floor(d / 50) * 50;
    const key = `${bucket} to ${bucket + 49}`;
    buckets[key] = (buckets[key] || 0) + 1;
  }
  const sorted = Object.entries(buckets).sort((a, b) => {
    return parseInt(a[0]) - parseInt(b[0]);
  });

  getOrCreateChart("ratingDeltaChart", {
    type: "bar",
    data: {
      labels: sorted.map(([k]) => k),
      datasets: [
        {
          label: "Contests",
          data: sorted.map(([, v]) => v),
          backgroundColor: sorted.map(([k]) =>
            parseInt(k) >= 0 ? "rgba(34,197,94,0.6)" : "rgba(244,63,94,0.6)",
          ),
          borderColor: sorted.map(([k]) =>
            parseInt(k) >= 0 ? "#22c55e" : "#f43f5e",
          ),
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: "#232d45" } },
        y: { grid: { color: "#232d45" }, beginAtZero: true },
      },
    },
  });
}

/* ─── Contest Rank Distribution ─── */
function renderContestRankChart(contestData) {
  const ranks = contestData.map((c) => c.rank);
  const buckets = {
    "Top 100": 0,
    "100-500": 0,
    "500-1000": 0,
    "1000-2000": 0,
    "2000-5000": 0,
    "5000+": 0,
  };
  for (const r of ranks) {
    if (r <= 100) buckets["Top 100"]++;
    else if (r <= 500) buckets["100-500"]++;
    else if (r <= 1000) buckets["500-1000"]++;
    else if (r <= 2000) buckets["1000-2000"]++;
    else if (r <= 5000) buckets["2000-5000"]++;
    else buckets["5000+"]++;
  }

  getOrCreateChart("contestRankChart", {
    type: "doughnut",
    data: {
      labels: Object.keys(buckets),
      datasets: [
        {
          data: Object.values(buckets),
          backgroundColor: CHART_PALETTE.slice(0, 6),
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "right", labels: { padding: 12 } },
      },
    },
  });
}

/* ─── Badges Grid Renderer ─── */
function renderBadges(badges) {
  const grid = document.getElementById("badgesGrid");
  const unlocked = badges.filter((b) => b.unlocked).length;
  const total = badges.length;

  document.getElementById("badgesProgressBar").style.width =
    `${((unlocked / total) * 100).toFixed(0)}%`;
  document.getElementById("badgesProgressText").textContent =
    `${unlocked} / ${total} Unlocked`;

  grid.innerHTML = badges
    .map(
      (b) => `
    <div class="badge-card ${b.unlocked ? "unlocked" : "locked"}">
      ${b.unlocked ? '<div class="badge-shimmer"></div>' : ""}
      <span class="badge-icon">${b.icon}</span>
      <h4>${b.title}</h4>
      <p>${b.description}</p>
      <p style="font-size:.68rem;color:var(--text2);margin-top:4px;">${b.progress}</p>
      <span class="badge-status ${b.unlocked ? "unlocked" : "locked"}">${b.unlocked ? "✅ Unlocked" : "🔒 Locked"}</span>
    </div>
  `,
    )
    .join("");
}

/* ─── Problem Recommendations Renderer ─── */
function renderRecommendations(recommendations) {
  const grid = document.getElementById("recommendGrid");
  if (!recommendations || recommendations.length === 0) {
    grid.innerHTML =
      '<p class="recommend-placeholder">No recommendations found. Try adjusting filters or solving more problems first.</p>';
    return;
  }

  function ratingColor(r) {
    if (r >= 2400) return "background:rgba(244,63,94,.2);color:#f43f5e;";
    if (r >= 1900) return "background:rgba(251,146,60,.2);color:#fb923c;";
    if (r >= 1600) return "background:rgba(167,139,250,.2);color:#a78bfa;";
    if (r >= 1400) return "background:rgba(56,189,248,.2);color:#38bdf8;";
    if (r >= 1200) return "background:rgba(34,197,94,.2);color:#22c55e;";
    return "background:rgba(148,163,184,.2);color:#94a3b8;";
  }

  grid.innerHTML = recommendations
    .map(
      (p) => `
    <div class="recommend-card">
      <div class="recommend-card-header">
        <div class="recommend-card-title">
          <a href="${p.url}" target="_blank">${p.contestId}${p.index}. ${p.name}</a>
        </div>
        <span class="recommend-card-rating" style="${ratingColor(p.rating)}">${p.rating}</span>
      </div>
      <div class="recommend-card-tags">
        ${p.tags.map((t) => `<span class="recommend-tag">${t}</span>`).join("")}
      </div>
      <div class="recommend-reason">💡 ${p.reason}</div>
    </div>
  `,
    )
    .join("");
}

/**
 * Render the Daily Problem of the Day card.
 * @param {Object|null} potd - Daily problem object from generateDailyProblem
 */
function renderDailyProblem(potd) {
  const wrapper = document.getElementById("potdCard");
  if (!wrapper) return;

  if (!potd) {
    wrapper.innerHTML = `
      <div class="potd-inner potd-empty">
        <div class="potd-icon">📝</div>
        <div class="potd-body">
          <h3 class="potd-title">Daily Problem of the Day</h3>
          <p class="potd-subtitle">No suitable problem found. Solve more problems to unlock personalized daily challenges!</p>
        </div>
      </div>`;
    return;
  }

  function ratingColor(r) {
    if (r >= 2400) return "#f43f5e";
    if (r >= 1900) return "#fb923c";
    if (r >= 1600) return "#a78bfa";
    if (r >= 1400) return "#38bdf8";
    if (r >= 1200) return "#22c55e";
    return "#94a3b8";
  }

  function ratingBg(r) {
    if (r >= 2400) return "rgba(244,63,94,.15)";
    if (r >= 1900) return "rgba(251,146,60,.15)";
    if (r >= 1600) return "rgba(167,139,250,.15)";
    if (r >= 1400) return "rgba(56,189,248,.15)";
    if (r >= 1200) return "rgba(34,197,94,.15)";
    return "rgba(148,163,184,.15)";
  }

  const diffBadgeClass =
    potd.difficultyLabel === "Challenge"
      ? "potd-diff-hard"
      : potd.difficultyLabel === "Warm-up"
        ? "potd-diff-easy"
        : "potd-diff-medium";

  const weakTags = potd.matchedTopics || [];
  const allTags = potd.tags || [];

  wrapper.innerHTML = `
    <div class="potd-inner">
      <div class="potd-left">
        <div class="potd-label">
          <span class="potd-flame">🔥</span>
          <span>Daily Problem of the Day</span>
          <span class="potd-date">${potd.date}</span>
        </div>
        <div class="potd-problem-name">
          <a href="${potd.url}" target="_blank" rel="noopener">${potd.contestId}${potd.index}. ${potd.name}</a>
        </div>
        <div class="potd-meta">
          <span class="potd-rating" style="background:${ratingBg(potd.rating)};color:${ratingColor(potd.rating)}">
            ★ ${potd.rating}
          </span>
          <span class="potd-diff-badge ${diffBadgeClass}">${potd.difficultyLabel}</span>
        </div>
        <div class="potd-tags">
          ${allTags
            .map(
              (t) =>
                `<span class="potd-tag${weakTags.includes(t) ? " potd-tag-weak" : ""}">${t}${weakTags.includes(t) ? " ⚠️" : ""}</span>`,
            )
            .join("")}
        </div>
        <div class="potd-reason">💡 ${potd.reason}</div>
      </div>
      <div class="potd-right">
        <div class="potd-countdown" id="potdCountdown"></div>
        <a href="${potd.url}" target="_blank" rel="noopener" class="potd-solve-btn">🚀 Solve Now</a>
        <button class="potd-skip-btn" onclick="skipDailyProblem()">🔄 Skip (New Problem)</button>
      </div>
    </div>`;

  // Start countdown timer to midnight
  startPotdCountdown();
}

/** Countdown timer for next POTD refresh (midnight) */
let _potdCountdownInterval = null;
function startPotdCountdown() {
  if (_potdCountdownInterval) clearInterval(_potdCountdownInterval);
  const el = document.getElementById("potdCountdown");
  if (!el) return;

  function update() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const diff = midnight - now;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    el.textContent = `Next problem in ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  update();
  _potdCountdownInterval = setInterval(update, 1000);
}

/**
 * Render upcoming contests list.
 */
function renderUpcomingContests(contests) {
  const wrapper = document.getElementById("upcomingContestsWrapper");
  if (!wrapper) return;

  if (!contests || contests.length === 0) {
    wrapper.innerHTML =
      '<p class="sheet-empty">No upcoming contests found right now.</p>';
    return;
  }

  function formatDuration(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  function contestTypeLabel(type) {
    if (type === "CF") return "Codeforces";
    if (type === "ICPC") return "ICPC Style";
    if (type === "IOI") return "IOI Style";
    return type || "Other";
  }

  function timeUntil(startSec) {
    const now = Math.floor(Date.now() / 1000);
    const diff = startSec - now;
    if (diff <= 0) return "🟢 Running Now";
    const d = Math.floor(diff / 86400);
    const h = Math.floor((diff % 86400) / 3600);
    const m = Math.floor((diff % 3600) / 60);
    if (d > 0) return `in ${d}d ${h}h`;
    if (h > 0) return `in ${h}h ${m}m`;
    return `in ${m}m`;
  }

  function phaseClass(phase) {
    return phase === "CODING" ? "contest-live" : "contest-upcoming";
  }

  wrapper.innerHTML = contests
    .slice(0, 15)
    .map((c) => {
      const startDate = new Date(c.startTimeSeconds * 1000);
      const dateStr = startDate.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      const timeStr = startDate.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `
      <div class="upcoming-contest-card ${phaseClass(c.phase)}">
        <div class="ucc-left">
          <div class="ucc-phase">${c.phase === "CODING" ? "🔴 LIVE" : "📅 Upcoming"}</div>
          <div class="ucc-name">
            <a href="https://codeforces.com/contest/${c.id}" target="_blank" rel="noopener">${c.name}</a>
          </div>
          <div class="ucc-meta">
            <span class="ucc-type">${contestTypeLabel(c.type)}</span>
            <span class="ucc-duration">⏱ ${formatDuration(c.durationSeconds)}</span>
          </div>
        </div>
        <div class="ucc-right">
          <div class="ucc-time">${dateStr}</div>
          <div class="ucc-time">${timeStr}</div>
          <div class="ucc-countdown ${c.phase === "CODING" ? "ucc-live" : ""}">${timeUntil(c.startTimeSeconds)}</div>
          <a href="https://codeforces.com/contestRegistration/${c.id}" target="_blank" rel="noopener" class="ucc-register-btn">
            ${c.phase === "CODING" ? "🚀 Enter" : "📝 Register"}
          </a>
        </div>
      </div>`;
    })
    .join("");

  // Start countdown auto-update
  startContestCountdowns();
}

let _contestCountdownInterval = null;
function startContestCountdowns() {
  if (_contestCountdownInterval) clearInterval(_contestCountdownInterval);
  _contestCountdownInterval = setInterval(() => {
    document.querySelectorAll(".ucc-countdown").forEach((el) => {
      // Re-render will happen on tab switch, this just keeps times fresh
    });
  }, 60000);
}

/**
 * Render the practice sheet (Rating × Topic grid).
 */
function renderPracticeSheet(sheetData) {
  const wrapper = document.getElementById("practiceSheetWrapper");
  if (!wrapper) return;

  if (!sheetData || sheetData.topics.length === 0) {
    wrapper.innerHTML =
      '<p class="sheet-empty">No practice sheet data available. Solve more problems first!</p>';
    return;
  }

  const { ratings, topics, grid, solvedCounts, userRating } = sheetData;

  // Build filter controls
  let ratingFilterHTML = '<div class="sheet-filters">';
  ratingFilterHTML +=
    '<label class="sheet-filter-label">Filter by Rating: </label>';
  ratingFilterHTML +=
    '<select id="sheetRatingFilter" class="recommend-select" onchange="filterPracticeSheet()">';
  ratingFilterHTML += '<option value="all">All Ratings</option>';
  // Group near user rating
  const nearRatings = ratings.filter((r) => Math.abs(r - userRating) <= 400);
  if (nearRatings.length > 0) {
    ratingFilterHTML += `<option value="near">Near My Rating (${nearRatings[0]}–${nearRatings[nearRatings.length - 1]})</option>`;
  }
  for (const r of ratings) {
    ratingFilterHTML += `<option value="${r}">${r}</option>`;
  }
  ratingFilterHTML += "</select>";
  ratingFilterHTML +=
    '<label class="sheet-filter-label" style="margin-left:12px">Topic: </label>';
  ratingFilterHTML +=
    '<select id="sheetTopicFilter" class="recommend-select" onchange="filterPracticeSheet()">';
  ratingFilterHTML += '<option value="all">All Topics</option>';
  for (const t of topics) {
    ratingFilterHTML += `<option value="${t}">${t}</option>`;
  }
  ratingFilterHTML += "</select></div>";

  // Build table
  let tableHTML =
    '<div class="sheet-table-wrap"><table class="sheet-table" id="sheetTable">';
  tableHTML += '<thead><tr><th class="sheet-th-topic">Topic</th>';
  for (const r of ratings) {
    const isNear = Math.abs(r - userRating) <= 100;
    tableHTML += `<th class="${isNear ? "sheet-th-highlight" : ""}">${r}</th>`;
  }
  tableHTML += "</tr></thead><tbody>";

  for (const topic of topics) {
    tableHTML += `<tr data-topic="${topic}">`;
    tableHTML += `<td class="sheet-td-topic">${topic}</td>`;

    for (const r of ratings) {
      const problems = grid[topic][r] || [];
      const sc = solvedCounts[topic][r] || { solved: 0, total: 0 };
      const isNear = Math.abs(r - userRating) <= 100;

      if (problems.length === 0 && sc.total === 0) {
        tableHTML += `<td class="sheet-cell sheet-cell-empty ${isNear ? "sheet-cell-highlight" : ""}" data-rating="${r}">–</td>`;
      } else {
        // Color based on solved ratio
        let cellClass = "sheet-cell-available";
        if (sc.solved > 0 && sc.solved >= sc.total)
          cellClass = "sheet-cell-done";
        else if (sc.solved > 0) cellClass = "sheet-cell-partial";

        const problemLinks = problems
          .slice(0, 3)
          .map(
            (p) =>
              `<a href="${p.url}" target="_blank" rel="noopener" class="sheet-problem-link" title="${p.name}">${p.contestId}${p.index}</a>`,
          )
          .join("");

        const solvedInfo =
          sc.solved > 0
            ? `<span class="sheet-solved-badge">✓${sc.solved}</span>`
            : "";

        tableHTML += `<td class="sheet-cell ${cellClass} ${isNear ? "sheet-cell-highlight" : ""}" data-rating="${r}">
          <div class="sheet-cell-inner">
            ${solvedInfo}
            <div class="sheet-problem-links">${problemLinks}</div>
            ${problems.length > 3 ? `<span class="sheet-more">+${problems.length - 3}</span>` : ""}
          </div>
        </td>`;
      }
    }
    tableHTML += "</tr>";
  }

  tableHTML += "</tbody></table></div>";

  // Legend
  const legendHTML = `
    <div class="sheet-legend">
      <span class="sheet-legend-item"><span class="sheet-legend-box sheet-cell-done"></span> All Solved</span>
      <span class="sheet-legend-item"><span class="sheet-legend-box sheet-cell-partial"></span> Partially Solved</span>
      <span class="sheet-legend-item"><span class="sheet-legend-box sheet-cell-available"></span> Unsolved Available</span>
      <span class="sheet-legend-item"><span class="sheet-legend-box sheet-cell-empty"></span> No Problems</span>
      <span class="sheet-legend-item"><span class="sheet-legend-box sheet-cell-highlight"></span> Your Rating Range</span>
    </div>`;

  wrapper.innerHTML = ratingFilterHTML + tableHTML + legendHTML;
}
