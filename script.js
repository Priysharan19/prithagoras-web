"use strict";
/**
 * Prithagoras public resource library.
 * Publication source of truth: resources.json in this GitHub repository.
 * No secret API keys, tracking scripts or fake submission controls.
 */
let resources = [];
let activeFilter = "all";
let activeSearch = "";
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const safe = (text) => String(text ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const trustedUrl = (value) => {
  try { const url = new URL(value, window.location.href); return ["https:","http:"].includes(url.protocol) ? url.href : "#"; }
  catch { return "#"; }
};
const filtered = () => resources.filter(resource => {
  const inFilter = activeFilter === "all" || resource.type === activeFilter;
  const inSearch = [resource.title,resource.subtitle,resource.description,resource.subject,resource.year,...(resource.tags||[])].join(" ").toLowerCase().includes(activeSearch.trim().toLowerCase());
  return inFilter && inSearch;
});
const resourceHref = (r) => "./?resource=" + encodeURIComponent(r.id);
const resourceArt = () => '<div class="resource-art"><span class="resource-art-top">PR / MATHS 2027</span><span class="resource-art-glyph">∑<span style="font-size:.52em;vertical-align:top">∞</span></span><svg class="resource-art-wave" viewBox="0 0 200 55" aria-hidden="true"><path d="M0 40 C22 40 20 9 44 9 S75 44 98 40 S137 9 158 9 S182 41 200 38"/></svg><span class="resource-art-bottom"><span>ORIGINAL EXAM</span><span>∎ 001</span></span></div>';
function renderResources() {
  const list = $("#resource-list"), meta = $("#results-meta");
  if (!list || !meta) return;
  const items = filtered();
  meta.textContent = "Showing " + items.length + " " + (items.length === 1 ? "resource" : "resources");
  const totalCount = $("#all-count");
  if (totalCount) totalCount.textContent = String(resources.length).padStart(2,"0");
  if (items.length === 0) {
    list.innerHTML = '<div class="empty-state"><strong>No resources found.</strong><span>Try a broader search or another category.</span><button type="button" id="reset-filter">Clear filters</button></div>';
    $("#reset-filter").addEventListener("click",()=>{ activeFilter="all";activeSearch="";$("#resource-search").value="";setFilterButtons();renderResources();});
    return;
  }
  list.innerHTML = items.map(r => `
    <article class="resource-card">
      ${resourceArt()}
      <div class="resource-card-copy">
        <div class="resource-card-topline"><span>${safe(r.grade || "HSC")}</span><i></i><span>${safe(r.year)}</span><i></i><span>${safe((r.type || "resource").toUpperCase())}</span></div>
        <h3>${safe(r.title)}</h3><p>${safe(r.description)}</p>
        <div class="resource-chips">${(r.tags||[]).slice(0,3).map(tag=>'<span class="chip">'+safe(tag)+'</span>').join("")}</div>
      </div>
      <div class="resource-open"><span class="resource-arrow" aria-hidden="true">↗</span></div>
      <a href="${resourceHref(r)}" data-open-resource="${safe(r.id)}" class="resource-hit" aria-label="View ${safe(r.title)}"></a>
    </article>`).join("");
  $$("[data-open-resource]",list).forEach(link => link.addEventListener("click",event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openResource(link.dataset.openResource, true);
  }));
}
function setFilterButtons() {
  $$(".filter-button").forEach(button => {
    const selected = button.dataset.filter === activeFilter;
    button.classList.toggle("active",selected);
    button.setAttribute("aria-pressed",String(selected));
  });
}
function showToast(message) {
  const el = $("#toast");
  el.textContent=message;
  el.classList.add("visible");
  clearTimeout(showToast.timer);
  showToast.timer=setTimeout(()=>el.classList.remove("visible"),2600);
}
function openResource(id, changeHistory=false) {
  const r = resources.find(resource => resource.id === id);
  if (!r) { showToast("That resource is not available.");return; }
  const dialog=$("#resource-dialog");
  const sourceLink=trustedUrl(r.url);
  $("#resource-dialog-body").innerHTML = `
    <div class="detail-cover"><div style="position:absolute;bottom:22px;left:36px;z-index:1;color:#c4bbff;font:11px 'Space Mono',monospace">PR / RESOURCE ${safe(String(resources.indexOf(r)+1).padStart(3,"0"))}</div></div>
    <div class="detail-content">
      <div class="detail-overline">${safe(r.grade)} / ${safe(r.subject)} / ${safe(r.year)}</div>
      <h2 id="resource-dialog-title">${safe(r.title)}</h2>
      <p>${safe(r.description)}</p>
      <div class="detail-meta">
        <span>${safe(r.marks)} MARKS</span>
        <span>${safe(r.questions)} QUESTIONS</span>
        <span>${safe(r.duration)}</span>
        <span>${safe(r.source || "PRITHAGORAS")}</span>
      </div>
      <div class="detail-links">
        <a class="detail-primary" href="${sourceLink}" target="_blank" rel="noopener noreferrer">Open resource ↗</a>
        <button id="copy-resource" type="button">Copy share link ⧉</button>
      </div>
      <p class="detail-note">${safe(r.disclaimer || "This is an independent learning resource, not an official NESA paper.")}</p>
    </div>`;
  $("#copy-resource").addEventListener("click",async ()=>{
    const link=new URL(window.location.href);
    link.searchParams.set("resource",r.id);
    link.hash="";
    try { await navigator.clipboard.writeText(link.href);showToast("Resource link copied."); }
    catch { showToast("Copy the page URL to share."); }
  });
  if (changeHistory) {
    const url=new URL(window.location.href);
    url.searchParams.set("resource",r.id);
    history.pushState({resource:id},"",url);
  }
  if(!dialog.open) dialog.showModal();
  document.body.classList.add("dialog-open");
}
function closeResource() {
  const dialog=$("#resource-dialog");
  if(dialog.open) dialog.close();
  document.body.classList.remove("dialog-open");
  const url=new URL(window.location.href);
  if(url.searchParams.has("resource")){url.searchParams.delete("resource");history.replaceState({},"",url);}
}
function paintSearchDialog() {
  const query=$("#dialog-search-input").value.trim().toLowerCase();
  const matches=resources.filter(r=>[r.title,r.description,r.subject,...(r.tags||[])].join(" ").toLowerCase().includes(query)).slice(0,7);
  const target=$("#dialog-search-results");
  target.innerHTML=matches.length ? matches.map(r=>`<button class="search-result" type="button" data-pick="${safe(r.id)}"><strong>${safe(r.title)}</strong><small>${safe(r.grade)} · ${safe(r.year)} · ${safe(r.type)}</small></button>`).join("") : '<div class="empty-state">No matching materials yet.</div>';
  $$("[data-pick]",target).forEach(button=>button.addEventListener("click",()=>{
    closeSearch();openResource(button.dataset.pick,true);
  }));
}
function openSearch() {
  const dialog=$("#search-dialog");
  if(dialog.open)return;
  $("#dialog-search-input").value="";
  paintSearchDialog();
  dialog.showModal();
  document.body.classList.add("dialog-open");
  requestAnimationFrame(()=>$("#dialog-search-input").focus());
}
function closeSearch() {
  const dialog=$("#search-dialog");if(dialog.open)dialog.close();document.body.classList.remove("dialog-open");
}
function plotPath(amplitude,phase) {
  const pts=[];
  for(let p=0;p<=620;p+=2){
    const x=(p/620)*Math.PI*4-Math.PI*2;
    const y=200-70*amplitude*Math.sin(x+phase);
    pts.push((p===0?"M":"L")+p.toFixed(1)+" "+y.toFixed(2));
  }
  return pts.join(" ");
}
function drawLab() {
  const amp=Number($("#amp-range").value),phase=Number($("#phase-range").value);
  $("#amp-value").textContent=amp.toFixed(1);
  $("#phase-value").textContent=phase.toFixed(1);
  $("#amplitude-label").textContent=amp.toFixed(1);
  $("#phase-label").textContent=phase.toFixed(1);
  $("#lab-original").setAttribute("d",plotPath(1,0));
  $("#lab-path").setAttribute("d",plotPath(amp,phase));
}
function initInteractions() {
  $("#year").textContent = String(new Date().getFullYear());
  $$(".filter-button").forEach(button=>button.addEventListener("click",()=>{activeFilter=button.dataset.filter;setFilterButtons();renderResources();}));
  $("#resource-search").addEventListener("input",event=>{activeSearch=event.target.value;renderResources();});
  $("#open-search").addEventListener("click",openSearch);
  $("#close-search").addEventListener("click",closeSearch);
  $("#dialog-search-input").addEventListener("input",paintSearchDialog);
  $("#dialog-search-input").addEventListener("keydown",event=>{
    if(event.key==="Enter") { const first=$("[data-pick]");if(first)first.click(); }
  });
  $("#search-dialog").addEventListener("close",()=>document.body.classList.remove("dialog-open"));
  $("#resource-dialog").addEventListener("close",()=>{
    document.body.classList.remove("dialog-open");
    const u=new URL(window.location.href);
    if(u.searchParams.has("resource")){u.searchParams.delete("resource");history.replaceState({},"",u);}
  });
  $("#close-resource").addEventListener("click",closeResource);
  document.addEventListener("keydown",event=>{
    if((event.key==="/" || (event.key.toLowerCase()==="k"&&(event.ctrlKey||event.metaKey))) && !/^(input|textarea|select)$/i.test(document.activeElement.tagName)){
      event.preventDefault();openSearch();
    }
  });
  window.addEventListener("popstate",()=>{
    const id=new URL(location.href).searchParams.get("resource");
    if(id)openResource(id,false);else closeResource();
  });
  const menuButton=$("#mobile-nav-toggle"), menu=$("#mobile-menu");
  menuButton.addEventListener("click",()=>{
    const expanded=menuButton.getAttribute("aria-expanded")==="true";
    menuButton.setAttribute("aria-expanded",String(!expanded));
    menu.hidden=expanded;
  });
  $$("a",menu).forEach(a=>a.addEventListener("click",()=>{menu.hidden=true;menuButton.setAttribute("aria-expanded","false");}));
  ["amp-range","phase-range"].forEach(id=>$("#"+id).addEventListener("input",drawLab));
  $("#lab-reset").addEventListener("click",()=>{$("#amp-range").value="1";$("#phase-range").value="0";drawLab();});
  drawLab();
}
async function loadResources() {
  const list=$("#resource-list");
  try {
    const resp=await fetch("./resources.json",{cache:"no-store"});
    if(!resp.ok)throw new Error("HTTP "+resp.status);
    const data=await resp.json();
    if(!Array.isArray(data.resources))throw new Error("Invalid resource index");
    resources=data.resources.filter(r=>r.id && r.title && r.url && trustedUrl(r.url)!=="#");
    renderResources();
    const id=new URL(window.location.href).searchParams.get("resource");
    if(id)openResource(id,false);
  } catch(error) {
    console.error("Resource library unavailable:",error);
    list.innerHTML='<div class="empty-state"><strong>The library is temporarily unavailable.</strong><span>Refresh the page to try again.</span></div>';
    $("#results-meta").textContent="Unable to load";
  }
}
document.addEventListener("DOMContentLoaded",()=>{initInteractions();loadResources();});
