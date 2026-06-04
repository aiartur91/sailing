// fetch-maersk.mjs — pull Maersk DCSA Commercial Schedules → sailings.csv
//
// API: "Ocean - Commercial Schedules [DCSA]" v1.0.1
//   GET https://api.maersk.com/ocean/commercial-schedules/dcsa/v1/point-to-point-routes
//   auth header: Consumer-Key
//
// Node 18+. Reads MAERSK_API_KEY from env (GitHub Secret) — never hard-code it.
// Local test:  MAERSK_API_KEY=xxxxx node scripts/fetch-maersk.mjs --debug

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

// ─────────────────────────── CONFIG ───────────────────────────
const API_KEY = process.env.MAERSK_API_KEY;
const DEBUG = process.argv.includes('--debug');

const BASE = 'https://api.maersk.com/ocean/commercial-schedules/dcsa/v1/point-to-point-routes';
const RANGE_DAYS = 42;             // departure window (max allowed 56)
const CSV_PATH   = 'sailings.csv';

// Tracked lanes — full matrix: every origin × every European destination.
// The API simply returns nothing for pairs Maersk doesn't serve (logged as 0).
const ORIGINS = [
  // China
  'CNSHA','CNNGB','CNYTN','CNTAO','CNXMN','CNNSA','CNTXG','CNDLC',
  // India
  'INNSA','INMUN','INHZA','INPAV','INMAA','INENR','INCOK','INTUT','INCCU','INHAL','INVTZ',
  // Bangladesh
  'BDCGP','BDMGL','BDPGN',
  // Vietnam
  'VNCMT','VNSGN','VNHPH','VNDAD','VNUIH',
];
const DESTINATIONS = ['PLGDN','NLRTM','BEANR','DEHAM','DEBRV','DEWVN']; // PLGDY dropped — Maersk P2P never calls Gdynia directly (always 0)

// Optional region slice via env LANE_GROUP (china|india|bdvn|all) — lets you
// spread the pull across days so each run stays under the API quota.
const GROUPS = {
  china: ['CNSHA','CNNGB','CNYTN','CNTAO','CNXMN','CNNSA','CNTXG','CNDLC'],
  india: ['INNSA','INMUN','INHZA','INPAV','INMAA','INENR','INCOK','INTUT','INCCU','INHAL','INVTZ'],
  bdvn:  ['BDCGP','BDMGL','BDPGN','VNCMT','VNSGN','VNHPH','VNDAD','VNUIH'],
};
const GROUP = (process.env.LANE_GROUP || 'all').toLowerCase();
const ORIGINS_ACTIVE = GROUP==='all' ? ORIGINS : (GROUPS[GROUP] || ORIGINS);

const LANES = [];
for (const o of ORIGINS_ACTIVE) for (const d of DESTINATIONS) LANES.push([o, d]);

const COLS = ['carrier','service','service_name','pol','pod','transshipment',
  'mother_vessel','mother_voyage','mother_imo','feeder_vessel','feeder_voyage','feeder_imo',
  'etd','eta','transit_days','etd_week','cutoff_gatein','cutoff_vgm','cutoff_doc',
  'ts_arrive','ts_depart','rotation','space','co2'];

// ─────────────────────────── HELPERS ───────────────────────────
const addDays = (n)=>{ const d=new Date(); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); };
function isoWeek(d){
  const x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
  const day=(x.getUTCDay()+6)%7; x.setUTCDate(x.getUTCDate()-day+3);
  const f=new Date(Date.UTC(x.getUTCFullYear(),0,4));
  const fd=(f.getUTCDay()+6)%7; f.setUTCDate(f.getUTCDate()-fd+3);
  return 1+Math.round((x-f)/(7*864e5));
}
const fmtDT = (iso)=> iso ? String(iso).replace('T',' ').slice(0,16) : '';
const sleep = (ms)=> new Promise(r=>setTimeout(r, ms));

// ─────────────────────── MAERSK API CALL ───────────────────────
const BASE_DELAY = 1200;       // ms between lanes (be gentle on the quota)
const MAX_RETRIES = 5;         // on HTTP 429
const BACKOFF = [20000, 45000, 90000, 150000, 240000]; // wait ladder for 429

async function fetchLane(origin, dest){
  const qs = new URLSearchParams({
    placeOfReceipt: origin,
    placeOfDelivery: dest,
    departureStartDate: addDays(0),
    departureEndDate: addDays(RANGE_DAYS),
  });
  const url = `${BASE}?${qs}`;
  for (let attempt=0; attempt<=MAX_RETRIES; attempt++){
    const res = await fetch(url, {
      headers: { 'Consumer-Key': API_KEY, 'API-Version': '1', 'Accept': 'application/json' },
    });
    if (res.status === 429){
      if (attempt === MAX_RETRIES) throw new Error(`HTTP 429 (quota) for ${origin}→${dest} after ${MAX_RETRIES} retries`);
      const wait = BACKOFF[Math.min(attempt, BACKOFF.length-1)];
      const ra = parseInt(res.headers.get('retry-after')||'', 10);
      const ms = Number.isFinite(ra) ? Math.max(wait, ra*1000) : wait;
      console.log(`   …429 quota on ${origin}→${dest}, waiting ${Math.round(ms/1000)}s (retry ${attempt+1}/${MAX_RETRIES})`);
      await sleep(ms);
      continue;
    }
    if (!res.ok){
      const body = await res.text().catch(()=> '');
      throw new Error(`HTTP ${res.status} for ${origin}→${dest} :: ${body.slice(0,300)}`);
    }
    return res.json();
  }
}

// ─────────────────────── NORMALISE → ROW ───────────────────────
// DCSA: response = PointToPoint[]; each has placeOfReceipt/placeOfDelivery,
// transitTime, legs[]; a Leg has transport (VESSEL/BARGE/OTHER), departure, arrival.
function legInfo(leg){
  const t = leg.transport || {};
  const sp = (t.servicePartners || [])[0] || {};
  const v  = t.vessel || {};
  return {
    mode: t.modeOfTransport || '',
    vessel: v.name || '',
    imo:    v.vesselIMONumber || '',
    voy:    sp.carrierExportVoyageNumber || '',
    svc:    sp.carrierServiceCode || '',
    svcN:   sp.carrierServiceName || '',
    depUN:  leg.departure?.location?.UNLocationCode || '',
    arrUN:  leg.arrival?.location?.UNLocationCode || '',
    depDT:  leg.departure?.dateTime || '',
    arrDT:  leg.arrival?.dateTime || '',
    dur:    (leg.departure?.dateTime && leg.arrival?.dateTime)
              ? (new Date(leg.arrival.dateTime) - new Date(leg.departure.dateTime)) : 0,
  };
}

function rowsFromResponse(json, reqOrigin, reqDest){
  const routes = Array.isArray(json) ? json : (json.routes || json.data || []);
  const out = [];
  for (const r of routes){
    const legs = (r.legs || []).map(legInfo).sort((a,b)=> new Date(a.depDT||0) - new Date(b.depDT||0));
    const vlegs = legs.filter(l => /VESSEL/i.test(l.mode));
    if (vlegs.length === 0) continue;

    // mainline = longest vessel leg; feeder = longest of the rest
    const byDur = [...vlegs].sort((a,b)=> b.dur - a.dur);
    const mother = byDur[0];
    const isTS = vlegs.length > 1;
    const feeder = isTS ? byDur[1] : null;

    const pol = r.placeOfReceipt?.location?.UNLocationCode || vlegs[0].depUN || reqOrigin;
    const pod = r.placeOfDelivery?.location?.UNLocationCode || vlegs[vlegs.length-1].arrUN || reqDest;
    const ts  = isTS ? vlegs[0].arrUN : '';          // first transshipment port
    const etd = r.placeOfReceipt?.dateTime || vlegs[0].depDT;
    const eta = r.placeOfDelivery?.dateTime || vlegs[vlegs.length-1].arrDT;
    let transit = r.transitTime;
    if (!transit && etd && eta) transit = Math.round((new Date(eta)-new Date(etd))/864e5);

    const rotation = legs.map(l=>l.depUN).concat(legs[legs.length-1]?.arrUN).filter(Boolean);

    out.push({
      carrier:'MAERSK',
      service: mother.svc || '',
      service_name: mother.svcN || '',
      pol, pod, transshipment: ts || '',
      mother_vessel: mother.vessel || '', mother_voyage: mother.voy || '', mother_imo: mother.imo || '',
      feeder_vessel: feeder ? (feeder.vessel||'') : '', feeder_voyage: feeder ? (feeder.voy||'') : '', feeder_imo: feeder ? (feeder.imo||'') : '',
      etd: fmtDT(etd), eta: fmtDT(eta),
      transit_days: transit || '',
      etd_week: etd && !isNaN(new Date(etd)) ? isoWeek(new Date(etd)) : '',
      cutoff_gatein:'', cutoff_vgm:'', cutoff_doc:'',   // not part of P2P routes
      ts_arrive: isTS ? fmtDT(vlegs[0].arrDT) : '',
      ts_depart: isTS ? fmtDT(vlegs[vlegs.length-1].depDT) : '',
      rotation: rotation.join('|'),
      space:'open', co2:'',
    });
  }
  return out;
}

// ─────────────────────────── CSV I/O ───────────────────────────
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

// ─────────────────────────── MAIN ───────────────────────────
async function main(){
  if (!API_KEY){ console.error('Missing MAERSK_API_KEY env var.'); process.exit(1); }

  const activeOrigins = new Set(ORIGINS_ACTIVE);
  let kept = [];
  if (existsSync(CSV_PATH)){
    const text = await readFile(CSV_PATH,'utf8');
    const raw = parseCsv(text);
    if (raw.length>1){
      const head = raw[0].map(h=>h.trim().toLowerCase());
      for (let r=1;r<raw.length;r++){
        const rec={}; COLS.forEach(c=>{ const k=head.indexOf(c); rec[c]= k>=0?(raw[r][k]||'').trim():''; });
        const isMaersk = (rec.carrier||'').toUpperCase()==='MAERSK';
        // keep: every non-Maersk row, AND Maersk rows whose POL is NOT in this run's slice
        if (!isMaersk || !activeOrigins.has((rec.pol||'').toUpperCase())) kept.push(rec);
      }
    }
  }
  console.log(`Slice: ${GROUP} · ${LANES.length} lanes · keeping ${kept.length} existing rows`);

  const fresh = []; let firstRaw = null, ok=0, fail=0, quota=false;
  for (const [o,d] of LANES){
    try {
      const json = await fetchLane(o,d);
      if (!firstRaw) firstRaw = json;
      const rows = rowsFromResponse(json, o, d);
      fresh.push(...rows); ok++;
      console.log(`OK ${o}->${d}: ${rows.length} sailings`);
    } catch(e){
      fail++;
      console.warn(`WARN ${o}->${d}: ${e.message}`);
      if (/429|quota/i.test(e.message)) { quota=true; }
    }
    await sleep(BASE_DELAY);
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

  // safety: if this run got almost nothing AND we hit quota, keep prior Maersk rows
  // for the active slice rather than wiping them to near-empty.
  let all = [...kept, ...dedup];
  await writeFile(CSV_PATH, toCsv(all));
  console.log(`\n${CSV_PATH}: ${kept.length} kept + ${dedup.length} Maersk(${GROUP}) = ${all.length} total (lanes ok:${ok} fail:${fail})`);
  if (quota) console.log('⚠ Hit API quota (429). Run a smaller slice via LANE_GROUP=china|india|bdvn, or space runs across days.');
  if (dedup.length===0) console.log('No Maersk parsed for this slice — run with --debug and inspect maersk-raw.json.');
}

main().catch(e=>{ console.error(e); process.exit(1); });
