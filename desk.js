import {durationConfig,questionGroups,createSession,restoreSession,remaining,updateSession,formatTime,counts} from "./session-core.mjs";

const $=selector=>document.querySelector(selector);
const escapeHTML=value=>String(value??"").replace(/[&<>"']/g,character=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]));
const allowedURL=value=>{
  try{const u=new URL(value,location.href);return u.protocol==="https:"?u.href:"";}
  catch{return "";}
};
let resource=null;
let state=null;
let config=null;
let groups=null;
let total=0;
let storageKey="";
let storageAvailable=true;
let saveTimeout=null;
let lastRenderedPhase="";

function announce(message){
  const toast=$("#desk-toast");toast.textContent=message;toast.classList.add("visible");
  clearTimeout(announce.timer);announce.timer=setTimeout(()=>toast.classList.remove("visible"),2500);
}
function persist(){
  if(!storageAvailable)return;
  try{localStorage.setItem(storageKey,JSON.stringify(state));$("#save-message").textContent="Stored locally";}
  catch(e){storageAvailable=false;$(".autosave-indicator").classList.add("warning");$("#save-message").textContent="Storage unavailable";announce("Local storage is unavailable. Export your attempt to keep a copy.");}
}
function commit(action){
  if(!state)return;
  // Flush the previous question's editor synchronously before switching.
  // Otherwise a queued autosave could attach Q3 notes to Q4 after a fast click.
  if(action.type==="SELECT" && Number(action.question)!==state.selected){
    clearTimeout(saveTimeout);
    const previousText=$("#working-notes").value;
    if(previousText!==(state.notes[state.selected]||"")){
      state=updateSession(state,{type:"SAVE_NOTE",question:state.selected,text:previousText},config,Date.now());
      persist();
    }
  }
  const next=updateSession(state,action,config,Date.now());
  if(next===state)return;
  const previousSelection=state.selected;
  state=next;
  persist();
  render();
  if(previousSelection!==state.selected)renderEditor();
}
function initQuestionGroups(){
  $("#question-groups").innerHTML=groups.map(group=>{
    const buttons=[];
    for(let n=group.start;n<=group.end;n++) {
      buttons.push(`<button type="button" class="question-button" data-question="${n}" aria-label="Question ${n}">${String(n).padStart(2,"0")}</button>`);
    }
    return `<div class="question-group"><div class="question-group-label"><span>${escapeHTML(group.label.toUpperCase())} · Q${group.start}–Q${group.end}</span><small>${escapeHTML(group.format)}</small></div><div class="question-grid">${buttons.join("")}</div></div>`;
  }).join("");
  document.querySelectorAll("[data-question]").forEach(button=>button.addEventListener("click",()=>commit({type:"SELECT",question:Number(button.dataset.question),total})));
}

function renderTimer(){
  const stage=state.phase,live=["reading","working"].includes(stage);
  const ms=remaining(state,Date.now(),config);
  $("#timer-display").textContent=formatTime(ms);
  const reading=stage==="reading",working=stage==="working",ready=stage==="ready",finished=stage==="finished",idle=stage==="idle";
  const label=reading?"READING TIME":working?"WORKING TIME":finished?"ATTEMPT FINISHED":"WORKING TIME";
  $("#timer-label").textContent=label;
  $("#timer-mode").textContent=finished?"COMPLETE":ready?"READY TO WORK":idle?"NOT STARTED":state.running?"RUNNING":"PAUSED";
  $("#session-status").textContent=finished?"SESSION COMPLETE":ready?"READING COMPLETE":idle?"READY TO BEGIN":reading?"READING PHASE":state.running?"SESSION ACTIVE":"SESSION PAUSED";
  const subtitles={
    idle:"Start with reading time, then move to the working session when you're ready.",
    reading:"Read through the examination. Use this time to plan your approach.",
    ready:"Reading time is complete. Start the working session when ready.",
    working:"Work independently. Mark questions as you complete them.",
    finished:"Attempt complete. Review your notes and export your record."
  };
  $("#session-subtitle").textContent=subtitles[stage];
  const start=$("#start-button");
  start.hidden=finished || (live && state.running);
  if(idle)start.innerHTML=`${config.readingMinutes>0?"Start reading time":"Start working time"} <span>↗</span>`;
  else if(ready)start.innerHTML='Start working time <span>↗</span>';
  else if(live&&!state.running)start.innerHTML=`Resume ${reading?"reading":"working"} <span>→</span>`;
  $("#pause-button").hidden=!(live&&state.running);
  $("#skip-button").hidden=!reading;
  $("#finish-button").hidden=!working;
  const readingPhase=$("#reading-phase"),workingPhase=$("#working-phase"),reviewPhase=$("#review-phase");
  [readingPhase,workingPhase,reviewPhase].forEach(p=>p.classList.remove("active","done"));
  if(idle||reading)readingPhase.classList.add("active");
  if(ready){readingPhase.classList.add("done");workingPhase.classList.add("active");}
  if(working){readingPhase.classList.add("done");workingPhase.classList.add("active");}
  if(finished){readingPhase.classList.add("done");workingPhase.classList.add("done");reviewPhase.classList.add("active");}
}
function renderProgress(){
  const {done,flagged,unseen}=counts(state,total);
  $("#completed-count").textContent=done;
  $("#flagged-count").textContent=flagged;
  $("#untouched-count").textContent=unseen;
  $("#progress-count").textContent=done;
  $("#progress-ring").style.setProperty("--percent",100*done/total);
  document.querySelectorAll("[data-question]").forEach(button=>{
    const q=Number(button.dataset.question), status=state.statuses[q]||"unseen";
    button.classList.toggle("selected",q===state.selected);
    button.classList.toggle("done",status==="done");
    button.classList.toggle("flagged",status==="flagged");
    button.setAttribute("aria-pressed",String(q===state.selected));
    button.setAttribute("aria-label",`Question ${q}, ${status}${q===state.selected?", selected":""}`);
  });
  $("#mark-done").classList.toggle("selected",state.statuses[state.selected]==="done");
  $("#mark-flag").classList.toggle("selected",state.statuses[state.selected]==="flagged");
}
function renderEditor(){
  const number=String(state.selected).padStart(2,"0");
  $("#note-question-label").textContent="QUESTION "+number;
  $("#notes-question").textContent="Q"+number;
  const text=state.notes[state.selected]||"";
  $("#working-notes").value=text;
  $("#note-count").textContent=text.length+" / 5000";
}
function render(){
  renderTimer();renderProgress();
  if(lastRenderedPhase!==state.phase){lastRenderedPhase=state.phase;}
}
function tick(){
  if(!state)return;
  const oldPhase=state.phase;
  state=updateSession(state,{type:"TICK"},config,Date.now());
  if(state.phase!==oldPhase){persist();render();announce(state.phase==="ready"?"Reading time complete. Start working when ready.":"Working time complete. Review your attempt.");}
  else renderTimer();
}
function exportSession(){
  const created=new Date().toISOString();
  const payload={
    exportVersion:1,createdAt:created,resource:{id:resource.id,title:resource.title,year:resource.year},
    exam:{marks:resource.marks,questions:total,readingMinutes:config.readingMinutes,workingMinutes:config.workingMinutes},
    session:{phase:state.phase,running:state.running,lastUpdated:state.updatedAt,
      remainingTimeSeconds:Math.ceil(remaining(state,Date.now(),config)/1000)},
    counts:counts(state,total),statuses:state.statuses,notes:state.notes,
    notice:"Personal practice record only. Not a marked examination or official HSC result."
  };
  const blob=new Blob([JSON.stringify(payload,null,2)+"\n"],{type:"application/json"});
  const url=URL.createObjectURL(blob), a=document.createElement("a");
  a.download=`prithagoras-${resource.id}-attempt.json`;
  a.href=url;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  announce("Attempt exported.");
}
function setupHandlers(){
  $("#start-button").addEventListener("click",()=>{
    if(state.phase==="idle")commit({type:config.readingMinutes?"BEGIN_READING":"BEGIN_WORKING"});
    else if(state.phase==="ready")commit({type:"BEGIN_WORKING"});
    else if(["reading","working"].includes(state.phase)&&!state.running)commit({type:"RESUME"});
  });
  $("#pause-button").addEventListener("click",()=>commit({type:"PAUSE"}));
  $("#skip-button").addEventListener("click",()=>commit({type:"BEGIN_WORKING"}));
  $("#finish-button").addEventListener("click",()=>{
    if(confirm("Finish this attempt? Your notes and question statuses will remain saved."))commit({type:"FINISH"});
  });
  $("#reset-button").addEventListener("click",()=>{
    if(!confirm("Reset the timer, flags, completion statuses and all working notes for this paper? This cannot be undone unless you exported your attempt."))return;
    clearTimeout(saveTimeout);
    state=createSession(resource);persist();render();renderEditor();announce("Workspace reset.");
  });
  $("#export-button").addEventListener("click",exportSession);
  $("#mark-done").addEventListener("click",()=>commit({type:"SET_STATUS",question:state.selected,status:"done"}));
  $("#mark-flag").addEventListener("click",()=>commit({type:"SET_STATUS",question:state.selected,status:"flagged"}));
  $("#clear-question").addEventListener("click",()=>commit({type:"SET_STATUS",question:state.selected,status:"unseen"}));
  $("#working-notes").addEventListener("input",event=>{
    const text=event.target.value;$("#note-count").textContent=text.length+" / 5000";
    clearTimeout(saveTimeout);
    // Persist after a brief idle to minimise synchronous storage writes while typing.
    const questionAtInput=state.selected;
    saveTimeout=setTimeout(()=>commit({type:"SAVE_NOTE",question:questionAtInput,text}),150);
  });
  $("#working-notes").addEventListener("blur",()=>{
    clearTimeout(saveTimeout);commit({type:"SAVE_NOTE",question:state.selected,text:$("#working-notes").value});
  });
  $("#shortcut-button").addEventListener("click",()=>$("#shortcuts-dialog").showModal());
  $("#close-shortcuts").addEventListener("click",()=>$("#shortcuts-dialog").close());
  document.addEventListener("keydown",event=>{
    const target=event.target;
    if(target.closest("input,textarea,select,[contenteditable]")||event.altKey||event.metaKey||event.ctrlKey)return;
    const dialog=$("#shortcuts-dialog");
    if(event.key==="?"){event.preventDefault();if(!dialog.open)dialog.showModal();return;}
    if(dialog.open)return;
    if(event.key==="ArrowLeft"){event.preventDefault();commit({type:"SELECT",question:state.selected-1,total});}
    if(event.key==="ArrowRight"){event.preventDefault();commit({type:"SELECT",question:state.selected+1,total});}
    if(event.key.toLowerCase()==="d"&&!event.repeat)commit({type:"SET_STATUS",question:state.selected,status:"done"});
    if(event.key.toLowerCase()==="f"&&!event.repeat)commit({type:"SET_STATUS",question:state.selected,status:"flagged"});
    if(event.key.toLowerCase()==="n")$("#working-notes").focus();
  });
  window.addEventListener("beforeunload",()=>{if(!state)return;clearTimeout(saveTimeout);const txt=$("#working-notes").value;if((state.notes[state.selected]||"")!==txt){state=updateSession(state,{type:"SAVE_NOTE",question:state.selected,text:txt},config);persist();}});
}
async function init(){
  try{
    const response=await fetch("./resources.json",{cache:"no-store"});
    if(!response.ok)throw new Error("Unable to load catalogue (HTTP "+response.status+")");
    const index=await response.json();
    const requestedId=new URL(location.href).searchParams.get("resource");
    const papers=Array.isArray(index.resources)?index.resources.filter(r=>r.type==="exam"):[];
    resource=requestedId?papers.find(r=>r.id===requestedId):papers[0];
    if(!resource)throw new Error(requestedId?"This examination is not in the library.":"No practice examinations are available.");
    total=Math.min(200,Math.max(1,Number.parseInt(resource.questions,10)||1));
    groups=questionGroups(resource);config=durationConfig(resource);
    storageKey="prithagoras:desk:v1:"+resource.id;
    let raw=null;
    try{raw=JSON.parse(localStorage.getItem(storageKey)||"null");}
    catch(e){storageAvailable=false;}
    state=restoreSession(raw,resource);
    // Reconcile a timer that expired while the browser was closed.
    state=updateSession(state,{type:"TICK"},config,Date.now());
    $("#rail-year").textContent=String(resource.year);
    $("#breadcrumb-year").textContent=String(resource.year);
    $("#rail-title").textContent=resource.title;
    $("#rail-meta").textContent=String(resource.subject||"Mathematics").toUpperCase();
    $("#reading-duration").textContent=config.readingMinutes+" min";
    $("#working-duration").textContent=config.workingMinutes+" min";
    $("#progress-total").textContent=total;
    const source=allowedURL(resource.url);
    if(source){$("#rail-source").href=source;}else{$("#rail-source").removeAttribute("href");$("#rail-source").textContent="Paper link unavailable";}
    if(!storageAvailable){$(".autosave-indicator").classList.add("warning");$("#save-message").textContent="Storage unavailable";}
    initQuestionGroups();setupHandlers();render();renderEditor();persist();setInterval(tick,500);
    document.title="Exam Desk — "+resource.subject+" "+resource.year+" | Prithagoras";
  }catch(error){
    console.error(error);
    $("#desk-description").textContent=error.message;
    $(".desk-grid").innerHTML='<div class="missing-resource"><p>Could not open this examination.</p><a href="./">Return to the resource library ↗</a></div>';
  }
}
document.addEventListener("DOMContentLoaded",init);
