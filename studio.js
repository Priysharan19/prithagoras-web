"use strict";
const $ = s => document.querySelector(s);
const safeSlug = value => value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,85);
let originalIndex = null;
let exportIndex = null;
function toast(message){const t=$("#toast");t.textContent=message;t.classList.add("visible");clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove("visible"),2600);}
function preview(){
  $("#preview-title").textContent=$("#r-title").value.trim()||"Your next great resource.";
  $("#preview-description").textContent=$("#r-description").value.trim()||"An inspiring mathematical challenge starts with a well-crafted question.";
  $("#preview-kicker").textContent="YEAR 12 / "+($("#r-year").value||"2027")+" / "+$("#r-type").selectedOptions[0].text.toUpperCase();
  $("#preview-marks").textContent=($("#r-marks").value||"0")+" MARKS";
  $("#preview-subject").textContent=$("#r-subject").value.toUpperCase().slice(0,24);
}
function checkFile(){
  const file=$("#r-file").files?.[0];
  if(file){$("#file-status").textContent=file.name+" · "+(file.size/1024/1024).toFixed(2)+" MB. Not uploaded yet: submit the file in the linked GitHub screen after generating this package.";}
  else $("#file-status").textContent="Select a PDF here, then upload that PDF in the GitHub screen after generation. This studio never transfers the file itself.";
}
async function init(){
  try{
    const response=await fetch("./resources.json",{cache:"no-store"});
    if(!response.ok)throw new Error("The resource index could not be read (HTTP "+response.status+").");
    const index=await response.json();
    if(!Array.isArray(index.resources))throw new Error("Resource index is invalid.");
    originalIndex=index;
  }catch(e){$("#form-errors").hidden=false;$("#form-errors").textContent="Cannot load live resources.json. Open this studio through the hosted website, not as a local file. "+e.message;$("#resource-form").querySelector("button[type=submit]").disabled=true;return;}
  $("#resource-form").addEventListener("input",preview);
  $("#r-file").addEventListener("change",checkFile);
  $("#resource-form").addEventListener("submit",event=>{
    event.preventDefault();
    const title=$("#r-title").value.trim(),description=$("#r-description").value.trim(),
      year=Number($("#r-year").value),subject=$("#r-subject").value.trim(),
      externalUrl=$("#r-url").value.trim(),file=$("#r-file").files?.[0];
    const errors=[];
    if(title.length<8)errors.push("Please enter a descriptive title (at least 8 characters).");
    if(description.length<25)errors.push("Please write at least 25 characters in the description.");
    if(subject.length<3)errors.push("Please enter a subject name.");
    if(!Number.isInteger(year)||year<2024||year>2035)errors.push("Choose an HSC year between 2024 and 2035.");
    if(!externalUrl && !file)errors.push("Supply either an HTTPS resource link or a PDF to upload.");
    if(externalUrl && !/^https:\/\/[^\s]+$/i.test(externalUrl))errors.push("The resource link must begin with https://.");
    if(file){
      if(!file.name.toLowerCase().endsWith(".pdf"))errors.push("Only PDF files are supported.");
      if(file.size>25*1024*1024)errors.push("PDF is over the 25 MB GitHub browser upload limit.");
    }
    const id=safeSlug(year+"-"+title);
    if(originalIndex.resources.some(r=>r.id===id))errors.push("A resource with this exact title and year already exists.");
    const errorArea=$("#form-errors");
    if(errors.length){errorArea.hidden=false;errorArea.innerHTML=errors.map(e=>"<div>• "+e.replaceAll("<","&lt;")+"</div>").join("");errorArea.scrollIntoView({block:"center",behavior:"smooth"});return;}
    errorArea.hidden=true;
    const record={
      id,title,subtitle:"Independent HSC learning resource",description,
      type:$("#r-type").value,subject,year,grade:"Year 12",
      marks:Number($("#r-marks").value)||0,questions:Number($("#r-questions").value)||0,
      duration:$("#r-duration").value.trim()||"Self-paced",
      releaseDate:new Date().toISOString().slice(0,10),
      tags:$("#r-tags").value.split(",").map(s=>s.trim()).filter(Boolean).slice(0,8),
      topic:subject,
      url:externalUrl||"./materials/"+encodeURIComponent(file.name),
      source:externalUrl?"External resource":"Prithagoras library",
      availability:externalUrl?"external":"hosted",
      disclaimer:"Independent educational resource. Not an official NESA or school examination."
    };
    exportIndex={...originalIndex,updated:new Date().toISOString().slice(0,10),resources:[record,...originalIndex.resources]};
    $("#generated-json").value=JSON.stringify(exportIndex,null,2)+"\n";
    $("#publication").hidden=false;
    $("#upload-step").textContent=file?"Upload '"+file.name+"' to the repository's materials/ folder first, keeping the filename unchanged.":"Your resource uses an external HTTPS link, so you can skip the PDF upload step.";
    $("#publication").scrollIntoView({behavior:"smooth",block:"start"});
    toast("Publication package generated.");
  });
  $("#copy-json").addEventListener("click",async()=>{
    try{await navigator.clipboard.writeText($("#generated-json").value);toast("Complete resource index copied.");}
    catch{ $("#generated-json").focus();$("#generated-json").select();toast("Select and copy the highlighted JSON.");}
  });
  $("#download-json").addEventListener("click",()=>{
    if(!exportIndex)return;
    const url=URL.createObjectURL(new Blob([JSON.stringify(exportIndex,null,2)+"\n"],{type:"application/json"}));
    const a=document.createElement("a");a.href=url;a.download="resources.json";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    toast("resources.json downloaded.");
  });
  preview();
}
document.addEventListener("DOMContentLoaded",init);
