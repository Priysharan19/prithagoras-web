"use strict";
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
const escapeHTML=value=>String(value??"").replace(/[&<>"']/g,character=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]));
const safeUrl=value=>{
  try {
    const url=new URL(value,location.href);
    return url.protocol==="https:" || (url.protocol==="http:" && url.hostname==="localhost") ? url.href : "";
  } catch {return "";}
};

let resources=[],activeFilter="all",query="",saved=new Set(),commandIndex=0;
const BOOKMARK_KEY="prithagoras:saved:v1";
function loadSaved(){
  try{
    const value=JSON.parse(localStorage.getItem(BOOKMARK_KEY)||"[]");
    if(Array.isArray(value))saved=new Set(value.filter(v=>typeof v==="string").slice(0,500));
  }catch{saved=new Set();}
}
function storeSaved(){
  try {localStorage.setItem(BOOKMARK_KEY,JSON.stringify([...saved]));}
  catch{showToast("Bookmarks could not be saved in this browser.");}
}
function showToast(message){
  const el=$("#toast");el.textContent=message;el.classList.add("visible");
  clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>el.classList.remove("visible"),2600);
}
function resourceType(type){
  return {exam:"PRACTICE EXAM",solutions:"WORKED SOLUTIONS",notes:"STUDY NOTES"}[type]||"RESOURCE";
}
function filterResources(){
  return resources.filter(r=>{
    const correctType=activeFilter==="all"||(activeFilter==="saved"?saved.has(r.id):r.type===activeFilter);
    const terms=[r.title,r.description,r.subject,r.subtitle,r.year,...(r.tags||[])].join(" ").toLowerCase();
    return correctType && terms.includes(query.trim().toLowerCase());
  });
}
function updateFilterState(){
  $$(".filter-button").forEach(button=>{
    const isSelected=button.dataset.filter===activeFilter;
    button.classList.toggle("active",isSelected);
    button.setAttribute("aria-pressed",String(isSelected));
    if(["exam","solutions","notes"].includes(button.dataset.filter)){
      button.hidden=!resources.some(r=>r.type===button.dataset.filter);
    }
  });
  $("#saved-count").textContent=String(saved.size);
  $("#collection-count").textContent=String(resources.length).padStart(2,"0");
}
function resourceCard(r){
  const tags=(r.tags||[]).slice(0,3).map(t=>`<span>${escapeHTML(t)}</span>`).join("");
  const isSaved=saved.has(r.id);
  const exam=r.type==="exam";
  return `<article class="resource-card" data-resource-card="${escapeHTML(r.id)}">
    <div class="resource-cover" aria-hidden="true">
      <div class="resource-cover-head"><span>PRITHAGORAS</span><span>${escapeHTML(r.year)}</span></div>
      <div class="resource-cover-topic">${escapeHTML(r.subject||"Mathematics")}</div>
      <div class="resource-cover-kind">${resourceType(r.type)}</div>
      <div class="resource-cover-foot"><span>ED. 001</span><span>${escapeHTML(r.marks||0)} MARKS</span></div>
    </div>
    <div class="resource-copy">
      <div class="resource-meta"><span>YEAR ${escapeHTML(r.year)}</span><i class="meta-divider"></i><span>${resourceType(r.type)}</span><i class="meta-divider"></i><span>${escapeHTML(r.source||"Prithagoras")}</span></div>
      <h3 class="resource-title"><a href="?resource=${encodeURIComponent(r.id)}" data-resource-open="${escapeHTML(r.id)}">${escapeHTML(r.title)}</a></h3>
      <p class="resource-description">${escapeHTML(r.description)}</p>
      <div class="resource-chips">${tags}</div>
    </div>
    <div class="resource-actions">
      <button class="resource-save ${isSaved?"saved":""}" type="button" data-save-id="${escapeHTML(r.id)}" aria-pressed="${isSaved}" aria-label="${isSaved?"Remove saved resource":"Save resource"}: ${escapeHTML(r.title)}">${isSaved?"★ Saved":"☆ Save"}</button>
      <div class="resource-actions-bottom"><a class="resource-open" href="?resource=${encodeURIComponent(r.id)}" data-resource-open="${escapeHTML(r.id)}">Details ↗</a>${exam?`<a class="resource-practice" href="./desk.html?resource=${encodeURIComponent(r.id)}">Exam Desk →</a>`:""}</div>
    </div>
  </article>`;
}
function renderLibrary(){
  const matches=filterResources();
  $("#results-meta").textContent=`${matches.length} ${matches.length===1?"material":"materials"} found`;
  if(!matches.length){
    $("#resource-list").innerHTML='<div class="empty-state"><strong>No matching materials.</strong><div>Try a different search or resource type.</div><button id="clear-filters" type="button">Clear filters</button></div>';
    $("#clear-filters").addEventListener("click",()=>{activeFilter="all";query="";$("#resource-search").value="";updateFilterState();renderLibrary();});
    return;
  }
  $("#resource-list").innerHTML=matches.map(resourceCard).join("");
  $$("[data-save-id]",$("#resource-list")).forEach(button=>button.addEventListener("click",()=>{
    const id=button.dataset.saveId;
    if(saved.has(id))saved.delete(id);else saved.add(id);
    storeSaved();updateFilterState();renderLibrary();
    showToast(saved.has(id)?"Resource saved on this device.":"Removed from saved resources.");
  }));
  $$("[data-resource-open]",$("#resource-list")).forEach(link=>link.addEventListener("click",event=>{
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();openDetail(link.dataset.resourceOpen,true);
  }));
}
function openDetail(id,updateHistory=false){
  const r=resources.find(item=>item.id===id);
  if(!r){showToast("This resource is not published.");return;}
  const link=safeUrl(r.url);
  const content=$("#resource-dialog-body");
  content.innerHTML=`<div class="detail-head"><span>RESOURCE / ${escapeHTML(r.year)}</span><span>${resourceType(r.type)}</span></div>
  <div class="detail-body">
    <h2 id="detail-title" class="detail-title">${escapeHTML(r.title)}</h2>
    <p class="detail-desc">${escapeHTML(r.description)}</p>
    <div class="detail-data"><div><strong>${escapeHTML(r.marks||"—")}</strong><span>MARKS</span></div><div><strong>${escapeHTML(r.questions||"—")}</strong><span>QUESTIONS</span></div><div><strong>${escapeHTML(r.duration||"—")}</strong><span>DURATION</span></div></div>
    <div class="detail-actions">
      ${link?`<a target="_blank" rel="noopener noreferrer" href="${escapeHTML(link)}">Open resource ↗</a>`:""}
      ${r.type==="exam"?`<a href="./desk.html?resource=${encodeURIComponent(r.id)}">Enter Exam Desk →</a>`:""}
      <button type="button" id="copy-resource">Copy share link ⧉</button>
    </div>
    <p class="detail-note">${escapeHTML(r.disclaimer||"Independent resource, not an official NESA or school examination.")}</p>
  </div>`;
  $("#copy-resource").addEventListener("click",async()=>{
    const url=new URL(location.href);url.searchParams.set("resource",r.id);url.hash="";
    try{await navigator.clipboard.writeText(url.href);showToast("Share link copied.");}
    catch{showToast("Copy this page's URL to share.");}
  });
  if(updateHistory){
    const url=new URL(location.href);url.searchParams.set("resource",r.id);
    history.pushState({resource:id},"",url);
  }
  const dialog=$("#resource-dialog");
  if(!dialog.open)dialog.showModal();
}
function closeDetail(){
  const dialog=$("#resource-dialog");
  if(dialog.open)dialog.close();
}
function cleanDetailURL(){
  const url=new URL(location.href);
  if(url.searchParams.has("resource")){url.searchParams.delete("resource");history.replaceState({},"",url);}
}
function commandItems(){
  const pages=[
    {key:"library",title:"Explore the library",subtitle:"Browse published examinations, solutions and notes",icon:"▤",href:"#library"},
    {key:"examdesk",title:"Open Exam Desk",subtitle:"Timer, question tracking and private notes",icon:"⌛",href:"./desk.html"},
    {key:"publishing",title:"Publishing studio",subtitle:"Prepare and publish resources through GitHub",icon:"↗",href:"./studio.html"}
  ];
  const search=$("#command-input").value.trim().toLowerCase();
  const combined=[
    ...pages.filter(item=>(item.title+" "+item.subtitle).toLowerCase().includes(search)).map(item=>({...item,group:"Navigate"})),
    ...resources.filter(r=>[r.title,r.description,r.subject,...(r.tags||[])].join(" ").toLowerCase().includes(search)).slice(0,8).map(r=>({key:r.id,title:r.title,subtitle:`${r.year} · ${resourceType(r.type)}`,icon:"π",group:"Resources",resourceId:r.id}))
  ];
  return combined;
}
function renderCommand(){
  const items=commandItems();const el=$("#command-results");
  if(!items.length){el.innerHTML='<div class="command-empty">No results. Try another word.</div>';commandIndex=0;return;}
  commandIndex=Math.min(commandIndex,items.length-1);
  let group="";
  el.innerHTML=items.map((item,i)=>{
    let heading="";
    if(item.group!==group){group=item.group;heading=`<div class="command-group-label">${group.toUpperCase()}</div>`;}
    return `${heading}<button type="button" class="command-item ${i===commandIndex?"selected":""}" data-command-index="${i}"><span class="command-item-icon" aria-hidden="true">${escapeHTML(item.icon)}</span><span><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.subtitle)}</small></span><span class="command-shortcut">↗</span></button>`;
  }).join("");
  $$("[data-command-index]",el).forEach(button=>{
    button.addEventListener("click",()=>chooseCommand(Number(button.dataset.commandIndex)));
    button.addEventListener("pointerenter",()=>{commandIndex=Number(button.dataset.commandIndex);markCommandIndex();});
  });
}
function markCommandIndex(){
  $$("[data-command-index]",$("#command-results")).forEach(btn=>btn.classList.toggle("selected",Number(btn.dataset.commandIndex)===commandIndex));
}
function chooseCommand(i){
  const item=commandItems()[i];if(!item)return;
  $("#command-dialog").close();
  if(item.resourceId){openDetail(item.resourceId,true);return;}
  if(item.href.startsWith("#")){$(item.href)?.scrollIntoView({behavior:"smooth"});return;}
  location.href=item.href;
}
function openCommand(){
  const dialog=$("#command-dialog");if(dialog.open)return;
  $("#command-input").value="";commandIndex=0;renderCommand();dialog.showModal();
  requestAnimationFrame(()=>$("#command-input").focus());
}
async function loadResources(){
  try{
    const response=await fetch("./resources.json",{cache:"no-store"});
    if(!response.ok)throw new Error("HTTP "+response.status);
    const data=await response.json();
    if(!Array.isArray(data.resources))throw new Error("Invalid resource index");
    resources=data.resources.filter(r=>r.id&&r.title&&safeUrl(r.url)).sort((a,b)=>String(b.releaseDate||"").localeCompare(String(a.releaseDate||"")));
    $("#library-updated").textContent=data.updated||"—";
    updateFilterState();renderLibrary();
    const id=new URL(location.href).searchParams.get("resource");
    if(id)openDetail(id,false);
  }catch(error){
    console.error("Unable to load resources:",error);
    $("#resource-list").innerHTML='<div class="empty-state"><strong>The collection is temporarily unavailable.</strong><div>Please refresh to try again.</div></div>';
    $("#results-meta").textContent="Library unavailable";
  }
}
function setup(){
  $("#year").textContent=String(new Date().getFullYear());
  loadSaved();
  $$(".filter-button").forEach(button=>button.addEventListener("click",()=>{
    activeFilter=button.dataset.filter;updateFilterState();renderLibrary();
  }));
  $("#resource-search").addEventListener("input",event=>{query=event.target.value;renderLibrary();});
  $("#open-search").addEventListener("click",openCommand);
  $("#close-command").addEventListener("click",()=>$("#command-dialog").close());
  $("#command-input").addEventListener("input",()=>{commandIndex=0;renderCommand();});
  $("#command-input").addEventListener("keydown",event=>{
    const items=commandItems();
    if(event.key==="ArrowDown"){event.preventDefault();commandIndex=Math.min(items.length-1,commandIndex+1);markCommandIndex();}
    if(event.key==="ArrowUp"){event.preventDefault();commandIndex=Math.max(0,commandIndex-1);markCommandIndex();}
    if(event.key==="Enter"){event.preventDefault();chooseCommand(commandIndex);}
  });
  document.addEventListener("keydown",event=>{
    if(event.altKey)return;
    const inEditable=event.target.closest("input,textarea,select,[contenteditable]");
    if((event.key==="/"&&!inEditable)||(event.key.toLowerCase()==="k"&&(event.ctrlKey||event.metaKey))){
      event.preventDefault();openCommand();
    }
  });
  $("#close-resource").addEventListener("click",closeDetail);
  $("#resource-dialog").addEventListener("close",cleanDetailURL);
  window.addEventListener("popstate",()=>{
    const id=new URL(location.href).searchParams.get("resource");
    if(id)openDetail(id,false);else closeDetail();
  });
  const toggle=$("#nav-toggle"),nav=$("#main-nav");
  toggle.addEventListener("click",()=>{
    const expanded=toggle.getAttribute("aria-expanded")==="true";
    toggle.setAttribute("aria-expanded",String(!expanded));
    nav.classList.toggle("open",!expanded);
  });
  $$("a",nav).forEach(a=>a.addEventListener("click",()=>{nav.classList.remove("open");toggle.setAttribute("aria-expanded","false");}));
  loadResources();
}
document.addEventListener("DOMContentLoaded",setup);
