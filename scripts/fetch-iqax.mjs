// fetch-iqax.mjs — pull ALL carriers from IQAX BigSchedules → sailings.csv
//
// IQAX "Sailing Schedules Query API" (Big Schedules v2.0.1)
//   GET {IQAX_BASE}/openapi/schedules/routeschedules
//   auth: appKey query param
// One request per lane returns EVERY carrier's routes, grouped — so this single
// script replaces all per-carrier integrations.
//
// Node 18+. Secrets (GitHub → Settings → Secrets → Actions):
//   IQAX_APP_KEY   your appKey
//   IQAX_BASE      your account host, e.g. https://api.bigschedules.com
//                  (the docs show https://xxxxx.bigschedules.com — use yours)
//
// Local test:  IQAX_APP_KEY=xxx IQAX_BASE=https://api.bigschedules.com \
//              node scripts/fetch-iqax.mjs --debug

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

// ─────────────────────────── CONFIG ───────────────────────────
const APP_KEY = process.env.IQAX_APP_KEY;
// Normalise host: ensure scheme, strip trailing slash. Accepts "api.x.com",
// "https://api.x.com", or "https://api.x.com/" — all become a valid base.
function normBase(v){
  let b = String(v || 'https://api.bigschedules.com').trim();
  if (!/^https?:\/\//i.test(b)) b = 'https://' + b;   // add scheme if missing
  return b.replace(/\/+$/,'');                          // drop trailing slash(es)
}
const BASE = normBase(process.env.IQAX_BASE);
const DEBUG   = process.argv.includes('--debug');
const SEARCH_WEEKS = 6;            // 1..8
const CSV_PATH = 'sailings.csv';

// SCAC → our display name. MAERSK is intentionally EXCLUDED here — it comes
// from the dedicated Maersk API script. IQAX owns the other carriers.
// (Carrier list matches your IQAX licence scope.)
const SCAC_TO_NAME = {
  MSCU:'MSC',
  HLCU:'HAPAG-LLOYD',
  COSU:'COSCO',
  OOLU:'OOCL',
  YMLU:'YANG MING',
  ONEY:'ONE',
  CMDU:'CMA CGM',
  EGLV:'EVERGREEN',
};
const CARRIER_PARAM = Object.keys(SCAC_TO_NAME).join(';');   // IQAX uses ';' separators
const EXCLUDE_CARRIERS = new Set(['MAERSK']);               // safety: never write Maersk from IQAX

// ── IQAX port codes (from your licence scope) → our canonical code ──
// The KEY only accepts the IQAX codes, so we REQUEST with them, then map the
// response back to our standard codes so the CSV/site stay consistent with
// Maersk's UN/LOCODEs. Codes not listed pass through unchanged.
const IQAX_TO_CANON = {
  CNSHG:'CNSHA',   // Shanghai
  CNSZX:'CNYTN',   // Shenzhen / Yantian
  CNTSN:'CNTXG',   // Tianjin / Xingang
  VNCMV:'VNCMT',   // Cai Mep
  VNQNH:'VNUIH',   // Quy Nhon
};
const toCanon = (code)=> IQAX_TO_CANON[(code||'').toUpperCase()] || (code||'').toUpperCase();

// ── Lanes by COUNTRY PAIR — REQUEST uses IQAX scope codes ──
const ORIGIN_GROUPS = {
  cn: ['CNTAO','CNDLC','CNTSN','CNXMN','CNLYG','CNNKG','CNSHG','CNNGB','CNSZX','CNNSA','CNCAN'],
  in: ['INTUT','INMAA','INNML','INCOK','INCCU','INNSA','INBOM','INMUN'],
  bd: ['BDCGP','BDDAC','BDMGL'],
  vn: ['VNQNH','VNDAD','VNCMV','VNSGN'],
};
const DEST_GROUPS = {
  pl: ['PLGDN','PLGDY'],
  de: ['DEHAM','DEBRV','DEWVN'],
  nl: ['NLRTM'],
  be: ['BEANR'],
};

// LANE_GROUP accepts: "cn-pl" · "cn" · "cn-pl,in-de" · "all". Default "all".
function buildLanes(token){
  token = String(token || 'all').toLowerCase().trim();
  const pairs = [];
  const expand = (t)=>{
    if (!t) return;
    if (t === 'all'){ for (const o of Object.keys(ORIGIN_GROUPS)) for (const d of Object.keys(DEST_GROUPS)) pairs.push([o,d]); return; }
    if (t.includes('-')){ const [o,d]=t.split('-'); if (ORIGIN_GROUPS[o] && DEST_GROUPS[d]) pairs.push([o,d]); return; }
    if (ORIGIN_GROUPS[t]){ for (const d of Object.keys(DEST_GROUPS)) pairs.push([t,d]); return; }
  };
  token.split(',').forEach(s=>expand(s.trim()));
  const lanes = [];
  for (const [o,d] of pairs)
    for (const por of ORIGIN_GROUPS[o])
      for (const fnd of DEST_GROUPS[d])
        lanes.push([por, fnd]);
  return lanes;
}
const GROUP = (process.env.LANE_GROUP || 'all').toLowerCase();
const LANES = buildLanes(GROUP);
const ACTIVE_LANES = new Set(LANES.map(([o,d])=>`${o}|${d}`));

const COLS = ['carrier','service','service_name','pol','pod','transshipment',
  'mother_vessel','mother_voyage','mother_imo','feeder_vessel','feeder_voyage','feeder_imo',
  'etd','eta','transit_days','etd_week','cutoff_gatein','cutoff_vgm','cutoff_doc',
  'ts_arrive','ts_depart','rotation','space','co2','fetched_at'];

const NOW_ISO = new Date().toISOString();

// Stable identity of a sailing — does NOT include the fields a carrier may
// revise (etd/eta/cutoffs). Voyage number is the key discriminator; vessel +
// service guard against collisions. If voyage is missing, fall back to ETD so
// we don't merge two genuinely different sailings.
const _norm = (s)=> (s==null?'':String(s)).trim().toUpperCase();
function sailKey(r){
  const voy = _norm(r.mother_voyage);
  return [_norm(r.carrier),_norm(r.pol),_norm(r.pod),_norm(r.transshipment),
          _norm(r.service),_norm(r.mother_vessel), voy || ('ETD:'+_norm(r.etd))].join('|');
}
// Collapse duplicates: among rows sharing a key, keep the one fetched most
// recently (newest fetched_at wins; ties favour the later/fresh row).
function dedupeKeepNewest(rows){
  const best = new Map();
  for (const r of rows){
    const k = sailKey(r);
    const prev = best.get(k);
    if (!prev){ best.set(k, r); continue; }
    const tp = Date.parse(prev.fetched_at||'') || 0;
    const tr = Date.parse(r.fetched_at||'') || 0;
    if (tr >= tp) best.set(k, r);
  }
  return [...best.values()];
}

// ─────────────────────────── HELPERS ───────────────────────────
const sleep = (ms)=> new Promise(r=>setTimeout(r, ms));
function isoWeek(d){
  const x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
  const day=(x.getUTCDay()+6)%7; x.setUTCDate(x.getUTCDate()-day+3);
  const f=new Date(Date.UTC(x.getUTCFullYear(),0,4));
  const fd=(f.getUTCDay()+6)%7; f.setUTCDate(f.getUTCDate()-fd+3);
  return 1+Math.round((x-f)/(7*864e5));
}
const fmtDT = (iso)=> iso ? String(iso).replace('T',' ').slice(0,16) : '';

// ─────────────────────── IQAX API CALL ───────────────────────
// License limits: 150 calls/day, max 30 calls/min. 2500ms ≈ 24/min (safe).
const BASE_DELAY = 2500;
const MAX_RETRIES = 5;
const BACKOFF = [20000, 45000, 90000, 150000, 240000];

async function fetchLane(porID, fndID){
  const today = new Date().toISOString().slice(0,10);
  const qs = new URLSearchParams({
    appKey: APP_KEY,
    porID, fndID,
    searchDuration: String(SEARCH_WEEKS),
    departureFrom: today,
    carrier: CARRIER_PARAM,
    enableNearbySchedules: 'false',
    useRealTimeData: 'false',
  });
  const url = `${BASE}/openapi/schedules/routeschedules?${qs}`;
  for (let attempt=0; attempt<=MAX_RETRIES; attempt++){
    let res;
    try { res = await fetch(url, { headers:{ 'Accept':'application/json', 'Referer':'https://www.bigschedules.com', 'Origin':'https://www.bigschedules.com' } }); }
    catch(e){ if(attempt===MAX_RETRIES) throw e; await sleep(BACKOFF[Math.min(attempt,BACKOFF.length-1)]); continue; }
    if (res.status === 401){
      const b = await res.text().catch(()=> '');
      // 401 can mean quota exceeded (per docs) — back off and retry a few times
      if (/quota/i.test(b) && attempt < MAX_RETRIES){
        const wait = BACKOFF[Math.min(attempt,BACKOFF.length-1)];
        console.log(`   …401/quota on ${porID}→${fndID}, waiting ${Math.round(wait/1000)}s (retry ${attempt+1})`);
        await sleep(wait); continue;
      }
      throw new Error(`HTTP 401 for ${porID}→${fndID} :: ${b.slice(0,200)}`);
    }
    if (res.status === 504 && attempt < MAX_RETRIES){ await sleep(BACKOFF[Math.min(attempt,BACKOFF.length-1)]); continue; }
    if (!res.ok){
      const b = await res.text().catch(()=> '');
      throw new Error(`HTTP ${res.status} for ${porID}→${fndID} :: ${b.slice(0,200)}`);
    }
    return res.json();
  }
}

// ─────────────────────── NORMALISE → ROWS ───────────────────────
function rowsFromResponse(json, reqPor, reqFnd){
  const out = [];
  const groups = json.routeGroupsList || [];
  for (const g of groups){
    const scac = (g.carrier?.scac || '').toUpperCase();
    const carrier = SCAC_TO_NAME[scac] || (g.carrier?.name || scac || '').toUpperCase();
    if (!carrier || EXCLUDE_CARRIERS.has(carrier)) continue;   // never write Maersk from IQAX
    for (const r of (g.route || [])){
      const legs = r.leg || [];
      const vlegs = legs.filter(l => /VESSEL/i.test(l.transportMode || ''));
      if (vlegs.length === 0) continue;

      const unlo = (pt)=> pt?.location?.unlocode || '';
      const pol = toCanon(unlo(vlegs[0].fromPoint) || r.por?.location?.unlocode || reqPor);
      const pod = toCanon(unlo(vlegs[vlegs.length-1].toPoint) || r.fnd?.location?.unlocode || reqFnd);
      const isTS = vlegs.length > 1;

      // mainline (mother) = vessel leg with the longest transitTime; feeder = first other vessel leg
      const byDur = [...vlegs].sort((a,b)=> (b.transitTime||0) - (a.transitTime||0));
      const mother = byDur[0];
      const feeder = isTS ? (vlegs.find(l => l !== mother) || null) : null;
      const ts = isTS ? toCanon(unlo(mother.fromPoint)) : '';

      const svc = mother.service || {};
      const svcCode = svc.externalCode || svc.code || '';
      const svcName = svc.name || '';

      const etd = r.por?.etd || mother.fromPoint?.etd || vlegs[0].fromPoint?.etd;
      const eta = r.fnd?.eta || mother.toPoint?.eta || vlegs[vlegs.length-1].toPoint?.eta;
      let transit = r.transitTime;
      if (!transit && etd && eta) transit = Math.round((new Date(eta)-new Date(etd))/864e5);

      const cut = r.cutoffTime || {};
      const rotation = vlegs.map(l => toCanon(unlo(l.fromPoint))).concat(toCanon(unlo(vlegs[vlegs.length-1].toPoint))).filter(Boolean);

      out.push({
        carrier,
        service: svcCode,
        service_name: svcName,
        pol, pod, transshipment: ts || '',
        mother_vessel: mother.vessel?.name || '', mother_voyage: mother.externalVoyageNumber || mother.internalVoyageNumber || '', mother_imo: mother.vessel?.IMO || mother.imoNumber || '',
        feeder_vessel: feeder ? (feeder.vessel?.name || '') : '', feeder_voyage: feeder ? (feeder.externalVoyageNumber || feeder.internalVoyageNumber || '') : '', feeder_imo: feeder ? (feeder.vessel?.IMO || feeder.imoNumber || '') : '',
        etd: fmtDT(etd), eta: fmtDT(eta),
        transit_days: transit || '',
        etd_week: etd && !isNaN(new Date(etd)) ? isoWeek(new Date(etd)) : '',
        cutoff_gatein: fmtDT(cut.cyCutoffTime), cutoff_vgm: fmtDT(cut.vgmCutoffTime), cutoff_doc: fmtDT(cut.siCutoffTime),
        ts_arrive: isTS ? fmtDT(feeder?.toPoint?.eta) : '',
        ts_depart: isTS ? fmtDT(mother.fromPoint?.etd) : '',
        rotation: rotation.join('|'),
        space:'open', co2:'',
      });
    }
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
  if (!APP_KEY){ console.error('Missing IQAX_APP_KEY env var.'); process.exit(1); }

  const activeLanes = ACTIVE_LANES;
  // IQAX owns all NON-Maersk carriers. Keep: every Maersk row (owned by the
  // Maersk script), and any row whose lane is outside this run's slice.
  let kept = [];
  if (existsSync(CSV_PATH)){
    const raw = parseCsv(await readFile(CSV_PATH,'utf8'));
    if (raw.length>1){
      const head = raw[0].map(h=>h.trim().toLowerCase());
      for (let r=1;r<raw.length;r++){
        const rec={}; COLS.forEach(c=>{ const k=head.indexOf(c); rec[c]= k>=0?(raw[r][k]||'').trim():''; });
        const isMaersk = (rec.carrier||'').toUpperCase()==='MAERSK';
        const lane = `${(rec.pol||'').toUpperCase()}|${(rec.pod||'').toUpperCase()}`;
        if (isMaersk || !activeLanes.has(lane)) kept.push(rec);
      }
    }
  }
  console.log(`IQAX slice: ${GROUP} · ${LANES.length} lanes · keeping ${kept.length} existing rows (incl. Maersk)`);

  const fresh=[]; let firstRaw=null, ok=0, fail=0, quota=false;
  for (const [o,d] of LANES){
    try {
      const json = await fetchLane(o,d);
      if (!firstRaw) firstRaw = json;
      const rows = rowsFromResponse(json, o, d);
      rows.forEach(r => { r.fetched_at = NOW_ISO; });   // stamp this pull
      fresh.push(...rows); ok++;
      const carriers = new Set(rows.map(r=>r.carrier)).size;
      console.log(`OK ${o}->${d}: ${rows.length} sailings (${carriers} carriers)`);
    } catch(e){ fail++; console.warn(`WARN ${o}->${d}: ${e.message}`); if(/quota|401/i.test(e.message)) quota=true; }
    await sleep(BASE_DELAY);
  }

  if (DEBUG && firstRaw){ await writeFile('iqax-raw.json', JSON.stringify(firstRaw,null,2)); console.log('wrote iqax-raw.json'); }

  // Combine kept + fresh, then collapse duplicates keeping the NEWEST pull.
  // This removes repeats across weekly runs and, when a carrier revised a
  // sailing, drops the older version in favour of the latest fetch.
  const combined = [...kept, ...fresh];
  const before = combined.length;
  const all = dedupeKeepNewest(combined);
  const removed = before - all.length;

  const byCarrier = {};
  all.forEach(r=>{ byCarrier[r.carrier]=(byCarrier[r.carrier]||0)+1; });

  await writeFile(CSV_PATH, toCsv(all));
  console.log(`\n${CSV_PATH}: ${kept.length} kept + ${fresh.length} fresh → ${all.length} after dedupe (removed ${removed} older/dupe) (lanes ok:${ok} fail:${fail})`);
  console.log('   by carrier: ' + Object.entries(byCarrier).map(([k,v])=>`${k}:${v}`).join('  '));
  if (quota) console.log('⚠ Hit quota/401. Use a smaller country-pair via LANE_GROUP (e.g. in-de) and spread runs across days.');
  if (fresh.length===0) console.log('No sailings parsed — run with --debug and inspect iqax-raw.json (check IQAX_BASE host + appKey).');
}

main().catch(e=>{ console.error(e); process.exit(1); });
