import { createHash, timingSafeEqual } from 'node:crypto'
import { readFileSync } from 'node:fs'

const headers = {
  'cache-control': 'no-store',
  'content-security-policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
}

function response(
  statusCode,
  body,
  contentType = 'application/json; charset=utf-8',
  extraHeaders = {},
) {
  return {
    statusCode,
    headers: { ...headers, ...extraHeaders, 'content-type': contentType },
    body: contentType.startsWith('application/json') ? JSON.stringify(body) : body,
  }
}

function secureTextEqual(actual, expected) {
  const actualHash = createHash('sha256').update(String(actual)).digest()
  const expectedHash = createHash('sha256').update(String(expected)).digest()
  return timingSafeEqual(actualHash, expectedHash)
}

function dashboardAuthorized(event) {
  const requestHeaders = event.headers ?? {}
  const authorization = Object.entries(requestHeaders).find(
    ([name]) => name.toLowerCase() === 'authorization',
  )?.[1]
  if (typeof authorization !== 'string' || !authorization.startsWith('Basic ')) {
    return false
  }

  let decoded
  try {
    decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8')
  } catch {
    return false
  }
  const separator = decoded.indexOf(':')
  if (separator < 0) return false

  const username = decoded.slice(0, separator)
  const password = decoded.slice(separator + 1)
  const expectedUsername = process.env.CTF_BASIC_AUTH_USERNAME ?? 'cloudvault'
  const expectedPasswordSha256 = process.env.CTF_BASIC_AUTH_PASSWORD_SHA256 ?? ''
  const actualPasswordSha256 = createHash('sha256').update(password).digest('hex')
  return secureTextEqual(username, expectedUsername) &&
    secureTextEqual(actualPasswordSha256, expectedPasswordSha256)
}

function basicAuthRequired() {
  return response(
    401,
    { message: 'Basic authentication required.' },
    'application/json; charset=utf-8',
    { 'www-authenticate': 'Basic realm="Cloud Vault CTF", charset="UTF-8"' },
  )
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function config() {
  let targetUrl = './target/'
  try {
    const configuredTarget = process.env.CTF_TARGET_URL?.trim()
    if (configuredTarget) {
      const candidate = new URL(configuredTarget)
      if (candidate.protocol === 'http:' || candidate.protocol === 'https:') {
        targetUrl = candidate.toString()
      }
    }
  } catch {
    // Render the challenge without a launch link when manually misconfigured.
  }

  return {
    stage: process.env.CTF_STAGE ?? 'local',
    title: process.env.CTF_CHALLENGE_TITLE ?? 'Cloud Vault — TechVault侵害調査',
    description: process.env.CTF_CHALLENGE_DESCRIPTION ?? '社員ポータルを起点に漏洩経路を追い、LocalStack上の最終証拠を回収してください。',
    targetUrl,
  }
}

let challengeCache

function challenges() {
  if (challengeCache) return challengeCache
  const catalogPath = process.env.CTF_CHALLENGES_PATH || new URL('./challenges.json', import.meta.url)
  const source = JSON.parse(
    readFileSync(catalogPath, 'utf8'),
  )
  challengeCache = source.flatMap((challenge) => {
    const base = {
      id: challenge.id,
      title: challenge.title,
      description: challenge.description,
      category: challenge.category,
      points: challenge.points,
      difficulty: challenge.difficulty,
      prerequisites: challenge.prerequisites ?? [],
      hints: challenge.hints ?? [],
      correctFlag: challenge.flag,
      kind: 'challenge',
    }
    if (!challenge.quiz) return [base]
    return [
      base,
      {
        id: `${challenge.id}-quiz`,
        title: `${challenge.title} — 理解確認`,
        description: challenge.quiz.question,
        category: 'quiz',
        points: challenge.quiz.points,
        difficulty: 1,
        prerequisites: [challenge.id],
        hints: [],
        options: challenge.quiz.options.map((option, index) => ({
          id: String(index),
          label: option.label,
        })),
        correctAnswer: String(
          challenge.quiz.options.findIndex(
            (option) => option.flag === challenge.quiz.correctFlag,
          ),
        ),
        kind: 'quiz',
      },
    ]
  })
  return challengeCache
}

function publicChallenges() {
  return challenges().map(({
    correctFlag: _correctFlag,
    correctAnswer: _correctAnswer,
    ...challenge
  }) => challenge)
}

function targetPage() {
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TechVault Portal</title>
  <style>
    :root { color-scheme:light; --bg:#f4f7fb; --panel:#fff; --line:#dce4ee; --ink:#172033; --muted:#637086; --blue:#1a73e8; --red:#c93645; }
    * { box-sizing:border-box } body { margin:0; min-height:100vh; background-color:var(--bg); background-image:linear-gradient(rgba(26,115,232,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(26,115,232,.035) 1px,transparent 1px); background-size:40px 40px; color:var(--ink); font-family:Inter,ui-sans-serif,system-ui,sans-serif }
    .shell { min-height:100vh; display:grid; place-items:center; padding:32px 16px }.login { width:min(430px,100%) }.card { padding:38px; border:1px solid var(--line); border-radius:14px; background:var(--panel); box-shadow:0 18px 55px rgba(31,45,61,.12) }
    .logo { display:grid; place-items:center; width:64px; height:64px; margin:0 auto 17px; border-radius:50%; background:#e8f1fd; color:var(--blue); font-weight:900; font-size:20px }.brand { text-align:center; margin:0; font-size:26px }.subtitle { text-align:center; color:var(--muted); margin:6px 0 30px }
    label { display:block; margin:16px 0 7px; font-size:13px; font-weight:700 } input { width:100%; padding:13px 14px; border:1px solid #cbd5e1; border-radius:7px; background:white; color:var(--ink); font:14px inherit; outline:none } input:focus { border-color:var(--blue); box-shadow:0 0 0 3px rgba(26,115,232,.12) }
    button { width:100%; margin-top:22px; padding:13px; border:0; border-radius:7px; background:var(--blue); color:white; font-weight:800; cursor:pointer } button:disabled { opacity:.6 }.error { min-height:21px; color:var(--red); margin:13px 0 0; font-size:13px }
    footer { margin-top:20px; text-align:center; color:var(--muted); font-size:12px } footer a { color:var(--blue); text-decoration:none }
  </style>
</head>
<body>
  <!-- TODO: remove debug marker before release: TVAULT{hardcoded_secret_in_js} -->
  <!-- public assets: http://localhost:4566/techvault-public-assets-local/ -->
  <main class="shell"><div class="login"><section class="card">
    <div class="logo">TV</div><h1 class="brand">TechVault</h1><p class="subtitle">Employee Portal</p>
    <form id="login-form"><label for="email">メールアドレス</label><input id="email" name="email" type="email" placeholder="name@techvault.example" required>
    <label for="password">パスワード</label><input id="password" name="password" type="password" required><button type="submit">ログイン</button><p id="login-error" class="error" role="alert"></p></form>
  </section><footer>© 2026 TechVault Inc. · <a href="../gitvual/techvault-ctf">GitVual</a></footer></div></main>
  <script>
    const form=document.getElementById('login-form'),error=document.getElementById('login-error'),button=form.querySelector('button');
    form.addEventListener('submit',async(event)=>{event.preventDefault();error.textContent='';button.disabled=true;try{const response=await fetch('../api/auth',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:form.email.value,password:form.password.value})});const data=await response.json();console.debug('[TechVault] auth response',data);if(response.ok){sessionStorage.setItem('tvault-token',data.token);location.href='../dashboard';}else{error.textContent=data.message||'メールアドレスまたはパスワードが正しくありません';}}catch{error.textContent='サーバーに接続できませんでした。';}finally{button.disabled=false;}});
  </script>
</body></html>`
}

function dashboardPage() {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dashboard | TechVault</title><style>body{margin:0;background:#f4f7fb;color:#172033;font-family:system-ui,sans-serif}header{padding:20px 7%;background:#fff;border-bottom:1px solid #dce4ee;font-weight:800;color:#1a73e8}main{width:min(960px,86%);margin:55px auto}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.card{padding:24px;background:#fff;border:1px solid #dce4ee;border-radius:10px}.card span{color:#637086;font-size:13px}.card strong{display:block;margin-top:18px;font-size:28px}@media(max-width:700px){.grid{grid-template-columns:1fr}}</style></head><body><header>TechVault Employee Portal</header><main><h1>ダッシュボード</h1><p>財務データ分析環境の稼働状況</p><section class="grid"><div class="card"><span>Stored objects</span><strong>12,840</strong></div><div class="card"><span>Active workloads</span><strong>24</strong></div><div class="card"><span>Security posture</span><strong>Healthy</strong></div></section></main></body></html>`
}

function gitVualPage() {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>techvault-ctf · GitVual</title><style>body{margin:0;background:#0d1117;color:#e6edf3;font-family:system-ui,sans-serif}main{width:min(880px,calc(100% - 32px));margin:60px auto}.repo{padding:22px;border:1px solid #30363d;border-radius:8px;background:#161b22}strong{color:#58a6ff}p{color:#8b949e}</style></head><body><main><h1>techvault-ctf</h1><p>TechVault Inc. public repositories</p><div class="repo"><strong>frontend-portal</strong><p>Employee portal frontend · Public · 14 commits</p></div></main></body></html>`
}

function dashboardPageHtml() {
  const dashboard = config()
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cloud Vault CTF Dashboard</title>
<style>
:root{color-scheme:dark;--bg:#07100d;--panel:#0d1b17;--panel2:#10231d;--line:#274139;--ink:#eef8f4;--muted:#92aaa2;--mint:#68e0b0;--amber:#f4c65d;--red:#fb7185;--blue:#67b7ff}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 85% 0,#143a2e,transparent 28rem),var(--bg);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,sans-serif}.shell{width:min(1200px,calc(100% - 32px));margin:auto;padding:28px 0 70px}header{display:flex;align-items:center;justify-content:space-between;padding-bottom:24px;border-bottom:1px solid var(--line)}.brand{font-weight:900;letter-spacing:.11em}.target{padding:10px 14px;background:var(--mint);color:#06100d;text-decoration:none;font-size:13px;font-weight:850}.hero{display:grid;grid-template-columns:1fr auto;align-items:end;gap:24px;padding:48px 0 30px}.eyebrow{color:var(--mint);font:11px ui-monospace,monospace;letter-spacing:.13em}.hero h1{margin:10px 0;font-size:clamp(34px,6vw,58px);letter-spacing:-.045em}.hero p{max-width:720px;margin:0;color:#b8cac4;line-height:1.7}.stats{display:grid;grid-template-columns:repeat(3,110px);gap:8px}.stat{padding:15px;border:1px solid var(--line);background:var(--panel);text-align:center}.stat strong{display:block;font-size:24px;color:var(--mint)}.stat span{font-size:10px;color:var(--muted)}.toolbar{display:flex;gap:8px;overflow:auto;padding:14px 0 22px}.filter{white-space:nowrap;padding:9px 13px;border:1px solid var(--line);background:transparent;color:var(--muted);cursor:pointer}.filter.active{background:var(--mint);border-color:var(--mint);color:#06100d;font-weight:800}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.challenge{display:flex;min-height:230px;padding:21px;border:1px solid var(--line);background:rgba(13,27,23,.92);cursor:pointer;transition:.15s;flex-direction:column}.challenge:hover{transform:translateY(-2px);border-color:#4e7468}.challenge.solved{border-color:rgba(104,224,176,.65)}.challenge.locked{opacity:.7}.top{display:flex;justify-content:space-between;gap:12px}.category{color:var(--mint);font:10px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.1em}.points{color:var(--amber);font:12px ui-monospace,monospace}.challenge h2{margin:17px 0 10px;font-size:18px}.challenge p{display:-webkit-box;overflow:hidden;-webkit-line-clamp:3;-webkit-box-orient:vertical;margin:0 0 18px;color:var(--muted);font-size:13px;line-height:1.6;white-space:pre-line}.foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:auto;padding-top:14px;border-top:1px solid rgba(39,65,57,.65);color:#647b73;font:10px ui-monospace,monospace}.difficulty{display:flex;align-items:center;gap:7px}.stars{color:var(--amber);font-size:12px;letter-spacing:2px}.solved .state{color:var(--mint)}dialog{width:min(720px,calc(100% - 30px));max-height:88vh;padding:0;border:1px solid var(--line);background:var(--panel);color:var(--ink);box-shadow:0 30px 100px #000;overflow:auto}dialog::backdrop{background:rgba(1,7,5,.78)}.modal{padding:28px}.close{float:right;border:0;background:transparent;color:var(--muted);font-size:25px;cursor:pointer}.modal .desc{color:#bdcec8;line-height:1.75;white-space:pre-line}.meta{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}.pill{padding:7px 9px;border:1px solid var(--line);color:var(--muted);font:11px ui-monospace,monospace}.modal-target{display:block;padding:13px;margin:20px 0;background:var(--mint);color:#06100d;text-align:center;text-decoration:none;font-weight:850}.prereq{padding:12px;border-left:3px solid var(--amber);background:#17190f;color:#d7c788;font-size:13px}.hints{margin:18px 0;border-top:1px solid var(--line);padding-top:15px}.hints summary{cursor:pointer;color:var(--amber)}.hints li{color:var(--muted);margin:9px 0}form{display:flex;gap:9px;margin-top:20px}input{flex:1;min-width:0;padding:13px;border:1px solid var(--line);background:#07110f;color:var(--ink);font:13px ui-monospace,monospace}form.quiz-mode{display:block}.quiz-options{display:grid;gap:10px;margin-bottom:14px}.quiz-option{display:flex;align-items:flex-start;gap:12px;padding:14px;border:1px solid var(--line);background:#07110f;color:#bdcec8;line-height:1.5;cursor:pointer}.quiz-option:hover{border-color:#4e7468}.quiz-option:has(input:checked){border-color:var(--mint);background:#10271f;color:var(--ink)}.quiz-option input{appearance:none;flex:0 0 19px;width:19px;height:19px;margin:1px 0 0;padding:0;border:1px solid #58736a;background:#07110f}.quiz-option input:checked{border-color:var(--mint);background:var(--mint);box-shadow:inset 0 0 0 4px #10271f}button.submit{padding:0 20px;border:0;background:var(--ink);color:#07110f;font-weight:850;cursor:pointer}.quiz-mode button.submit{width:100%;padding:13px}.result{min-height:22px;margin:10px 0 0;font:13px ui-monospace,monospace}.ok{color:var(--mint)}.error{color:var(--red)}.empty{grid-column:1/-1;padding:50px;text-align:center;color:var(--muted)}footer{margin-top:25px;color:#5d756c;font:11px ui-monospace,monospace}@media(max-width:900px){.grid{grid-template-columns:repeat(2,1fr)}.hero{grid-template-columns:1fr}.stats{grid-template-columns:repeat(3,1fr)}}@media(max-width:580px){.grid{grid-template-columns:1fr}.hero{padding-top:34px}header{gap:12px}.target{font-size:11px}.stats{width:100%}.modal{padding:21px}form{flex-direction:column}button.submit{padding:13px}}
</style></head><body><main class="shell" id="app" data-target-url="${escapeHtml(dashboard.targetUrl)}">
<header><div class="brand">CLOUD VAULT CTF</div><a class="target" id="header-target" target="_blank" rel="noreferrer">問題環境を開く ↗</a></header>
<section class="hero"><div><div class="eyebrow">CHALLENGE DASHBOARD</div><h1>${escapeHtml(dashboard.title)}</h1><p>${escapeHtml(dashboard.description)}</p></div><div class="stats"><div class="stat"><strong id="solved-count">0</strong><span>SOLVED</span></div><div class="stat"><strong id="challenge-count">0</strong><span>CHALLENGES</span></div><div class="stat"><strong id="score">0</strong><span>POINTS</span></div></div></section>
<nav class="toolbar" id="filters" aria-label="カテゴリ"></nav><section class="grid" id="challenge-grid"><div class="empty">問題を読み込んでいます…</div></section>
<footer>Dashboard domain · Cloud Vault / LocalStack</footer></main>
<dialog id="challenge-dialog"><div class="modal"><button class="close" id="close" aria-label="閉じる">×</button><div class="category" id="modal-category"></div><h2 id="modal-title"></h2><div class="meta" id="modal-meta"></div><p class="desc" id="modal-description"></p><div class="prereq" id="modal-prereq"></div><a class="modal-target" id="modal-target" target="_blank" rel="noreferrer">問題環境を開く ↗</a><details class="hints" id="modal-hints"><summary>ヒントを見る</summary><ul id="hint-list"></ul></details><form id="submit-form"><div class="quiz-options" id="quiz-options" role="radiogroup" aria-label="回答を選択" hidden></div><input id="flag-input" autocomplete="off" placeholder="TVAULT{...}" aria-label="Flag"><button class="submit" id="submit-button" type="submit">Flagを提出</button></form><p class="result" id="submit-result"></p></div></dialog>
<script>
const app=document.getElementById('app'),targetUrl=app.dataset.targetUrl,grid=document.getElementById('challenge-grid'),filters=document.getElementById('filters'),dialog=document.getElementById('challenge-dialog');
document.getElementById('header-target').href=targetUrl;document.getElementById('modal-target').href=targetUrl;
const labels={all:'すべて',tutorial:'チュートリアル',main:'メイン',quiz:'理解確認',bonus:'ボーナス',advanced:'上級',blueteam:'Blue Team',finale:'フィナーレ'};let catalog=[],active='all',selected=null;const solved=new Set(JSON.parse(localStorage.getItem('cloud-vault-solved')||'[]'));
const esc=(value)=>String(value??'').replace(/[&<>"']/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
function unlocked(item){return item.prerequisites.every((id)=>solved.has(id))}function save(){localStorage.setItem('cloud-vault-solved',JSON.stringify([...solved]))}
function updateStats(){document.getElementById('solved-count').textContent=solved.size;document.getElementById('challenge-count').textContent=catalog.length;document.getElementById('score').textContent=catalog.filter((item)=>solved.has(item.id)).reduce((sum,item)=>sum+item.points,0)}
function renderFilters(){const categories=['all',...new Set(catalog.map((item)=>item.category))];filters.innerHTML=categories.map((category)=>'<button class="filter '+(category===active?'active':'')+'" data-category="'+esc(category)+'">'+esc(labels[category]||category)+'</button>').join('');filters.querySelectorAll('button').forEach((button)=>button.onclick=()=>{active=button.dataset.category;renderFilters();render()})}
function render(){const items=active==='all'?catalog:catalog.filter((item)=>item.category===active);grid.innerHTML=items.length?items.map((item)=>{const isSolved=solved.has(item.id),isLocked=!unlocked(item),difficulty=Math.max(1,Number(item.difficulty)||1);return '<article class="challenge '+(isSolved?'solved ':'')+(isLocked?'locked':'')+'" data-id="'+esc(item.id)+'"><div class="top"><span class="category">'+esc(labels[item.category]||item.category)+'</span><span class="points">'+item.points+' pt</span></div><h2>'+esc(item.title)+'</h2><p>'+esc(item.description)+'</p><div class="foot"><span class="difficulty" aria-label="難易度 '+difficulty+'"><span>DIFFICULTY</span><span class="stars">'+'★'.repeat(difficulty)+'</span></span><span class="state">'+(isSolved?'✓ SOLVED':isLocked?'LOCKED':'OPEN')+'</span></div></article>'}).join(''):'<div class="empty">該当する問題はありません。</div>';grid.querySelectorAll('.challenge').forEach((card)=>card.onclick=()=>openChallenge(card.dataset.id));updateStats()}
function openChallenge(id){selected=catalog.find((item)=>item.id===id);if(!selected)return;const isQuiz=selected.kind==='quiz';document.getElementById('modal-category').textContent=labels[selected.category]||selected.category;document.getElementById('modal-title').textContent=selected.title;document.getElementById('modal-description').textContent=selected.description;document.getElementById('modal-meta').innerHTML='<span class="pill">'+selected.points+' POINTS</span><span class="pill">DIFFICULTY '+selected.difficulty+'</span><span class="pill">ID '+esc(selected.id)+'</span>';const prereq=document.getElementById('modal-prereq');prereq.hidden=selected.prerequisites.length===0;prereq.textContent='前提問題: '+selected.prerequisites.join(', ');const hints=document.getElementById('modal-hints');hints.hidden=isQuiz||selected.hints.length===0;document.getElementById('hint-list').innerHTML=selected.hints.map((hint)=>'<li>'+esc(hint.text)+(hint.penalty?' (-'+hint.penalty+'pt)':'')+'</li>').join('');const target=document.getElementById('modal-target');target.hidden=isQuiz;const form=document.getElementById('submit-form'),flagInput=document.getElementById('flag-input'),quizOptions=document.getElementById('quiz-options'),submitButton=document.getElementById('submit-button');form.classList.toggle('quiz-mode',isQuiz);flagInput.hidden=isQuiz;flagInput.value='';quizOptions.hidden=!isQuiz;quizOptions.innerHTML=isQuiz?selected.options.map((option)=>'<label class="quiz-option"><input type="radio" name="quiz-answer" value="'+esc(option.id)+'"><span>'+esc(option.label)+'</span></label>').join(''):'';submitButton.textContent=isQuiz?'回答する':'Flagを提出';const result=document.getElementById('submit-result');result.textContent=solved.has(id)?'✓ この問題はクリア済みです。':'';result.className='result '+(solved.has(id)?'ok':'');dialog.showModal()}
document.getElementById('close').onclick=()=>dialog.close();dialog.onclick=(event)=>{if(event.target===dialog)dialog.close()};
document.getElementById('submit-form').addEventListener('submit',async(event)=>{event.preventDefault();if(!selected)return;const isQuiz=selected.kind==='quiz',checked=document.querySelector('input[name="quiz-answer"]:checked'),result=document.getElementById('submit-result');if(isQuiz&&!checked){result.textContent='回答を1つ選択してください。';result.className='result error';return}const payload=isQuiz?{challengeId:selected.id,answer:checked.value}:{challengeId:selected.id,flag:document.getElementById('flag-input').value};result.textContent='確認中…';result.className='result';try{const response=await fetch('./api/submit',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});const data=await response.json();result.textContent=data.message;result.className='result '+(data.correct?'ok':'error');if(data.correct){solved.add(selected.id);save();render();dialog.close()}}catch{result.textContent='提出に失敗しました。';result.className='result error'}});
fetch('./api/challenges').then((response)=>response.json()).then((data)=>{catalog=data.challenges;renderFilters();render()}).catch(()=>{grid.innerHTML='<div class="empty">問題一覧を取得できませんでした。</div>'});
</script></body></html>`
}

function requestBody(event) {
  if (!event.body) return {}
  const text = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body
  try {
    return JSON.parse(text)
  } catch {
    return Object.fromEntries(new URLSearchParams(text))
  }
}

function flagMatches(candidate) {
  const expected = process.env.CTF_FLAG_SHA256 ?? ''
  if (!/^[a-f0-9]{64}$/.test(expected)) return false
  const actual = createHash('sha256').update(String(candidate).trim()).digest('hex')
  return timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'))
}

function catalogFlagMatches(challenge, candidate) {
  if (challenge.id === 'final' && flagMatches(candidate)) return true
  const expected = createHash('sha256')
    .update(String(challenge.correctFlag).trim().toLowerCase())
    .digest()
  const actual = createHash('sha256')
    .update(String(candidate).trim().toLowerCase())
    .digest()
  return timingSafeEqual(actual, expected)
}

function quizAnswerMatches(challenge, candidate) {
  const expected = createHash('sha256').update(String(challenge.correctAnswer)).digest()
  const actual = createHash('sha256').update(String(candidate)).digest()
  return timingSafeEqual(actual, expected)
}

function problemBaseUrl(event) {
  const requestHeaders = event.headers ?? {}
  const header = (name) => Object.entries(requestHeaders).find(
    ([key]) => key.toLowerCase() === name,
  )?.[1]
  const host = header('host') ?? 'localhost:3002'
  const protocol = String(header('x-forwarded-proto') ?? 'http').split(',')[0].toLowerCase()
  const apiStage = event.requestContext?.stage
  const stagePath = apiStage && apiStage !== '$default' ? `/${apiStage}` : ''
  return `${protocol}://${host}${stagePath}`
}

function emulatedEc2Inventory() {
  return {
    Reservations: [{
      ReservationId: 'r-0f7c2a84e6d193b51',
      Instances: [{
        InstanceId: 'i-0a1b2c3d4e5f67890',
        InstanceType: 't3.micro',
        PrivateIpAddress: '10.0.2.54',
        State: { Code: 16, Name: 'running' },
        MetadataOptions: { HttpEndpoint: 'enabled', HttpTokens: 'optional' },
        Tags: [
          { Key: 'Name', Value: 'internal-data-server' },
          { Key: 'Environment', Value: 'production' },
          { Key: 'ManagedBy', Value: 'cto-kawakami' },
          { Key: 'OpenApiSpec', Value: 'http://internal-data-server/openapi.json' },
          { Key: 'Note', Value: 'Portal Lambda経由で内部HTMLを確認すること（TODO: URL検証）' },
          { Key: 'Flag', Value: 'TVAULT{ec2_tags_are_not_secrets}' },
        ],
      }],
    }],
  }
}

function emulatedImdsBody(target) {
  if (target.hostname !== '169.254.169.254') return null
  const metadataPath = target.pathname.replace(/\/+$/, '')
  if (metadataPath === '/latest/meta-data') return 'ami-id\nhostname\niam/\ninstance-id\n'
  if (metadataPath === '/latest/meta-data/iam/security-credentials') {
    return 'EC2InstanceRole\n'
  }
  if (metadataPath === '/latest/meta-data/iam/security-credentials/EC2InstanceRole') {
    return JSON.stringify({
      Code: 'Success',
      Type: 'AWS-HMAC',
      AccessKeyId: 'ASIA4ZQ7N2KX8M5P3RVT',
      SecretAccessKey: 'uW4mV7aK2pQ9xT5nL8sD1cF6hJ3rB0yE4gZ7iO2P',
      Token: 'IQoJb3JpZ2luX2VjEHcaDmFwLW5vcnRoZWFzdC0x',
      Expiration: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      Flag: 'TVAULT{imdsv1_ssrf_is_classic}',
    })
  }
  return 'not found\n'
}

function emulatorOpenApi() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'TechVault Internal Data Service',
      version: '2026.09-internal',
    },
    paths: {
      '/fetch': { get: { summary: 'Fetch URL without link-local validation' } },
      '/openapi.json': { get: { summary: 'OpenAPI specification' } },
    },
  }
}

function emulatorIndexPage() {
  return '<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>TechVault Internal Data Service</title></head><body><main><h1>TechVault Internal Data Service</h1><p>このページはVPC内の運用者向け内部サービスです。Portal Lambdaのプレビュー機能からのみ到達する想定です。</p><p><code>/openapi.json</code> と <code>/fetch?url=...</code> を利用できます。</p><p>IMDSv2移行とURL許可リスト実装は未完了です。</p></main></body></html>'
}

function ec2QueryXml(event) {
  const instance = emulatedEc2Inventory()
    .Reservations[0].Instances[0]
  const xml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
  const tags = instance.Tags
    .map(({ Key, Value }) => `<item><key>${xml(Key)}</key><value>${xml(Value)}</value></item>`)
    .join('')
  return `<?xml version="1.0" encoding="UTF-8"?><DescribeInstancesResponse xmlns="http://ec2.amazonaws.com/doc/2016-11-15/"><requestId>6f1c2d90-9f4e-4bc4-bc95-9ee9db423ab8</requestId><reservationSet><item><reservationId>r-0f7c2a84e6d193b51</reservationId><ownerId>000000000000</ownerId><instancesSet><item><instanceId>${instance.InstanceId}</instanceId><imageId>ami-0d52744d6551d851e</imageId><instanceState><code>16</code><name>running</name></instanceState><privateIpAddress>${instance.PrivateIpAddress}</privateIpAddress><instanceType>${instance.InstanceType}</instanceType><tagSet>${tags}</tagSet><metadataOptions><state>applied</state><httpTokens>optional</httpTokens><httpEndpoint>enabled</httpEndpoint></metadataOptions></item></instancesSet></item></reservationSet></DescribeInstancesResponse>`
}

async function emulatedFetch(value, wrap = true) {
  if (!value) return response(400, { error: 'url parameter is required' })
  let target
  try {
    target = new URL(value)
  } catch {
    return response(400, { error: 'url must be an absolute URL' })
  }

  const imdsBody = emulatedImdsBody(target)
  if (imdsBody !== null) {
    if (!wrap) {
      return response(
        imdsBody === 'not found\n' ? 404 : 200,
        imdsBody,
        'text/plain; charset=utf-8',
      )
    }
    return response(200, {
      status: imdsBody === 'not found\n' ? 404 : 200,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'x-imds-emulated': 'true' },
      body: imdsBody,
    })
  }
  if (target.hostname === 'internal-data-server') {
    const internalPath = target.pathname.replace(/\/+$/, '') || '/'
    if (internalPath === '/') return response(200, emulatorIndexPage(), 'text/html; charset=utf-8')
    if (internalPath === '/openapi.json') return response(200, emulatorOpenApi())
    if (internalPath === '/describe-instances') return response(200, emulatedEc2Inventory())
    if (internalPath === '/fetch') return emulatedFetch(target.searchParams.get('url'), true)
    return response(404, { message: 'Not Found' })
  }
  if (!['http:', 'https:'].includes(target.protocol)) {
    return response(400, { error: 'unsupported URL scheme' })
  }
  try {
    const fetched = await fetch(target, {
      headers: { 'user-agent': 'TechVault-Lambda-EC2-Emulator/1.0' },
      signal: AbortSignal.timeout(5000),
    })
    const body = await fetched.text()
    return wrap
      ? response(200, {
          status: fetched.status,
          headers: Object.fromEntries(fetched.headers.entries()),
          body,
        })
      : response(
          fetched.status,
          body,
          fetched.headers.get('content-type') ?? 'text/plain; charset=utf-8',
        )
  } catch (error) {
    return response(502, {
      error: 'fetch failed',
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

async function targetHandler(event, method, path) {
  if (method === 'GET' && path === '/health') {
    return response(200, { status: 'ok', service: 'target', stage: config().stage })
  }
  if (method === 'GET' && path === '/') {
    return response(200, targetPage(), 'text/html; charset=utf-8')
  }
  if (method === 'GET' && path === '/dashboard') {
    return response(200, dashboardPage(), 'text/html; charset=utf-8')
  }
  if (method === 'GET' && path === '/gitvual/techvault-ctf') {
    return response(200, gitVualPage(), 'text/html; charset=utf-8')
  }
  if (method === 'GET' && path === '/robots.txt') {
    return response(
      200,
      [
        'User-agent: *',
        'Disallow: /admin/',
        'Disallow: /internal/',
        'Disallow: /debug/status',
        '',
        '# S3バケット: techvault-public-assets-local.s3.us-east-1.amazonaws.com',
        '# TODO: remove before production',
        '# FLAG: TVAULT{robots_txt_is_public}',
        '',
      ].join('\n'),
      'text/plain; charset=utf-8',
    )
  }
  if (method === 'GET' && path === '/api/ping') {
    return response(
      200,
      { status: 'ok' },
      'application/json; charset=utf-8',
      {
        'x-internal-flag': 'TVAULT{curl_headers_revealed}',
        'x-debug-info': 'build=2026.03.15',
      },
    )
  }
  if (method === 'GET' && path === '/.env') {
    return response(
      200,
      [
        'NODE_ENV=development',
        'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE',
        'AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        'AWS_REGION=us-east-1',
        `AWS_ENDPOINT_URL_EC2=${problemBaseUrl(event)}/aws/ec2`,
        'S3_PUBLIC_BUCKET=techvault-public-assets-local',
        'S3_INTERNAL_BUCKET=techvault-internal-2026-local',
        'FLAG=TVAULT{dotenv_exposed_on_web}',
        '',
      ].join('\n'),
      'text/plain; charset=utf-8',
    )
  }
  if (method === 'GET' && path === '/aws/ec2') {
    return response(200, emulatorIndexPage(), 'text/html; charset=utf-8')
  }
  if (method === 'POST' && path === '/aws/ec2') {
    const action = requestBody(event).Action ?? event.queryStringParameters?.Action
    if (action === 'DescribeInstances') {
      return response(200, ec2QueryXml(event), 'text/xml; charset=utf-8')
    }
    return response(400, { error: 'Unsupported EC2 action', action: action ?? null })
  }
  if (method === 'GET' && path === '/aws/ec2/health') {
    return response(200, { status: 'ok', service: 'internal-data-service' })
  }
  if (method === 'GET' && path === '/aws/ec2/openapi.json') {
    return response(200, emulatorOpenApi())
  }
  if (method === 'GET' && path === '/aws/ec2/describe-instances') {
    return response(200, emulatedEc2Inventory())
  }
  if (method === 'GET' && path === '/aws/ec2/fetch') {
    return emulatedFetch(event.queryStringParameters?.url)
  }
  if (method === 'GET' && path.startsWith('/aws/ec2/latest/meta-data')) {
    const metadataPath = path.slice('/aws/ec2'.length)
    const body = emulatedImdsBody(new URL(`http://169.254.169.254${metadataPath}`))
    return response(
      body === 'not found\n' ? 404 : 200,
      body,
      'text/plain; charset=utf-8',
    )
  }
  if (method === 'GET' && path === '/api/announcements/preview') {
    return emulatedFetch(event.queryStringParameters?.url, false)
  }
  if (method === 'POST' && path === '/api/auth') {
    const body = requestBody(event)
    if (
      body.username === 'employee@techvault.example' &&
      body.password === 'EmployeePass2026!'
    ) {
      return response(200, {
        token: 'local-demo-token',
        user: { username: body.username, role: 'employee', provider: 'local' },
      })
    }
    return response(401, {
      error: 'Unauthorized',
      message: 'Invalid credentials',
      debug: {
        aws_access_key_id: 'AKIAIOSFODNN7EXAMPLE',
        aws_secret_access_key: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        region: 'us-east-1',
        note: 'dev credentials - investigate S3 bucket techvault-internal-2026-local',
        flag: 'TVAULT{dev_mode_is_dangerous}',
      },
    })
  }
  return response(404, { message: 'Not Found' })
}

async function dashboardHandler(event, method, path) {
  if (!dashboardAuthorized(event)) return basicAuthRequired()
  if (method === 'GET' && path === '/health') {
    return response(200, { status: 'ok', service: 'dashboard', stage: config().stage })
  }
  if (method === 'GET' && path === '/api/challenges') {
    const items = publicChallenges()
    return response(200, {
      challenges: items,
      totalChallenges: items.length,
      totalPoints: items.reduce((sum, item) => sum + item.points, 0),
    })
  }
  if (method === 'POST' && path === '/api/submit') {
    const body = requestBody(event)
    if (typeof body.challengeId !== 'string') {
      return response(400, { correct: false, message: '問題IDが必要です。' })
    }
    const challenge = challenges().find((item) => item.id === body.challengeId)
    if (!challenge) {
      return response(404, { correct: false, message: '問題が見つかりません。' })
    }
    if (challenge.kind === 'quiz' && typeof body.answer !== 'string') {
      return response(400, { correct: false, message: '回答を1つ選択してください。' })
    }
    if (
      challenge.kind !== 'quiz' &&
      (typeof body.flag !== 'string' || body.flag.trim().length === 0)
    ) {
      return response(400, { correct: false, message: 'フラグを入力してください。' })
    }
    const correct = challenge.kind === 'quiz'
      ? quizAnswerMatches(challenge, body.answer)
      : catalogFlagMatches(challenge, body.flag)
    return response(correct ? 200 : 400, {
      correct,
      challengeId: challenge.id,
      points: correct ? challenge.points : 0,
      message: correct
        ? `正解です！ ${challenge.points}ポイント獲得。`
        : challenge.kind === 'quiz'
          ? '不正解です。もう一度考えてみてください。'
          : 'Flagが違います。もう一度確認してください。',
    })
  }
  if (method === 'GET' && path === '/') {
    return response(200, dashboardPageHtml(), 'text/html; charset=utf-8')
  }
  return response(404, { message: 'Not Found' })
}

export async function handler(event = {}) {
  const method = event.requestContext?.http?.method ?? event.httpMethod ?? 'GET'
  const path = event.rawPath ?? event.path ?? '/'
  return (event.appMode ?? process.env.APP_MODE) === 'target'
    ? targetHandler(event, method, path)
    : dashboardHandler(event, method, path)
}
