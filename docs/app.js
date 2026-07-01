// Global state
let statsData = {};
let tableData = [];
let sortColumn = "post_count";
let sortAscending = false;
let searchQuery = "";

// Chart instances
let topUnivsChart = null;
let hourlyTrendChart = null;
let engagementShareChart = null;

// DOM Elements
const lblUpdateTime = document.getElementById("lbl-update-time");
const valTotalPosts = document.getElementById("val-total-posts");
const valTotalUnivs = document.getElementById("val-total-univs");
const valTotalLikes = document.getElementById("val-total-likes");
const valTotalComments = document.getElementById("val-total-comments");

const highlightsList = document.getElementById("highlights-list");
const tableSearchInput = document.getElementById("table-search-input");
const tableTbody = document.getElementById("leaderboard-tbody");
const sortHeaders = document.querySelectorAll(".leaderboard-table th.sortable");

// Theme Toggle Button
const themeBtn = document.getElementById("theme-btn");

// Modal Elements
const detailModal = document.getElementById("detail-modal");
const modalCloseBtn = document.getElementById("modal-close-btn");
const modalWriterImg = document.getElementById("modal-writer-img");
const modalWriterName = document.getElementById("modal-writer-name");
const modalSchool = document.getElementById("modal-school");
const modalTitle = document.getElementById("modal-title");
const modalTime = document.getElementById("modal-time");
const modalText = document.getElementById("modal-text");
const modalVotes = document.getElementById("modal-votes");
const modalComments = document.getElementById("modal-comments");
const modalArticleId = document.getElementById("modal-article-id");

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
        <td colspan="7" style="text-align: center; color: var(--primary-color); padding: 40px 0;">
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
  if (statsData.updated_at) {
    const d = new Date(statsData.updated_at);
    lblUpdateTime.innerHTML = `<i class="fa-regular fa-clock"></i> 업데이트: ${d.toLocaleString("ko-KR")}`;
  }
  
  animateValue("val-total-posts", statsData.total_posts || 0);
  animateValue("val-total-univs", statsData.unique_universities || 0);
  animateValue("val-total-likes", statsData.total_likes || 0);
  animateValue("val-total-comments", statsData.total_comments || 0);
  
  // Render Highlight Cards
  renderHighlights();
  
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

// Render Highlights Sidebar
function renderHighlights() {
  highlightsList.innerHTML = "";
  const highlights = statsData.highlights || [];
  
  // Show only top 5
  const topHighlights = highlights.slice(0, 5);
  
  if (topHighlights.length === 0) {
    highlightsList.innerHTML = `<p style="font-size: 13px; color: var(--text-muted); text-align: center; padding: 20px 0;">분석 대상 인기글이 없습니다.</p>`;
    return;
  }
  
  topHighlights.forEach(item => {
    const itemEl = document.createElement("div");
    itemEl.className = "highlight-item";
    itemEl.addEventListener("click", () => openModal(item));
    
    const title = item.title && item.title !== "제목 없음" ? item.title : (item.textPreview ? item.textPreview.substring(0, 20) + "..." : "제목 없음");
    const excerpt = item.textPreview ? item.textPreview : "";
    const school = item.writer && item.writer.campusFullName ? item.writer.campusFullName : "익명/기타";
    
    itemEl.innerHTML = `
      <div class="highlight-item-header">
        <span class="highlight-school">${school}</span>
        <span class="highlight-votes"><i class="fa-solid fa-heart"></i> ${item.posvote || 0}</span>
      </div>
      <h4 class="highlight-title">${title}</h4>
      <p class="highlight-excerpt">${excerpt}</p>
    `;
    
    highlightsList.appendChild(itemEl);
  });
}

// Render Leaderboard table
function applyTableFiltersAndSort() {
  // 1. Search filter
  let data = [...statsData.universities];
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    data = data.filter(u => u.name.toLowerCase().includes(q));
  }
  
  // 2. Sort
  data.sort((a, b) => {
    let valA = a[sortColumn];
    let valB = b[sortColumn];
    
    if (typeof valA === "string") {
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
    }
    
    if (valA < valB) return sortAscending ? -1 : 1;
    if (valA > valB) return sortAscending ? 1 : -1;
    return 0;
  });
  
  renderTableRows(data);
}

function renderTableRows(data) {
  tableTbody.innerHTML = "";
  
  if (data.length === 0) {
    tableTbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px 0;">
          검색어와 일치하는 대학이 없습니다.
        </td>
      </tr>
    `;
    return;
  }
  
  data.forEach((univ, index) => {
    // Find absolute rank based on post count (independent of current table sorting)
    // If currently sorted by post_count desc, the index + 1 is the rank.
    // Let's find rank from original statsData.universities list:
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
      <td class="col-count">${univ.post_count.toLocaleString()}</td>
      <td class="col-likes">${univ.total_likes.toLocaleString()}</td>
      <td class="col-comments">${univ.total_comments.toLocaleString()}</td>
      <td class="col-avg-likes">${univ.avg_likes.toFixed(1)}</td>
      <td class="col-avg-comments">${univ.avg_comments.toFixed(1)}</td>
    `;
    
    tableTbody.appendChild(tr);
  });
}

// Chart Initializations
function initCharts() {
  const isDark = !document.body.classList.contains("light-mode");
  const themeMode = isDark ? "dark" : "light";
  
  // 1. Top Universities (Horizontal Bar Chart)
  const top10 = statsData.universities.slice(0, 10);
  const topUnivsOptions = {
    series: [{
      name: "게시글 수",
      data: top10.map(u => u.post_count)
    }],
    chart: {
      type: "bar",
      height: 350,
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
      formatter: function(val, opt) {
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
      height: 250,
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
        rotate: -45,
        rotateAlways: false,
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
  
  // 3. Engagement Share (Donut Chart)
  const engagementShareOptions = {
    series: [statsData.total_likes || 0, statsData.total_comments || 0],
    labels: ["추천수", "댓글수"],
    chart: {
      type: "donut",
      height: 250,
      background: "transparent",
      foreColor: "var(--text-secondary)"
    },
    theme: { mode: themeMode },
    colors: ["#e53935", "#ff9100"],
    stroke: { show: false },
    plotOptions: {
      pie: {
        donut: {
          size: "65%",
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: "13px",
              fontFamily: "Noto Sans KR, Inter",
              fontWeight: 600,
              offsetY: -10
            },
            value: {
              show: true,
              fontSize: "20px",
              fontFamily: "Outfit, Inter",
              fontWeight: 700,
              color: "var(--text-primary)",
              offsetY: 8,
              formatter: function(val) {
                return parseInt(val, 10).toLocaleString() + "개";
              }
            },
            total: {
              show: true,
              label: "총 반응수",
              color: "var(--text-secondary)",
              formatter: function(w) {
                const total = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                return total.toLocaleString() + "개";
              }
            }
          }
        }
      }
    },
    legend: {
      position: "bottom",
      fontFamily: "Noto Sans KR, Inter",
      fontSize: "12px",
      markers: { radius: 12 }
    },
    tooltip: {
      theme: themeMode,
      y: {
        formatter: function(val) {
          return val.toLocaleString() + " 개 반응";
        }
      }
    }
  };
  
  if (engagementShareChart) engagementShareChart.destroy();
  engagementShareChart = new ApexCharts(document.querySelector("#chart-engagement-share"), engagementShareOptions);
  engagementShareChart.render();
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
  if (engagementShareChart) {
    engagementShareChart.updateOptions({
      theme: { mode: themeMode },
      tooltip: { theme: themeMode }
    });
  }
}

// Modal management
function openModal(article) {
  const authorPic = article.writer && article.writer.picture ? article.writer.picture : "https://cf-fpi.everytime.kr/0.png";
  const authorName = article.writer && article.writer.displayName ? article.writer.displayName : "익명";
  const schoolName = article.writer && article.writer.campusFullName ? article.writer.campusFullName : "익명/기타";
  
  modalWriterImg.src = authorPic;
  modalWriterImg.onerror = () => { modalWriterImg.src = "https://cf-fpi.everytime.kr/0.png"; };
  modalWriterName.textContent = authorName;
  modalSchool.textContent = schoolName;
  modalTitle.textContent = article.title || "제목 없음";
  modalTime.innerHTML = `<i class="fa-regular fa-clock"></i> ${article.createdAt || ""}`;
  
  modalText.textContent = article.textPreview || "";
  
  modalVotes.textContent = article.posvote || 0;
  modalComments.textContent = article.commentCount || 0;
  modalArticleId.textContent = article.id || "";
  
  detailModal.style.display = "flex";
  document.body.style.overflow = "hidden"; // disable body scrolling
}

function closeModal() {
  detailModal.style.display = "none";
  document.body.style.overflow = ""; // enable body scrolling
}

// Setup Event Listeners
function setupEventListeners() {
  // Table search input
  tableSearchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    applyTableFiltersAndSort();
  });
  
  // Table column sorting
  sortHeaders.forEach(th => {
    th.addEventListener("click", () => {
      const colName = th.dataset.sort;
      
      // If clicking same column, toggle direction
      if (sortColumn === colName) {
        sortAscending = !sortAscending;
      } else {
        sortColumn = colName;
        sortAscending = false;
      }
      
      // Update icons
      sortHeaders.forEach(header => {
        const icon = header.querySelector("i");
        if (header === th) {
          icon.className = sortAscending ? "fa-solid fa-sort-up" : "fa-solid fa-sort-down";
          icon.style.color = "var(--primary-color)";
        } else {
          icon.className = "fa-solid fa-sort";
          icon.style.color = "";
        }
      });
      
      applyTableFiltersAndSort();
    });
  });
  
  // Close Modal Events
  modalCloseBtn.addEventListener("click", closeModal);
  detailModal.addEventListener("click", (e) => {
    if (e.target === detailModal) {
      closeModal();
    }
  });
  
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && detailModal.style.display === "flex") {
      closeModal();
    }
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
