const OVEN_COUNT = 6;
const STORAGE_KEY = "oven-bookings-v1";
const OVEN_COLORS = ["#0f766e", "#2563eb", "#c2410c", "#7c3aed", "#be123c", "#4d7c0f"];
const SUPABASE_TABLE = "oven_bookings";

const form = document.querySelector("#bookingForm");
const departmentSelect = document.querySelector("#department");
const ovenMap = document.querySelector("#ovenMap");
const timeline = document.querySelector("#timeline");
const timelineLegend = document.querySelector("#timelineLegend");
const ovenSelect = document.querySelector("#ovenId");
const startTimeInput = document.querySelector("#startTime");
const endTimeInput = document.querySelector("#endTime");
const userNameInput = document.querySelector("#userName");
const clearFormButton = document.querySelector("#clearFormButton");
const clearAllButton = document.querySelector("#clearAllButton");
const clearOvenSelect = document.querySelector("#clearOvenSelect");
const prevMonthButton = document.querySelector("#prevMonthButton");
const nextMonthButton = document.querySelector("#nextMonthButton");
const monthLabel = document.querySelector("#monthLabel");
const clock = document.querySelector("#clock");
const syncStatus = document.querySelector("#syncStatus");
const ovenCardTemplate = document.querySelector("#ovenCardTemplate");

let visibleMonth = startOfMonth(new Date());
let bookingsCache = [];
let supabaseClient = null;

function getSupabaseConfig() {
  return window.OVEN_APP_CONFIG || {};
}

function hasSupabaseConfig() {
  const config = getSupabaseConfig();
  return Boolean(config.SUPABASE_URL && config.SUPABASE_ANON_KEY);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${src}"]`);
    if (existingScript) {
      existingScript.addEventListener("load", resolve, { once: true });
      existingScript.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", reject, { once: true });
    document.head.append(script);
  });
}

async function initSupabase() {
  if (!hasSupabaseConfig()) return null;
  if (!window.supabase) {
    await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
  }
  const config = getSupabaseConfig();
  return window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
}

function readBookings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
}

function writeBookings(bookings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
}

function normalizeBooking(booking) {
  return {
    id: booking.id,
    department: booking.department,
    userName: booking.userName || booking.user_name,
    ovenId: String(booking.ovenId || booking.oven_id),
    startTime: booking.startTime || booking.start_time,
    endTime: booking.endTime || booking.end_time,
    duration: booking.duration,
    createdAt: booking.createdAt || booking.created_at,
  };
}

async function loadBookings() {
  if (!supabaseClient) {
    bookingsCache = readBookings().map(normalizeBooking);
    return;
  }

  const { data, error } = await supabaseClient
    .from(SUPABASE_TABLE)
    .select("*")
    .order("start_time", { ascending: true });

  if (error) {
    console.error(error);
    syncStatus.textContent = "雲端讀取失敗，暫用本機資料";
    bookingsCache = readBookings().map(normalizeBooking);
    return;
  }

  bookingsCache = data.map(normalizeBooking);
  syncStatus.textContent = "雲端同步中";
}

async function createBooking(booking) {
  if (!supabaseClient) {
    const bookings = readBookings();
    bookings.push(booking);
    writeBookings(bookings);
    bookingsCache = bookings.map(normalizeBooking);
    return;
  }

  const { error } = await supabaseClient.from(SUPABASE_TABLE).insert({
    department: booking.department,
    user_name: booking.userName,
    oven_id: Number(booking.ovenId),
    start_time: booking.startTime,
    end_time: booking.endTime,
  });

  if (error) {
    console.error(error);
    window.alert(`雲端登記失敗：${error.message}`);
    return;
  }

  await loadBookings();
}

function getOvenName(ovenId) {
  if (String(ovenId) === "1") return "烤箱 1(上)";
  if (String(ovenId) === "2") return "烤箱 2(下)";
  return `烤箱 ${ovenId}`;
}

async function clearBookings(ovenId = "all") {
  if (!supabaseClient) {
    const nextBookings =
      ovenId === "all" ? [] : readBookings().filter((booking) => String(normalizeBooking(booking).ovenId) !== String(ovenId));
    writeBookings(nextBookings);
    bookingsCache = nextBookings.map(normalizeBooking);
    return;
  }

  const query = supabaseClient.from(SUPABASE_TABLE).delete();
  const { error } =
    ovenId === "all"
      ? await query.neq("id", "00000000-0000-0000-0000-000000000000")
      : await query.eq("oven_id", Number(ovenId));
  if (error) {
    console.error(error);
    window.alert(`雲端清除失敗：${error.message}`);
    return;
  }
  await loadBookings();
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function toLocalInputValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function daysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function formatTime(date) {
  return new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatFullDateTime(date) {
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatRemaining(ms) {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes} 分鐘`;
  if (minutes === 0) return `${hours} 小時`;
  return `${hours} 小時 ${minutes} 分鐘`;
}

function formatMonth(date) {
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "long",
  }).format(date);
}

function getBookingStart(booking) {
  return new Date(booking.startTime);
}

function getBookingEnd(booking) {
  if (booking.endTime) return new Date(booking.endTime);
  return new Date(new Date(booking.startTime).getTime() + Number(booking.duration || 0) * 60 * 1000);
}

function isCurrentBooking(booking, now = new Date()) {
  const start = getBookingStart(booking);
  const end = getBookingEnd(booking);
  return start <= now && now < end;
}

function getCurrentBooking(ovenId) {
  return bookingsCache
    .filter((booking) => String(booking.ovenId) === String(ovenId))
    .find((booking) => isCurrentBooking(booking));
}

function getNextBooking(ovenId, now = new Date()) {
  return bookingsCache
    .filter((booking) => String(booking.ovenId) === String(ovenId))
    .filter((booking) => getBookingStart(booking) > now)
    .sort((a, b) => getBookingStart(a) - getBookingStart(b))[0];
}

function setDefaultTimes() {
  const now = new Date();
  now.setSeconds(0, 0);
  now.setMinutes(Math.ceil(now.getMinutes() / 5) * 5);

  const end = new Date(now);
  end.setMinutes(now.getMinutes() + 30);

  startTimeInput.value = toLocalInputValue(now);
  endTimeInput.value = toLocalInputValue(end);
}

function getOvenColor(ovenId) {
  return OVEN_COLORS[Number(ovenId) - 1] || "#334155";
}

function renderOvenMap() {
  const selectedOvenId = ovenSelect.value;
  const now = new Date();
  ovenMap.innerHTML = "";

  for (let ovenId = 1; ovenId <= OVEN_COUNT; ovenId += 1) {
    const node = ovenCardTemplate.content.firstElementChild.cloneNode(true);
    const currentBooking = getCurrentBooking(ovenId);
    const progressBar = node.querySelector(".oven-progress span");
    node.dataset.ovenId = ovenId;
    node.style.setProperty("--oven-color", getOvenColor(ovenId));
    node.classList.toggle("busy", Boolean(currentBooking));
    node.classList.toggle("selected", String(selectedOvenId) === String(ovenId));
    node.querySelector(".oven-number").textContent = ovenId;
    node.querySelector(".oven-label").textContent = getOvenName(ovenId);
    if (currentBooking) {
      const start = getBookingStart(currentBooking);
      const end = getBookingEnd(currentBooking);
      const totalMs = Math.max(1, end - start);
      const elapsedMs = Math.max(0, now - start);
      const progress = Math.min(100, (elapsedMs / totalMs) * 100);
      node.querySelector(".oven-status").textContent =
        `${currentBooking.department || "未填部門"} / ${currentBooking.userName} 使用中，到 ${formatFullDateTime(end)}，剩餘 ${formatRemaining(end - now)}`;
      progressBar.style.width = `${progress}%`;
    } else {
      const nextBooking = getNextBooking(ovenId, now);
      node.querySelector(".oven-status").textContent = nextBooking
        ? `目前空閒，下一筆 ${formatFullDateTime(getBookingStart(nextBooking))} ${nextBooking.department || "未填部門"} / ${nextBooking.userName}`
        : "目前空閒";
      progressBar.style.width = "0%";
    }
    node.addEventListener("click", () => {
      ovenSelect.value = String(ovenId);
      renderOvenMap();
    });
    ovenMap.append(node);
  }
}

function renderLegend() {
  timelineLegend.innerHTML = "";
  for (let ovenId = 1; ovenId <= OVEN_COUNT; ovenId += 1) {
    const item = document.createElement("div");
    item.className = "legend-item";
    item.innerHTML = `<span style="background:${getOvenColor(ovenId)}"></span>${getOvenName(ovenId)}`;
    timelineLegend.append(item);
  }
}

function renderTimeline() {
  const bookings = bookingsCache;
  const now = new Date();
  const monthStart = startOfMonth(visibleMonth);
  const monthEnd = endOfMonth(visibleMonth);
  const monthDays = daysInMonth(visibleMonth);
  const totalMs = monthEnd - monthStart;
  const shouldShowNowLine = monthStart <= now && now <= monthEnd;
  const nowLineLeft = shouldShowNowLine ? ((now - monthStart) / totalMs) * 100 : 0;
  monthLabel.textContent = formatMonth(visibleMonth);
  timeline.style.setProperty("--month-days", monthDays);
  timeline.innerHTML = "";

  const header = document.createElement("div");
  header.className = "timeline-header";
  header.append(document.createElement("div"));

  const dayHeader = document.createElement("div");
  dayHeader.className = "day-grid";
  for (let day = 1; day <= monthDays; day += 1) {
    const dayCell = document.createElement("div");
    dayCell.className = "day-cell";
    dayCell.textContent = day;
    dayHeader.append(dayCell);
  }
  if (shouldShowNowLine) {
    const nowLine = document.createElement("div");
    nowLine.className = "now-line now-line-header";
    nowLine.style.left = `${nowLineLeft}%`;
    nowLine.innerHTML = `<span>現在 ${formatTime(now)}</span>`;
    dayHeader.append(nowLine);
  }
  header.append(dayHeader);
  timeline.append(header);

  for (let ovenId = 1; ovenId <= OVEN_COUNT; ovenId += 1) {
    const row = document.createElement("div");
    row.className = "timeline-row";

    const label = document.createElement("div");
    label.className = "timeline-label";
    label.textContent = getOvenName(ovenId);

    const track = document.createElement("div");
    track.className = "timeline-track";
    if (shouldShowNowLine) {
      const nowLine = document.createElement("div");
      nowLine.className = "now-line";
      nowLine.style.left = `${nowLineLeft}%`;
      nowLine.title = `現在 ${formatDateTime(now)}`;
      track.append(nowLine);
    }

    bookings
      .filter((booking) => String(booking.ovenId) === String(ovenId))
      .forEach((booking) => {
        const start = getBookingStart(booking);
        const end = getBookingEnd(booking);
        if (end <= monthStart || start >= monthEnd) return;

        const clampedStart = Math.max(start.getTime(), monthStart.getTime());
        const clampedEnd = Math.min(end.getTime(), monthEnd.getTime());
        const left = ((clampedStart - monthStart.getTime()) / totalMs) * 100;
        const width = Math.max(((clampedEnd - clampedStart) / totalMs) * 100, 100 / monthDays / 3);

        const block = document.createElement("div");
        block.className = "timeline-block";
        block.style.left = `${left}%`;
        block.style.width = `${width}%`;
        block.style.background = getOvenColor(ovenId);
        block.title = `${booking.department || "未填部門"} / ${booking.userName} ${formatDateTime(start)} - ${formatDateTime(end)}`;
        block.textContent = `${booking.department || ""} ${booking.userName}`.trim();
        track.append(block);
      });

    row.append(label, track);
    timeline.append(row);
  }
}

function applyUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const ovenId = params.get("oven");
  if (ovenId && Number(ovenId) >= 1 && Number(ovenId) <= OVEN_COUNT) {
    ovenSelect.value = ovenId;
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  const startTime = new Date(startTimeInput.value);
  const endTime = new Date(endTimeInput.value);
  if (endTime <= startTime) {
    window.alert("結束使用時間必須晚於開始使用時間。");
    return;
  }

  const booking = {
    id: crypto.randomUUID(),
    department: departmentSelect.value,
    userName: userNameInput.value.trim(),
    ovenId: ovenSelect.value,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    createdAt: new Date().toISOString(),
  };

  await createBooking(booking);
  form.reset();
  setDefaultTimes();
  applyUrlParams();
  render();
}

function renderClock() {
  clock.textContent = formatFullDateTime(new Date());
}

function render() {
  renderClock();
  renderOvenMap();
  renderLegend();
  renderTimeline();
}

form.addEventListener("submit", handleSubmit);
ovenSelect.addEventListener("change", renderOvenMap);
clearFormButton.addEventListener("click", () => {
  form.reset();
  setDefaultTimes();
  applyUrlParams();
  renderOvenMap();
});
clearAllButton.addEventListener("click", async () => {
  const ovenId = clearOvenSelect.value;
  if (!ovenId) {
    window.alert("請先選擇要清除的烤箱。");
    return;
  }
  const targetName = ovenId === "all" ? "全部烤箱" : getOvenName(ovenId);
  const confirmed = window.confirm(`確定要清除 ${targetName} 的登記資料嗎？`);
  if (!confirmed) return;
  await clearBookings(ovenId);
  clearOvenSelect.value = "";
  render();
});
prevMonthButton.addEventListener("click", () => {
  visibleMonth = addMonths(visibleMonth, -1);
  renderTimeline();
});
nextMonthButton.addEventListener("click", () => {
  visibleMonth = addMonths(visibleMonth, 1);
  renderTimeline();
});

async function startApp() {
  try {
    syncStatus.textContent = hasSupabaseConfig() ? "連線雲端中" : "本機模式";
    supabaseClient = await initSupabase();
  } catch (error) {
    console.error(error);
    syncStatus.textContent = "雲端套件載入失敗，暫用本機模式";
    supabaseClient = null;
  }
  setDefaultTimes();
  applyUrlParams();
  await loadBookings();
  render();
  setInterval(async () => {
    await loadBookings();
    render();
  }, 30 * 1000);
}

startApp();
