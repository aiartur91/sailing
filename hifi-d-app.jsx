// Variant D hi-fi — List + voyage detail (master–detail).
const { useState, useEffect, useRef, useMemo, useCallback } = React;
const S = window.SAILINGS;

// ───────────────────────── search bar ─────────────────────────
function PortSelect({ label, value, onChange, options, allLabel }) {
  const REG = window.PORT_REGIONS || {};
  // group option codes by country/region, preserving order
  const groups = [];
  const seen = {};
  options.forEach(c => {
    const cc = (window.PORTS[c]||{}).country || '—';
    if (seen[cc]===undefined){ seen[cc]=groups.length; groups.push({ region: REG[cc]||cc, codes:[c] }); }
    else groups[seen[cc]].codes.push(c);
  });
  return (
    <div className="field port">
      <label>{label}</label>
      <div className="ctrl">
        <span className="pin">{Ico.pin()}</span>
        <select value={value} onChange={e=>onChange(e.target.value)}>
          {allLabel && <option value="all">{allLabel}</option>}
          {groups.map(g => (
            <optgroup key={g.region} label={g.region}>
              {g.codes.map(c => <option key={c} value={c}>{pname(c)} ({c})</option>)}
            </optgroup>
          ))}
        </select>
      </div>
    </div>
  );
}

function SearchBar({ q, setQ, onSearch, onExport }) {
  return (
    <div className="searchbar">
      <PortSelect label="Port of loading" value={q.pol} onChange={v=>setQ(s=>({...s,pol:v}))} options={window.LANES_POL}/>
      <span className="leg-sep">{Ico.arrowS()}</span>
      <PortSelect label="Port of discharge" value={q.pod} onChange={v=>setQ(s=>({...s,pod:v}))} options={window.LANES_POD} allLabel="All destinations"/>
      <div className="field week">
        <label>ETD week</label>
        <div className="ctrl">
          {Ico.clock({ style:{ color:'var(--sea)' }})}
          <select value={q.weekRange} onChange={e=>setQ(s=>({...s,weekRange:e.target.value}))}>
            <option value="all">All weeks</option>
            {[...new Set((window.SAILINGS||[]).map(s=>s.week).filter(Boolean))].sort((a,b)=>a-b)
              .map(w => <option key={w} value={String(w)}>Week {w}</option>)}
          </select>
        </div>
      </div>
      <div className="field carrier">
        <label>Carriers</label>
        <div className="ctrl">
          <select value={q.carrierSel} onChange={e=>setQ(s=>({...s,carrierSel:e.target.value}))}>
            <option value="all">All 9 carriers</option>
            {window.CARRIER_LIST.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <button className="btn btn-primary" onClick={onSearch}>{Ico.arrowS({ stroke:'#fff' })} Search</button>
      <div className="field export">
        <label>&nbsp;</label>
        <button className="btn btn-ghost" onClick={onExport}>{Ico.pdf()} Export results</button>
      </div>
    </div>
  );
}

// ───────────────────────── filters ─────────────────────────
function Filters({ filter, setFilter, counts }) {
  const set = (k,v) => setFilter(f => ({ ...f, [k]: v }));
  return (
    <div className="filters">
      <span className="lbl">Routing</span>
      <button className={'chip'+(filter.routing==='all'?' active':'')} onClick={()=>set('routing','all')}>All <span className="count">{counts.all}</span></button>
      <button className={'chip'+(filter.routing==='direct'?' active':'')} onClick={()=>set('routing','direct')}>
        <span className="dot" style={{ background:'var(--green)' }}></span> Direct <span className="count">{counts.direct}</span>
      </button>
      <button className={'chip'+(filter.routing==='ts'?' active':'')} onClick={()=>set('routing','ts')}>
        <span className="dot" style={{ background:'var(--sea)' }}></span> 1 transshipment <span className="count">{counts.ts}</span>
      </button>
      <div style={{ width:1, height:20, background:'var(--line)', margin:'0 4px' }}></div>
      <button className={'chip'+(filter.space?' active':'')} onClick={()=>set('space',!filter.space)}>
        Space open only
      </button>
      <div style={{ flex:1 }}></div>
      <span className="lbl" style={{ marginRight:6 }}>Fastest first</span>
    </div>
  );
}

// ───────────────────────── sailing card ─────────────────────────
function SailingCard({ s, sel, star, onSelect, onStar, refCb }) {
  const m = CM[s.carrier];
  return (
    <div className={'scard'+(sel?' sel':'')} tabIndex={0} ref={refCb}
      onClick={onSelect}
      onKeyDown={e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); onSelect(); } }}>
      <div className="scard-top">
        <CarrierBadge carrier={s.carrier} service={s.service}/>
        <button className={'star'+(star?' on':'')} title={star?'Remove from shortlist':'Add to shortlist'}
          onClick={e=>{ e.stopPropagation(); onStar(); }}>
          {Ico.star({ fill: star? 'currentColor':'none' })}
        </button>
      </div>
      <div className="scard-route">
        <div className="port-blk">
          <div className="pname">{pname(s.pol)}</div>
          <div className="pcd mono">{s.pol}</div>
        </div>
        {s.ts ? (
          <>
            <span className="leg-ico">{Ico.arrowS()}</span>
            <div className="port-blk ts">
              <div className="pname ts-name">{pname(s.ts)}</div>
              <div className="pcd mono">{s.ts}</div>
            </div>
            <span className="leg-ico">{Ico.arrowS()}</span>
          </>
        ) : (
          <span className="leg-ico" style={{ margin:'0 2px' }}>{Ico.arrow({ width:22, height:22 })}</span>
        )}
        <div className="port-blk">
          <div className="pname">{pname(s.pod)}</div>
          <div className="pcd mono">{s.pod}</div>
        </div>
        <div style={{ flex:1 }}></div>
        {s.ts ? <span className="pill ts">1 TS</span> : <span className="pill direct">{Ico.check()} Direct</span>}
      </div>
      <div className="scard-meta">
        <span><b style={{ color:'var(--ink-2)' }}>{fmtDate(s.etd)}</b> → {fmtDate(s.eta)}</span>
        <span className="sep"></span>
        <span className="tnum">{s.transit} days</span>
        <span className="sep"></span>
        <span className="pill wk">Wk {s.week}</span>
        {s.space==='tight' && <span className="pill tight" style={{ marginLeft:'auto' }}>Space tight</span>}
      </div>
    </div>
  );
}

// ───────────────────────── list pane ─────────────────────────
function ListPane({ items, selId, stars, onSelect, onStar, sort, setSort, cardRefs }) {
  // group by week
  const groups = useMemo(()=>{
    const g = {};
    items.forEach(s => { (g[s.week] = g[s.week] || []).push(s); });
    return Object.keys(g).sort().map(w => ({ week:w, items:g[w] }));
  }, [items]);

  return (
    <div className="listpane">
      <div className="listhead">
        <div className="count"><b>{items.length}</b> sailings · {window.LANES_POD.length===2?'Gdańsk + Gdynia':''}</div>
        <div className="sortsel">
          <span style={{ color:'var(--mute)' }}>Sort</span>
          <select value={sort} onChange={e=>setSort(e.target.value)}>
            <option value="etd">ETD (earliest)</option>
            <option value="transit">Transit time</option>
            <option value="carrier">Carrier</option>
          </select>
        </div>
      </div>
      <div className="list scroll">
        {groups.map(g => (
          <React.Fragment key={g.week}>
            <div className="grp-label">Week {g.week} · 2026</div>
            {g.items.map(s => (
              <SailingCard key={s.id} s={s} sel={s.id===selId} star={stars.has(s.id)}
                onSelect={()=>onSelect(s.id)} onStar={()=>onStar(s.id)}
                refCb={el=>{ if(el) cardRefs.current[s.id]=el; }} />
            ))}
          </React.Fragment>
        ))}
        {items.length===0 && (
          <div style={{ textAlign:'center', color:'var(--faint)', padding:'48px 20px' }}>
            <div style={{ marginBottom:8 }}>{Ico.anchor({ width:30, height:30 })}</div>
            No sailings match these filters.
          </div>
        )}
      </div>
    </div>
  );
}

window.SearchBar = SearchBar;
window.Filters = Filters;
window.ListPane = ListPane;
