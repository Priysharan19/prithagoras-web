"use strict";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const escapeText = value => String(value ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validUrl = value => {
  const url = String(value ?? "");
  if (/^\.\/materials\/[\w.%-]+$/i.test(url)) return url;
  try { const parsed = new URL(url); return parsed.protocol === "https:" ? parsed.href : ""; }
  catch { return ""; }
};

let resources = [];
let activeType = "all";
let activeSearch = "";
let activeResource = null;

const countLabel = count => `${count} ${count === 1 ? "resource" : "resources"}`;

function render() {
  const container = $("#resource-list");
  const matches = resources.filter(r => {
    const categoryMatch = activeType === "all" || r.type === activeType;
    const phrase = [r.title, r.description, r.subject, r.year, ...(r.tags || [])].join(" ").toLowerCase();
    return categoryMatch && phrase.includes(activeSearch);
  });
  $("#results-meta").textContent = countLabel(matches.length);
  if (matches.length === 0) {
    container.innerHTML = '<div class="empty-state"><strong>Nothing matched that search.</strong><span>Try fewer words or another category.</span><div><button type="button" id="clear-search">Clear search</button></div></div>';
    $("#clear-search").addEventListener("click", () => {
      $("#resource-search").value = "";
      activeSearch = "";
      activeType = "all";
      updateFilters();
      render();
    });
    return;
  }
  container.innerHTML = matches.map(r => {
    const tags = (r.tags || []).slice(0, 3).map(t => "<span>" + escapeText(t) + "</span>").join("");
    return `<article class="resource-row">
      <div class="resource-cover" aria-hidden="true">
        <div class="resource-cover-top"><span>PRITHAGORAS</span><span>${escapeText(r.year)}</span></div>
        <div class="resource-cover-name">${escapeText(r.subject || "Mathematics")}</div>
        <div class="resource-cover-type">${escapeText(r.type === "exam" ? "PRACTICE EXAMINATION" : r.type === "notes" ? "STUDY NOTES" : "WORKED SOLUTIONS")}</div>
        <div class="resource-cover-bottom"><span>VOLUME 01</span><span>${escapeText(r.marks || 0)} MARKS</span></div>
      </div>
      <div class="resource-main">
        <div class="resource-meta"><span>YEAR ${escapeText(r.year)}</span><i></i><span>${escapeText((r.type || "RESOURCE").toUpperCase())}</span><i></i><span>${escapeText(r.source || "Prithagoras")}</span></div>
        <h3>${escapeText(r.title)}</h3>
        <p class="resource-description">${escapeText(r.description)}</p>
        <div class="resource-tags">${tags}</div>
      </div>
      <div class="resource-go">View paper <span aria-hidden="true">↗</span></div>
      <a class="card-link" href="?resource=${encodeURIComponent(r.id)}" aria-label="View details of ${escapeText(r.title)}" data-resource-id="${escapeText(r.id)}"></a>
    </article>`;
  }).join("");
  $$("[data-resource-id]", container).forEach(link => link.addEventListener("click", event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    openDetail(link.dataset.resourceId, true);
  }));
}

function updateFilters() {
  $$(".filter").forEach(button => {
    const active = button.dataset.filter === activeType;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function updateAvailableFilters() {
  for (const type of ["exam", "solutions", "notes"]) {
    const button = $(`[data-filter="${type}"]`);
    button.hidden = !resources.some(r => r.type === type);
  }
  $("#resource-total").textContent = String(resources.length);
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("visible"), 2500);
}

function openDetail(id, pushHistory) {
  const r = resources.find(item => item.id === id);
  if (!r) { toast("That resource could not be found."); return; }
  activeResource = r;
  const link = validUrl(r.url);
  const dialog = $("#resource-dialog");
  $("#resource-dialog-body").innerHTML = `
    <div class="detail-head"><span>PRITHAGORAS / RESOURCE FILE</span><span>${escapeText(r.year)} · ${escapeText(r.type.toUpperCase())}</span></div>
    <div class="detail-body">
      <h2 class="detail-title" id="detail-title">${escapeText(r.title)}</h2>
      <p class="detail-desc">${escapeText(r.description)}</p>
      <div class="detail-data">
        <div><strong>${escapeText(r.marks || "—")}</strong><span>TOTAL MARKS</span></div>
        <div><strong>${escapeText(r.questions || "—")}</strong><span>QUESTIONS</span></div>
        <div><strong>${escapeText(r.duration || "Self-paced")}</strong><span>WORKING TIME</span></div>
      </div>
      <div class="detail-actions">
        <a href="${escapeText(link || "#")}" target="_blank" rel="noopener noreferrer" ${link ? "" : 'aria-disabled="true"'}>Open examination ↗</a>
        <button type="button" id="copy-resource">Copy link</button>
      </div>
      <p class="detail-note">${escapeText(r.disclaimer || "This independent resource is not an official NESA or school examination.")}</p>
    </div>`;
  $("#copy-resource").addEventListener("click", async () => {
    const shareUrl = new URL(location.href);
    shareUrl.searchParams.set("resource", r.id);
    shareUrl.hash = "";
    try { await navigator.clipboard.writeText(shareUrl.href); toast("Resource link copied"); }
    catch { toast("You can copy the page address to share"); }
  });
  if (pushHistory) {
    const url = new URL(location.href);
    url.searchParams.set("resource", r.id);
    history.pushState({resource: r.id}, "", url);
  }
  if (!dialog.open) dialog.showModal();
}
function closeDetail() {
  const dialog = $("#resource-dialog");
  if (dialog.open) dialog.close();
}
function cleanupDialogUrl() {
  activeResource = null;
  const url = new URL(location.href);
  if (url.searchParams.has("resource")) {
    url.searchParams.delete("resource");
    history.replaceState({}, "", url);
  }
}
async function loadLibrary() {
  try {
    const res = await fetch("./resources.json", {cache:"no-store"});
    if (!res.ok) throw new Error("HTTP " + res.status);
    const index = await res.json();
    if (!Array.isArray(index.resources)) throw new Error("Invalid resource index");
    resources = index.resources.filter(r => r.id && r.title && validUrl(r.url))
      .sort((a,b) => (b.releaseDate || "").localeCompare(a.releaseDate || ""));
    $("#library-updated").textContent = index.updated || "—";
    updateAvailableFilters();
    render();
    const deepId = new URL(location.href).searchParams.get("resource");
    if (deepId) openDetail(deepId, false);
  } catch(error) {
    console.error("Failed to load library", error);
    $("#resource-list").innerHTML = '<div class="empty-state"><strong>Library unavailable.</strong><span>Please refresh the page to try again.</span></div>';
    $("#results-meta").textContent = "Unable to load materials";
  }
}

function initialise() {
  $("#year").textContent = String(new Date().getFullYear());
  $$(".filter").forEach(button => button.addEventListener("click", () => {
    activeType = button.dataset.filter;
    updateFilters(); render();
  }));
  $("#resource-search").addEventListener("input", event => {
    activeSearch = String(event.target.value).trim().toLowerCase();
    render();
  });
  document.addEventListener("keydown", event => {
    if ((event.key === "/" || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k")) &&
      !event.altKey && !event.target.closest("input,textarea,select,[contenteditable]")) {
      event.preventDefault();
      $("#resource-search").focus();
      $("#library").scrollIntoView({block:"start",behavior:"smooth"});
    }
  });
  const toggle = $("#nav-toggle");
  const nav = $("#main-nav");
  toggle.addEventListener("click", () => {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!isOpen));
    nav.classList.toggle("open", !isOpen);
  });
  $$("a", nav).forEach(link => link.addEventListener("click", () => {
    nav.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  }));
  $("#resource-dialog").addEventListener("close", cleanupDialogUrl);
  $("#close-resource").addEventListener("click", closeDetail);
  window.addEventListener("popstate", () => {
    const id = new URL(location.href).searchParams.get("resource");
    if (id) openDetail(id, false);
    else closeDetail();
  });
  loadLibrary();
}
document.addEventListener("DOMContentLoaded", initialise);
