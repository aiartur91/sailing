// Browser editor that builds sailings.csv — no Excel, no API.
const { useState, useEffect, useRef, useMemo } = React;

const PORTS = window.PORTS || {};
const CM = window.CARRIER_META || {};
const CARRIERS = window.CARRIER_LIST || Object.keys(CM);

// port groups for selects (driven by the shared dictionary)
const ORIGIN_CC = ['CN','IN','BD','VN'];
const DEST_CC   = ['PL','NL','BE','DE'];
const HUB_CC    = ['MA','MY','SG','LK','ES','GR','EG','OM','AE','MT','NL','DE'];
const byCC = (ccList)=> Object.keys(PORTS).filter(c => ccList.includes((PORTS[c]||{}).country));
const CN_PORTS  = window.LANES_POL || byCC(ORIGIN_CC);   // all origins
const PL_PORTS  = window.LANES_POD || byCC(DEST_CC);     // all destinations
const HUB_PORTS = byCC(HUB_CC);                          // transshipment hubs

// canonical CSV columns (must match sailings.csv header)
const COLS = ['carrier','service','service_name','pol','pod','transshipment',
  'mother_vessel','mother_voyage','mother_imo','feeder_vessel','feeder_voyage','feeder_imo',
  'etd','eta','transit_days','etd_week','cutoff_gatein','cutoff_vgm','cutoff_doc',
  'ts_arrive','ts_depart','rotation','space','co2','fetched_at'];

const LS_KEY = 'sailingi.editor.rows.v1';

// ── icons ──
const I = {
  plus:(p)=><svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...p}><path d="M8 3v10M3 8h10"/></svg>,
  down:(p)=><svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M8 3v9M4 8.5 8 12l4-3.5"/></svg>,
  up:(p)=><svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M8 13V4M4 7.5 8 4l4 3.5"/></svg>,
  edit:(p)=><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M11 2.5 13.5 5 5.5 13l-3 .5.5-3 8-8Z"/></svg>,
  trash:(p)=><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 4.5h10M6 4.5V3h4v1.5M5 4.5 5.5 13h5L11 4.5"/></svg>,
  chev:(p)=><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 4l4 4-4 4"/></svg>,
  file:(p)=><svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 1.5v3.5h3.5M4 1.5h5L13 5.5V14a.5.5 0 0 1-.5.5h-9A.5.5 0 0 1 3 14V2a.5.5 0 0 1 .5-.5Z"/></svg>,
  check:(p)=><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 8.5 6.5 12 13 4.5"/></svg>,
};

// ── helpers ──
function pname(code){ return (PORTS[code]||{}).name || code; }
function isoWeek(dt){
  const d=new Date(Date.UTC(dt.getFullYear(),dt.getMonth(),dt.getDate()));
  const day=(d.getUTCDay()+6)%7; d.setUTCDate(d.getUTCDate()-day+3);
  const f=new Date(Date.UTC(d.getUTCFullYear(),0,4));
  const fd=(f.getUTCDay()+6)%7; f.setUTCDate(f.getUTCDate()-fd+3);
  return 1+Math.round((d-f)/(7*864e5));
}
function calcTransit(etd,eta){ if(!etd||!eta) return ''; const a=new Date(etd),b=new Date(eta); if(isNaN(a)||isNaN(b)) return ''; return Math.max(0,Math.round((b-a)/864e5)); }
function calcWeek(etd){ if(!etd) return ''; const d=new Date(etd); return isNaN(d)?'':isoWeek(d); }
// datetime-local value "2026-06-23T18:00" → CSV "2026-06-23 18:00"
function toCsvDate(v){ return v ? v.replace('T',' ') : ''; }
function fromCsvDate(v){ if(!v) return ''; return v.trim().replace(' ','T').slice(0,16); }
function fmtShort(v){ if(!v) return ''; const d=new Date(v.replace(' ','T')); if(isNaN(d)) return v; const M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${M[d.getMonth()]} ${d.getDate()}`; }

// blank form
function blankForm(){
  return { carrier:'MAERSK', service:'', service_name:'', pol:'CNSHA', pod:'PLGDN',
    routing:'direct', transshipment:'NLRTM',
    mother_vessel:'', mother_voyage:'', mother_imo:'',
    feeder_vessel:'', feeder_voyage:'', feeder_imo:'',
    etd:'', eta:'', cutoff_gatein:'', cutoff_vgm:'', cutoff_doc:'',
    ts_arrive:'', ts_depart:'', rotation:'', space:'open', co2:'' };
}

// ── CSV parse / build ──
function parseCsv(text){
  const rows=[];let i=0,field='',row=[],inQ=false;
  text=text.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  while(i<text.length){const c=text[i];
    if(inQ){if(c==='"'){if(text[i+1]==='"'){field+='"';i+=2;continue;}inQ=false;i++;continue;}field+=c;i++;continue;}
    if(c==='"'){inQ=true;i++;continue;}
    if(c===','){row.push(field);field='';i++;continue;}
    if(c==='\n'){row.push(field);rows.push(row);field='';row=[];i++;continue;}
    field+=c;i++;}
  if(field.length||row.length){row.push(field);rows.push(row);}
  return rows.filter(r=>r.length>1||(r.length===1&&r[0].trim()!==''));
}
function esc(v){ v=(v==null)?'':String(v); return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; }
function rowsToCsv(rows){
  const lines=[COLS.join(',')];
  for(const r of rows){ lines.push(COLS.map(c=>esc(r[c])).join(',')); }
  return lines.join('\n')+'\n';
}
// form → csv-shaped record
function formToRecord(f){
  const ts = f.routing==='ts' ? f.transshipment : '';
  return {
    carrier:f.carrier, service:f.service, service_name:f.service_name,
    pol:f.pol, pod:f.pod, transshipment:ts,
    mother_vessel:f.mother_vessel, mother_voyage:f.mother_voyage, mother_imo:f.mother_imo,
    feeder_vessel: ts? f.feeder_vessel:'', feeder_voyage: ts? f.feeder_voyage:'', feeder_imo: ts? f.feeder_imo:'',
    etd:toCsvDate(f.etd), eta:toCsvDate(f.eta),
    transit_days:calcTransit(f.etd,f.eta), etd_week:calcWeek(f.etd),
    cutoff_gatein:toCsvDate(f.cutoff_gatein), cutoff_vgm:toCsvDate(f.cutoff_vgm), cutoff_doc:toCsvDate(f.cutoff_doc),
    ts_arrive: ts? toCsvDate(f.ts_arrive):'', ts_depart: ts? toCsvDate(f.ts_depart):'',
    rotation:f.rotation, space:f.space, co2:f.co2,
    fetched_at: new Date().toISOString()   // a manual add/edit is the newest version
  };
}
// csv record → form (for editing)
function recordToForm(r){
  const ts=(r.transshipment||'').trim();
  return { carrier:(r.carrier||'MAERSK').toUpperCase(), service:r.service||'', service_name:r.service_name||'',
    pol:(r.pol||'CNSHA').toUpperCase(), pod:(r.pod||'PLGDN').toUpperCase(),
    routing: ts?'ts':'direct', transshipment: ts? ts.toUpperCase():'NLRTM',
    mother_vessel:r.mother_vessel||'', mother_voyage:r.mother_voyage||'', mother_imo:r.mother_imo||'',
    feeder_vessel:r.feeder_vessel||'', feeder_voyage:r.feeder_voyage||'', feeder_imo:r.feeder_imo||'',
    etd:fromCsvDate(r.etd), eta:fromCsvDate(r.eta),
    cutoff_gatein:fromCsvDate(r.cutoff_gatein), cutoff_vgm:fromCsvDate(r.cutoff_vgm), cutoff_doc:fromCsvDate(r.cutoff_doc),
    ts_arrive:fromCsvDate(r.ts_arrive), ts_depart:fromCsvDate(r.ts_depart),
    rotation:r.rotation||'', space:(r.space||'open').toLowerCase(), co2:r.co2||'' };
}

window.__editor = { COLS, parseCsv, rowsToCsv, formToRecord, recordToForm, blankForm,
  CARRIERS, CM, PORTS, CN_PORTS, PL_PORTS, HUB_PORTS, I, pname, calcTransit, calcWeek, fmtShort, LS_KEY };
