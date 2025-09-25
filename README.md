<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>InCheck Issues Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js"></script>
  <style>
    :root{ --bg:#0b1020; --card:#111935; --muted:#7d8ab3; --text:#e8edff; --accent:#4f8cff; --accent-2:#8b5cf6; --danger:#ef4444; --ok:#10b981; }
    *{box-sizing:border-box}
    body{margin:0; font-family:Inter,system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif; background:linear-gradient(180deg,#0b1020,#0c1328 40%,#0e1530); color:var(--text)}
    header{display:flex; gap:12px; align-items:center; padding:20px 24px; position:sticky; top:0; backdrop-filter:saturate(140%) blur(8px); background-color:#0b1020d0; z-index:10; border-bottom:1px solid #1e2a58}
    header .title{font-weight:700; font-size:18px}
    .container{padding:20px 24px; max-width:1200px; margin:0 auto}
    .grid{display:grid; gap:16px}
    .grid.cols-4{grid-template-columns:repeat(4,minmax(0,1fr))}
    .charts{display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px}
    @media (max-width: 900px){ .grid.cols-4{grid-template-columns:repeat(2,1fr)} .charts{grid-template-columns:1fr} }
    @media (max-width: 580px){ .grid.cols-4{grid-template-columns:1fr} }
    .card{background:var(--card); border:1px solid #1e2a58; border-radius:16px; padding:16px; box-shadow:0 8px 30px rgba(0,0,0,.35)}
    .kpi{display:flex; flex-direction:column; gap:6px}
    .kpi .label{color:var(--muted); font-size:12px; text-transform:uppercase}
    .kpi .value{font-size:28px; font-weight:800}
    .toolbar{display:flex; flex-wrap:wrap; gap:8px}
    select, input[type="search"], button{background:#0f1733; color:var(--text); border:1px solid #263564; border-radius:10px; padding:10px 12px; font:inherit}
    button{background:linear-gradient(180deg,#365dc7,#2c4dac); border:none; font-weight:600; cursor:pointer}
    button.ghost{background:#0f1733}
    button.secondary{background:#0f1733; border:1px solid #2a3a73}
    .hint{font-size:12px; color:#a7b4df}
    .banner{border:1px solid #3b4c8a; background:#0e1838; padding:8px 12px; border-radius:10px; color:#bfd0ff; display:flex; align-items:center; gap:8px}
    .banner.error{border-color:#7a1b27; background:#230c12; color:#ffc7cf}
    table{width:100%; border-collapse:collapse; font-size:14px}
    th, td{padding:10px 8px; border-bottom:1px solid #213065; vertical-align:top}
    th{position:sticky; top:0; background:#0e1a3c; text-align:left}
    .pill{display:inline-flex; align-items:center; gap:6px; padding:2px 8px; border-radius:999px; font-size:12px; border:1px solid #2a3a73}
    .pill.bug{background:#201227; color:#ffc4ec; border-color:#4e2b58}
    .pill.enh{background:#0d2130; color:#b9e2ff; border-color:#274f6a}
    .muted{color:#93a1d9}
    .table-wrap{max-height:420px; overflow:auto; border:1px solid #1e2a58; border-radius:12px}
    footer{padding:20px; text-align:center; color:#7d8ab3}
  </style>
</head>
<body>
  <header>
    <div class="title">InCheck Issues Dashboard</div>
    <div style="margin-left:auto" class="toolbar">
      <input id="searchInput" type="search" placeholder="Search title / ID / module" />
      <select id="moduleFilter"></select>
      <select id="priorityFilter"></select>
      <select id="statusFilter"></select>
      <button id="refreshNow" class="secondary">Refresh Now</button>
      <button id="resetBtn" class="ghost">Reset</button>
    </div>
  </header>

  <div class="container">
    <div id="statusBanner" class="banner" style="display:none"></div>

    <div class="grid cols-4" id="kpis"></div>

    <div class="charts" style="margin-top:16px">
      <div class="card"><canvas id="byModule"></canvas></div>
      <div class="card"><canvas id="byPriority"></canvas></div>
      <div class="card"><canvas id="byStatus"></canvas></div>
      <div class="card"><canvas id="byType"></canvas></div>
    </div>

    <div class="card" style="margin-top:16px">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px">
        <strong style="font-size:16px">Issues</strong>
        <span id="rowCount" class="muted"></span>
        <span id="lastUpdated" class="hint" style="margin-left:auto"></span>
      </div>
      <div class="table-wrap">
        <table id="issuesTable">
          <thead>
            <tr>
              <th>ID</th>
              <th>Module</th>
              <th>Title</th>
              <th>Description</th>
              <th>Type</th>
              <th>Priority</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <strong>Debug Preview (first 5 rows)</strong>
      <div id="debugPreview" class="hint" style="margin-top:8px"></div>
    </div>

    <div class="card" style="margin-top:16px">
      <strong>Self Tests</strong>
      <div id="testResults" class="hint" style="margin-top:8px"></div>
    </div>
  </div>

  <footer>
    Data loads live from Google Sheet (CSV export link).
  </footer>

  <script>
    const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTRwAjNAQxiPP8uR15t_vx03JkjgEBjgUwp2bpx8rsHx-JJxVDBZyf5ap77rAKrYHfgkVMwLJVm6pGn/pub?output=csv";

    const els = {
      banner: document.getElementById('statusBanner'),
      kpis: document.getElementById('kpis'),
      tableBody: document.querySelector('#issuesTable tbody'),
      rowCount: document.getElementById('rowCount'),
      lastUpdated: document.getElementById('lastUpdated'),
      search: document.getElementById('searchInput'),
      moduleFilter: document.getElementById('moduleFilter'),
      priorityFilter: document.getElementById('priorityFilter'),
      statusFilter: document.getElementById('statusFilter'),
      reset: document.getElementById('resetBtn'),
      refreshNow: document.getElementById('refreshNow'),
      tests: document.getElementById('testResults'),
      debug: document.getElementById('debugPreview'),
    };

    function showBanner(msg, type='info'){
      els.banner.textContent = msg;
      els.banner.className = 'banner' + (type==='error' ? ' error' : '');
      els.banner.style.display = 'flex';
      if(type!=='error') setTimeout(()=>els.banner.style.display='none',4000);
    }

    function uniq(arr){ return [...new Set(arr.filter(Boolean))].sort(); }
    function badge(text){ return `<span class="pill">${text||'-'}</span>`; }
    function typeBadge(t){ const c=/bug/i.test(t)?'bug':/enh/i.test(t)?'enh':''; return `<span class="pill ${c}">${t||'-'}</span>`; }

    let rows = [], filtered = [], charts = {};

    function normalizeRow(raw){
      const lower={}; for(const k in raw){ lower[k.toLowerCase().trim()]=String(raw[k]??'').trim(); }
      const pick=(...keys)=>{for(const key of keys){if(lower[key]) return lower[key];} return '';};
      return {
        id: pick('id','ticket id','incheck id'),
        module: pick('module','impacted module'),
        title: pick('title'),
        description: pick('description'),
        type: pick('type','category'),
        priority: pick('priority'),
        status: pick('status')
      };
    }

    function parseCsv(text){
      const parsed = Papa.parse(text,{header:true,skipEmptyLines:true});
      return (parsed.data||[]).map(normalizeRow).filter(r=>r.id||r.title);
    }

    function renderKpis(){
      els.kpis.innerHTML = `<div class="card kpi"><div class="label">Total Issues</div><div class="value">${filtered.length}</div></div>`;
    }

    function renderFilters(){
      els.moduleFilter.innerHTML = ['All',...uniq(rows.map(r=>r.module))].map(v=>`<option>${v}</option>`).join('');
      els.priorityFilter.innerHTML = ['All',...uniq(rows.map(r=>r.priority))].map(v=>`<option>${v}</option>`).join('');
      els.statusFilter.innerHTML = ['All',...uniq(rows.map(r=>r.status))].map(v=>`<option>${v}</option>`).join('');
    }

    function renderTable(){
      els.tableBody.innerHTML = filtered.map(r=>`
        <tr>
          <td>${r.id}</td>
          <td>${r.module}</td>
          <td>${r.title}</td>
          <td>${r.description}</td>
          <td>${typeBadge(r.type)}</td>
          <td>${badge(r.priority)}</td>
          <td>${r.status}</td>
        </tr>`).join('');
      els.rowCount.textContent=`${filtered.length} rows`;
    }

    function groupCount(list,key){return list.reduce((a,r)=>{const k=r[key]||'Unspecified';a[k]=(a[k]||0)+1;return a;},{});}

    function drawCharts(){
      const make=(id,type,data)=>{if(charts[id]) charts[id].destroy(); charts[id]=new Chart(document.getElementById(id),{type,data:{labels:Object.keys(data),datasets:[{data:Object.values(data)}]}});};
      make('byModule','bar',groupCount(filtered,'module'));
      make('byPriority','doughnut',groupCount(filtered,'priority'));
      make('byStatus','bar',groupCount(filtered,'status'));
      make('byType','bar',groupCount(filtered,'type'));
    }

    function applyFilters(){
      const q=(els.search.value||'').toLowerCase();
      const m=els.moduleFilter.value,p=els.priorityFilter.value,s=els.statusFilter.value;
      filtered=rows.filter(r=>{
        const text=(r.id+' '+r.module+' '+r.title+' '+r.description).toLowerCase();
        return (!q||text.includes(q))&&(!m||m==='All'||r.module===m)&&(!p||p==='All'||r.priority===p)&&(!s||s==='All'||r.status===s);
      });
      renderKpis(); renderTable(); drawCharts();
    }

    async function loadSheet(){
      try{
        showBanner('Loading data…');
        const res=await fetch(SHEET_URL+'&t='+Date.now(),{cache:'no-store'});
        if(!res.ok) throw new Error(res.statusText);
        const text=await res.text();
        rows=parseCsv(text); filtered=[...rows];
        renderFilters(); applyFilters();
        els.lastUpdated.textContent='Last updated: '+new Date().toLocaleString();
        els.debug.innerHTML=rows.slice(0,5).map(r=>`${r.id} | ${r.title} | ${r.description}`).join('<br>');
        showBanner(`Loaded ${rows.length} rows`);
      }catch(e){console.error(e);showBanner('Failed to load sheet: '+e.message,'error');}
    }

    els.search.addEventListener('input',applyFilters);
    els.moduleFilter.addEventListener('change',applyFilters);
    els.priorityFilter.addEventListener('change',applyFilters);
    els.statusFilter.addEventListener('change',applyFilters);
    els.reset.addEventListener('click',()=>{els.search.value='';renderFilters();applyFilters();});
    els.refreshNow.addEventListener('click',loadSheet);

    // Self test
    function runTests(){
      const csv=`ID,Module,Title,Description,Type,Priority,Status\n1,Reporting,Export error,Broken export,Bug,High,Resolved`;
      const r=parseCsv(csv)[0];
      const ok=r.id==='1'&&r.description==='Broken export'&&r.type==='Bug'&&r.status==='Resolved';
      els.tests.textContent=ok?'✅ Basic mapping works':'❌ Test failed';
    }

    runTests();
    loadSheet();
  </script>
</body>
</html>
