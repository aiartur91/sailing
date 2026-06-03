// Variant D hi-fi — root app: state, filtering, sorting, selection, shortlist.
const { useState: uS, useEffect: uE, useRef: uR, useMemo: uM } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": ["#1d6fa5", "#2b8cc4"],
  "density": "regular",
  "showCutoffs": true,
  "showCo2": true
}/*EDITMODE-END*/;

const ACCENTS = [
  ["#1d6fa5", "#2b8cc4"],  // sea blue (default)
  ["#0f766e", "#14b8a6"],  // teal
  ["#3949ab", "#5c6bc0"],  // indigo
  ["#b45309", "#d97706"],  // amber/rust
];
const DENS = { compact:0.62, regular:1, comfy:1.4 };

// ── empty / edge state — "BRAK DANYCH" ──
function DataEmpty({ mode, query, onReset, onReload }) {
  const nodata = mode === 'nodata';
  return (
    <div className="dataempty">
      <div className="de-card">
        <div className={'de-ico'+(nodata?' err':'')}>
          {nodata ? Ico.warn({ width:34, height:34 }) : Ico.anchor({ width:34, height:34 })}
        </div>
        <div className="de-head">BRAK DANYCH</div>
        {nodata ? (
          <>
            <p className="de-sub">Nie udało się wczytać sailingów z pliku <span className="mono">sailings.csv</span>.
              Sprawdź, czy plik jest na stronie i ma poprawny format, a potem odśwież.</p>
            <button className="btn btn-primary btn-sm" onClick={onReload}>Reload page</button>
          </>
        ) : (
          <>
            <p className="de-sub">Żaden sailing nie pasuje do wybranych filtrów
              {query && <> dla trasy <b>{pname(query.pol)} → Gdańsk + Gdynia</b></>}.
              Spróbuj poszerzyć zakres tygodni lub wyczyść filtry.</p>
            <button className="btn btn-primary btn-sm" onClick={onReset}>Reset filters</button>
          </>
        )}
      </div>
    </div>
  );
}

function TopBar({ shortlistCount }) {
  return (
    <div className="topbar">
      <div className="brand">
        <span className="logo">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="9.2" stroke="#9cc3e0" strokeWidth="1.4" strokeDasharray="2.5 2.5"/>
            <circle cx="14" cy="14" r="3.4" fill="#2b8cc4"/>
            <g stroke="#fff" strokeWidth="1.4" strokeLinecap="round">
              <path d="M14 4v3.4M14 20.6V24M4 14h3.4M20.6 14H24M7 7l2.4 2.4M18.6 18.6 21 21M7 21l2.4-2.4M18.6 9.4 21 7"/>
            </g>
          </svg>
        </span>
        <span className="name">Sailingi</span>
        <span className="tag">Schedule search</span>
      </div>
      <div className="spacer"></div>
      <nav className="topnav">
        <a href="#" className="active">Search</a>
        <a href="#">Shortlist {shortlistCount>0 && <span style={{ opacity:.7 }}>· {shortlistCount}</span>}</a>
        <a href="#">Admin · Upload</a>
      </nav>
      <div className="user">JK</div>
    </div>
  );
}

function RealApp() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [q, setQ] = uS({ pol:'CNSHA', pod:'PLGDN', weekRange:'all', carrierSel:'all' });
  const [applied, setApplied] = uS({ pol:'CNSHA', pod:'PLGDN', weekRange:'all', carrierSel:'all' });
  const [filter, setFilter] = uS({ routing:'all', space:false });
  const [sort, setSort] = uS('etd');
  const [selId, setSelId] = uS(null);
  const [stars, setStars] = uS(()=> new Set());
  const [detailView, setDetailView] = uS(false); // mobile master→detail
  const [toast, setToast] = uS(null);
  const cardRefs = uR({});
  const toastTimer = uR(null);

  const showToast = (msg) => { setToast(msg); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(()=>setToast(null), 2200); };

  const passBase = (s) => {
    if (applied.carrierSel!=='all' && s.carrier!==applied.carrierSel) return false;
    if (applied.weekRange!=='all') {
      if (applied.weekRange==='26-28') { if (![26,27,28].includes(s.week)) return false; }
      else if (String(s.week)!==applied.weekRange) return false;
    }
    if (filter.space && s.space!=='open') return false;
    return true;
  };

  const items = uM(()=>{
    let r = S.filter(s => {
      if (!passBase(s)) return false;
      if (filter.routing==='direct' && s.ts) return false;
      if (filter.routing==='ts' && !s.ts) return false;
      return true;
    });
    return [...r].sort((a,b)=>{
      if (sort==='etd') return new Date(a.etd)-new Date(b.etd);
      if (sort==='transit') return a.transit-b.transit || (new Date(a.etd)-new Date(b.etd));
      if (sort==='carrier') return a.carrier.localeCompare(b.carrier) || (new Date(a.etd)-new Date(b.etd));
      return 0;
    });
  }, [applied, filter, sort]);

  const counts = uM(()=>{
    const base = S.filter(passBase);
    return { all: base.length, direct: base.filter(s=>!s.ts).length, ts: base.filter(s=>s.ts).length };
  }, [applied, filter.space]);

  uE(()=>{
    if (items.length===0) { setSelId(null); return; }
    if (!selId || !items.find(s=>s.id===selId)) setSelId(items[0].id);
  }, [items]);

  const sel = uM(()=> S.find(s=>s.id===selId) || null, [selId, items]);

  uE(()=>{
    const onKey = (e) => {
      if (['SELECT','INPUT','TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key!=='ArrowDown' && e.key!=='ArrowUp') return;
      e.preventDefault();
      const idx = items.findIndex(s=>s.id===selId);
      const ni = e.key==='ArrowDown' ? Math.min(items.length-1, idx+1) : Math.max(0, idx-1);
      const next = items[ni];
      if (next) { setSelId(next.id); cardRefs.current[next.id]?.scrollIntoView({ block:'nearest' }); }
    };
    window.addEventListener('keydown', onKey);
    return ()=>window.removeEventListener('keydown', onKey);
  }, [items, selId]);

  const onStar = (id) => setStars(prev=>{ const n=new Set(prev); if(n.has(id)){n.delete(id);showToast('Removed from shortlist');}else{n.add(id);showToast('Added to shortlist');} return n; });
  const onSelect = (id) => { setSelId(id); setDetailView(true); };
  const onSearch = () => { setApplied({ ...q }); showToast(`Searching ${pname(q.pol)} → Gdańsk + Gdynia`); };
  const onCopy = () => {
    if (!sel) return;
    const txt = `${sel.carrier} · ${sel.service} · ${sel.pol}${sel.ts?` → ${sel.ts}`:''} → ${sel.pod} · ETD ${fmtDateY(sel.etd)} · ETA ${fmtDateY(sel.eta)} · ${sel.transit}d · Mother: ${sel.mother.vessel} ${sel.mother.voyage}`;
    try { navigator.clipboard.writeText(txt); } catch(e){}
    showToast('Voyage details copied');
  };
  const onExport = () => showToast('Generating 1-page PDF…');

  const onResetFilters = () => {
    setFilter({ routing:'all', space:false });
    const cleared = { ...applied, weekRange:'all', carrierSel:'all' };
    setApplied(cleared); setQ(q=>({ ...q, weekRange:'all', carrierSel:'all' }));
    showToast('Filters cleared');
  };
  const onReload = () => { try { location.reload(); } catch(e){} };

  // apply visual tweaks to CSS vars
  uE(()=>{
    const r = document.documentElement.style;
    const acc = t.accent || ACCENTS[0];
    r.setProperty('--sea', acc[0]);
    r.setProperty('--sea-2', acc[1]);
    r.setProperty('--row-h', String(DENS[t.density] ?? 1));
  }, [t.accent, t.density]);

  return (
    <div className={'app'+(detailView?' detailview':'')}>
      <TopBar shortlistCount={stars.size}/>
      <SearchBar q={q} setQ={setQ} onSearch={onSearch}/>
      <Filters filter={filter} setFilter={setFilter} counts={counts}/>
      <div className="body">
        <div className="split">
          {items.length===0 ? (
            <DataEmpty mode={S.length===0?'nodata':'nofilter'} query={applied}
              onReset={onResetFilters} onReload={onReload}/>
          ) : (
            <>
              <ListPane items={items} selId={selId} stars={stars} onSelect={onSelect} onStar={onStar}
                sort={sort} setSort={setSort} cardRefs={cardRefs}/>
              <DetailPane s={sel} star={sel?stars.has(sel.id):false} onStar={()=>sel&&onStar(sel.id)}
                onExport={onExport} onCopy={onCopy} onBack={()=>setDetailView(false)}
                showCutoffs={t.showCutoffs} showCo2={t.showCo2}/>
            </>
          )}
        </div>
      </div>

      <div className={'tray'+(stars.size>0?' show':'')}>
        <div className="ct">{Ico.star({ fill:'#fff', width:16, height:16 })} <span><b>{stars.size}</b></span> in shortlist</div>
        <button className="btn btn-sm" style={{ background:'rgba(255,255,255,.14)', color:'#fff' }} onClick={()=>showToast('Opening shortlist…')}>View</button>
        <button className="btn btn-sm btn-primary" onClick={()=>showToast('Exporting shortlist to Excel…')}>{Ico.pdf({ stroke:'#fff' })} Export all</button>
      </div>

      <div className={'toast'+(toast?' show':'')}>{toast && <>{Ico.check({ stroke:'#7ee0a6' })} {toast}</>}</div>

      <TweaksPanel>
        <TweakSection label="Appearance" />
        <TweakColor label="Accent" value={t.accent} options={ACCENTS}
          onChange={(v)=>setTweak('accent', v)} />
        <TweakRadio label="Density" value={t.density} options={['compact','regular','comfy']}
          onChange={(v)=>setTweak('density', v)} />
        <TweakSection label="Detail panel" />
        <TweakToggle label="Show cut-offs" value={t.showCutoffs} onChange={(v)=>setTweak('showCutoffs', v)} />
        <TweakToggle label="Show CO₂ estimate" value={t.showCo2} onChange={(v)=>setTweak('showCo2', v)} />
      </TweaksPanel>
    </div>
  );
}

// ── CSV → sailing objects ─────────────────────────────────────
// Lets the production site read sailings from an editable sailings.csv
// (filled in Excel / Google Sheets) instead of hard-coded JS.
function parseCsv(text){
  const rows = []; let i=0, field='', row=[], inQ=false;
  text = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  while (i < text.length){
    const c = text[i];
    if (inQ){
      if (c==='"'){ if (text[i+1]==='"'){ field+='"'; i+=2; continue; } inQ=false; i++; continue; }
      field+=c; i++; continue;
    }
    if (c==='"'){ inQ=true; i++; continue; }
    if (c===','){ row.push(field); field=''; i++; continue; }
    if (c==='\n'){ row.push(field); rows.push(row); field=''; row=[]; i++; continue; }
    field+=c; i++;
  }
  if (field.length || row.length){ row.push(field); rows.push(row); }
  return rows.filter(r => r.length>1 || (r.length===1 && r[0].trim()!==''));
}

function isoWeek(dt){
  const d = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
  const day = (d.getUTCDay()+6)%7; d.setUTCDate(d.getUTCDate()-day+3);
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(),0,4));
  const fday = (firstThu.getUTCDay()+6)%7; firstThu.setUTCDate(firstThu.getUTCDate()-fday+3);
  return 1 + Math.round((d-firstThu)/(7*864e5));
}

function csvToSailings(text){
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const head = rows[0].map(h=>h.trim().toLowerCase());
  const idx = (name)=> head.indexOf(name);
  const out = [];
  for (let r=1; r<rows.length; r++){
    const c = rows[r];
    const g = (name)=>{ const k=idx(name); return k>=0 ? (c[k]||'').trim() : ''; };
    if (!g('carrier') || !g('pol') || !g('pod')) continue;
    const etd = g('etd').replace(' ','T');
    const eta = g('eta').replace(' ','T');
    const ts = g('transshipment') || null;
    const transit = g('transit_days') ? +g('transit_days')
      : (etd && eta ? Math.round((new Date(eta)-new Date(etd))/864e5) : null);
    const week = g('etd_week') ? +g('etd_week') : (etd && !isNaN(new Date(etd)) ? isoWeek(new Date(etd)) : null);
    const norm = (x)=> x ? x.replace(' ','T') : '';
    const cutoffs = {};
    if (g('cutoff_gatein')) cutoffs.gateIn = norm(g('cutoff_gatein'));
    if (g('cutoff_vgm'))    cutoffs.vgm    = norm(g('cutoff_vgm'));
    if (g('cutoff_doc'))    cutoffs.doc    = norm(g('cutoff_doc'));
    const rotation = g('rotation') ? g('rotation').split(/[|>;]/).map(s=>s.trim()).filter(Boolean)
      : [g('pol'), ts, g('pod')].filter(Boolean);
    out.push({
      id: 'r'+r,
      carrier: g('carrier').toUpperCase(),
      service: g('service') || '—',
      serviceName: g('service_name') || '',
      pol: g('pol').toUpperCase(), pod: g('pod').toUpperCase(),
      ts: ts ? ts.toUpperCase() : null,
      mother: { vessel: g('mother_vessel')||'—', voyage: g('mother_voyage')||'—', imo: g('mother_imo')||'—' },
      feeder: ts ? { vessel: g('feeder_vessel')||'Feeder TBA', voyage: g('feeder_voyage')||'—', imo: g('feeder_imo')||'—' } : null,
      etd, eta, transit, week,
      cutoffs,
      tsArrive: norm(g('ts_arrive')), tsDepart: norm(g('ts_depart')),
      rotation,
      space: (g('space')||'open').toLowerCase(),
      co2: g('co2') || '—',
    });
  }
  return out;
}

// ── boot: try sailings.csv, else use embedded fallback, then render ──
async function boot(){
  try {
    const res = await fetch('sailings.csv', { cache:'no-store' });
    if (res.ok){
      const rows = csvToSailings(await res.text());
      if (rows.length){ window.SAILINGS.length = 0; rows.forEach(x=>window.SAILINGS.push(x)); }
    }
  } catch(e){ /* file:// or missing CSV → keep embedded data */ }
  ReactDOM.createRoot(document.getElementById('root')).render(<RealApp/>);
}
boot();
