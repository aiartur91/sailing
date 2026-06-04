// Realistic mock dataset for the hi-fi Variant D prototype.
// Display rule (systemwide): port NAME is primary, UN/LOCODE is secondary.

window.PORTS = {
  // ── China ──
  CNSHA: { code:'CNSHA', name:'Shanghai',            country:'CN', city:'Shanghai' },
  CNNGB: { code:'CNNGB', name:'Ningbo',              country:'CN', city:'Ningbo' },
  CNYTN: { code:'CNYTN', name:'Yantian',             country:'CN', city:'Shenzhen' },
  CNTAO: { code:'CNTAO', name:'Qingdao',             country:'CN', city:'Qingdao' },
  CNXMN: { code:'CNXMN', name:'Xiamen',              country:'CN', city:'Xiamen' },
  CNNSA: { code:'CNNSA', name:'Nansha',              country:'CN', city:'Guangzhou' },
  CNTXG: { code:'CNTXG', name:'Xingang',             country:'CN', city:'Tianjin' },
  CNDLC: { code:'CNDLC', name:'Dalian',              country:'CN', city:'Dalian' },
  // ── India ──
  INNSA: { code:'INNSA', name:'Nhava Sheva',         country:'IN', city:'JNPT · Mumbai' },
  INMUN: { code:'INMUN', name:'Mundra',              country:'IN', city:'Mundra' },
  INHZA: { code:'INHZA', name:'Hazira',              country:'IN', city:'Hazira' },
  INPAV: { code:'INPAV', name:'Pipavav',             country:'IN', city:'Pipavav' },
  INMAA: { code:'INMAA', name:'Chennai',             country:'IN', city:'Chennai' },
  INENR: { code:'INENR', name:'Ennore',              country:'IN', city:'Kamarajar' },
  INCOK: { code:'INCOK', name:'Cochin',              country:'IN', city:'Kochi' },
  INTUT: { code:'INTUT', name:'Tuticorin',           country:'IN', city:'V.O.C. · Thoothukudi' },
  INCCU: { code:'INCCU', name:'Kolkata',             country:'IN', city:'Kolkata' },
  INHAL: { code:'INHAL', name:'Haldia',              country:'IN', city:'Haldia' },
  INVTZ: { code:'INVTZ', name:'Visakhapatnam',       country:'IN', city:'Visakhapatnam' },
  // ── Bangladesh ──
  BDCGP: { code:'BDCGP', name:'Chattogram',          country:'BD', city:'Chittagong' },
  BDMGL: { code:'BDMGL', name:'Mongla',              country:'BD', city:'Mongla' },
  BDPGN: { code:'BDPGN', name:'Pangaon',             country:'BD', city:'Pangaon ICD · Dhaka' },
  // ── Vietnam ──
  VNCMT: { code:'VNCMT', name:'Cai Mep',             country:'VN', city:'Phu My · Cai Mep' },
  VNSGN: { code:'VNSGN', name:'Ho Chi Minh',         country:'VN', city:'Cat Lai · HCMC' },
  VNHPH: { code:'VNHPH', name:'Hai Phong',           country:'VN', city:'Lach Huyen' },
  VNDAD: { code:'VNDAD', name:'Da Nang',             country:'VN', city:'Da Nang' },
  VNUIH: { code:'VNUIH', name:'Qui Nhon',            country:'VN', city:'Qui Nhon' },
  // ── European destinations ──
  PLGDN: { code:'PLGDN', name:'Gdańsk',              country:'PL', city:'Baltic Hub' },
  PLGDY: { code:'PLGDY', name:'Gdynia',              country:'PL', city:'GCT' },
  NLRTM: { code:'NLRTM', name:'Rotterdam',           country:'NL', city:'Rotterdam' },
  BEANR: { code:'BEANR', name:'Antwerp',             country:'BE', city:'Antwerpia' },
  DEHAM: { code:'DEHAM', name:'Hamburg',             country:'DE', city:'Hamburg' },
  DEBRV: { code:'DEBRV', name:'Bremerhaven',         country:'DE', city:'Bremerhaven' },
  DEWVN: { code:'DEWVN', name:'Wilhelmshaven',       country:'DE', city:'Wilhelmshaven' },
  // ── Transshipment hubs ──
  MAPTM: { code:'MAPTM', name:'Tanger Med',          country:'MA', city:'Tangier' },
  MYTPP: { code:'MYTPP', name:'Tanjung Pelepas',     country:'MY', city:'Tanjung Pelepas' },
  SGSIN: { code:'SGSIN', name:'Singapore',           country:'SG', city:'Singapore' },
  LKCMB: { code:'LKCMB', name:'Colombo',             country:'LK', city:'Colombo' },
  ESALG: { code:'ESALG', name:'Algeciras',           country:'ES', city:'Algeciras' },
  ESVLC: { code:'ESVLC', name:'Valencia',            country:'ES', city:'Valencia' },
  GRPIR: { code:'GRPIR', name:'Piraeus',             country:'GR', city:'Piraeus' },
  EGPSD: { code:'EGPSD', name:'Port Said',           country:'EG', city:'Port Said' },
  OMSLL: { code:'OMSLL', name:'Salalah',             country:'OM', city:'Salalah' },
  AEJEA: { code:'AEJEA', name:'Jebel Ali',           country:'AE', city:'Dubai' },
  MTMAR: { code:'MTMAR', name:'Marsaxlokk',          country:'MT', city:'Malta Freeport' },
};

window.CARRIER_META = {
  'MAERSK':      { short:'MAE', color:'#1b9bd7', ink:'#063a52' },
  'MSC':         { short:'MSC', color:'#0a3d91', ink:'#0a2a63' },
  'HAPAG-LLOYD': { short:'HPL', color:'#ee7203', ink:'#5e3000' },
  'COSCO':       { short:'COS', color:'#c8102e', ink:'#5e0a16' },
  'OOCL':        { short:'OCL', color:'#0a7d3e', ink:'#063c1e' },
  'YANG MING':   { short:'YML', color:'#00763d', ink:'#053a20' },
  'ONE':         { short:'ONE', color:'#bf0d3e', ink:'#5e0720' },
  'CMA CGM':     { short:'CMA', color:'#0d2c6c', ink:'#081d47' },
  'EVERGREEN':   { short:'EVG', color:'#00853f', ink:'#04421f' },
};

// helper to build ISO date
const d = (s) => s;

// Each sailing: feeder leg optional (null = direct deepsea call at POD).
// Times are local-ish ISO strings for display only.
window.SAILINGS = [
  {
    id:'s01', carrier:'MAERSK', service:'AE7', serviceName:'Asia–North Europe 7',
    pol:'CNSHA', pod:'PLGDN', ts:null,
    mother:{ vessel:'Maersk Hangzhou', voyage:'079E', imo:'9784271' },
    feeder:null,
    etd:'2026-06-23T18:00', eta:'2026-07-29T08:00', transit:36, week:26,
    cutoffs:{ gateIn:'2026-06-21T12:00', vgm:'2026-06-22T12:00', doc:'2026-06-21T16:00' },
    rotation:['CNSHA','CNNGB','CNYTN','SGSIN','NLRTM','PLGDN'],
    space:'open', co2:'1.92 t/TEU'
  },
  {
    id:'s02', carrier:'MSC', service:'Silk', serviceName:'Silk Service',
    pol:'CNSHA', pod:'PLGDN', ts:null,
    mother:{ vessel:'MSC Loreto', voyage:'IU526A', imo:'9839430' },
    feeder:null,
    etd:'2026-06-25T22:00', eta:'2026-08-02T06:00', transit:38, week:26,
    cutoffs:{ gateIn:'2026-06-23T12:00', vgm:'2026-06-24T12:00', doc:'2026-06-23T18:00' },
    rotation:['CNSHA','CNNGB','CNYTN','LKCMB','NLRTM','PLGDN'],
    space:'tight', co2:'1.78 t/TEU'
  },
  {
    id:'s03', carrier:'HAPAG-LLOYD', service:'FE2', serviceName:'Far East Loop 2',
    pol:'CNSHA', pod:'PLGDY', ts:'NLRTM',
    mother:{ vessel:'Al Nasriyah', voyage:'124E', imo:'9461562' },
    feeder:{ vessel:'Wec Vermeer', voyage:'FR2618', imo:'9361310' },
    etd:'2026-06-24T14:00', eta:'2026-08-04T10:00', transit:41, week:26,
    cutoffs:{ gateIn:'2026-06-22T12:00', vgm:'2026-06-23T12:00', doc:'2026-06-22T16:00' },
    tsArrive:'2026-07-30T06:00', tsDepart:'2026-08-02T20:00',
    rotation:['CNSHA','CNNGB','SGSIN','NLRTM'],
    space:'open', co2:'2.05 t/TEU'
  },
  {
    id:'s04', carrier:'COSCO', service:'AEU2', serviceName:'Asia–Europe 2',
    pol:'CNTAO', pod:'PLGDY', ts:'DEHAM',
    mother:{ vessel:'COSCO Universe', voyage:'052E', imo:'9795623' },
    feeder:{ vessel:'BF Carmen', voyage:'2624', imo:'9508982' },
    etd:'2026-06-22T10:00', eta:'2026-08-01T16:00', transit:40, week:26,
    cutoffs:{ gateIn:'2026-06-20T12:00', vgm:'2026-06-21T12:00', doc:'2026-06-20T16:00' },
    tsArrive:'2026-07-28T08:00', tsDepart:'2026-07-30T18:00',
    rotation:['CNTAO','CNSHA','CNNGB','DEHAM'],
    space:'open', co2:'1.99 t/TEU'
  },
  {
    id:'s05', carrier:'OOCL', service:'LL3', serviceName:'Loop 3',
    pol:'CNYTN', pod:'PLGDY', ts:'NLRTM',
    mother:{ vessel:'OOCL Hong Kong', voyage:'088E', imo:'9776171' },
    feeder:{ vessel:'X-Press Mulhacen', voyage:'25W', imo:'9853278' },
    etd:'2026-06-26T20:00', eta:'2026-08-06T12:00', transit:41, week:26,
    cutoffs:{ gateIn:'2026-06-24T12:00', vgm:'2026-06-25T12:00', doc:'2026-06-24T16:00' },
    tsArrive:'2026-08-01T06:00', tsDepart:'2026-08-04T18:00',
    rotation:['CNYTN','CNNGB','SGSIN','NLRTM'],
    space:'tight', co2:'2.11 t/TEU'
  },
  {
    id:'s06', carrier:'ONE', service:'IN1', serviceName:'India–N.Europe 1',
    pol:'CNYTN', pod:'PLGDN', ts:null,
    mother:{ vessel:'ONE Innovation', voyage:'041E', imo:'9806079' },
    feeder:null,
    etd:'2026-06-27T16:00', eta:'2026-08-03T09:00', transit:37, week:26,
    cutoffs:{ gateIn:'2026-06-25T12:00', vgm:'2026-06-26T12:00', doc:'2026-06-25T16:00' },
    rotation:['CNYTN','CNNGB','MYTPP','NLRTM','PLGDN'],
    space:'open', co2:'1.84 t/TEU'
  },
  {
    id:'s07', carrier:'CMA CGM', service:'FAL1', serviceName:'French Asia Line 1',
    pol:'CNNGB', pod:'PLGDY', ts:'DEWVN',
    mother:{ vessel:'CMA CGM Marco Polo', voyage:'0FA8WE', imo:'9454436' },
    feeder:{ vessel:'CMA CGM Strauss', voyage:'0XY3', imo:'9722557' },
    etd:'2026-06-21T08:00', eta:'2026-07-28T14:00', transit:37, week:26,
    cutoffs:{ gateIn:'2026-06-19T12:00', vgm:'2026-06-20T12:00', doc:'2026-06-19T16:00' },
    tsArrive:'2026-07-24T06:00', tsDepart:'2026-07-26T20:00',
    rotation:['CNNGB','CNSHA','SGSIN','DEWVN'],
    space:'open', co2:'1.88 t/TEU'
  },
  {
    id:'s08', carrier:'YANG MING', service:'AE6', serviceName:'Asia–Europe 6',
    pol:'CNTXG', pod:'PLGDY', ts:'DEHAM',
    mother:{ vessel:'YM Witness', voyage:'071E', imo:'9704646' },
    feeder:{ vessel:'YM Pluto', voyage:'0312', imo:'9344386' },
    etd:'2026-06-28T12:00', eta:'2026-08-08T18:00', transit:41, week:27,
    cutoffs:{ gateIn:'2026-06-26T12:00', vgm:'2026-06-27T12:00', doc:'2026-06-26T16:00' },
    tsArrive:'2026-08-03T08:00', tsDepart:'2026-08-05T20:00',
    rotation:['CNTXG','CNTAO','CNSHA','DEHAM'],
    space:'tight', co2:'2.14 t/TEU'
  },
  {
    id:'s09', carrier:'EVERGREEN', service:'CES', serviceName:'China–Europe Service',
    pol:'CNSHA', pod:'PLGDN', ts:null,
    mother:{ vessel:'Ever Ace', voyage:'0102E', imo:'9893890' },
    feeder:null,
    etd:'2026-06-29T18:00', eta:'2026-08-05T07:00', transit:37, week:27,
    cutoffs:{ gateIn:'2026-06-27T12:00', vgm:'2026-06-28T12:00', doc:'2026-06-27T16:00' },
    rotation:['CNSHA','CNNGB','CNYTN','NLRTM','PLGDN'],
    space:'open', co2:'1.71 t/TEU'
  },
  {
    id:'s10', carrier:'MAERSK', service:'AE10', serviceName:'Asia–North Europe 10',
    pol:'CNNGB', pod:'PLGDY', ts:'DEBRV',
    mother:{ vessel:'Maersk Hidalgo', voyage:'081E', imo:'9784295' },
    feeder:{ vessel:'Maersk Emden', voyage:'2625', imo:'9302807' },
    etd:'2026-06-25T14:00', eta:'2026-07-31T20:00', transit:36, week:26,
    cutoffs:{ gateIn:'2026-06-23T12:00', vgm:'2026-06-24T12:00', doc:'2026-06-23T16:00' },
    tsArrive:'2026-07-27T08:00', tsDepart:'2026-07-29T18:00',
    rotation:['CNNGB','CNSHA','SGSIN','DEBRV'],
    space:'open', co2:'1.90 t/TEU'
  },
  {
    id:'s11', carrier:'COSCO', service:'NE1', serviceName:'North Europe 1',
    pol:'CNDLC', pod:'PLGDN', ts:null,
    mother:{ vessel:'COSCO Shipping Aries', voyage:'039E', imo:'9783306' },
    feeder:null,
    etd:'2026-06-30T10:00', eta:'2026-08-07T08:00', transit:38, week:27,
    cutoffs:{ gateIn:'2026-06-28T12:00', vgm:'2026-06-29T12:00', doc:'2026-06-28T16:00' },
    rotation:['CNDLC','CNTAO','CNSHA','NLRTM','PLGDN'],
    space:'tight', co2:'1.95 t/TEU'
  },
  {
    id:'s12', carrier:'MSC', service:'Dragon', serviceName:'Dragon Service',
    pol:'CNTAO', pod:'PLGDY', ts:'DEHAM',
    mother:{ vessel:'MSC Gülsün', voyage:'IU528A', imo:'9839416' },
    feeder:{ vessel:'MSC Lucy', voyage:'FH26', imo:'9290208' },
    etd:'2026-07-01T22:00', eta:'2026-08-11T06:00', transit:41, week:27,
    cutoffs:{ gateIn:'2026-06-29T12:00', vgm:'2026-06-30T12:00', doc:'2026-06-29T18:00' },
    tsArrive:'2026-08-06T06:00', tsDepart:'2026-08-08T20:00',
    rotation:['CNTAO','CNSHA','CNNGB','DEHAM'],
    space:'open', co2:'1.82 t/TEU'
  },
  {
    id:'s13', carrier:'HAPAG-LLOYD', service:'EUM', serviceName:'Euro-Med Express',
    pol:'CNNGB', pod:'PLGDN', ts:null,
    mother:{ vessel:'Hamburg Express', voyage:'126E', imo:'9501330' },
    feeder:null,
    etd:'2026-07-02T14:00', eta:'2026-08-08T09:00', transit:37, week:27,
    cutoffs:{ gateIn:'2026-06-30T12:00', vgm:'2026-07-01T12:00', doc:'2026-06-30T16:00' },
    rotation:['CNNGB','CNSHA','SGSIN','NLRTM','PLGDN'],
    space:'open', co2:'1.86 t/TEU'
  },
  {
    id:'s14', carrier:'CMA CGM', service:'FAL3', serviceName:'French Asia Line 3',
    pol:'CNYTN', pod:'PLGDY', ts:'NLRTM',
    mother:{ vessel:'CMA CGM Jacques Saade', voyage:'0FA9WE', imo:'9839179' },
    feeder:{ vessel:'CMA CGM Berlioz', voyage:'0XY5', imo:'9299241' },
    etd:'2026-07-03T08:00', eta:'2026-08-12T14:00', transit:40, week:27,
    cutoffs:{ gateIn:'2026-07-01T12:00', vgm:'2026-07-02T12:00', doc:'2026-07-01T16:00' },
    tsArrive:'2026-08-07T06:00', tsDepart:'2026-08-09T20:00',
    rotation:['CNYTN','CNNGB','SGSIN','NLRTM'],
    space:'tight', co2:'2.02 t/TEU'
  },
  {
    id:'s15', carrier:'OOCL', service:'LL1', serviceName:'Loop 1',
    pol:'CNSHA', pod:'PLGDN', ts:null,
    mother:{ vessel:'OOCL Spain', voyage:'092E', imo:'9776200' },
    feeder:null,
    etd:'2026-07-04T20:00', eta:'2026-08-09T07:00', transit:36, week:27,
    cutoffs:{ gateIn:'2026-07-02T12:00', vgm:'2026-07-03T12:00', doc:'2026-07-02T16:00' },
    rotation:['CNSHA','CNNGB','CNYTN','NLRTM','PLGDN'],
    space:'open', co2:'1.74 t/TEU'
  },
  {
    id:'s16', carrier:'ONE', service:'FE3', serviceName:'Far East 3',
    pol:'CNTXG', pod:'PLGDN', ts:null,
    mother:{ vessel:'ONE Tradition', voyage:'047E', imo:'9806081' },
    feeder:null,
    etd:'2026-07-05T16:00', eta:'2026-08-13T09:00', transit:39, week:28,
    cutoffs:{ gateIn:'2026-07-03T12:00', vgm:'2026-07-04T12:00', doc:'2026-07-03T16:00' },
    rotation:['CNTXG','CNTAO','CNSHA','NLRTM','PLGDN'],
    space:'open', co2:'1.97 t/TEU'
  },
  {
    id:'s17', carrier:'EVERGREEN', service:'CEM', serviceName:'China–Europe Med',
    pol:'CNDLC', pod:'PLGDY', ts:'DEWVN',
    mother:{ vessel:'Ever Globe', voyage:'0212E', imo:'9811031' },
    feeder:{ vessel:'Ever Best', voyage:'0418', imo:'9300288' },
    etd:'2026-07-06T18:00', eta:'2026-08-16T18:00', transit:41, week:28,
    cutoffs:{ gateIn:'2026-07-04T12:00', vgm:'2026-07-05T12:00', doc:'2026-07-04T16:00' },
    tsArrive:'2026-08-11T08:00', tsDepart:'2026-08-13T20:00',
    rotation:['CNDLC','CNTAO','CNSHA','DEWVN'],
    space:'tight', co2:'2.08 t/TEU'
  },
  {
    id:'s18', carrier:'MAERSK', service:'AE7', serviceName:'Asia–North Europe 7',
    pol:'CNTAO', pod:'PLGDN', ts:null,
    mother:{ vessel:'Maersk Edmonton', voyage:'080E', imo:'9784283' },
    feeder:null,
    etd:'2026-07-07T18:00', eta:'2026-08-12T08:00', transit:36, week:28,
    cutoffs:{ gateIn:'2026-07-05T12:00', vgm:'2026-07-06T12:00', doc:'2026-07-05T16:00' },
    rotation:['CNTAO','CNSHA','CNYTN','NLRTM','PLGDN'],
    space:'open', co2:'1.91 t/TEU'
  },
  {
    id:'s19', carrier:'MSC', service:'Silk', serviceName:'Silk Service',
    pol:'CNNGB', pod:'PLGDN', ts:null,
    mother:{ vessel:'MSC Türkiye', voyage:'IU530A', imo:'9930860' },
    feeder:null,
    etd:'2026-07-09T22:00', eta:'2026-08-16T06:00', transit:38, week:28,
    cutoffs:{ gateIn:'2026-07-07T12:00', vgm:'2026-07-08T12:00', doc:'2026-07-07T18:00' },
    rotation:['CNNGB','CNSHA','CNYTN','NLRTM','PLGDN'],
    space:'open', co2:'1.76 t/TEU'
  },
  {
    id:'s20', carrier:'COSCO', service:'AEU2', serviceName:'Asia–Europe 2',
    pol:'CNNGB', pod:'PLGDY', ts:'DEHAM',
    mother:{ vessel:'COSCO Galaxy', voyage:'054E', imo:'9795635' },
    feeder:{ vessel:'BF Carmen', voyage:'2626', imo:'9508982' },
    etd:'2026-07-10T10:00', eta:'2026-08-19T16:00', transit:40, week:28,
    cutoffs:{ gateIn:'2026-07-08T12:00', vgm:'2026-07-09T12:00', doc:'2026-07-08T16:00' },
    tsArrive:'2026-08-15T08:00', tsDepart:'2026-08-17T18:00',
    rotation:['CNNGB','CNSHA','SGSIN','DEHAM'],
    space:'tight', co2:'2.00 t/TEU'
  },
];

// Lanes for the search-bar selectors — grouped origin regions, European destinations.
window.LANES_POL = [
  // China
  'CNSHA','CNNGB','CNYTN','CNTAO','CNXMN','CNNSA','CNTXG','CNDLC',
  // India
  'INNSA','INMUN','INHZA','INPAV','INMAA','INENR','INCOK','INTUT','INCCU','INHAL','INVTZ',
  // Bangladesh
  'BDCGP','BDMGL','BDPGN',
  // Vietnam
  'VNCMT','VNSGN','VNHPH','VNDAD','VNUIH',
];
window.LANES_POD = ['PLGDN','PLGDY','NLRTM','BEANR','DEHAM','DEBRV','DEWVN'];
window.PORT_REGIONS = {
  CN:'China', IN:'India', BD:'Bangladesh', VN:'Vietnam',
  PL:'Poland', NL:'Netherlands', BE:'Belgium', DE:'Germany',
  MA:'Morocco', MY:'Malaysia', SG:'Singapore', LK:'Sri Lanka',
  ES:'Spain', GR:'Greece', EG:'Egypt', OM:'Oman', AE:'UAE', MT:'Malta',
};
window.CARRIER_LIST = ['MAERSK','MSC','HAPAG-LLOYD','COSCO','OOCL','YANG MING','ONE','CMA CGM','EVERGREEN'];
