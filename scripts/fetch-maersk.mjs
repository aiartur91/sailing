// fetch-maersk.mjs — pull Maersk Point-to-Point schedules → sailings.csv
// Runs in Node 18+. Reads MAERSK_API_KEY from env (GitHub Secret).
// Local test:  MAERSK_API_KEY=xxxxx node scripts/fetch-maersk.mjs --debug

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const API_KEY = process.env.MAERSK_API_KEY;
const DEBUG = process.argv.includes('--debug');

// Confirm exact path on developer.maersk.com "Point-to-Point Schedules" → Try it
const BASE = 'https://api.maersk.com/schedules/point-to-point';
const CARRIER_CODE = 'MAEU';
const WEEKS_AHEAD  = 6;
const CSV_PATH     = 'sailings.csv';

const LANES = [
  ['CNTAO','PLGDN'], ['CNTAO','PLGDY'],
  ['CNDLC','PLGDN'], ['CNDLC','PLGDY'],
  ['CNSHA','PLGDN'], ['CNSHA','PLGDY'],
  ['CNYTN','PLGDN'], ['CNYTN','PLGDY'],
  ['CNTXG','PLGDN'], ['CNTXG','PLGDY'],
  ['CNNGB','PLGDN'], ['CNNGB','PLGDY'],
];

const COLS = ['carrier','service','service_name','pol','pod','transshipment',
  'mother_vessel','mother_voyage','mother_imo','feeder_vessel','feeder_voyage','feeder_imo',
  'etd','eta','transit_days','etd_week','cutoff_gatein','cutoff_vgm','cutoff_doc',
  'ts_arrive','ts_depart','rotation','space','co2'];

const today = () => new Date().toISOString().slice(0,10);
function isoWeek(d){
  const x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
  const day=(x.getUTCDay()+6)%7; x.setUTCDate(x.getUTCDate()-day+3);
  const f=new Date(Date.UTC(x.getUTCFullYear(),0,4));
  const fd=(f.getUTCDay()+6)%7; f.setUTCDate(f.getUTCDate()-fd+3);
  return 1+Math.round((x-f)/(7*864e5));
}
const fmtDT = (iso)=> iso ? String(iso).replace('T',' ').slice(0,16) : '';
const pick = (obj, ...paths) => {
  for (const p of paths){
    let v=obj; let ok=true;
    for (const k of p.split('.')){ if(v && k in v) v=v[k]; else { ok=false; break; } }
    if (ok && v!==undefined && v!==null && v!=='') return v;
  }
  return '';
};

async function fetchLane(origin, dest){
  const qs = new URLSearchParams({
    collectionOriginUNLocationCode: origin,
    deliveryDestinationUNLocationCode: dest,
    vesselOperatorCarrierCode: CARRIER_CODE,
    startDate: today(),
    startDateType: 'D',
    dateRange: `P${WEEKS_AHEAD}W`,
  });
  const res = await fetch(`${BASE}?${qs}`, {
    headers: { 'Consumer-Key': API_KEY, 'Accept': 'application/json' },
  });
  if (!res.ok){
    const body = await res.text().catch(()=> '');
    throw new Error(`HTTP ${res.status} for ${origin}→${dest} :: ${body.slice(0,300)}`);
  }
  return res.json();
}

function rowsFromResponse(json, reqOrigin, reqDest){
  const out = [];
  const products = json.oceanProducts || json.products || [];
  for (const prod of products){
    const scheds = prod.transportSchedules || prod.schedules || [];
    for (const s of scheds){
      const legs = (s.transportLegs || s.transport || s.legs || []);
      const vlegs = legs.filter(l => {
        const mode = pick(l,'transport.transportMode','transportMode','mode');
        return !mode || /VESSEL|VESL/i.test(mode);
      });
      const first = vlegs[0] || {};
      const last  = vlegs[vlegs.length-1] || first;
      const startLoc = (l)=> pick(l,'facilities.startLocation.UNLocationCode','startLocation.UNLocationCode','facilities.collectionOrigin.UNLocationCode');
      const endLoc   = (l)=> pick(l,'facilities.endLocation.UNLocationCode','endLocation.UNLocationCode','facilities.deliveryDestination.UNLocationCode');
      const pol = startLoc(first) || reqOrigin;
      const pod = endLoc(last)    || reqDest;
      const isTS = vlegs.length > 1;
      const ts = isTS ? endLoc(first) : '';
      const vesselOf = (l)=> ({
        name:  pick(l,'transport.vessel.vesselName','vessel.vesselName','transport.vesselName'),
        imo:   pick(l,'transport.vessel.vesselIMONumber','vessel.vesselIMONumber','transport.vesselIMONumber'),
        voy:   pick(l,'transport.carrierDepartureVoyageNumber','carrierDepartureVoyageNumber','transport.voyageNumber'),
        svc:   pick(l,'transport.carrierServiceCode','carrierServiceCode','transport.inttraServiceCode'),
        svcN:  pick(l,'transport.carrierServiceName','carrierServiceName','transport.inttraServiceName'),
      });
      const mother = vesselOf(last);
      const feeder = isTS ? vesselOf(first) : { name:'', imo:'', voy:'', svc:'', svcN:'' };
      const etd = pick(s,'departureDateTime','firstDepartureDateTime') || pick(first,'departureDateTime');
      const eta = pick(s,'arrivalDateTime','lastArrivalDateTime')      || pick(last,'arrivalDateTime');
      let transit = pick(s,'transitTime');
      if (!transit && etd && eta) transit = Math.round((new Date(eta)-new Date(etd))/864e5);
      const rotation = vlegs.map(l=>startLoc(l)).concat(endLoc(last)).filter(Boolean);
      out.push({
        carrier:'MAERSK', service: mother.svc||'', service_name: mother.svcN||'',
        pol, pod, transshipment: ts||'',
        mother_vessel: mother.name||'', mother_voyage: mother.voy||'', mother_imo: mother.imo||'',
        feeder_vessel: feeder.name||'', feeder_voyage: feeder.voy||'', feeder_imo: feeder.imo||'',
        etd: fmtDT(etd), eta: fmtDT(eta), transit_days: transit||'',
        etd_week: etd && !isNaN(new Date(etd)) ? isoWeek(new Date(etd)) : '',
        cutoff_gatein:'', cutoff_vgm:'', cutoff_doc:'',
        ts_arrive: isTS ? fmtDT(pick(first,'arrivalDateTime')) : '',
        ts_depart: isTS ? fmtDT(pick(last,'departureDateTime')) : '',
        rotation: rotation.join('|'), space:'open', co2:'',
      });
    }
  }
  return out;
}

function parseCsv(text){
  const rows=[];let i=0,f='',row=[],q=false;
  text=text.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  while(i<text.length){const c=text[i];
    if(q){ if(c==='"'){ if(text[i+1]==='"'){f+='"';i+=2;continue;} q=false;i++;continue;} f+=c;i++;continue; }
    if(c==='"'){q=true;i++;continue;}
    if(c===','){row.push(f);f='';i++;continue;}
    if(c==='\n'){row.push(f);rows.push(row);f='';row=[];i++;continue;}
    f+=c;i++; }
  if(f.length||row.length){row.push(f);rows.push(row);}
  return rows.filter(r=>r.length>1||(r.length===1&&r[0].trim()!==''));
}
const esc = (v)=>{ v=(v==null)?'':String(v); return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; };
const toCsv = (objs)=> [COLS.join(','), ...objs.map(o=>COLS.map(c=>esc(o[c])).join(','))].join('\n')+'\n';

async function main(){
  if (!API_KEY){ console.error('Missing MAERSK_API_KEY env var.'); process.exit(1); }
  let kept = [];
  if (existsSync(CSV_PATH)){
    const text = await readFile(CSV_PATH,'utf8');
    const raw = parseCsv(text);
    if (raw.length>1){
      const head = raw[0].map(h=>h.trim().toLowerCase());
      for (let r=1;r<raw.length;r++){
        const rec={}; COLS.forEach(c=>{ const k=head.indexOf(c); rec[c]= k>=0?(raw[r][k]||'').trim():''; });
        if ((rec.carrier||'').toUpperCase()!=='MAERSK') kept.push(rec);
      }
    }
  }
  const fresh = []; let firstRaw = null, ok=0, fail=0;
  for (const [o,d] of LANES){
    try {
      const json = await fetchLane(o,d);
      if (!firstRaw) firstRaw = json;
      const rows = rowsFromResponse(json, o, d);
      fresh.push(...rows); ok++;
      console.log(`OK ${o}->${d}: ${rows.length} sailings`);
    } catch(e){ fail++; console.warn(`WARN ${o}->${d}: ${e.message}`); }
    await new Promise(r=>setTimeout(r, 400));
  }
  if (DEBUG && firstRaw){
    await writeFile('maersk-raw.json', JSON.stringify(firstRaw,null,2));
    console.log('wrote maersk-raw.json');
  }
  const seen=new Set(); const dedup=[];
  for (const r of fresh){
    const k=[r.carrier,r.service,r.pol,r.pod,r.etd].join('|');
    if(!seen.has(k)){ seen.add(k); dedup.push(r); }
  }
  const all = [...kept, ...dedup];
  await writeFile(CSV_PATH, toCsv(all));
  console.log(`\n${CSV_PATH}: ${kept.length} kept + ${dedup.length} Maersk = ${all.length} total (lanes ok:${ok} fail:${fail})`);
  if (dedup.length===0) console.log('No Maersk parsed — run with --debug and inspect maersk-raw.json.');
}
main().catch(e=>{ console.error(e); process.exit(1); });
