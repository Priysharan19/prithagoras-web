// Pure session functions shared by the browser workspace and Node tests.
export const SESSION_VERSION = 1;
export const PHASES = Object.freeze(["idle","reading","ready","working","finished"]);
export const STATUSES = Object.freeze(["unseen","done","flagged"]);

export function durationConfig(resource) {
  const parsed = /^(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i.exec(String(resource?.duration || ""));
  const working = Number.isFinite(Number(resource?.workingMinutes)) && Number(resource.workingMinutes) > 0
    ? Number(resource.workingMinutes)
    : parsed ? Number(parsed[1]) * 60 : 60;
  const reading = Number.isFinite(Number(resource?.readingMinutes)) && Number(resource.readingMinutes) >= 0
    ? Number(resource.readingMinutes) : 0;
  return {
    workingMinutes: Math.min(600,Math.max(1,Math.round(working))),
    readingMinutes: Math.min(90,Math.max(0,Math.round(reading)))
  };
}

export function questionGroups(resource) {
  const count = Math.min(200, Math.max(1,Number.parseInt(resource?.questions,10) || 1));
  const sections = Array.isArray(resource?.sections) ? resource.sections : [];
  const valid = sections.length > 0 && sections.every(s =>
    Number.isInteger(s.start) && Number.isInteger(s.end) && s.start>=1 && s.end>=s.start && s.end<=count
  );
  if (!valid) return [{label:"Questions",start:1,end:count,format:""}];
  const covered = new Set();
  for (const section of sections) {
    for(let q=section.start;q<=section.end;q++) {
      if(covered.has(q)) return [{label:"Questions",start:1,end:count,format:""}];
      covered.add(q);
    }
  }
  if(covered.size!==count)return [{label:"Questions",start:1,end:count,format:""}];
  return sections.map(s=>({label:String(s.label||"Section"),start:s.start,end:s.end,format:String(s.format||"")}));
}

export function createSession(resource) {
  return {version:SESSION_VERSION, phase:"idle",running:false,deadline:null,remainingMs:null,
    selected:1,statuses:{},notes:{},updatedAt:null};
}

export function restoreSession(raw,resource) {
  const empty=createSession(resource);
  if(!raw || typeof raw!=="object" || raw.version!==SESSION_VERSION || !PHASES.includes(raw.phase))return empty;
  const total=Math.min(200,Math.max(1,parseInt(resource?.questions,10)||1));
  const statuses={};
  if(raw.statuses && typeof raw.statuses==="object")for(const [key,value] of Object.entries(raw.statuses)){
    const q=Number(key);
    if(Number.isInteger(q)&&q>=1&&q<=total&&STATUSES.includes(value)&&value!=="unseen")statuses[q]=value;
  }
  const notes={};
  if(raw.notes && typeof raw.notes==="object")for(const [key,value] of Object.entries(raw.notes)){
    const q=Number(key);
    if(Number.isInteger(q)&&q>=1&&q<=total&&typeof value==="string")notes[q]=value.slice(0,5000);
  }
  const running=Boolean(raw.running)&&["reading","working"].includes(raw.phase)&&Number.isFinite(Number(raw.deadline));
  return {...empty,phase:raw.phase,running,deadline:running?Number(raw.deadline):null,
    remainingMs:raw.remainingMs!==null && raw.remainingMs!==undefined && Number.isFinite(Number(raw.remainingMs))?Math.max(0,Number(raw.remainingMs)):null,
    selected:Number.isInteger(raw.selected)?Math.min(total,Math.max(1,raw.selected)):1,
    statuses,notes,updatedAt:typeof raw.updatedAt==="string"?raw.updatedAt:null};
}

export function remaining(state, now, config) {
  if(state.phase==="reading"||state.phase==="working"){
    const defaultMs=(state.phase==="reading"?config.readingMinutes:config.workingMinutes)*60000;
    if(state.running && Number.isFinite(state.deadline))return Math.max(0,state.deadline-now);
    return state.remainingMs ?? defaultMs;
  }
  if(state.phase==="ready"||state.phase==="idle")return config.workingMinutes*60000;
  return 0;
}

export function updateSession(state, action, config, now=Date.now()) {
  let next={...state};
  const kind=action?.type;
  if(kind==="TICK") {
    if(!state.running)return state;
    if(remaining(state,now,config)>0)return state;
    if(state.phase==="reading")return {...state,phase:"ready",running:false,deadline:null,remainingMs:null,updatedAt:new Date(now).toISOString()};
    if(state.phase==="working")return {...state,phase:"finished",running:false,deadline:null,remainingMs:0,updatedAt:new Date(now).toISOString()};
    return state;
  }
  if(kind==="BEGIN_READING" && state.phase==="idle"){
    if(config.readingMinutes===0)return updateSession(state,{type:"BEGIN_WORKING"},config,now);
    next={...next,phase:"reading",running:true,deadline:now+config.readingMinutes*60000,remainingMs:config.readingMinutes*60000};
  } else if(kind==="BEGIN_WORKING" && ["idle","reading","ready"].includes(state.phase)){
    next={...next,phase:"working",running:true,deadline:now+config.workingMinutes*60000,remainingMs:config.workingMinutes*60000};
  } else if(kind==="PAUSE" && state.running && ["reading","working"].includes(state.phase)){
    next={...next,running:false,remainingMs:remaining(state,now,config),deadline:null};
  } else if(kind==="RESUME" && !state.running && ["reading","working"].includes(state.phase)){
    const time=remaining(state,now,config);
    if(time<=0)return updateSession({...state,running:true,deadline:now},{type:"TICK"},config,now);
    next={...next,running:true,deadline:now+time,remainingMs:time};
  } else if(kind==="FINISH" && state.phase==="working"){
    next={...next,phase:"finished",running:false,deadline:null,remainingMs:0};
  } else if(kind==="RESET") {
    next=createSession();
  } else if(kind==="SELECT") {
    next.selected=Math.max(1,Math.min(action.total||1,Number(action.question)||1));
  } else if(kind==="SET_STATUS" && Number.isInteger(action.question) && action.question>=1 && action.question<=200 && STATUSES.includes(action.status)){
    const question=String(action.question);
    const statuses={...state.statuses};
    if(statuses[question]===action.status || action.status==="unseen")delete statuses[question];
    else statuses[question]=action.status;
    next.statuses=statuses;
  } else if(kind==="SAVE_NOTE" && Number.isInteger(action.question) && action.question>=1){
    next.notes={...state.notes,[action.question]:String(action.text||"").slice(0,5000)};
  } else return state;
  next.updatedAt=new Date(now).toISOString();
  return next;
}

export function formatTime(ms) {
  const seconds=Math.max(0,Math.ceil(ms/1000));
  const h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=seconds%60;
  return [h,m,s].map(n=>String(n).padStart(2,"0")).join(":");
}

export function counts(state,total) {
  let done=0,flagged=0;
  for(let q=1;q<=total;q++){
    if(state.statuses[q]==="done")done++;
    if(state.statuses[q]==="flagged")flagged++;
  }
  return {done,flagged,unseen:Math.max(0,total-done-flagged)};
}
