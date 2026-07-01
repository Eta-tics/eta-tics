// Global state
let statsData = {};
let tableData = [];
let sortAscending = false; // Default: descending (highest posts first)
let searchQuery = "";

// Chart instances
let topUnivsChart = null;
let hourlyTrendChart = null;

// DOM Elements
const lblUpdateTime = document.getElementById("lbl-update-time");
const valTotalPosts = document.getElementById("val-total-posts");
const valTotalUnivs = document.getElementById("val-total-univs");
const valLastUpdate = document.getElementById("val-last-update");

const tableSearchInput = document.getElementById("table-search-input");
const tableTbody = document.getElementById("leaderboard-tbody");
const sortHeader = document.querySelector(".leaderboard-table th.sortable");

// Theme Toggle Button
const themeBtn = document.getElementById("theme-btn");

// Load Stats JSON
async function loadStats() {
  try {
    const response = await fetch("data/stats.json");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    statsData = await response.json();
    tableData = [...statsData.universities];
    
    // Update Stats Display
    renderDashboard();
    
  } catch (error) {
    console.error("Failed to load statistics JSON:", error);
    tableTbody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align: center; color: var(--primary-color); padding: 40px 0;">
          <i class="fa-solid fa-circle-exclamation" style="font-size: 32px; margin-bottom: 12px;"></i>
          <p>데이터 로딩 실패. <strong>preprocess.py</strong>를 먼저 실행해 주세요.</p>
        </td>
      </tr>
    `;
  }
}

// Render Dashboard components
function renderDashboard() {
  // Update Date & KPI values
  let formattedTime = "-";
  if (statsData.updated_at) {
    const d = new Date(statsData.updated_at);
    lblUpdateTime.innerHTML = `<i class="fa-regular fa-clock"></i> 업데이트: ${d.toLocaleString("ko-KR")}`;
    
    // e.g. "07-01 23:45"
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const date = d.getDate().toString().padStart(2, '0');
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    formattedTime = `${month}-${date} ${hours}:${minutes}`;
  }
  
  animateValue("val-total-posts", statsData.total_posts || 0);
  animateValue("val-total-univs", statsData.unique_universities || 0);
  valLastUpdate.textContent = formattedTime;
  
  // Render Leaderboard
  applyTableFiltersAndSort();
  
  // Initialize Charts
  initCharts();
}

// Simple counter animation
function animateValue(id, value) {
  const obj = document.getElementById(id);
  if (!obj) return;
  
  let start = 0;
  const duration = 800; // ms
  const stepTime = 20;
  const steps = duration / stepTime;
  const increment = (value - start) / steps;
  let current = start;
  let step = 0;
  
  const timer = setInterval(() => {
    step++;
    current += increment;
    
    if (step >= steps) {
      clearInterval(timer);
      obj.textContent = Math.round(value).toLocaleString();
    } else {
      obj.textContent = Math.round(current).toLocaleString();
    }
  }, stepTime);
}

// Render Leaderboard table
function applyTableFiltersAndSort() {
  // 1. Search filter
  let data = [...statsData.universities];
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    data = data.filter(u => u.name.toLowerCase().includes(q));
  }
  
  // 2. Sort by post_count
  data.sort((a, b) => {
    return sortAscending ? a.post_count - b.post_count : b.post_count - a.post_count;
  });
  
  renderTableRows(data);
}

function renderTableRows(data) {
  tableTbody.innerHTML = "";
  
  if (data.length === 0) {
    tableTbody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align: center; color: var(--text-muted); padding: 30px 0;">
          검색어와 일치하는 대학이 없습니다.
        </td>
      </tr>
    `;
    return;
  }
  
  data.forEach((univ) => {
    // Find absolute rank based on post count (independent of current table sorting)
    const absoluteRank = statsData.universities.findIndex(u => u.name === univ.name) + 1;
    
    let rankBadge = "";
    if (absoluteRank === 1) rankBadge = `<span class="rank-badge rank-badge-1">1</span>`;
    else if (absoluteRank === 2) rankBadge = `<span class="rank-badge rank-badge-2">2</span>`;
    else if (absoluteRank === 3) rankBadge = `<span class="rank-badge rank-badge-3">3</span>`;
    else rankBadge = `<span class="rank-badge-other">${absoluteRank}</span>`;
    
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="col-rank">${rankBadge}</td>
      <td class="col-name">${univ.name}</td>
      <td class="col-count">${univ.post_count.toLocaleString()}개</td>
    `;
    
    tableTbody.appendChild(tr);
  });
}

// Chart Initializations
function initCharts() {
  const isLight = document.body.classList.contains("light-mode");
  const themeMode = isLight ? "light" : "dark";
  
  // 1. Top Universities (Horizontal Bar Chart)
  const top10 = statsData.universities.slice(0, 10);
  const topUnivsOptions = {
    series: [{
      name: "게시글 수",
      data: top10.map(u => u.post_count)
    }],
    chart: {
      type: "bar",
      height: 320,
      toolbar: { show: false },
      background: "transparent",
      foreColor: "var(--text-secondary)"
    },
    theme: { mode: themeMode },
    plotOptions: {
      bar: {
        borderRadius: 6,
        horizontal: true,
        barHeight: "55%",
        distributed: true
      }
    },
    colors: [
      "#d32f2f", "#e53935", "#f44336", "#ef5350", "#e57373", 
      "#ff9100", "#ffb300", "#ffca28", "#ffe082", "#b0bec5"
    ],
    dataLabels: {
      enabled: true,
      textAnchor: "start",
      style: {
        colors: ["#fff"],
        fontWeight: "bold",
        fontFamily: "Inter"
      },
      formatter: function(val) {
        return val + "개";
      },
      offsetX: 0
    },
    xaxis: {
      categories: top10.map(u => u.name),
      labels: {
        style: { fontFamily: "Inter, Noto Sans KR" }
      }
    },
    yaxis: {
      labels: {
        style: { 
          fontFamily: "Inter, Noto Sans KR",
          fontWeight: 600,
          fontSize: "13px"
        }
      }
    },
    grid: {
      borderColor: "var(--border-color)",
      xaxis: { lines: { show: true } }
    },
    legend: { show: false },
    tooltip: {
      theme: themeMode,
      x: { show: true },
      y: {
        formatter: function(val) {
          return val + " 개 게시글";
        }
      }
    }
  };
  
  if (topUnivsChart) topUnivsChart.destroy();
  topUnivsChart = new ApexCharts(document.querySelector("#chart-top-univs"), topUnivsOptions);
  topUnivsChart.render();
  
  // 2. Hourly Activity (Area Chart)
  const hourlyData = statsData.hourly_activity || Array(24).fill(0);
  const hourlyTrendOptions = {
    series: [{
      name: "게시글 수",
      data: hourlyData
    }],
    chart: {
      type: "area",
      height: 320,
      toolbar: { show: false },
      background: "transparent",
      foreColor: "var(--text-secondary)"
    },
    theme: { mode: themeMode },
    stroke: {
      curve: "smooth",
      width: 3,
      colors: ["#ff9100"]
    },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.45,
        opacityTo: 0.05,
        stops: [0, 95],
        colorStops: [
          {
            offset: 0,
            color: "#ff9100",
            opacity: 0.4
          },
          {
            offset: 100,
            color: "#ff9100",
            opacity: 0
          }
        ]
      }
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories: Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, "0")}시`),
      labels: {
        style: { fontFamily: "Inter" }
      }
    },
    yaxis: {
      labels: {
        style: { fontFamily: "Inter" },
        formatter: function(val) {
          return Math.round(val);
        }
      }
    },
    grid: {
      borderColor: "var(--border-color)"
    },
    tooltip: {
      theme: themeMode,
      x: { show: true }
    }
  };
  
  if (hourlyTrendChart) hourlyTrendChart.destroy();
  hourlyTrendChart = new ApexCharts(document.querySelector("#chart-hourly-trend"), hourlyTrendOptions);
  hourlyTrendChart.render();
}

// Update charts dark/light theme
function updateChartsTheme(themeMode) {
  if (topUnivsChart) {
    topUnivsChart.updateOptions({
      theme: { mode: themeMode },
      tooltip: { theme: themeMode }
    });
  }
  if (hourlyTrendChart) {
    hourlyTrendChart.updateOptions({
      theme: { mode: themeMode },
      tooltip: { theme: themeMode }
    });
  }
}

// Setup Event Listeners
function setupEventListeners() {
  // Table search input
  tableSearchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    applyTableFiltersAndSort();
  });
  
  // Table column sorting toggle
  sortHeader.addEventListener("click", () => {
    sortAscending = !sortAscending;
    
    // Update sort icon
    const icon = sortHeader.querySelector("i");
    icon.className = sortAscending ? "fa-solid fa-sort-up" : "fa-solid fa-sort-down";
    icon.style.color = "var(--primary-color)";
    
    applyTableFiltersAndSort();
  });
  
  // Theme Toggle Event
  themeBtn.addEventListener("click", () => {
    const isLight = document.body.classList.toggle("light-mode");
    localStorage.setItem("theme", isLight ? "light" : "dark");
    
    // Change icon
    const icon = themeBtn.querySelector("i");
    if (isLight) {
      icon.className = "fa-solid fa-sun";
    } else {
      icon.className = "fa-solid fa-moon";
    }
    
    // Update charts theme
    updateChartsTheme(isLight ? "light" : "dark");
  });
}

// Check saved theme preference
function checkThemePreference() {
  const savedTheme = localStorage.getItem("theme");
  const icon = themeBtn.querySelector("i");
  
  if (savedTheme === "light") {
    document.body.classList.add("light-mode");
    icon.className = "fa-solid fa-sun";
  } else {
    document.body.classList.remove("light-mode");
    icon.className = "fa-solid fa-moon";
  }
}

// App Initialization
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  checkThemePreference();
  loadStats();
});
