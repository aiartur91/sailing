// Sailing editor — UI (form + paste-assist + table + CSV import/export)
const { useState: uS, useEffect: uE, useRef: uR, useMemo: uM } = React;
const E = window.__editor;
const { COLS, parseCsv, rowsToCsv, formToRecord, recordToForm, blankForm,
  CARRIERS, CM, PORTS, CN_PORTS, PL_PORTS, HUB_PORTS, I, pname, calcTransit, calcWeek, fmtShort, LS_KEY } = E;

function CMark({ carrier, sm }){
  const m = CM[carrier] || { short:'?', color:'#888' };
  return <span className="cmk"><span className="sw" style={{ background:m.color }}>{m.short}</span>{!sm && carrier}</span>;
}

function PortOpts({ codes }){
  const REG = window.PORT_REGIONS || {};
  const groups = []; const seen = {};
  codes.forEach(c => {
    const cc = (PORTS[c]||{}).country || '—';
    if (seen[cc]===undefined){ seen[cc]=groups.length; groups.push({ region: REG[cc]||cc, codes:[c] }); }
    else groups[seen[cc]].codes.push(c);
  });
  return groups.map(g => (
    <optgroup key={g.region} label={g.region}>
      {g.codes.map(c => <option key={c} value={c}>{pname(c)} ({c})</option>)}
    </optgroup>
  ));
}

function Field({ label, req, children, hint }){
  return (
    <div className="field">
      <label>{label}{req && <span className="req"> *</span>}</label>
      {children}
      {hint && <div className="help">{hint}</div>}
    </div>
  );
}

// ── paste-assist: split a copied row into our column order ──
function splitPaste(text){
  let parts;
  if (text.includes('\t')) parts = text.split('\t');
  else if (text.includes(';')) parts = text.split(';');
  else parts = text.split(',');
  return parts.map(p=>p.trim());
}

function EditorApp(){
  const [form, setForm] = uS(blankForm());
  const [rows, setRows] = uS(()=>{ try{ const v=localStorage.getItem(LS_KEY); return v?JSON.parse(v):[]; }catch(e){ return []; } });
  const [editIdx, setEditIdx] = uS(-1);
  const [showCutoffs, setShowCutoffs] = uS(false);
  const [showAdv, setShowAdv] = uS(false);
  const [paste, setPaste] = uS('');
  const [pasteTokens, setPasteTokens] = uS(null);
  const [toast, setToast] = uS(null);
  const [errs, setErrs] = uS({});
  const fileRef = uR(null);
  const toastT = uR(null);
  const set = (k,v)=> setForm(f=>({ ...f, [k]:v }));
  const showToast = (m)=>{ setToast(m); clearTimeout(toastT.current); toastT.current=setTimeout(()=>setToast(null),2200); };

  uE(()=>{ try{ localStorage.setItem(LS_KEY, JSON.stringify(rows)); }catch(e){} }, [rows]);

  // try to preload existing sailings.csv once (so editor continues your data)
  uE(()=>{
    if (rows.length) return;
    fetch('sailings.csv',{ cache:'no-store' }).then(r=>r.ok?r.text():null).then(t=>{
      if(!t) return;
      const parsed = csvToRows(t);
      if(parsed.length){ setRows(parsed); showToast(`Loaded ${parsed.length} sailings from sailings.csv`); }
    }).catch(()=>{});
  }, []);

  function csvToRows(text){
    const raw = parseCsv(text);
    if(raw.length<2) return [];
    const head = raw[0].map(h=>h.trim().toLowerCase());
    const out=[];
    for(let i=1;i<raw.length;i++){
      const c=raw[i]; const rec={};
      COLS.forEach(col=>{ const k=head.indexOf(col); rec[col]= k>=0 ? (c[k]||'').trim() : ''; });
      if(rec.carrier && rec.pol && rec.pod) out.push(rec);
    }
    return out;
  }

  const transit = calcTransit(form.etd, form.eta);
  const week = calcWeek(form.etd);

  function validate(){
    const e={};
    if(!form.carrier) e.carrier=1;
    if(!form.pol) e.pol=1;
    if(!form.pod) e.pod=1;
    if(!form.etd) e.etd=1;
    if(!form.eta) e.eta=1;
    if(form.etd && form.eta && new Date(form.eta) < new Date(form.etd)) e.eta=1;
    setErrs(e);
    return Object.keys(e).length===0;
  }

  function addOrSave(){
    if(!validate()){ showToast('Fill required fields (marked *)'); return; }
    const rec = formToRecord(form);
    if(editIdx>=0){ setRows(rs=>rs.map((r,i)=>i===editIdx?rec:r)); showToast('Sailing updated'); }
    else { setRows(rs=>[...rs, rec]); showToast('Sailing added'); }
    setForm(f=>({ ...blankForm(), carrier:f.carrier, pol:f.pol, pod:f.pod, routing:f.routing, transshipment:f.transshipment }));
    setEditIdx(-1); setErrs({});
  }
  function editRow(i){ setForm(recordToForm(rows[i])); setEditIdx(i); window.scrollTo({top:0,behavior:'smooth'}); }
  function delRow(i){ setRows(rs=>rs.filter((_,x)=>x!==i)); if(editIdx===i){ setEditIdx(-1); setForm(blankForm()); } showToast('Removed'); }
  function cancelEdit(){ setEditIdx(-1); setForm(blankForm()); setErrs({}); }

  function applyPaste(){
    const t = paste.trim();
    if(!t){ return; }
    const parts = splitPaste(t);
    // map by our column order; tolerate fewer columns
    const map = {};
    COLS.forEach((c,i)=>{ if(parts[i]!==undefined && parts[i]!=='') map[c]=parts[i]; });
    const rec = {};
    COLS.forEach(c=> rec[c]= map[c]||'');
    const f = recordToForm(rec);
    setForm(f);
    setPasteTokens(COLS.map((c,i)=>({ col:c, val: parts[i]!==undefined?parts[i]:'' })).filter(x=>x.val!==''));
    showToast(`Filled ${Object.keys(map).length} fields — check & Add`);
  }

  function downloadCsv(){
    const csv = rowsToCsv(rows);
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='sailings.csv'; a.click();
    URL.revokeObjectURL(url);
    showToast(`Downloaded sailings.csv (${rows.length} rows)`);
  }
  function onFile(ev){
    const f = ev.target.files[0]; if(!f) return;
    const rd = new FileReader();
    rd.onload = ()=>{ const parsed=csvToRows(String(rd.result)); if(parsed.length){ setRows(parsed); showToast(`Loaded ${parsed.length} sailings`); } else showToast('No valid rows found'); };
    rd.readAsText(f); ev.target.value='';
  }
  function clearAll(){ if(confirm('Remove all sailings from the editor? (Your downloaded CSV files are untouched.)')){ setRows([]); showToast('Cleared'); } }

  const isTS = form.routing==='ts';

  return (
    <>
      <div className="topbar">
        <div className="brand">
          <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="9.2" stroke="#9cc3e0" strokeWidth="1.4" strokeDasharray="2.5 2.5"/>
            <circle cx="14" cy="14" r="3.4" fill="#2b8cc4"/>
            <g stroke="#fff" strokeWidth="1.4" strokeLinecap="round"><path d="M14 4v3.4M14 20.6V24M4 14h3.4M20.6 14H24M7 7l2.4 2.4M18.6 18.6 21 21M7 21l2.4-2.4M18.6 9.4 21 7"/></g>
          </svg>
          <span className="name">Sailingi</span><span className="tag">Edytor danych</span>
        </div>
        <div className="spacer"></div>
        <a className="back" href="index.html">← Wróć do wyszukiwarki</a>
      </div>

      <div className="wrap">
        {/* LEFT — form */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div className="panel">
            <div className="panel-hd">
              <h2>{editIdx>=0 ? 'Edit sailing' : 'Add sailing'}</h2>
              <span className="sub">{editIdx>=0 ? `row #${editIdx+1}` : 'fill & click Add'}</span>
            </div>
            <div className="panel-bd">
              {/* paste assist */}
              <div className="paste-box" style={{ marginBottom:16 }}>
                <div className="paste-hint">⚡ <b>Wklej z Excela</b> — skopiuj wiersz z pliku armatora (Ctrl+C) i wklej tutaj. Pola wypełnią się same w kolejności kolumn.</div>
                <textarea value={paste} onChange={e=>setPaste(e.target.value)}
                  onPaste={e=>{ setTimeout(()=>{ /* let value settle */ },0); }}
                  placeholder="MAERSK	AE7	Asia–North Europe 7	CNSHA	PLGDN		Maersk Hangzhou …"></textarea>
                <div style={{ display:'flex', gap:8, marginTop:8 }}>
                  <button className="btn btn-soft btn-sm" onClick={applyPaste} disabled={!paste.trim()}>{I.down()} Fill fields</button>
                  <button className="btn btn-ghost btn-sm" onClick={()=>{ setPaste(''); setPasteTokens(null); }}>Clear</button>
                </div>
                {pasteTokens && pasteTokens.length>0 && (
                  <div className="paste-map">
                    {pasteTokens.map((t,i)=><span className="tok" key={i}><b>{t.col}</b> {t.val}</span>)}
                  </div>
                )}
              </div>

              <div className="grid2">
                <Field label="Carrier" req>
                  <div className={'ctrl'+(errs.carrier?' err-field':'')}>
                    <select value={form.carrier} onChange={e=>set('carrier',e.target.value)}>
                      {CARRIERS.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </Field>
                <Field label="Service" hint="kod, np. AE7">
                  <div className="ctrl"><input value={form.service} onChange={e=>set('service',e.target.value)} placeholder="AE7"/></div>
                </Field>
              </div>

              <div style={{ marginTop:12 }}>
                <Field label="Service name (opcjonalnie)">
                  <div className="ctrl"><input value={form.service_name} onChange={e=>set('service_name',e.target.value)} placeholder="Asia–North Europe 7"/></div>
                </Field>
              </div>

              <div className="grid2" style={{ marginTop:12 }}>
                <Field label="POL — port załadunku" req>
                  <div className={'ctrl'+(errs.pol?' err-field':'')}>
                    <select value={form.pol} onChange={e=>set('pol',e.target.value)}><PortOpts codes={CN_PORTS}/></select>
                  </div>
                </Field>
                <Field label="POD — port wyładunku" req>
                  <div className={'ctrl'+(errs.pod?' err-field':'')}>
                    <select value={form.pod} onChange={e=>set('pod',e.target.value)}><PortOpts codes={PL_PORTS}/></select>
                  </div>
                </Field>
              </div>

              {/* routing */}
              <div style={{ marginTop:14 }}>
                <Field label="Routing">
                  <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                    <div className="seg">
                      <button className={form.routing==='direct'?'on':''} onClick={()=>set('routing','direct')}>{I.check()} Direct</button>
                      <button className={form.routing==='ts'?'on':''} onClick={()=>set('routing','ts')}>1 transshipment</button>
                    </div>
                    {isTS && (
                      <div className="ctrl" style={{ flex:1, minWidth:160 }}>
                        <select value={form.transshipment} onChange={e=>set('transshipment',e.target.value)}><PortOpts codes={HUB_PORTS}/></select>
                      </div>
                    )}
                  </div>
                </Field>
              </div>

              {/* vessels */}
              <div className="hr"></div>
              <div className="grid3">
                <Field label="Mother vessel"><div className="ctrl"><input value={form.mother_vessel} onChange={e=>set('mother_vessel',e.target.value)} placeholder="Maersk Hangzhou"/></div></Field>
                <Field label="Voyage"><div className="ctrl"><input value={form.mother_voyage} onChange={e=>set('mother_voyage',e.target.value)} placeholder="079E"/></div></Field>
                <Field label="IMO"><div className="ctrl"><input value={form.mother_imo} onChange={e=>set('mother_imo',e.target.value)} placeholder="9784271"/></div></Field>
              </div>
              {isTS && (
                <div className="grid3" style={{ marginTop:12 }}>
                  <Field label="Feeder vessel"><div className="ctrl"><input value={form.feeder_vessel} onChange={e=>set('feeder_vessel',e.target.value)} placeholder="Wec Vermeer"/></div></Field>
                  <Field label="Feeder voyage"><div className="ctrl"><input value={form.feeder_voyage} onChange={e=>set('feeder_voyage',e.target.value)} placeholder="FR2618"/></div></Field>
                  <Field label="Feeder IMO"><div className="ctrl"><input value={form.feeder_imo} onChange={e=>set('feeder_imo',e.target.value)} placeholder="9361310"/></div></Field>
                </div>
              )}

              {/* dates */}
              <div className="hr"></div>
              <div className="grid2">
                <Field label="ETD — wypłynięcie z POL" req>
                  <div className={'ctrl'+(errs.etd?' err-field':'')}><input type="datetime-local" value={form.etd} onChange={e=>set('etd',e.target.value)}/></div>
                </Field>
                <Field label="ETA — przybycie do POD" req>
                  <div className={'ctrl'+(errs.eta?' err-field':'')}><input type="datetime-local" value={form.eta} onChange={e=>set('eta',e.target.value)}/></div>
                </Field>
              </div>
              <div className="calc">
                {transit!=='' ? <>Transit: <b>{transit} dni</b></> : <>Transit: liczy się z dat</>}
                <span style={{ opacity:.4 }}>·</span>
                {week!=='' ? <>Tydzień ETD: <b>{week}</b></> : <>Tydzień: auto</>}
                <span style={{ opacity:.4 }}>·</span>
                <span>liczone automatycznie</span>
              </div>

              {/* cut-offs (collapsible, TS legs) */}
              <div className="hr"></div>
              <div className={'collapse-h'+(showCutoffs?' open':'')} onClick={()=>setShowCutoffs(v=>!v)}>
                <span className="chev">{I.chev()}</span> Cut-offy (opcjonalne)
              </div>
              {showCutoffs && (
                <div className="grid3" style={{ marginTop:12 }}>
                  <Field label="Gate-in"><div className="ctrl"><input type="datetime-local" value={form.cutoff_gatein} onChange={e=>set('cutoff_gatein',e.target.value)}/></div></Field>
                  <Field label="VGM"><div className="ctrl"><input type="datetime-local" value={form.cutoff_vgm} onChange={e=>set('cutoff_vgm',e.target.value)}/></div></Field>
                  <Field label="Doc / SI"><div className="ctrl"><input type="datetime-local" value={form.cutoff_doc} onChange={e=>set('cutoff_doc',e.target.value)}/></div></Field>
                </div>
              )}

              {/* advanced (TS times, rotation, space, co2) */}
              <div className="hr"></div>
              <div className={'collapse-h'+(showAdv?' open':'')} onClick={()=>setShowAdv(v=>!v)}>
                <span className="chev">{I.chev()}</span> Pozostałe (rotacja, space, CO₂{isTS?', czasy przeładunku':''})
              </div>
              {showAdv && (
                <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:12 }}>
                  {isTS && (
                    <div className="grid2">
                      <Field label="TS arrive"><div className="ctrl"><input type="datetime-local" value={form.ts_arrive} onChange={e=>set('ts_arrive',e.target.value)}/></div></Field>
                      <Field label="TS depart (mother)"><div className="ctrl"><input type="datetime-local" value={form.ts_depart} onChange={e=>set('ts_depart',e.target.value)}/></div></Field>
                    </div>
                  )}
                  <Field label="Rotacja (kody portów oddzielone |)" hint="np. CNSHA|NLRTM|PLGDN">
                    <div className="ctrl"><input value={form.rotation} onChange={e=>set('rotation',e.target.value)} placeholder="CNSHA|NLRTM|PLGDN"/></div>
                  </Field>
                  <div className="grid2">
                    <Field label="Space">
                      <div className="seg">
                        <button className={form.space==='open'?'on':''} onClick={()=>set('space','open')}>open</button>
                        <button className={form.space==='tight'?'on':''} onClick={()=>set('space','tight')}>tight</button>
                      </div>
                    </Field>
                    <Field label="CO₂ (opcjonalnie)"><div className="ctrl"><input value={form.co2} onChange={e=>set('co2',e.target.value)} placeholder="1.92 t/TEU"/></div></Field>
                  </div>
                </div>
              )}

              <div style={{ display:'flex', gap:8, marginTop:18 }}>
                <button className="btn btn-primary btn-block" onClick={addOrSave}>{editIdx>=0 ? <>{I.check()} Save changes</> : <>{I.plus()} Add sailing</>}</button>
                {editIdx>=0 && <button className="btn btn-ghost" onClick={cancelEdit}>Cancel</button>}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — table + export */}
        <div className="panel">
          <div className="panel-hd">
            <h2>Sailings <span className="count-badge">· <b>{rows.length}</b></span></h2>
            <div className="toolbar">
              <input ref={fileRef} type="file" accept=".csv" style={{ display:'none' }} onChange={onFile}/>
              <button className="btn btn-ghost btn-sm" onClick={()=>fileRef.current.click()}>{I.file()} Load CSV</button>
              <button className="btn btn-danger btn-sm" onClick={clearAll} disabled={!rows.length}>Clear</button>
              <button className="btn btn-navy btn-sm" onClick={downloadCsv} disabled={!rows.length}>{I.down()} Download sailings.csv</button>
            </div>
          </div>
          <div className="panel-bd" style={{ padding:0 }}>
            <div className="note" style={{ margin:16 }}>
              Edytujesz <b>lokalnie</b> — dane trzymane w tej przeglądarce (nie znikną po odświeżeniu). Gdy skończysz, kliknij <b>Download sailings.csv</b> i wgraj plik na GitHub.
            </div>
            {rows.length===0 ? (
              <div className="empty">Brak sailingów. Dodaj pierwszy z lewej, albo wczytaj istniejący plik (Load CSV).</div>
            ) : (
              <div className="tablewrap scroll">
                <table className="rows">
                  <thead><tr>
                    <th>#</th><th>Carrier</th><th>Service</th><th>Route</th><th>Routing</th><th>ETD</th><th>ETA</th><th>TT</th><th>Wk</th><th>Mother</th><th></th>
                  </tr></thead>
                  <tbody>
                    {rows.map((r,i)=>(
                      <tr key={i} style={ editIdx===i ? { background:'var(--sea-soft)' } : null }>
                        <td style={{ color:'var(--faint)' }}>{i+1}</td>
                        <td><CMark carrier={r.carrier}/></td>
                        <td className="mono">{r.service||'—'}</td>
                        <td className="mono"><b>{r.pol}</b>{r.transshipment?<> ›<span style={{ color:'var(--mute)' }}>{r.transshipment}</span>›</>:' → '}<b>{r.pod}</b></td>
                        <td>{r.transshipment ? <span className="pill ts">1 TS</span> : <span className="pill direct">Direct</span>}</td>
                        <td>{fmtShort(r.etd)}</td>
                        <td>{fmtShort(r.eta)}</td>
                        <td className="mono">{r.transit_days||'—'}</td>
                        <td className="mono">{r.etd_week||'—'}</td>
                        <td style={{ maxWidth:150, overflow:'hidden', textOverflow:'ellipsis' }}>{r.mother_vessel||'—'}</td>
                        <td>
                          <div className="rowact">
                            <button className="iconbtn" title="Edit" onClick={()=>editRow(i)}>{I.edit()}</button>
                            <button className="iconbtn del" title="Delete" onClick={()=>delRow(i)}>{I.trash()}</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={'toast'+(toast?' show':'')}>{toast && <>{I.check({ stroke:'#7ee0a6' })} {toast}</>}</div>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<EditorApp/>);
