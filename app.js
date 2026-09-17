/**
 * İTÜ Ders Seçimi Pratik Simülatörü & Bookmarklet Benchmark Motoru
 * Doğrudan kullanıcı bookmarklet koduyla %100 uyumlu çalışır.
 */

// --- Durum ve Değişkenler ---
let startTime = performance.now();
let timerRunning = true;
let timerInterval = null;

let firstInputRecorded = false;
let firstInputTime = 0;
let submitClickTime = 0;
let finalConfirmTime = 0;

// Öntanımlı CRN listesi (Kullanıcının verdiği kod ile aynı)
let currentCrnValues = [11694, 12152, 11695, 11698, 13846, 11700, 11702, 10030, 12155];

// Örnek Ders Veri Tabanı (Gerçekçi İTÜ Ders Eşleşmeleri)
const courseMockDb = {
  11694: { code: "BLG 252E", name: "Object Oriented Programming", credit: "3.0", quota: "45/50" },
  12152: { code: "MAT 271E", name: "Probability and Statistics", credit: "3.0", quota: "58/60" },
  11695: { code: "BLG 223E", name: "Data Structures", credit: "4.0", quota: "40/45" },
  11698: { code: "BLG 311E", name: "Formal Languages & Automata", credit: "3.0", quota: "50/50" },
  13846: { code: "BLG 335E", name: "Analysis of Algorithms", credit: "3.0", quota: "42/45" },
  11700: { code: "BLG 351E", name: "Microcomputer Laboratory", credit: "2.0", quota: "24/25" },
  11702: { code: "BLG 212E", name: "Microprocessor Systems", credit: "4.0", quota: "35/40" },
  10030: { code: "FIZ 102E", name: "Physics II", credit: "4.0", quota: "70/75" },
  12155: { code: "MAT 201E", name: "Differential Equations", credit: "4.0", quota: "65/70" },
  10500: { code: "ING 201A", name: "Interpersonal Communication", credit: "2.0", quota: "30/30" }
};

// --- DOM Elemanları ---
const crnTableBody = document.getElementById("crnTableBody");
const timerDisplay = document.getElementById("timerDisplay");
const statusBadge = document.getElementById("statusBadge");
const firstFillTimeEl = document.getElementById("firstFillTime");
const submitClickTimeEl = document.getElementById("submitClickTime");
const finalConfirmTimeEl = document.getElementById("finalConfirmTime");
const filledCounter = document.getElementById("filledCounter");
const mainTimerCard = document.getElementById("mainTimerCard");

const resetBtn = document.getElementById("resetBtn");
const realF5Btn = document.getElementById("realF5Btn");
const simulateBookmarkletBtn = document.getElementById("simulateBookmarkletBtn");

const bestTimeDisplay = document.getElementById("bestTimeDisplay");
const lastTimeDisplay = document.getElementById("lastTimeDisplay");
const avgTimeDisplay = document.getElementById("avgTimeDisplay");
const attemptCountDisplay = document.getElementById("attemptCountDisplay");
const clearStatsBtn = document.getElementById("clearStatsBtn");
const historyTableBody = document.getElementById("historyTableBody");

const confirmationModal = document.getElementById("confirmationModal");
const modalCancelBtn = document.getElementById("modalCancelBtn");
const modalConfirmBtn = document.getElementById("modalConfirmBtn");
const closeModalCrossBtn = document.getElementById("closeModalCrossBtn");
const modalCrnSummary = document.getElementById("modalCrnSummary");

const bookmarkletLink = document.getElementById("bookmarkletLink");
const copyCodeBtn = document.getElementById("copyCodeBtn");
const editValuesBtn = document.getElementById("editValuesBtn");

const editorModal = document.getElementById("editorModal");
const customCrnInput = document.getElementById("customCrnInput");
const saveCustomCrnBtn = document.getElementById("saveCustomCrnBtn");
const editorCancelBtn = document.getElementById("editorCancelBtn");
const closeEditorCrossBtn = document.getElementById("closeEditorCrossBtn");

const systemClock = document.getElementById("systemClock");

// --- Ses Efektleri (Web Audio API) ---
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playTone(freq, type, duration, delay = 0) {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    gain.gain.setValueAtTime(0.12, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration);
  } catch (e) {
    // Ses desteği yoksa yoksay
  }
}

function playSuccessSound() {
  playTone(523.25, 'sine', 0.12, 0);       // C5
  playTone(659.25, 'sine', 0.12, 0.08);    // E5
  playTone(783.99, 'sine', 0.18, 0.16);    // G5
  playTone(1046.50, 'triangle', 0.3, 0.24);// C6
}

function playResetSound() {
  playTone(330, 'triangle', 0.08, 0);
  playTone(440, 'sine', 0.08, 0.06);
}

// --- 10 CRN Kutusunu Tabloya Oluştur ---
function renderCrnInputs() {
  crnTableBody.innerHTML = "";
  for (let i = 1; i <= 10; i++) {
    const tr = document.createElement("tr");
    tr.id = `crnRow_${i}`;

    // CRN Kutusu: Bookmarklet "input[type='number']" seçicisini arar
    tr.innerHTML = `
      <td><span style="font-weight:700; color:#64748b;">${i}</span></td>
      <td>
        <input 
          type="number" 
          id="crnInput_${i}" 
          class="crn-input" 
          placeholder="CRN Giriniz..." 
          autocomplete="off"
          min="10000" 
          max="99999"
        />
      </td>
      <td>
        <span class="course-code-tag" id="courseCode_${i}">--</span> 
        <span class="course-name-text" id="courseName_${i}">(CRN bekleniyor)</span>
      </td>
      <td><span id="courseCredit_${i}">-</span></td>
      <td><span id="courseQuota_${i}">-</span></td>
      <td><span class="badge-status-open" id="courseStatus_${i}">Seçime Açık</span></td>
    `;

    crnTableBody.appendChild(tr);

    // Event listener: Kullanıcının bookmarklet'i `input.dispatchEvent(new Event("input", { bubbles: true }));` tetikler
    const input = tr.querySelector("input[type='number']");
    input.addEventListener("input", (e) => onCrnInputChanged(e, i));
  }
}

// CRN input değiştiğinde çalışır
function onCrnInputChanged(event, index) {
  const val = event.target.value.trim();
  const row = document.getElementById(`crnRow_${index}`);
  const inputEl = event.target;

  // İlk input geldiği an (Bookmarklet'e basılma anı)
  if (!firstInputRecorded) {
    firstInputRecorded = true;
    firstInputTime = performance.now() - startTime;
    firstFillTimeEl.textContent = `${(firstInputTime / 1000).toFixed(3)}s`;
    
    // Timer göstergesine hafif tepki rengi
    timerDisplay.style.color = "#f59e0b";
  }

  if (val) {
    inputEl.classList.add("highlight-fill");
    row.classList.add("filled-row");

    // Ders bilgisi eşleştirme
    const course = courseMockDb[val] || {
      code: `DERS ${val}`,
      name: `Seçilen Ders (${val})`,
      credit: "3.0",
      quota: "45/50"
    };

    document.getElementById(`courseCode_${index}`).textContent = course.code;
    document.getElementById(`courseName_${index}`).textContent = course.name;
    document.getElementById(`courseCredit_${index}`).textContent = course.credit;
    document.getElementById(`courseQuota_${index}`).textContent = course.quota;
    
    const statusBadge = document.getElementById(`courseStatus_${index}`);
    statusBadge.className = "badge-status-filled";
    statusBadge.textContent = "Hazır";
  } else {
    inputEl.classList.remove("highlight-fill");
    row.classList.remove("filled-row");
    document.getElementById(`courseCode_${index}`).textContent = "--";
    document.getElementById(`courseName_${index}`).textContent = "(CRN bekleniyor)";
    document.getElementById(`courseCredit_${index}`).textContent = "-";
    document.getElementById(`courseQuota_${index}`).textContent = "-";
    const statusBadge = document.getElementById(`courseStatus_${index}`);
    statusBadge.className = "badge-status-open";
    statusBadge.textContent = "Seçime Açık";
  }

  updateFilledCounter();
}

function updateFilledCounter() {
  const inputs = document.querySelectorAll("input[type='number']");
  let count = 0;
  inputs.forEach(inp => {
    if (inp.value && inp.value.trim() !== "") count++;
  });
  filledCounter.innerHTML = `Doldurulan CRN: <strong>${count} / 10</strong>`;
}

// --- Form Gönderme (Bookmarklet'in tıkladığı submit butonu) ---
// Kod: let submitBtn = document.querySelector('button[type="submit"]:not([disabled])');
function handleFormSubmit() {
  submitClickTime = performance.now() - startTime;
  submitClickTimeEl.textContent = `${(submitClickTime / 1000).toFixed(3)}s`;

  // Onay modalını aç
  openConfirmationModal();
}

// --- Onay Modalı Açılışı ---
function openConfirmationModal() {
  const inputs = document.querySelectorAll("input[type='number']");
  modalCrnSummary.innerHTML = "";
  
  let hasAny = false;
  inputs.forEach((inp, idx) => {
    if (inp.value) {
      hasAny = true;
      const chip = document.createElement("span");
      chip.className = "crn-chip";
      chip.textContent = `#${idx + 1}: ${inp.value}`;
      modalCrnSummary.appendChild(chip);
    }
  });

  if (!hasAny) {
    modalCrnSummary.innerHTML = "<span class='text-muted'>Hiç CRN girilmedi.</span>";
  }

  confirmationModal.style.display = "flex";
}

function closeConfirmationModal() {
  confirmationModal.style.display = "none";
}

// --- Nihai Onay Butonuna Tıklanması (Bookmarklet buttons[1]) ---
// Kod:
// let footer = document.querySelector(".card-footer.d-flex.justify-content-end");
// if (footer) { let buttons = footer.getElementsByTagName("button"); if (buttons.length > 1) buttons[1].click(); }
// --- Nihai Onay Butonuna Tıklanması (Bookmarklet buttons[1]) ---
function handleFinalConfirm() {
  if (!timerRunning) return;

  finalConfirmTime = performance.now() - startTime;
  timerRunning = false;
  clearInterval(timerInterval);

  finalConfirmTimeEl.textContent = `${(finalConfirmTime / 1000).toFixed(3)}s`;

  const totalSeconds = (finalConfirmTime / 1000).toFixed(3);
  const reflexSeconds = firstInputRecorded ? (firstInputTime / 1000).toFixed(3) : totalSeconds;

  // Ana gösterge: Kullanıcının F5 sonrası bookmarklet'e tıklama refleksi (örn: 0.055s)
  timerDisplay.innerHTML = `${reflexSeconds}<span class="timer-unit">s</span>`;
  timerDisplay.className = "timer-big completed";

  const totalExecutionDisplay = document.getElementById("totalExecutionDisplay");
  if (totalExecutionDisplay) {
    totalExecutionDisplay.innerHTML = `${totalSeconds}<span class="timer-unit">s</span>`;
  }

  statusBadge.className = "badge status-badge completed";
  statusBadge.innerHTML = `✓ TAMAMLANDI &bull; Refleks: ${reflexSeconds}s (Toplam: ${totalSeconds}s)`;

  mainTimerCard.classList.add("success-pulse");

  // Modalı kapat
  closeConfirmationModal();

  // Otomatik aralık varsa durdur
  if (window._autoFillInterval) {
    clearInterval(window._autoFillInterval);
    window._autoFillInterval = null;
  }

  // Ses çal
  playSuccessSound();

  // İstatistikleri kaydet ve yeni rekor kontrolü yap (Refleks süresine göre)
  saveAttempt(parseFloat(reflexSeconds), parseFloat(totalSeconds));
}

// --- Canlı Sayaç Döngüsü ---
function startTimerLoop() {
  startTime = performance.now();
  timerRunning = true;
  firstInputRecorded = false;
  firstInputTime = 0;
  submitClickTime = 0;
  finalConfirmTime = 0;

  firstFillTimeEl.textContent = "--";
  submitClickTimeEl.textContent = "--";
  finalConfirmTimeEl.textContent = "--";

  const totalExecutionDisplay = document.getElementById("totalExecutionDisplay");
  if (totalExecutionDisplay) {
    totalExecutionDisplay.innerHTML = `--<span class="timer-unit">s</span>`;
  }

  timerDisplay.className = "timer-big";
  timerDisplay.style.color = "#ffffff";
  statusBadge.className = "badge status-badge live";
  statusBadge.innerHTML = `<span class="dot"></span> HAZIR &bull; SAYAÇ ÇALIŞIYOR`;
  mainTimerCard.classList.remove("success-pulse");

  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    if (!timerRunning) return;
    const elapsed = (performance.now() - startTime) / 1000;
    timerDisplay.innerHTML = `${elapsed.toFixed(3)}<span class="timer-unit">s</span>`;
  }, 16); // ~60fps yenileme
}

// --- Sıfırlama (Yeniden Başlat) ---
function resetBenchmark(playSound = true) {
  if (window._autoFillInterval) {
    clearInterval(window._autoFillInterval);
    window._autoFillInterval = null;
  }

  closeConfirmationModal();
  closeEditorModal();

  // Inputları temizle
  const inputs = document.querySelectorAll("input[type='number']");
  inputs.forEach((input, idx) => {
    input.value = "";
    input.classList.remove("highlight-fill");
    const row = document.getElementById(`crnRow_${idx + 1}`);
    if (row) row.classList.remove("filled-row");
    const codeEl = document.getElementById(`courseCode_${idx + 1}`);
    if (codeEl) codeEl.textContent = "--";
    const nameEl = document.getElementById(`courseName_${idx + 1}`);
    if (nameEl) nameEl.textContent = "(CRN bekleniyor)";
    const creditEl = document.getElementById(`courseCredit_${idx + 1}`);
    if (creditEl) creditEl.textContent = "-";
    const quotaEl = document.getElementById(`courseQuota_${idx + 1}`);
    if (quotaEl) quotaEl.textContent = "-";
    const statusEl = document.getElementById(`courseStatus_${idx + 1}`);
    if (statusEl) {
      statusEl.className = "badge-status-open";
      statusEl.textContent = "Seçime Açık";
    }
  });

  updateFilledCounter();
  startTimerLoop();

  if (playSound) playResetSound();
  showToast("Sistem sıfırlandı! Sayaç başladı, bookmarklet'e tıklayın.", "info");
}

// --- İstatistik & Skor Yönetimi ---
const STORAGE_KEY = "itu_course_reg_benchmark_v1";

function loadStats() {
  const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"best":null,"attempts":[]}');
  renderStats(data);
}

function saveAttempt(reflexSec, totalSec) {
  const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"best":null,"attempts":[]}');
  
  let isRecord = false;
  if (data.best === null || reflexSec < data.best) {
    data.best = reflexSec;
    isRecord = true;
    timerDisplay.classList.add("new-record");
    launchConfetti();
    showToast(`🎉 TEBRİKLER! YENİ REKOR: ${reflexSec.toFixed(3)}s`, "success");
  } else {
    showToast(`Refleks: ${reflexSec.toFixed(3)}s &bull; Toplam Onay: ${totalSec.toFixed(3)}s`, "success");
  }

  const now = new Date();
  const timeStr = now.toLocaleTimeString("tr-TR", { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  data.attempts.unshift({
    reflex: reflexSec,
    total: totalSec,
    submit: (submitClickTime / 1000).toFixed(3),
    timestamp: timeStr,
    isRecord: isRecord
  });

  // En fazla son 25 deneme
  if (data.attempts.length > 25) {
    data.attempts.pop();
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  renderStats(data);
}

function renderStats(data) {
  if (data.best !== null) {
    bestTimeDisplay.textContent = `${data.best.toFixed(3)}s`;
  } else {
    bestTimeDisplay.textContent = "--";
  }

  attemptCountDisplay.textContent = data.attempts.length;

  if (data.attempts.length > 0) {
    const latest = data.attempts[0];
    lastTimeDisplay.textContent = `${(latest.reflex !== undefined ? latest.reflex : latest.total).toFixed(3)}s`;
    
    const sum = data.attempts.reduce((acc, curr) => acc + (curr.reflex !== undefined ? curr.reflex : curr.total), 0);
    const avg = sum / data.attempts.length;
    avgTimeDisplay.textContent = `${avg.toFixed(3)}s`;

    // Tabloyu doldur
    historyTableBody.innerHTML = "";
    data.attempts.forEach((att, idx) => {
      const tr = document.createElement("tr");
      const recordBadge = att.isRecord 
        ? `<span class="rank-badge best">★ REKOR</span>` 
        : `<span class="rank-badge">#${data.attempts.length - idx}</span>`;
      
      const reflexVal = att.reflex !== undefined ? att.reflex : att.firstInput;

      tr.innerHTML = `
        <td>${data.attempts.length - idx}</td>
        <td style="color:#94a3b8;">${att.timestamp}</td>
        <td><strong class="history-time-val ${att.isRecord ? 'is-record' : ''}">${reflexVal.toFixed(3)}s</strong></td>
        <td>${att.submit}s</td>
        <td>${att.total.toFixed(3)}s</td>
        <td>${recordBadge}</td>
      `;
      historyTableBody.appendChild(tr);
    });
  } else {
    lastTimeDisplay.textContent = "--";
    avgTimeDisplay.textContent = "--";
    historyTableBody.innerHTML = `<tr class="empty-row"><td colspan="6">Henüz pratik denemesi yapılmadı. F5 atıp bookmarklet'e tıklayın!</td></tr>`;
  }
}

function clearStats() {
  if (confirm("Tüm istatistikleri ve rekorları sıfırlamak istediğinize emin misiniz?")) {
    localStorage.removeItem(STORAGE_KEY);
    loadStats();
    showToast("İstatistikler sıfırlandı.", "info");
  }
}

// --- Bookmarklet Kod Oluşturucu & Link Güncelleyici ---
function generateBookmarkletCode(valuesArray) {
  const valuesStr = JSON.stringify(valuesArray);
  return `javascript:(function(){if(window._autoFillInterval){clearInterval(window._autoFillInterval);window._autoFillInterval=null;return;}var values=${valuesStr};function isVisible(el){let style=window.getComputedStyle(el);if(style.display==='none'||style.visibility==='hidden')return false;let parent=el.parentElement;while(parent){let pStyle=window.getComputedStyle(parent);if(pStyle.display==='none'||pStyle.visibility==='hidden')return false;parent=parent.parentElement;}return true;}function fillAndSubmit(){let inputs=document.querySelectorAll("input[type='number']");let count=0;inputs.forEach(input=>{if(isVisible(input)&&count<values.length){input.value=values[count];input.dispatchEvent(new Event("input",{bubbles:true}));count++;}});setTimeout(function(){let submitBtn=document.querySelector('button[type="submit"]:not([disabled])');if(submitBtn){submitBtn.click();setTimeout(function(){let footer=document.querySelector(".card-footer.d-flex.justify-content-end");if(footer){let buttons=footer.getElementsByTagName("button");if(buttons.length>1)buttons[1].click();}},50);}},50);}fillAndSubmit();window._autoFillInterval=setInterval(fillAndSubmit,3000);})();`;
}

function updateBookmarkletLink() {
  const code = generateBookmarkletCode(currentCrnValues);
  bookmarkletLink.setAttribute("href", code);
  customCrnInput.value = currentCrnValues.join(", ");
}

// --- Simülasyon Butonu (Bookmarklet'i Doğrudan Çalıştırır) ---
function simulateBookmarkletAction() {
  const code = generateBookmarkletCode(currentCrnValues);
  // Doğrudan aynı bookmarklet fonksiyonunu yürüt
  const execCode = code.replace(/^javascript:/, '');
  try {
    const fn = new Function(execCode);
    fn();
    showToast("Bookmarklet kodu yürütüldü!", "info");
  } catch (err) {
    console.error("Bookmarklet simülasyon hatası:", err);
  }
}

// --- CRN Düzenleme Modalı ---
function openEditorModal() {
  editorModal.style.display = "flex";
}

function closeEditorModal() {
  editorModal.style.display = "none";
}

function saveCustomCrn() {
  const raw = customCrnInput.value;
  const parsed = raw.split(/[\s,]+/)
    .map(n => parseInt(n.trim(), 10))
    .filter(n => !isNaN(n) && n > 0);

  if (parsed.length === 0) {
    alert("Lütfen en az bir geçerli CRN numarası girin!");
    return;
  }

  currentCrnValues = parsed;
  updateBookmarkletLink();
  closeEditorModal();
  showToast(`Bookmarklet güncellendi! (${parsed.length} adet CRN)`, "success");
}

// --- Kopyalama İşlemi ---
function copyBookmarkletCode() {
  const code = generateBookmarkletCode(currentCrnValues);
  navigator.clipboard.writeText(code).then(() => {
    showToast("Bookmarklet kodu panoya kopyalandı! Yer imi URL alanına yapıştırabilirsiniz.", "success");
  }).catch(() => {
    prompt("Kodu kopyalayın:", code);
  });
}

// --- Toast Bildirimleri ---
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✓' : 'ℹ'}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = "opacity 0.3s ease, transform 0.3s ease";
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// --- Canlı Saat Göstergesi (10:00:00 Pratiği İçin) ---
function startLiveClock() {
  function update() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    systemClock.textContent = `${h}:${m}:${s}.${ms}`;
    requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

// --- Basit ve Hafif Canvas Konfeti Efekti ---
function launchConfetti() {
  let canvas = document.getElementById("confettiCanvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "confettiCanvas";
    document.body.appendChild(canvas);
  }

  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const pieces = [];
  const colors = ["#c89d3d", "#ffffff", "#38bdf8", "#10b981", "#fbbf24", "#f43f5e"];

  for (let i = 0; i < 90; i++) {
    pieces.push({
      x: canvas.width / 2,
      y: canvas.height / 2,
      w: Math.random() * 9 + 4,
      h: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 14,
      vy: (Math.random() - 0.7) * 16,
      rot: Math.random() * 360,
      vrot: (Math.random() - 0.5) * 8,
      opacity: 1
    });
  }

  let frame = 0;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;

    pieces.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // Yer çekimi
      p.rot += p.vrot;
      p.opacity -= 0.012;

      if (p.opacity > 0) {
        alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
    });

    frame++;
    if (alive && frame < 120) {
      requestAnimationFrame(animate);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.remove();
    }
  }
  requestAnimationFrame(animate);
}

// --- Event Listeners Kurulumu ---
function setupEventListeners() {
  // Sıfırla ve F5 Butonları
  resetBtn.addEventListener("click", () => resetBenchmark(true));
  realF5Btn.addEventListener("click", () => window.location.reload());
  simulateBookmarkletBtn.addEventListener("click", simulateBookmarkletAction);

  // Klavye Kısayolları (Space veya R ile hızlı sıfırlama)
  window.addEventListener("keydown", (e) => {
    // Modal veya input içindeyken Space tuşunu engelleme
    if (document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA")) {
      return;
    }
    if (e.code === "Space" || e.key.toLowerCase() === "r") {
      e.preventDefault();
      resetBenchmark(true);
    }
  });

  // Modal Butonları
  modalCancelBtn.addEventListener("click", closeConfirmationModal);
  closeModalCrossBtn.addEventListener("click", closeConfirmationModal);
  
  // CRITICAL: modalConfirmBtn is buttons[1] inside .card-footer.d-flex.justify-content-end
  modalConfirmBtn.addEventListener("click", handleFinalConfirm);

  // Bookmarklet Yardımcıları
  copyCodeBtn.addEventListener("click", copyBookmarkletCode);
  editValuesBtn.addEventListener("click", openEditorModal);
  saveCustomCrnBtn.addEventListener("click", saveCustomCrn);
  editorCancelBtn.addEventListener("click", closeEditorModal);
  closeEditorCrossBtn.addEventListener("click", closeEditorModal);

  // İstatistik Temizle
  clearStatsBtn.addEventListener("click", clearStats);

  // Sayfa Yenilendiğinde (Gerçek F5 Testi yapıldığında da) süre sayımı başlasın
  window.addEventListener("beforeunload", () => {
    if (window._autoFillInterval) {
      clearInterval(window._autoFillInterval);
    }
  });
}

// --- Başlatma ---
document.addEventListener("DOMContentLoaded", () => {
  renderCrnInputs();
  updateBookmarkletLink();
  loadStats();
  setupEventListeners();
  startLiveClock();
  startTimerLoop();
});
