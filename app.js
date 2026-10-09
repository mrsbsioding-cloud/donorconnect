/* ===== DonorConnect — aplikasi vanilla JS ===== */
(function () {
  "use strict";

  const STORAGE_KEY = "donorconnect-data-v1";

  const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

  // Daftar kota besar Indonesia (ibukota provinsi + kota besar)
  const CITIES = [
    "Jakarta", "Bogor", "Depok", "Tangerang", "Bekasi", "Bandung", "Cirebon",
    "Semarang", "Solo", "Yogyakarta", "Surabaya", "Malang", "Denpasar", "Mataram",
    "Kupang", "Pontianak", "Banjarmasin", "Palangkaraya", "Samarinda", "Balikpapan",
    "Makassar", "Palu", "Kendari", "Gorontalo", "Manado", "Ambon", "Ternate",
    "Sofifi", "Jayapura", "Manokwari", "Merauke", "Medan", "Padang", "Palembang",
    "Pekanbaru", "Jambi", "Bengkulu", "Bandar Lampung", "Pangkal Pinang",
    "Tanjung Pinang", "Batam", "Banda Aceh", "Serang", "Mamuju",
  ];

  const EMPTY_DATA = { donors: [], requests: [] };

  const ADMIN_PASSWORD = "admin123";
  const ADMIN_SESSION_KEY = "donorconnect-admin-session";

  let isAdmin = false;
  let currentView = "landing";

  /** @type {{donors: Array, requests: Array}} */
  let data = load();

  /* ===== Penyimpanan ===== */

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredCloneSafe(EMPTY_DATA);
      const parsed = JSON.parse(raw);
      return normalizeData(parsed);
    } catch (err) {
      console.error("Gagal memuat data:", err);
      return structuredCloneSafe(EMPTY_DATA);
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error("Gagal menyimpan data:", err);
      showToast("Gagal menyimpan ke localStorage", true);
    }
  }

  function structuredCloneSafe(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function normalizeData(obj) {
    const donors = Array.isArray(obj && obj.donors)
      ? obj.donors.filter(isValidDonor).map((d) => ({ ...d, verified: !!d.verified }))
      : [];
    const requests = Array.isArray(obj && obj.requests) ? obj.requests.filter(isValidRequest) : [];
    return { donors, requests };
  }

  function isValidDonor(d) {
    return d && typeof d.name === "string" && BLOOD_TYPES.includes(d.blood);
  }

  function isValidRequest(r) {
    return r && typeof r.patientName === "string" && BLOOD_TYPES.includes(r.blood);
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ===== Elemen DOM ===== */

  const $ = (id) => document.getElementById(id);

  const els = {
    statDonors: $("stat-donors"),
    statVerifiedDonors: $("stat-verified-donors"),
    donorCount: $("donor-count"),
    requestCount: $("request-count"),
    filterBlood: $("filter-blood"),
    filterCity: $("filter-city"),
    donorTbody: $("donor-tbody"),
    formDonor: $("form-donor"),
    donorName: $("donor-name"),
    donorBlood: $("donor-blood"),
    donorCity: $("donor-city"),
    donorPhone: $("donor-phone"),
    donorLast: $("donor-last"),
    formRequest: $("form-request"),
    reqName: $("req-name"),
    reqBlood: $("req-blood"),
    reqHospital: $("req-hospital"),
    reqCity: $("req-city"),
    reqContact: $("req-contact"),
    reqUrgency: $("req-urgency"),
    requestList: $("request-list"),
    btnExport: $("btn-export"),
    btnImport: $("btn-import"),
    importFile: $("import-file"),
    toast: $("toast"),
    viewLanding: $("view-landing"),
    viewDonor: $("view-donor"),
    viewSeeker: $("view-seeker"),
    viewAdmin: $("view-admin"),
    btnRoleDonor: $("btn-role-donor"),
    btnRoleSeeker: $("btn-role-seeker"),
    btnRoleAdmin: $("btn-role-admin"),
    btnLogout: $("btn-logout"),
    loginModal: $("login-modal"),
    adminPassword: $("admin-password"),
    loginError: $("login-error"),
    btnLoginSubmit: $("btn-login-submit"),
    btnLoginCancel: $("btn-login-cancel"),
    btnExportReport: $("btn-export-report"),
    adminStatDonors: $("admin-stat-donors"),
    adminStatVerified: $("admin-stat-verified"),
    adminStatRequests: $("admin-stat-requests"),
    adminStatActive: $("admin-stat-active"),
    adminCityTbody: $("admin-city-tbody"),
    adminBloodTbody: $("admin-blood-tbody"),
    adminDonorTbody: $("admin-donor-tbody"),
    adminRequestTbody: $("admin-request-tbody"),
    adminDonorCount: $("admin-donor-count"),
    adminRequestCount: $("admin-request-count"),
  };

  /* ===== Util tampilan ===== */

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  }

  let toastTimer = null;
  function showToast(message, isError) {
    els.toast.textContent = message;
    els.toast.classList.toggle("error", !!isError);
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2600);
  }

  /* ===== Filter ===== */

  function syncFilterOptions() {
    fillBloodSelect(els.filterBlood, "Semua");

    // Kota: daftar tetap 44 kota besar + kota lain yang mungkin ada di data (mis. hasil import)
    const curCity = els.filterCity.value;
    const extras = Array.from(
      new Set(data.donors.map((d) => d.city).filter((c) => c && !CITIES.includes(c)))
    ).sort((a, b) => a.localeCompare(b, "id"));
    const cities = CITIES.concat(extras);
    els.filterCity.innerHTML =
      '<option value="">Semua</option>' +
      cities.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
    els.filterCity.value = cities.includes(curCity) ? curCity : "";
  }

  function filteredDonors() {
    const blood = els.filterBlood.value;
    const city = els.filterCity.value;
    return data.donors
      .filter((d) => (!blood || d.blood === blood) && (!city || d.city === city))
      .sort((a, b) => a.name.localeCompare(b.name, "id"));
  }

  /* ===== Render ===== */

  function renderStats() {
    const verified = data.donors.filter((d) => d.verified).length;
    els.statDonors.textContent = data.donors.length;
    els.statVerifiedDonors.textContent = verified;
    els.donorCount.textContent = data.donors.length;
  }

  function renderDonors() {
    const list = filteredDonors();
    if (!list.length) {
      const msg = data.donors.length
        ? "Tidak ada pendonor yang cocok dengan filter."
        : "Belum ada pendonor terdaftar.";
      els.donorTbody.innerHTML = `<tr><td colspan="6" class="empty">${msg}</td></tr>`;
      return;
    }
    els.donorTbody.innerHTML = list
      .map(
        (d) => `
      <tr>
        <td>${escapeHtml(d.name)}<br><span class="chip-verify ${d.verified ? "yes" : "no"}">${d.verified ? "Terverifikasi" : "Belum Terverifikasi"}</span></td>
        <td><span class="blood-chip">${escapeHtml(d.blood)}</span></td>
        <td>${escapeHtml(d.city)}</td>
        <td>${escapeHtml(d.phone)}</td>
        <td>${formatDate(d.lastDonation)}</td>
        <td><button class="btn btn-sm" data-action="delete-donor" data-id="${d.id}" type="button">Hapus</button></td>
      </tr>`
      )
      .join("");
  }

  function renderRequests() {
    // Halaman pencari donor hanya menampilkan permintaan yang masih AKTIF
    const list = data.requests
      .filter((r) => r.status === "aktif")
      .sort((a, b) => b.createdAt - a.createdAt);

    els.requestCount.textContent = list.length;

    if (!list.length) {
      els.requestList.innerHTML = '<p class="empty">Belum ada permintaan donor.</p>';
      return;
    }

    els.requestList.innerHTML = list
      .map((r) => {
        const done = r.status !== "aktif";
        return `
        <div class="request-card urgensi-${escapeHtml(r.urgency)}${done ? " done" : ""}">
          <div class="request-top">
            <span class="request-name">${escapeHtml(r.patientName)}</span>
            <span class="urgency-tag">${escapeHtml(r.urgency)}${done ? " · Selesai" : ""}</span>
          </div>
          <div class="request-meta">
            <div><strong>Gol. darah:</strong> ${escapeHtml(r.blood)}</div>
            <div><strong>RS:</strong> ${escapeHtml(r.hospital)} · ${escapeHtml(r.city)}</div>
            <div><strong>Kontak:</strong> ${escapeHtml(r.contact)}</div>
          </div>
          <div class="request-actions">
            <button class="btn btn-sm" data-action="toggle-request" data-id="${r.id}" type="button">
              ${done ? "Aktifkan" : "Tandai Selesai"}
            </button>
            <button class="btn btn-sm" data-action="delete-request" data-id="${r.id}" type="button">Hapus</button>
          </div>
        </div>`;
      })
      .join("");
  }

  function renderAll() {
    syncFilterOptions();
    renderStats();
    renderDonors();
    renderRequests();
    renderAdmin();
  }

  /* ===== Select golongan darah ===== */

  function fillBloodSelect(select, placeholder) {
    const cur = select.value;
    const head = placeholder ? `<option value="">${placeholder}</option>` : "";
    select.innerHTML = head + BLOOD_TYPES.map((b) => `<option value="${b}">${b}</option>`).join("");
    if (BLOOD_TYPES.includes(cur)) select.value = cur;
  }

  function fillCitySelect(select, placeholder) {
    const cur = select.value;
    const head = placeholder ? `<option value="">${placeholder}</option>` : "";
    select.innerHTML = head + CITIES.map((c) => `<option value="${c}">${c}</option>`).join("");
    if (CITIES.includes(cur)) select.value = cur;
  }

  /* ===== Aksi ===== */

  function addDonor(e) {
    e.preventDefault();
    const donor = {
      id: uid(),
      name: els.donorName.value.trim(),
      blood: els.donorBlood.value,
      city: els.donorCity.value.trim(),
      phone: els.donorPhone.value.trim(),
      lastDonation: els.donorLast.value || "",
      verified: false,
      createdAt: Date.now(),
    };
    if (!donor.name || !donor.blood || !donor.city || !donor.phone) {
      showToast("Mohon lengkapi nama, gol. darah, kota, dan no. HP", true);
      return;
    }
    data.donors.push(donor);
    save();
    els.formDonor.reset();
    els.donorBlood.value = BLOOD_TYPES[0];
    renderAll();
    showToast(`Terima kasih, ${donor.name}! Anda terdaftar sebagai pendonor 🩸`);
  }

  function addRequest(e) {
    e.preventDefault();
    const req = {
      id: uid(),
      patientName: els.reqName.value.trim(),
      blood: els.reqBlood.value,
      hospital: els.reqHospital.value.trim(),
      city: els.reqCity.value.trim(),
      contact: els.reqContact.value.trim(),
      urgency: els.reqUrgency.value,
      status: "aktif",
      createdAt: Date.now(),
    };
    if (!req.patientName || !req.blood || !req.hospital || !req.city || !req.contact || !req.urgency) {
      showToast("Mohon lengkapi semua kolom permintaan", true);
      return;
    }
    data.requests.push(req);
    save();
    els.formRequest.reset();
    els.reqBlood.value = "";
    els.reqUrgency.value = "";
    renderAll();
    showToast(`Permintaan untuk ${req.patientName} dibuat`);
  }

  function deleteDonor(id) {
    const d = data.donors.find((x) => x.id === id);
    if (!d) return;
    if (!confirm(`Hapus pendonor "${d.name}"?`)) return;
    data.donors = data.donors.filter((x) => x.id !== id);
    save();
    renderAll();
    showToast("Pendonor dihapus");
  }

  function toggleRequest(id) {
    const r = data.requests.find((x) => x.id === id);
    if (!r) return;
    r.status = r.status === "aktif" ? "selesai" : "aktif";
    save();
    renderAll();
    showToast(r.status === "aktif" ? "Permintaan diaktifkan kembali" : "Permintaan ditandai selesai");
  }

  function deleteRequest(id) {
    const r = data.requests.find((x) => x.id === id);
    if (!r) return;
    if (!confirm(`Hapus permintaan untuk "${r.patientName}"?`)) return;
    data.requests = data.requests.filter((x) => x.id !== id);
    save();
    renderAll();
    showToast("Permintaan dihapus");
  }

  /* ===== Export / Import JSON ===== */

  function downloadJson(payload, filename) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportJson() {
    const payload = {
      app: "DonorConnect",
      version: 1,
      exportedAt: new Date().toISOString(),
      donors: data.donors,
      requests: data.requests,
    };
    downloadJson(payload, `donorconnect-${new Date().toISOString().slice(0, 10)}.json`);
    showToast("Data berhasil diexport");
  }

  function exportReport() {
    const report = {
      app: "DonorConnect",
      type: "laporan-admin",
      version: 1,
      exportedAt: new Date().toISOString(),
      summary: {
        totalDonors: data.donors.length,
        verifiedDonors: data.donors.filter((d) => d.verified).length,
        totalRequests: data.requests.length,
        activeRequests: data.requests.filter((r) => r.status === "aktif").length,
        byCity: Object.fromEntries(donorStatsByCity()),
        byBlood: Object.fromEntries(donorStatsByBlood()),
      },
      donors: data.donors,
      requests: data.requests,
    };
    downloadJson(report, `donorconnect-laporan-${new Date().toISOString().slice(0, 10)}.json`);
    showToast("Laporan admin berhasil diexport");
  }

  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || typeof parsed !== "object" || (!Array.isArray(parsed.donors) && !Array.isArray(parsed.requests))) {
          showToast("Format file tidak valid", true);
          return;
        }
        const incoming = normalizeData(parsed);
        const total = incoming.donors.length + incoming.requests.length;
        if (!total) {
          showToast("File tidak berisi data yang bisa diimpor", true);
          return;
        }
        if (!confirm(`Impor ${incoming.donors.length} pendonor dan ${incoming.requests.length} permintaan? Data saat ini akan diganti.`)) return;
        data = incoming;
        save();
        renderAll();
        showToast("Data berhasil diimpor");
      } catch (err) {
        console.error(err);
        showToast("Gagal membaca file JSON", true);
      }
    };
    reader.onerror = () => showToast("Gagal membaca file", true);
    reader.readAsText(file);
  }

  /* ===== Admin ===== */

  function donorStatsByCity() {
    const map = new Map();
    data.donors.forEach((d) => {
      const city = d.city || "-";
      map.set(city, (map.get(city) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "id"));
  }

  function donorStatsByBlood() {
    const map = {};
    BLOOD_TYPES.forEach((b) => (map[b] = 0));
    data.donors.forEach((d) => {
      if (map[d.blood] !== undefined) map[d.blood] += 1;
    });
    return BLOOD_TYPES.map((b) => [b, map[b]]);
  }

  function renderAdmin() {
    const verified = data.donors.filter((d) => d.verified).length;
    const active = data.requests.filter((r) => r.status === "aktif").length;

    els.adminStatDonors.textContent = data.donors.length;
    els.adminStatVerified.textContent = verified;
    els.adminStatRequests.textContent = data.requests.length;
    els.adminStatActive.textContent = active;
    els.adminDonorCount.textContent = data.donors.length;
    els.adminRequestCount.textContent = data.requests.length;

    // Pendonor per kota
    const byCity = donorStatsByCity();
    els.adminCityTbody.innerHTML = byCity.length
      ? byCity
          .map(([city, n]) => `<tr><td>${escapeHtml(city)}</td><td><strong>${n}</strong></td></tr>`)
          .join("")
      : '<tr><td colspan="2" class="empty">Belum ada data pendonor.</td></tr>';

    // Pendonor per golongan darah (semua gol)
    els.adminBloodTbody.innerHTML = donorStatsByBlood()
      .map(([b, n]) => `<tr><td><span class="blood-chip">${b}</span></td><td><strong>${n}</strong></td></tr>`)
      .join("");

    // Semua pendonor
    els.adminDonorTbody.innerHTML = data.donors.length
      ? data.donors
          .map(
            (d) => `
      <tr>
        <td>${escapeHtml(d.name)}</td>
        <td><span class="blood-chip">${escapeHtml(d.blood)}</span></td>
        <td>${escapeHtml(d.city)}</td>
        <td>${escapeHtml(d.phone)}</td>
        <td>${formatDate(d.lastDonation)}</td>
        <td><span class="badge ${d.verified ? "badge-green" : "badge-gray"}">${d.verified ? "Terverifikasi" : "Belum Terverifikasi"}</span></td>
        <td class="admin-actions">
          <button class="btn btn-admin-sm" data-action="toggle-verify" data-id="${d.id}" type="button">${d.verified ? "Batalkan" : "Verifikasi"}</button>
          <button class="btn btn-sm" data-action="delete-donor" data-id="${d.id}" type="button">Hapus</button>
        </td>
      </tr>`
          )
          .join("")
      : '<tr><td colspan="7" class="empty">Belum ada pendonor.</td></tr>';

    // Semua request
    els.adminRequestTbody.innerHTML = data.requests.length
      ? data.requests
          .map(
            (r) => `
      <tr>
        <td>${escapeHtml(r.patientName)}</td>
        <td><span class="blood-chip">${escapeHtml(r.blood)}</span></td>
        <td>${escapeHtml(r.hospital)}</td>
        <td>${escapeHtml(r.city)}</td>
        <td>${escapeHtml(r.contact)}</td>
        <td><span class="urgency-tag tag-${escapeHtml(r.urgency)}">${escapeHtml(r.urgency)}</span></td>
        <td><span class="badge ${r.status === "aktif" ? "badge-blue" : "badge-gray"}">${r.status === "aktif" ? "Aktif" : "Selesai"}</span></td>
        <td class="admin-actions">
          <button class="btn btn-admin-sm" data-action="toggle-request" data-id="${r.id}" type="button">${r.status === "aktif" ? "Tandai Selesai" : "Aktifkan"}</button>
          <button class="btn btn-sm" data-action="delete-request" data-id="${r.id}" type="button">Hapus</button>
        </td>
      </tr>`
          )
          .join("")
      : '<tr><td colspan="8" class="empty">Belum ada permintaan donor.</td></tr>';
  }

  function showView(name) {
    if (name === "admin" && !isAdmin) name = "landing";
    currentView = name;
    els.viewLanding.hidden = name !== "landing";
    els.viewDonor.hidden = name !== "donor";
    els.viewSeeker.hidden = name !== "seeker";
    els.viewAdmin.hidden = name !== "admin";
  }

  function applyAdminChrome() {
    document.body.classList.toggle("admin-mode", isAdmin);
    if (!isAdmin && currentView === "admin") showView("landing");
  }

  function openLogin() {
    els.loginError.hidden = true;
    els.adminPassword.value = "";
    els.loginModal.hidden = false;
    els.adminPassword.focus();
  }

  function closeLogin() {
    els.loginModal.hidden = true;
  }

  function tryLogin() {
    if (els.adminPassword.value === ADMIN_PASSWORD) {
      isAdmin = true;
      try { sessionStorage.setItem(ADMIN_SESSION_KEY, "1"); } catch (err) { /* ignore */ }
      closeLogin();
      applyAdminChrome();
      renderAll();
      showView("admin");
      showToast("Login berhasil. Selamat datang, Pengelola PMI");
    } else {
      els.loginError.hidden = false;
      els.adminPassword.focus();
    }
  }

  function logout() {
    isAdmin = false;
    try { sessionStorage.removeItem(ADMIN_SESSION_KEY); } catch (err) { /* ignore */ }
    applyAdminChrome();
    showView("landing");
    showToast("Anda telah logout dari mode admin");
  }

  function toggleVerify(id) {
    const d = data.donors.find((x) => x.id === id);
    if (!d) return;
    d.verified = !d.verified;
    save();
    renderAll();
    showToast(d.verified ? `${d.name} ditandai Terverifikasi` : `Verifikasi ${d.name} dibatalkan`);
  }

  /* ===== Event binding ===== */

  els.formDonor.addEventListener("submit", addDonor);
  els.formRequest.addEventListener("submit", addRequest);

  els.filterBlood.addEventListener("change", renderDonors);
  els.filterCity.addEventListener("change", renderDonors);

  els.donorTbody.addEventListener("click", (e) => {
    const btn = e.target.closest('[data-action="delete-donor"]');
    if (btn) deleteDonor(btn.dataset.id);
  });

  els.requestList.addEventListener("click", (e) => {
    const toggle = e.target.closest('[data-action="toggle-request"]');
    if (toggle) return toggleRequest(toggle.dataset.id);
    const del = e.target.closest('[data-action="delete-request"]');
    if (del) deleteRequest(del.dataset.id);
  });

  els.btnExport.addEventListener("click", exportJson);
  els.btnImport.addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", () => {
    const file = els.importFile.files && els.importFile.files[0];
    if (file) importJson(file);
    els.importFile.value = "";
  });

  // Navigasi landing & role
  els.btnRoleDonor.addEventListener("click", () => showView("donor"));
  els.btnRoleSeeker.addEventListener("click", () => showView("seeker"));
  els.btnRoleAdmin.addEventListener("click", () => {
    if (isAdmin) {
      showView("admin");
      showToast("Sesi admin masih aktif");
    } else {
      openLogin();
    }
  });
  document.addEventListener("click", (e) => {
    const back = e.target.closest('[data-action="back-home"]');
    if (back) showView("landing");
  });
  els.btnLoginCancel.addEventListener("click", closeLogin);
  els.btnLoginSubmit.addEventListener("click", tryLogin);
  els.btnLogout.addEventListener("click", logout);
  els.btnExportReport.addEventListener("click", exportReport);
  els.adminPassword.addEventListener("keydown", (e) => {
    if (e.key === "Enter") tryLogin();
  });
  els.loginModal.addEventListener("click", (e) => {
    if (e.target === els.loginModal) closeLogin();
  });

  els.adminDonorTbody.addEventListener("click", (e) => {
    const verify = e.target.closest('[data-action="toggle-verify"]');
    if (verify) return toggleVerify(verify.dataset.id);
    const del = e.target.closest('[data-action="delete-donor"]');
    if (del) deleteDonor(del.dataset.id);
  });

  els.adminRequestTbody.addEventListener("click", (e) => {
    const toggle = e.target.closest('[data-action="toggle-request"]');
    if (toggle) return toggleRequest(toggle.dataset.id);
    const del = e.target.closest('[data-action="delete-request"]');
    if (del) deleteRequest(del.dataset.id);
  });

  /* ===== Init ===== */

  fillBloodSelect(els.donorBlood, null);
  els.donorBlood.value = BLOOD_TYPES[0];
  fillCitySelect(els.donorCity, "Pilih kota…");
  fillBloodSelect(els.reqBlood, "Pilih…");
  fillBloodSelect(els.filterBlood, "Semua");
  fillCitySelect(els.filterCity, "Semua");

  try {
    isAdmin = sessionStorage.getItem(ADMIN_SESSION_KEY) === "1";
  } catch (err) {
    isAdmin = false;
  }
  applyAdminChrome();
  showView("landing");
  renderAll();
})();
