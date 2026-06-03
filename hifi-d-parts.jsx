// Reusable presentational parts for Variant D hi-fi.
const { useState, useEffect, useRef, useMemo, useCallback } = React;

const PORTS = window.PORTS,CM = window.CARRIER_META;

// ── tiny inline icons (stroke) ──
const Ico = {
  pin: (p) => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}><path d="M13 6.6C13 10 8 14 8 14S3 10 3 6.6a5 5 0 1 1 10 0Z" /><circle cx="8" cy="6.5" r="1.8" /></svg>,
  ship: (p) => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M2.5 9.5 3.4 13a1 1 0 0 0 .96.7h7.28a1 1 0 0 0 .96-.7l.9-3.5" /><path d="M2.5 9.5 8 7.5l5.5 2" /><path d="M8 7.5V3.5M5.5 5.5h5" /></svg>,
  anchor: (p) => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="8" cy="3" r="1.6" /><path d="M8 4.6V14M4 8H2.2a5.8 5.8 0 0 0 11.6 0H12M3.5 7l1 1.4M12.5 7l-1 1.4" /></svg>,
  arrow: (p) => <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 10h12M11 5l5 5-5 5" /></svg>,
  arrowS: (p) => <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 7.5h9M8.5 4l3.5 3.5L8.5 11" /></svg>,
  swap: (p) => <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 4h8l-2-2M12 12H4l2 2" /></svg>,
  star: (p) => <svg width="17" height="17" viewBox="0 0 18 18" fill={p.fill || 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" {...p}><path d="M9 1.8l2.1 4.3 4.7.7-3.4 3.3.8 4.7L9 12.7l-4.2 2.2.8-4.7L2.2 6.8l4.7-.7L9 1.8Z" /></svg>,
  pdf: (p) => <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M8 1v3.5h3.5M3.5 1.5h4.8L12.5 5.7V13a1.5 1.5 0 0 1-1.5 1.5H5" /><path d="M2 8.5h2.2a1.2 1.2 0 0 1 0 2.4H2V8.5ZM2 13v-1.6" /></svg>,
  copy: (p) => <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="5" y="5" width="9" height="9" rx="1.5" /><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2H3.5A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" /></svg>,
  clock: (p) => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="8" cy="8" r="6.3" /><path d="M8 4.8V8l2.2 1.4" /></svg>,
  leaf: (p) => <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M13 3S5 3 4 9c-.5 3 1.5 4 1.5 4M13 3c0 6-3 9-7.5 10M13 3c-2 .5-5 1.2-6.5 3" /></svg>,
  back: (p) => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M10 3 5 8l5 5" /></svg>,
  check: (p) => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 8.5 6.5 12 13 4.5" /></svg>,
  warn: (p) => <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M8 2.5 14.5 13.5H1.5L8 2.5ZM8 6.5v3M8 11.6v.01" /></svg>
};

// ── date helpers (robust: '—' on missing/invalid) ──
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function _d(iso) {if (!iso) return null;const dt = new Date(iso);return isNaN(dt) ? null : dt;}
function fmtDate(iso) {const dt = _d(iso);return dt ? `${MON[dt.getMonth()]} ${dt.getDate()}` : '—';}
function fmtDateY(iso) {const dt = _d(iso);return dt ? `${MON[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}` : '—';}
function fmtTime(iso) {const dt = _d(iso);return dt ? `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}` : '—';}
function fmtDOW(iso) {const dt = _d(iso);return dt ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dt.getDay()] : '';}
function pname(code) {return (PORTS[code] || {}).name || code;}
function pcity(code) {return (PORTS[code] || {}).city || '';}

// ── carrier badge ──
function CarrierBadge({ carrier, service, serviceName, size }) {
  const m = CM[carrier] || { short: '?', color: '#888' };
  return (
    <div className="cbadge">
      <span className="mk" style={{ background: m.color, width: size || 26, height: size || 26 }}>{m.short}</span>
      <div>
        <div className="nm">{carrier}</div>
        {service && <div className="sv">{service}{serviceName ? ` · ${serviceName}` : ''}</div>}
      </div>
    </div>);

}

window.Ico = Ico;
Object.assign(window, { fmtDate, fmtDateY, fmtTime, fmtDOW, pname, pcity, CarrierBadge, PORTS, CM });