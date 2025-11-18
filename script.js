/* ================= Storage / Defaults ================= */
const LS = {
    startTs:  'clean.startTs',

    // ms epoch (UTC)
    spent:  'clean.spent',
    bonus:  'clean.bonus',
    test:  'clean.testMode',
    history:  'clean.history',
    craving:  'clean.craving',
    boostInfo: 'clean.boostInfo'
};
const DEFAULTS = { TEST_MODE:  false, GOAL_DAYS:  30 };

function getDailySpendMin() {
    const now = new Date();

    const seed = now.getFullYear() * 10_000 + now.getMonth() * 100 + now.getDate();
    return (seed * 1337 + 42) % 90 + 10;
}


const MIN_TO_SPEND = getDailySpendMin();

const $ = s => document.querySelector(s);
const nowMs = () => Date.now();
const clamp = (n,  a,  b)  =>  Math.max(a,  Math.min(b,  n));
const vibr = () => {

    if ('vibrate' in navigator) navigator.vibrate(10);

};

/* overlays helpers */
const openSheet = el => {

    el.classList.add('overlay--show');

    vibr();

};
const closeSheet = el => el.classList.remove('overlay--show');

/* ========= Ripple (на кнопках) ========= */
function attachRipple(root  =  document)  {
    const targets = root.querySelectorAll('.btn, .iconbtn, .qty__btn');
    targets.forEach(el  =>  {
        el.addEventListener('pointerdown', (e)  =>  {
            const r = document.createElement('span');
            const rect = el.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            r.style.position  =  'absolute';
            r.style.left = (e.clientX  -  rect.left - size  /  2)  +  'px';
            r.style.top = (e.clientY  -  rect.top - size  /  2)  +  'px';
            r.style.width = r.style.height = size  +  'px';
            r.style.borderRadius  =  '50%';
            r.style.background  =  'rgba(255,255,255,.35)';
            r.style.transform  =  'scale(0)';
            r.style.transition  =  'transform .4s ease, opacity .6s ease';
            r.style.opacity  =  '1';
            r.className  =  'ripple';
            el.appendChild(r);
            requestAnimationFrame(()  =>  {
                r.style.transform  =  'scale(1)';
                r.style.opacity  =  '.0';
            });
            setTimeout(()  =>  r.remove(), 650);
        }, {passive:  true});
    });
}

/* ========= Settings ========= */
function loadSettings()  {
    const start = Number(localStorage.getItem(LS.startTs)) || 0;
    const spent = Number(localStorage.getItem(LS.spent)) || 0;
    const bonus = Number(localStorage.getItem(LS.bonus)) || 0;
    const test = localStorage.getItem(LS.test)  ===  '1';
    let history = [];
    try  {

        history = JSON.parse(localStorage.getItem(LS.history)  ||  '[]');

    }catch  { history  =  []; }
    let craving = null;
    try  {

        craving = JSON.parse(localStorage.getItem(LS.craving)  ||  'null');

    }catch  { craving  =  null; }
    return {start,  spent,  bonus,  test,  history,  craving};
}
function saveSettings(obj)  {
    if  ('start' in obj) localStorage.setItem(LS.startTs,  String(obj.start  ||  0));
    if  ('spent' in obj) localStorage.setItem(LS.spent,  String(obj.spent  ||  0));
    if  ('bonus' in obj) localStorage.setItem(LS.bonus,  String(obj.bonus  ||  0));
    if  ('test' in obj) localStorage.setItem(LS.test,  obj.test  ?  '1'  :  '0');
    if  ('history' in obj) localStorage.setItem(LS.history, JSON.stringify(obj.history  ||  []));
    if  ('craving' in obj) localStorage.setItem(LS.craving, JSON.stringify(obj.craving));
}
function ensureStart()  {
    const st = loadSettings().start;
    if  (!st)  { saveSettings({start: nowMs()}); }
}

/* ====== Time helpers (UTC store, local display) ====== */
function toLocalInputValue(ms)  {
    const d = new Date(ms);
    const y = d.getFullYear();
    const m = String(d.getMonth()  +  1).padStart(2,  '0');
    const day = String(d.getDate()).padStart(2,  '0');
    const hh = String(d.getHours()).padStart(2,  '0');
    const mm = String(d.getMinutes()).padStart(2,  '0');
    return `${y}-${m}-${day}T${hh}:${mm}`;
}
function fromLocalInputValue(str)  {
    if  (!str) return nowMs();
    const [date, time] = str.split('T');
    const [yy,  mm,  dd] = date.split('-').map(Number);
    const [HH,  MM] = time.split(':').map(Number);
    const d = new Date(yy, mm  -  1, dd, HH, MM, 0, 0);
    return d.getTime();
}

/* ====== Core calc: 4 subs / day ====== */
function computeState()  {
    const {start,  spent,  bonus,  test} = loadSettings();
    const effectiveNow = test ? nowMs() + 24  *  3600_000 : nowMs();

    const startTs = start;
    const elapsedMs = Math.max(0, effectiveNow - startTs);

    // ====== Core calc: 4 subs / day ======
    const ratePerMs = 4 / 86_400_000;
    const accruedFloat = elapsedMs * ratePerMs;
    const accrued = Math.floor(accruedFloat);

    const available = Math.max(0, accrued + bonus - spent);

    const nextUnitAt = (Math.floor(accruedFloat)  +  1) / ratePerMs;
    const msToNext = Math.max(0, startTs + nextUnitAt - effectiveNow);
    const unitMs = 1 / ratePerMs;

    return {

        startTs,

        elapsedMs,

        accruedFloat,

        accrued,

        spent,

        bonus,

        available,

        msToNext,

        unitMs,

        test,

        effectiveNow

    };
}

/* ====== UI helpers ====== */
function formatSince(ms)  {
    const d = new Date(ms);
    return 'с ' + d.toLocaleString([], {

        year:  'numeric',

        month:  '2-digit',

        day:  '2-digit',

        hour:  '2-digit',

        minute:  '2-digit'

    });
}
function fmtETA(ms)  {
    const s = Math.max(0, Math.floor(ms  /  1000));
    const hh = Math.floor(s  /  3600);
    const mm = Math.floor((s  %  3600)  /  60);
    const ss = s  %  60;
    const parts  =  [];
    if  (hh) parts.push(hh  +  'ч');
    if  (mm) parts.push(mm  +  'м');
    parts.push(ss  +  'с');
    return parts.join(' ');
}
function toast(msg  =  'Сохранено',  t  =  1400)  {
    const el  =  $('#toast');

    el.textContent  =  msg;

    el.classList.add('toast--show');
    setTimeout(()  =>  el.classList.remove('toast--show'), t);
}

/* ====== Quotes ====== */
const QUOTES = [
    ["Дисциплина — это свобода.", "Джоко Уиллинк"],
    ["Что меня не убивает, делает меня сильнее.", "Фридрих Ницше"],
    ["Если ты проходишь через ад — продолжай идти.", "Уинстон Черчилль"],
    ["Успех — это способность идти от поражения к поражению, не теряя энтузиазма.", "Уинстон Черчилль"],
    ["Не проси, чтобы было легче. Проси, чтобы ты стал сильнее.", "Джим Рон"],
    ["Гений — это 1% вдохновения и 99% пота.", "Томас Эдисон"],
    ["Неважно, как медленно ты идёшь, пока не останавливаешься.", "Конфуций"],
    ["Ни один ветер не будет попутным тому, кто не знает, куда плыть.", "Сенека"],
    ["Делай, что можешь, там, где ты есть, с тем, что имеешь.", "Теодор Рузвельт"],
    ["Я терпел поражение снова и снова. И потому я побеждаю.", "Майкл Джордан"],
    ["Ты промахиваешься в 100% бросков, которые не делаешь.", "Уэйн Гретцки"],
    ["Если думаешь, что сможешь — ты прав; если думаешь, что не сможешь — тоже прав.", "Генри Форд"],
    ["Тяжело в учении — легко в бою.", "Александр Суворов"],
    ["Кто познал «зачем», выдержит почти любое «как».", "Фридрих Ницше"],
    ["Человека можно лишить всего, кроме одного — свободы выбирать своё отношение к обстоятельствам.", "Виктор Франкл"],
    ["Путь преграды становится путём: то, что мешает действию, продвигает действие.", "Марк Аврелий"],
    ["Если хочешь иметь то, чего никогда не имел, делай то, чего никогда не делал.", "Томас Джефферсон"],
    ["Лучшее время посадить дерево было 20 лет назад. Второе лучшее — сегодня.", "Китайская пословица"],
    ["Талант — ничто без упорства.", "Дин Кроуфорд"],
    ["Персеверанс — это работа, которую делаешь после того, как устал от работы, которую уже сделал.", "Ньют Гингрич"],
    ["Не события тревожат людей, а их мнение о событиях.", "Эпиктет"],
    ["Сила приходит не от побед. Борьба развивает твою силу.", "Арнольд Шварценеггер"],
    ["Кровь, труд, слёзы и пот.", "Уинстон Черчилль"],
    ["Не жди вдохновения — иди за ним с дубиной.", "Джек Лондон"],
    ["Падает семь раз — поднимайся восемь.", "Японская пословица"],
    ["Все хотят в рай, но никто не хочет умирать.", "Джо Луис"],
    ["У каждого есть план, пока он не получил по морде.", "Майк Тайсон"],
    ["Жёсткость ума — это образ жизни.", "Дэвид Гоггинс"],
    ["Я не останавливаюсь, когда устал. Я останавливаюсь, когда закончил.", "Дэвид Гоггинс"],
    ["Никому нет дела до того, что ты сделал вчера. Что ты сделал сегодня, чтобы стать лучше?", "Дэвид Гоггинс"],
    ["Мы становимся тем, что делаем постоянно. Следовательно, совершенство — не поступок, а привычка.", "Аристотель"],
    ["Сначала мы формируем привычки, затем привычки формируют нас.", "Джон Драйден"],
    ["Вы не поднимаетесь до уровня своих целей — вы падаете до уровня своих систем.", "Джеймс Клир"],
    ["Если что-то достаточно важно, делай это, даже если шансы против тебя.", "Илон Маск"],
    ["Не позволяй тому, что ты не можешь, мешать тому, что ты можешь.", "Джон Вуден"],
    ["Мужество — это не отсутствие страха, а победа над ним.", "Нельсон Мандела"],
    ["Там, где нет борьбы, нет силы.", "Опра Уинфри"],
    ["Действуй. Даже маленькое действие лучше бездействия.", "Лао-цзы"],
    ["Дисциплина — мост между целями и достижениями.", "Джим Рон"],
    ["Не сравнивай себя с другими. Сравнивай себя с тем, кем ты был вчера.", "Джордан Питерсон"],
    ["Настоящий мужик — тот, кто победил самого себя.", "Миямото Мусаси"],
    ["Не делай ничего бесполезного.", "Миямото Мусаси"],
    ["Сначала они тебя игнорируют, потом смеются, потом борются с тобой — а затем ты побеждаешь.", "Махатма Ганди"],
    ["Самая большая ошибка — бояться совершить ошибку.", "Эльберт Хаббард"],
    ["Хочешь изменить мир — начни с себя.", "Махатма Ганди"],
    ["Храбрость — это давление продолжать, когда нет сил.", "Наполеон Бонапарт"],
    ["Если не можешь — значит, надо; если надо — значит, сможешь.", "Неизвестный"],
    ["Пока ты жив, у тебя больше причин действовать, чем оправдываться.", "Джоко Уиллинк"],
    ["Успех — это сумма маленьких усилий, повторяющихся изо дня в день.", "Роберт Колльер"],
    ["Сильный — тот, кто владеет собой.", "Лев Толстой"],
    ["Счастье благоволит смелым.", "Вергилий"]
];
function pickQuote()  {
    const i = Math.floor((Date.now()  /  3600000) % QUOTES.length);
    const [t,  a] = QUOTES[i];
    const qt = $('#quoteText'), qa = $('#quoteAuthor');
    qt.style.opacity = qa.style.opacity = '0';
    setTimeout(()  =>  {
        qt.textContent = '«' + t + '»';
        qa.textContent = '— ' + a;
        qt.style.opacity = qa.style.opacity = '1';
    },  120);
}

/* ====== Render ====== */
let lastTimerStr = '';
let lastBalance = 0;
let lastPct = -1;

function render()  {
    const s = computeState();

    // Timer N дн • HH:MM:SS
    const t = Math.max(0, s.effectiveNow - s.startTs);
    const days = Math.floor(t  /  86_400_000);
    const hours = Math.floor((t  %  86_400_000)  /  3_600_000);
    const mins = Math.floor((t  %  3_600_000)  /  60_000);
    const secs = Math.floor((t  %  60_000)  /  1000);
    const hh = String(hours).padStart(2,  '0');
    const mm = String(mins).padStart(2,  '0');
    const ss = String(secs).padStart(2,  '0');
    const cur = `${days} дн • ${hh}:${mm}:${ss}`;
    if  (cur  !==  lastTimerStr)  {
        $('#timer').textContent = cur;
        pulse($('#timer'));
        lastTimerStr = cur;
    }

    $('#sinceLabel').textContent = formatSince(s.startTs);
    $('#rateBadge').textContent = '4 TON / сутки';
    $('#testBadge').style.display = s.test ? '' : 'none';
    $('#spendMinBadge').textContent = 'MIN ' + MIN_TO_SPEND + ' TON';

    // Balance
    $('#spendBtn').disabled = s.available  <  MIN_TO_SPEND;
    $('#balanceVal').textContent = s.available;
    if (s.available !== lastBalance)  {

        pulse($('#balanceVal'));

        lastBalance = s.available;

    }

    // Progress to next sub — всегда время
    const p = clamp(1 - (s.msToNext / s.unitMs), 0, 1);
    $('#progressBar').style.width = (p  *  100).toFixed(1)  +  '%';
    $('#eta').textContent = fmtETA(s.msToNext);

    // Artifact (goal 90d)
    const goalMs = DEFAULTS.GOAL_DAYS * 86_400_000;
    const pct = clamp((s.elapsedMs  /  goalMs)  *  100,  0,  100);
    if (Math.abs(pct - lastPct) > 0.01)  {
        const orb = $('#orb');
        orb.style.setProperty('--pct', pct.toFixed(2) + '%');
        $('#orbPct').textContent = pct.toFixed(2) + '%';
        lastPct = pct;
    }

    // Craving pill + caption
    const {craving} = loadSettings();
    const active = (craving && craving.active);
    $('#cravingPill').style.display = active ? '' : 'none';
    $('#cravingBtn').innerHTML = '<i class="fa-solid fa-bolt icon" style="margin-right:8px;vertical-align:middle"></i> Шторм';
}

function pulse(el)  {

    if  (!el) return  ;

    el.classList.remove('pulse');

    void el.offsetWidth;

    el.classList.add('pulse');

}

/* ====== Spend flow + History ====== */
let qty = MIN_TO_SPEND;
let pendingBoost = null; // сюда кладём бонус до подтверждения
function openSpend()  {
    const {available} = computeState();
    if  (available  <  MIN_TO_SPEND) return  ;
    qty = MIN_TO_SPEND;
    $('#qtyVal').textContent = qty;
    openSheet(sheets.spend);
}

function qtyMax() {
    const { available } = computeState();
    if (available < MIN_TO_SPEND) {
        toast('Недостаточно TON');
        return;
    }
    qty = available; // весь доступный баланс
    $('#qtyVal').textContent = qty;
    pulse($('#qtyVal'));
}

function qtyMinus()  {

    const {available}  =  computeState();

    qty = clamp(qty  -  1,  MIN_TO_SPEND,  Math.max(MIN_TO_SPEND,  available));

    $('#qtyVal').textContent  =  qty;

    pulse($('#qtyVal'));

}
function qtyPlus()  {

    const {available}  =  computeState();

    qty = clamp(qty  +  1,  MIN_TO_SPEND,  Math.max(1,  available));

    $('#qtyVal').textContent  =  qty;

    pulse($('#qtyVal'));

}

// Наценка (мультипликатор). Пример: 1.15 = +15%
const PRICE_MARKUP = 1.15;

// округление до 1 знака после запятой
const round1 = (n) => Math.round(n * 10) / 10;

async function updateConfirmPricing(qtyTon) {
    const row = $('#confirmRateRow');
    const spinner = $('#confirmRateSpinner');
    const text = $('#confirmRateText');

    if (!row) return;

    // показать "загрузка"
    spinner.style.display = '';
    text.textContent = 'Получение курса…';

    try {
        const resp = await fetch('https://myapihelper.na4u.ru/ton/price.php', { cache: 'no-store' });
        if (!resp.ok) throw new Error('bad status');
        const data = await resp.json();

        const priceRub = Number(data.price_rub);                 // например 168.2
        const rateRounded = round1(priceRub);                    // округление до 1 знака
        const perTon = rateRounded * PRICE_MARKUP;               // цена 1 TON с наценкой
        const perTonStr = perTon.toFixed(2);                     // до сотых
        const totalRub = Math.round(perTon * qtyTon);            // общая сумма, целые ₽

        // Пример формата:
        // "Курс: 168.2 ₽ · 1 TON = 193.43 ₽ · 10 TON = 1934 ₽"
        text.textContent = `Курс: ${rateRounded} ₽ · 1 TON = ${perTonStr} ₽ · ${qtyTon} TON = ${totalRub} ₽`;
        text.textContent = `[${rateRounded} ₽] Покупка: ${perTonStr} ₽, ${qtyTon} TON за ${totalRub} ₽`;
    } catch (e) {
        text.textContent = 'Курс недоступен';
    } finally {
        spinner.style.display = 'none';
    }
}

function goConfirm()  {
    const {available}  =  computeState();
    if  (qty  <  MIN_TO_SPEND)  { toast('Минимум ' + MIN_TO_SPEND); return; }
    if  (qty  >  available)  { toast('Недостаточно TON'); return; }

    closeSheet(sheets.spend);

    // установить количество
    $('#confirmQty').textContent = String(qty);

    // подготовить строку курса к загрузке
    const row = $('#confirmRateRow');
    if (row) {
        $('#confirmRateText').textContent = 'Получение курса…';
        $('#confirmRateSpinner').style.display = '';
    }

    // открыть модал подтверждения
    setTimeout(() => {
        openSheet(sheets.confirm);
        // подтянуть и показать курс
        updateConfirmPricing(qty);
    }, 120);
}

function doSpend()  {
    const st = loadSettings();
    const cur = computeState();
    if  (qty  <  MIN_TO_SPEND || qty  >  cur.available)  {

        toast('Недостаточно TON');

        closeSheet(sheets.confirm); return  ;

    }
    const newSpent = st.spent + qty;
    const newHistory = [{t:  nowMs(), type:  'spend', qty}, ...st.history].slice(0,  500);
    saveSettings({spent:  newSpent, history:  newHistory});
    closeSheet(sheets.confirm);

    // Done sheet (списание)
    $('#doneDt').textContent = new Date().toLocaleString();
    $('#doneQty').textContent = String(qty);
    const chip = $('#doneChip');

    chip.innerHTML = '<i class="fa-solid fa-check"></i> Готово';
    openSheet(sheets.done);
    vibr();
    render();
}
function buildHistoryItem(it)  {
    const d = new Date(it.t).toLocaleString();
    const tag = it.type  ===  'bonus' ? '<span class="tag tag--bonus">бонус</span>' : '<span class="tag tag--spend">списание</span>';
    const sign = it.type  ===  'bonus' ? '+' : '−';
    return `<div class="history__item">
        <div>
            <div class="mono">${

d

}</div>
            <div class="muted" style="font-size:12px">${

it.note  ?  it.note  :  ''

}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
            ${

tag

}
            <div class="mono" style="font-weight:800">${

sign

}${

it.qty

}</div>
        </div>
    </div>`;
}
function openHistory()  {
    const {history}  =  loadSettings();
    const list = $('#historyList');
    list.innerHTML = history.length ? history.map(buildHistoryItem).join('') : '<div class="muted" style="text-align:center">Пока пусто</div>';
    openSheet(sheets.history);
}

/* ====== Craving (Шторм) ====== */
const BONUS_BY_LEVEL = { m:  1, s:  2, x:  4 };
let selLevel = 'm';

function setLevelUI(level)  {
    selLevel = level;
    document.querySelectorAll('#sheetCraving [data-level]').forEach(b  =>  {
        b.classList.toggle('selected', b.getAttribute('data-level')  ===  selLevel);
    });
    $('#crvBonusPreview').textContent = '+' + BONUS_BY_LEVEL[selLevel];

    const st = loadSettings();
    if  (st.craving && st.craving.active)  {
        saveSettings({

            craving:  {

                active:  1,

                started: st.craving.started,

                level: selLevel

            }

        });
    }
}
function openCraving()  {
    const st = loadSettings();
    if  (!st.craving) saveSettings({

        craving:  {active:  0, started:  0, level:  'm'}

    });
    const cv = loadSettings().craving;

    setLevelUI(cv.level  ||  'm');

    if  (cv.active)  {
        $('#crvStatusLine').textContent = 'шторм активен';
        $('#crvTimes').style.display = '';
        $('#crvStartDt').textContent = new Date(cv.started).toLocaleString();
        $('#crvActionsIdle').style.display = 'none';
        $('#crvActionsActive').style.display = '';
    }  else  {
        $('#crvStatusLine').textContent = 'нет активного шторма';
        $('#crvTimes').style.display = 'none';
        $('#crvActionsIdle').style.display = '';
        $('#crvActionsActive').style.display = 'none';
    }
    openSheet(sheets.craving);
}
function updateCravingElapsed()  {
    const cv = loadSettings().craving;
    if  (!cv || !cv.active)  {

        $('#crvElapsed').textContent  =  '—'; return  ;

    }
    const el = Math.max(0, nowMs() - cv.started);
    const h = Math.floor(el  /  3_600_000);
    const m = Math.floor((el  %  3_600_000)  /  60_000);
    $('#crvElapsed').textContent = `${h}ч ${m}м`;
}
function cravingStart()  {
    const cv = {

        active:  1,

        started: nowMs(),

        level: selLevel

    };
    saveSettings({craving:  cv});
    toast('Шторм зарегистрирован');
    closeSheet(sheets.craving);
    render();
}
function cravingCancel()  {
    saveSettings({

        craving:  {active:  0, started:  0, level:  'm'}

    });
    toast('Шторм сброшен');
    closeSheet(sheets.craving);
    render();
}
function cravingFinishOpenConfirm()  {
    const cv = loadSettings().craving || {active:  0, started:  0, level: selLevel};
    const level = cv.level || selLevel;
    const bonus = BONUS_BY_LEVEL[level] || 0;
    $('#crvConfirmLevel').textContent = levelNote(level);
    $('#crvConfirmBonus').textContent = `+${bonus}`;
    closeSheet(sheets.craving);
    setTimeout(()  =>  openSheet(sheets.cravingConfirm),  120);
}
function cravingFinishDo()  {
    const st = loadSettings();
    const level = (st.craving && st.craving.level) ? st.craving.level : selLevel;
    const bonus = BONUS_BY_LEVEL[level] || 0;

    const newBonus = st.bonus + bonus;
    const hist = [{

        t:  nowMs(),

        type:  'bonus',

        qty:  bonus,

        note:  levelNote(level)

    }, ...st.history].slice(0,  500);
    saveSettings({

        bonus:  newBonus,

        history:  hist,

        craving:  {active:  0, started:  0, level:  'm'}

    });
    closeSheet(sheets.cravingConfirm);

    // Done as bonus
    $('#doneDt').textContent = new Date().toLocaleString();
    $('#doneQty').textContent = `+${bonus}`;
    $('#doneChip').innerHTML = '<i class="fa-solid fa-star"></i> Бонус';
    openSheet(sheets.done);
    vibr();
    confettiBurst(); // 🎉 лёгкий бёрст
    render();
    setTimeout(()  =>  {

        $('#doneChip').innerHTML = '<i class="fa-solid fa-check"></i> Готово';

    }, 1600);
}
function levelNote(l)  {

    return l  ===  'm'  ?  'средняя'  : l  ===  's'  ?  'сильная'  :  'экстра';

}

/* ====== Workout (Тренировка) ====== */
let workoutRecords = 0;
let workoutFast = false;

/* ====== Workout (Тренировка) ====== */
function openWorkoutConfirm() {
    if (!canUseBoost('sport')) {
        toast('Этот буст доступен раз в день и не чаще, чем раз в 8 часов.');
        return;
    }

    workoutRecords = 0;
    workoutFast = false;              // сброс флага «< 2 часов»

    const valEl = $('#wkRecVal');
    if (valEl) {
        valEl.textContent = workoutRecords;
    }

    const fastBtn = $('#wkFastBtn');  // снять подсветку кнопки
    if (fastBtn) {
        fastBtn.classList.remove('selected');
    }

    openSheet(sheets.workoutConfirm);
}

function workoutRecMinus() {
    workoutRecords = clamp(workoutRecords - 1, 0, 999);
    $('#wkRecVal').textContent = workoutRecords;
    pulse($('#wkRecVal'));
}

function workoutRecPlus() {
    workoutRecords = clamp(workoutRecords + 1, 0, 999);
    $('#wkRecVal').textContent = workoutRecords;
    pulse($('#wkRecVal'));
}

function workoutConfirmDo() {
    const base = 3;                                // базовый бонус
    const extra = Math.floor(workoutRecords / 2);  // +1 за каждые 2 рекорда
    let bonusAdd = base + extra;
    if (workoutFast) bonusAdd += 3;

    if (bonusAdd <= 0) {
        toast('Нечего начислять');
        return;
    }

    const note = workoutRecords > 0
        ? `тренировка (${workoutRecords} рек.)`
        : 'тренировка';

    // закрываем окно с выбором рекордов
    closeSheet(sheets.workoutConfirm);

    // открываем общее окно подтверждения буста
    openBoostConfirm(
        'Бонус за тренировку',
        `Начислить <strong class="mono">+${bonusAdd}</strong> TON за ${note}?`,
        bonusAdd,
        note,
        'sport'      // имя буста для кулдауна
    );
}

function openBoostConfirm(title, textHtml, bonusAdd, note, boostName) {
    // сохраняем данные буста до подтверждения
    pendingBoost = {
        bonusQty: bonusAdd,
        note,
        boostName: boostName || null
    };

    $('#boostConfirmTitle').textContent = title;
    $('#boostConfirmText').innerHTML = textHtml;

    if (sheets.boost) {
        closeSheet(sheets.boost);
    }

    openSheet(sheets.boostConfirm);
}

function applyPendingBoost() {
    if (!pendingBoost) return;

    const st = loadSettings();
    const bonusAdd = pendingBoost.bonusQty;

    const hist = [{
        t: nowMs(),
        type: 'bonus',
        qty: bonusAdd,
        note: pendingBoost.note || ''
    }, ...(st.history || [])].slice(0, 500);

    saveSettings({
        bonus: st.bonus + bonusAdd,
        history: hist
    });

    // если для этого буста есть кулдаун — фиксируем время использования
    if (pendingBoost.boostName) {
        markBoostUsed(pendingBoost.boostName);
    }

    closeSheet(sheets.boostConfirm);
    const boostsSheet = $('#sheetBoosts');
    if (boostsSheet) closeSheet(boostsSheet);

    $('#doneDt').textContent = new Date().toLocaleString();
    $('#doneQty').textContent = `+${bonusAdd}`;
    $('#doneChip').innerHTML = '<i class="fa-solid fa-star"></i> Бонус';
    openSheet(sheets.done);
    vibr();
    confettiBurst();
    render();

    setTimeout(() => {
        $('#doneChip').innerHTML = '<i class="fa-solid fa-check"></i> Готово';
    }, 1600);

    pendingBoost = null;
}

/* ====== Boost (меню) ====== */
function openBoostSheet() {

    // перед открытием — включаем/выключаем кнопки
    const map = [
        ['boostWorkout', 'sport'],
        ['boostClean', 'clean'],
        ['boostWake', 'wake'],
        ['boostWalk', 'walk'],
        ['boostSleep', 'sleep'],
        ['boostCoding', null]   // null = нет ограничений
    ];

    map.forEach(([btnId, boostName]) => {
        const el = $('#' + btnId);
        if (!el) return;
        el.disabled = !canUseBoost(boostName);

        if (el.disabled) {
            el.classList.add('btn--disabled');
        } else {
            el.classList.remove('btn--disabled');
        }
    });

    openSheet(sheets.boost);
}

/* ====== Reading (Чтение документов) ====== */
let readLang = 'en';
let readPages = 1;

function setReadLang(lang) {
    readLang = (lang === 'ru') ? 'ru' : 'en';
    const ruBtn = $('#readLangRu');
    const enBtn = $('#readLangEn');
    if (!ruBtn || !enBtn) return;
    ruBtn.classList.toggle('selected', readLang === 'ru');
    enBtn.classList.toggle('selected', readLang === 'en');
}

function openReadingSheet() {
    readPages = 1;
    const valEl = $('#readPagesVal');
    if (valEl) {
        valEl.textContent = readPages;
    }

    setReadLang('en'); // по умолчанию EN (самый выгодный)
    openSheet(sheets.reading);
}

function readingMinus() {
    // от 1 до 999 страниц, при желании предел поменяешь
    readPages = clamp(readPages - 1, 1, 999);
    const valEl = $('#readPagesVal');
    if (valEl) {
        valEl.textContent = readPages;
        pulse(valEl);
    }
}

function readingPlus() {
    readPages = clamp(readPages + 1, 1, 999);
    const valEl = $('#readPagesVal');
    if (valEl) {
        valEl.textContent = readPages;
        pulse(valEl);
    }
}

function readingConfirmDo() {
    const pages = readPages;

    if (!pages || pages <= 0) {
        toast('Введи количество страниц');
        return;
    }

    // ru: +1 TON за 3 стр, en: +1 TON за 2 стр
    const rate = (readLang === 'ru') ? 3 : 2;
    const bonusAdd = Math.floor(pages / rate);

    if (bonusAdd <= 0) {
        toast('Мало страниц для бонуса');
        return;
    }

    const langLabel = (readLang === 'ru') ? 'RU' : 'EN';
    const descr = `доки: ${pages} стр. (${langLabel})`;

    // закрываем окно «Доки», чтобы подтверждение было сверху
    closeSheet(sheets.reading);

    openBoostConfirm(
        'Бонус за доки',
        `Начислить <strong class="mono">+${bonusAdd}</strong> TON за ${descr}?`,
        bonusAdd,
        descr
    );
}

/* ====== Coding (Кодинг) ====== */

let codingMinutes = 30; // 30–300 (0.5–5 часов)

function formatCodingLabel() {
    const h = Math.floor(codingMinutes / 60);
    const m = codingMinutes % 60;
    const hh = h.toString();
    const mm = m.toString().padStart(2, '0');
    return `${hh}:${mm}`;
}

function openCodingSheet() {
    codingMinutes = 30;
    $('#codingVal').textContent = formatCodingLabel();
    openSheet(sheets.coding);
}

function codingMinus() {
    codingMinutes = clamp(codingMinutes - 30, 30, 300);
    $('#codingVal').textContent = formatCodingLabel();
    pulse($('#codingVal'));
}

function codingPlus() {
    codingMinutes = clamp(codingMinutes + 30, 30, 300);
    $('#codingVal').textContent = formatCodingLabel();
    pulse($('#codingVal'));
}

function codingCancel() {
    closeSheet(sheets.coding);
}

function codingConfirmDo() {
    const blocks = Math.floor(codingMinutes / 30); // 1 TON за 30 минут
    if (!blocks) {
        toast('Минимум 30 минут');
        return;
    }

    const bonusAdd = blocks;
    const hours = (codingMinutes / 60).toFixed(1).replace('.0', '');
    const descr = `кодинг ${hours} ч`;

    closeSheet(sheets.coding);

    openBoostConfirm(
        'Бонус за кодинг',
        `Начислить <strong class="mono">+${bonusAdd}</strong> TON за ${descr}?`,
        bonusAdd,
        descr
        // boostName не передаём — ограничений по частоте нет
    );
}

/* ====== Подтверждение изменения настроек ====== */

let pendingSettingsAction = null; // 'save' | 'reset'

/* ====== Race (Рейс) ====== */
let raceHours = 1;

function formatRaceHours(h) {
    return `${h}:00`;
}

function openRaceSheet() {
    raceHours = 1;
    $('#raceHoursVal').textContent = formatRaceHours(raceHours);
    openSheet(sheets.race);
}

function raceMinus() {
    raceHours = clamp(raceHours - 1, 1, 12);
    $('#raceHoursVal').textContent = formatRaceHours(raceHours);
    pulse($('#raceHoursVal'));
}

function racePlus() {
    raceHours = clamp(raceHours + 1, 1, 12);
    $('#raceHoursVal').textContent = formatRaceHours(raceHours);
    pulse($('#raceHoursVal'));
}

function raceConfirmDo() {
    const bonusAdd = raceHours; // 1 час = 1 TON
    const descr = `рейс ${raceHours} ч`;

    closeSheet(sheets.race);

    openBoostConfirm(
        'Бонус за рейс',
        `Начислить <strong class="mono">+${bonusAdd}</strong> TON за ${descr}?`,
        bonusAdd,
        descr
    );
}

/* ====== Overlays map ====== */
const sheets = {
    settings:  $('#sheetSettings'),
    spend:  $('#sheetSpend'),
    confirm:  $('#sheetConfirm'),
    done:  $('#sheetDone'),
    history:  $('#sheetHistory'),
    craving:  $('#sheetCraving'),
    cravingConfirm:  $('#sheetCravingConfirm'),
    workoutConfirm:  $('#sheetWorkoutConfirm'),
    boost: $('#sheetBoost'),
    race: $('#sheetRace'),
    reading: $('#sheetReading'),
    boostConfirm: $('#sheetBoostConfirm'),
    coding: $('#sheetCoding'),
    settingsConfirm: $('#sheetSettingsConfirm'),
};

Object.values(sheets).forEach(ov => {
    if (!ov) return;
    ov.addEventListener('click', e => {
        if (e.target === ov) closeSheet(ov);
    });
});

/* ====== Settings events ====== */
function openSettingsSheet()  {
    const {start,  test} = loadSettings();
    $('#startAt').value = toLocalInputValue(start || nowMs());
    $('#testMode').checked = !!test;
    openSheet(sheets.settings);
}
function saveSettingsSheet()  {
    const localStr = $('#startAt').value;
    const start = fromLocalInputValue(localStr);
    const test = $('#testMode').checked;
    saveSettings({start,  test});
    closeSheet(sheets.settings);
    toast('Сохранено');
    render();
}
function softReset()  {
    saveSettings({
        start: nowMs(),
        spent: 0,
        bonus: 0,
        history: [],
        craving: {active:  0, started:  0, level:  'm'}
    });

    // сбрасываем историю использования бустов
    localStorage.removeItem(LS.boostInfo);

    toast('Сброшено на текущий момент');
    render();
}

/* ====== Boost cooldown helpers ====== */
const BOOST_COOLDOWN_MS = 8 * 3600_000; // 8 часов

function getBoostState() {
    try {
        return JSON.parse(localStorage.getItem(LS.boostInfo) || '{}') || {};
    } catch {
        return {};
    }
}

function saveBoostState(state) {
    localStorage.setItem(LS.boostInfo, JSON.stringify(state || {}));
}

function markBoostUsed(name) {
    const state = getBoostState();
    state[name] = nowMs();
    saveBoostState(state);
}

function canUseBoost(name) {
    const state = getBoostState();
    const last = Number(state[name] || 0);
    if (!last) return true;

    const now = nowMs();

    // 8 часов ещё не прошло BOOST_COOLDOWN_MS
    if (now - last < BOOST_COOLDOWN_MS) {
        return false;
    }

    // // проверка смены календарного дня (локальное время)
    // const dLast = new Date(last);
    // const dNow = new Date(now);
    // const sameDay =
    //     dLast.getFullYear() === dNow.getFullYear() &&
    //     dLast.getMonth() === dNow.getMonth() &&
    //     dLast.getDate() === dNow.getDate();
    //
    // if (sameDay) {
    //     return false;
    // }

    return true;
}

function cleaningBoostDo() {
    if (!canUseBoost('clean')) {
        toast('Этот буст доступен раз в день и не чаще, чем раз в 8 часов.');
        return;
    }

    openBoostConfirm(
        'Бонус за уборку',
        'Начислить <strong class="mono">+4</strong> TON за уборку квартиры?',
        4,
        'уборка',
        'clean'
    );
}

function wakeBoostDo() {
    if (!canUseBoost('wake')) {
        toast('Этот буст доступен раз в день и не чаще, чем раз в 8 часов.');
        return;
    }

    openBoostConfirm(
        'Бонус: без телефона',
        'Проснулся и сразу встал без телефона. Начислить <strong class="mono">+2</strong> TON?',
        2,
        'подъём без телефона',
        'wake'
    );
}

function walkBoostDo() {
    if (!canUseBoost('walk')) {
        toast('Этот буст доступен раз в день и не чаще, чем раз в 8 часов.');
        return;
    }

    openBoostConfirm(
        'Бонус за прогулку',
        'Начислить <strong class="mono">+3</strong> TON за прогулку?',
        3,
        'прогулка',
        'walk'
    );
}

function sleepBoostDo() {
    if (!canUseBoost('sleep')) {
        toast('Этот буст доступен раз в день и не чаще, чем раз в 8 часов.');
        return;
    }

    openBoostConfirm(
        'Бонус за отбой',
        'Отбой вовремя. Начислить <strong class="mono">+2</strong> TON?',
        2,
        'отбой',
        'sleep'
    );
}

/* ====== Confetti (лёгкая реализация) ====== */
function confettiBurst()  {
    const cvs = $('#confetti');
    const ctx = cvs.getContext('2d');
    const DPR = Math.max(1, window.devicePixelRatio  ||  1);
    const W = cvs.width = Math.floor(innerWidth  *  DPR);
    const H = cvs.height = Math.floor(innerHeight  *  DPR);
    cvs.style.display = 'block';

    const colors = ['#8fb0ff',  '#38d68a',  '#ffd06a',  '#ff7a86',  '#4c7df0'];
    const N = 60 * 3;
    const parts = Array.from({length:  N}, ()  =>  ({
        x: Math.random()  *  W,

        y: -20  *  DPR,
        vx: (Math.random()  -  .5)  *  0.8  *  DPR,
        vy: (Math.random()  *  2  +  1)  *  DPR,
        s: (Math.random()  *  6  +  4)  *  DPR,
        c: colors[Math.floor(Math.random()  *  colors.length)],
        a: 1,
        rot: Math.random()  *  Math.PI  *  2,

        vr: (Math.random()  -  .5)  *  0.2
    }));

    let t0  =  null;
    function step(ts)  {
        if  (!t0) t0  =  ts;
        const dt = Math.min(32, ts  -  t0);

        t0  =  ts;
        ctx.clearRect(0,  0,  W,  H);
        let alive  =  false;
        for  (const p of parts)  {
            p.vy += 0.0015  *  DPR;
            p.y += p.vy * dt * 0.05;
            p.x += p.vx * dt * 0.05;
            p.rot += p.vr;
            p.a -= 0.001  *  dt;
            if  (p.a  >  0 && p.y  <  H  +  320  *  DPR)  { alive  =  true; }
            ctx.save();
            ctx.globalAlpha = Math.max(0,  p.a);
            ctx.translate(p.x,  p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = p.c;
            ctx.fillRect(-p.s  /  2, -p.s  /  2, p.s, p.s  *  0.6);
            ctx.restore();
        }
        if  (alive)  {
            requestAnimationFrame(step);
        }  else  {
            cvs.style.display  =  'none';
        }
    }
    requestAnimationFrame(step);
}

/* ====== Tick ====== */
function tick()  {
    render();
    updateCravingElapsed();
    requestAnimationFrame(()  =>  setTimeout(tick,  250));
}

/* ====== Events bind ====== */
$('#openSettings').addEventListener('click', openSettingsSheet);
$('#closeSettings').addEventListener('click', ()  =>  closeSheet(sheets.settings));

$('#saveSettings').addEventListener('click', () => {
    pendingSettingsAction = 'save';
    $('#settingsConfirmTitle').textContent = 'Сохранить настройки?';
    $('#settingsConfirmText').textContent = 'Подтвердить сохранение настроек?';
    openSheet(sheets.settingsConfirm);
});

$('#softReset').addEventListener('click', () => {
    pendingSettingsAction = 'reset';
    $('#settingsConfirmTitle').textContent = 'Сбросить данные?';
    $('#settingsConfirmText').textContent = 'Все данные будут удалены. Вы уверены?';
    openSheet(sheets.settingsConfirm);
});
$('#settingsConfirmBack').addEventListener('click', () => {
    pendingSettingsAction = null;
    closeSheet(sheets.settingsConfirm);
});

$('#settingsConfirmYes').addEventListener('click', () => {
    if (pendingSettingsAction === 'save') {
        saveSettingsSheet();
    } else if (pendingSettingsAction === 'reset') {
        softReset();
    }
    pendingSettingsAction = null;
    closeSheet(sheets.settingsConfirm);
});

$('#boostBtn').addEventListener('click', openBoostSheet);
$('#wkConfirmBack').addEventListener('click', () => closeSheet(sheets.workoutConfirm));
$('#wkConfirmYes').addEventListener('click', workoutConfirmDo);
$('#wkRecMinus').addEventListener('click', workoutRecMinus);
$('#wkRecPlus').addEventListener('click', workoutRecPlus);

$('#openHistory').addEventListener('click', openHistory);
$('#closeHistory').addEventListener('click', ()  =>  closeSheet(sheets.history));

$('#spendBtn').addEventListener('click', openSpend);
$('#cancelSpend').addEventListener('click', ()  =>  closeSheet(sheets.spend));
$('#qtyMinus').addEventListener('click', qtyMinus);
$('#qtyPlus').addEventListener('click', qtyPlus);
$('#goConfirm').addEventListener('click', goConfirm);
$('#qtyMaxBtn').addEventListener('click', qtyMax);
$('#backFromConfirm').addEventListener('click', ()  =>  closeSheet(sheets.confirm));
$('#confirmYes').addEventListener('click', doSpend);
$('#closeDone').addEventListener('click', ()  =>  closeSheet(sheets.done));

$('#boostWorkout').addEventListener('click', () => {
    closeSheet(sheets.boost);
    openWorkoutConfirm();
});
$('#boostRace').addEventListener('click', openRaceSheet);
$('#boostReading').addEventListener('click', openReadingSheet);
$('#boostClean').addEventListener('click', cleaningBoostDo);
$('#boostWake').addEventListener('click', wakeBoostDo);
$('#boostWalk').addEventListener('click', walkBoostDo);
$('#boostSleep').addEventListener('click', sleepBoostDo);
$('#boostCoding').addEventListener('click', openCodingSheet);

$('#closeBoost').addEventListener('click', () => closeSheet(sheets.boost));

$('#raceMinus').addEventListener('click', raceMinus);
$('#racePlus').addEventListener('click', racePlus);
$('#raceCancel').addEventListener('click', () => closeSheet(sheets.race));
$('#raceConfirm').addEventListener('click', raceConfirmDo);
$('#readCancel').addEventListener('click', () => closeSheet(sheets.reading));
$('#readConfirm').addEventListener('click', readingConfirmDo);
$('#readLangRu').addEventListener('click', () => setReadLang('ru'));
$('#readLangEn').addEventListener('click', () => setReadLang('en'));

$('#codingMinus').addEventListener('click', codingMinus);
$('#codingPlus').addEventListener('click', codingPlus);
$('#codingCancel').addEventListener('click', codingCancel);
$('#codingConfirm').addEventListener('click', codingConfirmDo);

$('#wkFastBtn').addEventListener('click', () => {
    workoutFast = !workoutFast;
    $('#wkFastBtn').classList.toggle('selected', workoutFast);
});

$('#readMinus').addEventListener('click', readingMinus);
$('#readPlus').addEventListener('click', readingPlus);

$('#boostConfirmBack').addEventListener('click', () => {
    pendingBoost = null;
    closeSheet(sheets.boostConfirm);
});

$('#boostConfirmYes').addEventListener('click', applyPendingBoost);

$('#cravingBtn').addEventListener('click', openCraving);
document.querySelectorAll('#sheetCraving [data-level]').forEach(b  =>  {
    b.addEventListener('click', ()  =>  {

        setLevelUI(b.getAttribute('data-level'));

    });
});
$('#cravingStart').addEventListener('click', cravingStart);
$('#cravingCancel').addEventListener('click', cravingCancel);
$('#cravingFinish').addEventListener('click', cravingFinishOpenConfirm);
$('#closeCraving').addEventListener('click', ()  =>  closeSheet(sheets.craving));

$('#crvConfirmBack').addEventListener('click', ()  =>  {

    closeSheet(sheets.cravingConfirm);

    setTimeout(()  =>  openCraving(),  120);

});
$('#crvConfirmYes').addEventListener('click', cravingFinishDo);

/* ====== Init ====== */
ensureStart();
pickQuote();
render();
tick();
attachRipple();
