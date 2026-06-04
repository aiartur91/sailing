// Variant D hi-fi — voyage detail pane.
const { useMemo: useMemoD } = React;

// route strip across the top of detail
function RouteStrip({ s }) {
  const rot = s.rotation || [s.pol, s.pod];
  return (
    <div className="routestrip scroll">
      {rot.map((code, i) => {
        const isEnd = i===0 || i===rot.length-1;
        const known = !!PORTS[code];
        return (
          <React.Fragment key={i}>
            {i>0 && (
              <div className={'rs-link'+( (code===s.pod||rot[i-1]===s.pol)&&!s.ts ? ' solid':'' )}>
                <div className="line"></div>
              </div>
            )}
            <div className={'rs-port'+(isEnd?' endpoint':'')}>
              <div className="seg-dot"></div>
              <div className="pc">{known? pname(code) : code}</div>
              <div className="pn mono">{code}</div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// build the voyage timeline steps from a sailing
function buildSteps(s) {
  const steps = [];
  steps.push({ kind:'port', node:'port', when:`Cut-offs before ETD`, what:`${pname(s.pol)} · ${s.pol}`,
    sub:'Port of loading', cutoffs:s.cutoffs });
  if (s.ts) {
    steps.push({ kind:'depart', node:'dot', when:`${fmtDOW(s.etd)} ${fmtDateY(s.etd)} · ${fmtTime(s.etd)}`,
      what:`Feeder departs · ${s.feeder.vessel}`, detail:[['Voyage', s.feeder.voyage],['IMO', s.feeder.imo]] });
    steps.push({ kind:'transit', node:'transit', note:`Feeder leg to ${pname(s.ts)}` });
    steps.push({ kind:'ts', node:'dot', when:`${fmtDate(s.tsArrive)} → ${fmtDate(s.tsDepart)}`,
      what:`Transshipment · ${pname(s.ts)} (${s.ts})`,
      detail:[['Arrive', `${fmtDateY(s.tsArrive)} ${fmtTime(s.tsArrive)}`],['Connect', `${fmtDateY(s.tsDepart)} ${fmtTime(s.tsDepart)}`]] });
    steps.push({ kind:'depart', node:'dot', when:`${fmtDOW(s.tsDepart)} ${fmtDateY(s.tsDepart)} · ${fmtTime(s.tsDepart)}`,
      what:`Mother vessel departs · ${s.mother.vessel}`, detail:[['Voyage', s.mother.voyage],['IMO', s.mother.imo],['Service', `${s.service} · ${s.serviceName}`]] });
    steps.push({ kind:'transit', node:'transit', note:`Mainline leg · Asia → North Europe` });
  } else {
    steps.push({ kind:'depart', node:'dot', when:`${fmtDOW(s.etd)} ${fmtDateY(s.etd)} · ${fmtTime(s.etd)}`,
      what:`Mother vessel departs · ${s.mother.vessel}`, detail:[['Voyage', s.mother.voyage],['IMO', s.mother.imo],['Service', `${s.service} · ${s.serviceName}`]] });
    steps.push({ kind:'transit', node:'transit', note:`Direct deepsea call · Asia → ${pname(s.pod)}` });
  }
  steps.push({ kind:'port', node:'port', when:`${fmtDOW(s.eta)} ${fmtDateY(s.eta)} · ${fmtTime(s.eta)}`,
    what:`${pname(s.pod)} · ${s.pod}`, sub:'Port of discharge — ETA' });
  return steps;
}

function CutoffRow({ cutoffs }) {
  const items = [['Gate-in', cutoffs.gateIn],['VGM', cutoffs.vgm],['Doc / SI', cutoffs.doc]].filter(([k,v])=>v);
  if (!items.length) return null;
  return (
    <div className="cutoff-row">
      {items.map(([k,v],i)=>(
        <div className={'cutoff'+(i===0?' soon':'')} key={k}>
          <span className="cl">{k} cut-off</span>
          <span className="cv mono">{fmtDate(v)} · {fmtTime(v)}</span>
        </div>
      ))}
    </div>
  );
}

function Timeline({ s, showCutoffs=true }) {
  const steps = buildSteps(s);
  return (
    <div className="timeline">
      {steps.map((st,i)=>(
        <div className="tl-step" key={i}>
          <div className="tl-rail"><div className={'tl-node '+st.node}></div></div>
          <div className="tl-body">
            {st.kind==='transit' ? (
              <div className="tl-transit-note">{Ico.ship({ style:{ verticalAlign:'-2px', marginRight:6, color:'var(--faint)' }})}{st.note}</div>
            ) : (
              <>
                <div className="tl-when">{st.when}</div>
                <div className="tl-what">{st.what}</div>
                {st.sub && <div className="tl-detail"><span className="lab">{st.sub}</span></div>}
                {st.detail && (
                  <div className="tl-detail">
                    {st.detail.map(([k,v])=>(
                      <span key={k}><span className="lab">{k}:</span> <span className="mono" style={{ fontSize:12.5 }}>{v}</span></span>
                    ))}
                  </div>
                )}
                {st.cutoffs && showCutoffs && <CutoffRow cutoffs={st.cutoffs}/>}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function VesselCard({ role, vessel, icon }) {
  if (!vessel) {
    return <div className="vessel-card empty"><div style={{ marginBottom:6 }}>{Ico.arrow({ width:20, height:20 })}</div><div style={{ fontWeight:600 }}>Direct — no feeder</div><div style={{ fontSize:12 }}>Single mainline vessel</div></div>;
  }
  return (
    <div className="vessel-card">
      <div className="role">{icon} {role}</div>
      <div className="vn">{vessel.vessel}</div>
      <div className="vmeta">
        <span><span style={{ color:'var(--mute)' }}>Voyage</span> <span className="mono">{vessel.voyage}</span></span>
        <span><span style={{ color:'var(--mute)' }}>IMO</span> <span className="mono">{vessel.imo}</span></span>
      </div>
    </div>
  );
}

function DetailPane({ s, star, onStar, onExport, onCopy, onBack, showCutoffs=true, showCo2=true }) {
  if (!s) {
    return (
      <div className="detail">
        <div className="d-empty">
          <span className="ring">{Ico.anchor({ width:46, height:46 })}</span>
          <div style={{ fontWeight:600, color:'var(--mute)', fontSize:15 }}>Select a sailing</div>
          <div style={{ maxWidth:240 }}>Pick a sailing on the left to see its full voyage timeline, cut-offs and vessels.</div>
        </div>
      </div>
    );
  }
  const m = CM[s.carrier];
  return (
    <div className="detail scroll">
      <div className="detail-inner">
        <button className="btn btn-ghost btn-sm backbtn" style={{ marginBottom:14 }} onClick={onBack}>{Ico.back()} Back to list</button>

        <div className="stale-banner">{Ico.clock({ style:{ color:'var(--amber)' }})} Schedule data uploaded 4 days ago — verify time-critical bookings directly with the carrier.</div>

        <div className="d-head">
          <div>
            <div className="d-title"><CarrierBadge carrier={s.carrier} service={s.service} serviceName={s.serviceName}/></div>
            <div className="d-route">
              <span className="big">{pname(s.pol)}</span>
              {s.ts && <><span className="arrow">{Ico.arrow()}</span><span className="big" style={{ fontSize:24, color:'var(--ink-3)' }}>{pname(s.ts)}</span></>}
              <span className="arrow">{Ico.arrow()}</span>
              <span className="big">{pname(s.pod)}</span>
            </div>
            <div className="d-codes mono">
              {s.pol}{s.ts && <> → {s.ts}</>} → {s.pod}
            </div>
            <div className="d-sub">
              {s.ts ? <span className="pill ts">1 transshipment · {pname(s.ts)} ({s.ts})</span> : <span className="pill direct">{Ico.check()} Direct call</span>}
              {s.space==='tight' && <span className="pill tight">{Ico.warn()} Space tight</span>}
            </div>
          </div>
          <div className="d-actions">
            <button className={'btn btn-sm '+(star?'btn-soft':'btn-ghost')} onClick={onStar}>
              {Ico.star({ fill: star?'currentColor':'none' })} {star?'Shortlisted':'Shortlist'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onCopy}>{Ico.copy()} Copy</button>
            <button className="btn btn-primary btn-sm" onClick={onExport}>{Ico.pdf({ stroke:'#fff' })} Export PDF</button>
          </div>
        </div>

        <div className="summary" style={{ gridTemplateColumns: showCo2? 'repeat(4,1fr)':'repeat(3,1fr)' }}>
          <div className="cell"><div className="k">Transit time</div><div className="v tnum">{s.transit} <small>days</small></div></div>
          <div className="cell"><div className="k">ETD · {s.pol}</div><div className="v" style={{ fontSize:16 }}>{fmtDate(s.etd)} <small>· Wk {s.week}</small></div></div>
          <div className="cell"><div className="k">ETA · {s.pod}</div><div className="v" style={{ fontSize:16 }}>{fmtDate(s.eta)}</div></div>
          {showCo2 && <div className="cell"><div className="k">Est. CO₂</div><div className="v" style={{ fontSize:16 }}>{s.co2}</div></div>}
        </div>

        <div className="card-block" style={{ marginBottom:16 }}>
          <div className="block-head"><h3>{Ico.ship({ style:{ color:'var(--sea)' }})} Service rotation</h3><span className="hint">{s.service} · {s.serviceName}</span></div>
          <RouteStrip s={s}/>
        </div>

        <div className="card-block">
          <div className="block-head"><h3>{Ico.anchor({ style:{ color:'var(--sea)' }})} Voyage timeline</h3><span className="hint">{s.ts? 'Feeder + mainline legs':'Single mainline vessel'}</span></div>
          <Timeline s={s} showCutoffs={showCutoffs}/>
        </div>

        <div className="kv-grid">
          <VesselCard role="Feeder vessel" vessel={s.feeder} icon={Ico.ship({ width:13, height:13 })}/>
          <VesselCard role="Mother vessel" vessel={s.mother} icon={Ico.ship({ width:13, height:13 })}/>
        </div>

        <div className="data-foot">Source: weekly carrier upload · {s.carrier} · file parsed Jun 29, 2026 · sailing id {s.id.toUpperCase()}</div>
      </div>
    </div>
  );
}

window.DetailPane = DetailPane;
