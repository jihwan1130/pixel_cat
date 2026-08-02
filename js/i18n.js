/* -------------------------------------------------------------------------
   I18N : 화면에 나오는 모든 문장을 한곳에 모아 둔다.
     · 게임 코드에는 문장을 직접 쓰지 않는다. 전부 TXT('키') / TXTA('키') 로 꺼낸다.
     · 언어는 타이틀 화면에서만 고른다 — 판이 시작된 뒤 문장이 바뀌면
       내레이션이 중간에 갈아 끼워지는 꼴이 된다.
     · 고른 값은 localStorage 에 남는다.
------------------------------------------------------------------------- */

const STRINGS = {

  /* ===================== 한국어 ===================== */
  ko: {
    /* 언어 자체의 이름과, 그 언어에 맞춘 내레이션 속도(초당 글자수).
       영문은 같은 뜻을 쓰는 데 글자가 두 배쯤 든다 — 같은 속도로 두면
       연출 타임라인의 다음 대사에 잘려 나간다. */
    _name: '한국어',
    _speed: 26,

    'doc.title': '고양이를 찾아서',
    'game.title': '고양이를 찾아서',
    'game.titleSpaced': '고 양 이 를  찾 아 서',
    'game.sub': 'A Monochrome Maze',
    'game.end': '끝',

    'title.lang': '언어 · LANGUAGE',
    'title.startKey': '아무 키나 누르세요',
    'title.startTouch': '화면을 누르세요',
    'title.ctrlKeys': '이동 W A S D / ← ↑ → ↓  ·  상호작용 E',
    'title.ctrlTouch': '왼쪽을 끌어 이동  ·  오른쪽을 눌러 상호작용',
    'title.sound': '소리를 켜고 플레이하세요',
    'rotate': '가로로 돌려 주세요',

    /* ---- 힌트 ---- */
    'hint.skipKey': 'SPACE — 건너뛰기',
    'hint.skipTouch': 'E — 건너뛰기',
    'hint.moveKeys': 'W A S D — 이동   ·   E — 뒤지기 / 숨기',
    'hint.moveTouch': '왼쪽을 끌어 이동   ·   E — 뒤지기 / 숨기',
    'hint.restartKey': 'R — 다시 시작',
    'hint.restartTouch': 'E — 다시 시작',
    'hint.exitHide': 'E — 나온다',
    'hint.gateLocked': '철문 — 자물쇠 {have} / {need}',
    'hint.gateOpen': 'E — 철문을 연다',
    'hint.doorLocked': '잠겨 있다 — 열쇠가 없다',
    'hint.door': 'E — 문을 연다',
    'hint.cat': 'E — 고양이를 부른다',
    'hint.hideNow': 'E — 숨는다',
    'hint.hide': 'E — 안에 숨는다',

    /* ---- 수색 동작 ---- */
    'verb.cabinet': '옷장을 연다',
    'verb.bed': '침대 밑을 본다',
    'verb.shelf': '선반을 뒤진다',
    'verb.bin': '쓰레기통을 뒤진다',
    'verb.drum': '드럼통을 연다',
    'verb.crate': '상자를 연다',

    /* ---- 도입 ---- */
    'intro.1': '밤 산책.',
    'intro.2': '고양이는 언제나 나보다 세 걸음 앞서 걷는다.',
    'intro.3': '어딘가 먼 곳에서 종이 울렸다.',
    'intro.4': '고양이가 귀를 세웠다.',
    'intro.5': '…그리고 가로등이 닿지 않는 곳으로 뛰어들었다.',
    'intro.6': '나는 빈 목줄만 쥔 채 서 있었다.',

    /* ---- 스테이지 ---- */
    'level.alley.title': '하나 · 골 목',
    'level.alley.lines': [
      '고양이가 사라진 골목.',
      '창문은 전부 꺼져 있고, 어느 집도 이쪽을 내다보지 않는다.'
    ],
    'level.house.title': '둘 · 낡 은  건 물',
    'level.house.lines': [
      '안쪽은 바깥보다 더 조용했다.',
      '누가 살다 나간 자리에 가구만 그대로 남아 있다.'
    ],
    'level.cellar.title': '셋 · 지 하',
    'level.cellar.lines': [
      '계단은 아래로만 이어졌다.',
      '천장의 전구가 일정한 간격으로 하나씩 켜져 있다.'
    ],

    'lock.key': '아래로 내려가는 문은 잠겨 있었다. 열쇠는 이 안 어딘가에 있을 것이다.',
    'lock.shard': '길을 막은 철문에는 자물쇠가 세 개. 조각을 셋 다 찾아야 한다.',

    /* ---- 열쇠 / 철문 ---- */
    'gate.rattle': '자물쇠가 꿈쩍도 하지 않는다. 조각이 {n}개 더 필요하다.',
    'gate.opened': '빗장이 풀리고, 철문이 안쪽으로 밀려났다.',
    'door.rattle': '손잡이가 돌아가지 않는다. 열쇠는 이 집 어딘가에 있다.',
    'key.take': '작은 열쇠 하나. 아래로 내려가는 문의 것이다.',
    'key.last': '마지막 조각. ({have} / {need})  이제 철문을 열 수 있다.',
    'key.shard': '녹슨 열쇠 조각 하나. ({have} / {need})',

    /* ---- 수색 결과 ---- */
    'flavor.empty': [
      '빈 옷걸이만 남아 있다.',
      '먼지가 두껍게 앉았다. 오래 열리지 않은 것 같다.',
      '아무것도 없다. 아무것도 없다는 것이 조금 이상하다.',
      '누군가 이미 비워 갔다.',
      '바닥에 신문지 몇 장. 날짜는 읽히지 않는다.'
    ],
    'flavor.trace': [
      '고양이 털 몇 올. 아직 따뜻한 것 같다.',
      '작은 발자국이 안쪽으로 어지럽게 찍혀 있다.',
      '목줄에서 떨어진 고리 하나가 굴러 나왔다.',
      '여기서 한참 웅크리고 있었던 자국이 남아 있다.'
    ],
    'flavor.noise': [
      '안쪽에서 무언가 무너지는 소리가 났다.',
      '무언가 빠르게 지나갔다. 쥐였을 것이다.',
      '닫는 순간, 안에서 한 번 더 소리가 났다.',
      '뒤쪽에서 뭔가가 넘어졌다. 돌아보니 아무것도 없다.'
    ],

    /* ---- 잘못 연 쪽 ---- */
    'dread.figure': '…안에 누군가 서 있었다.',
    'dread.torch': '여는 순간 손전등이 꺼졌다.',
    'dread.bell': '종소리가 바로 귀 옆에서 울렸다.',
    'dread.deep': '안쪽이, 이 물건의 깊이보다 훨씬 깊다.',
    'dread.behind': '뒤에서 문이 닫히는 소리가 났다. 방금 지나온 곳이다.',

    /* ---- 그것 ---- */
    'fig.wake': '…서 있던 것이, 이쪽으로 고개를 돌렸다.',
    'fig.outOfBox': '그것이 상자 밖으로 발을 내디뎠다.',
    'fig.atDoor': '발소리가 문 바로 앞에서 멈췄다.',
    'fig.sawMe': '…들어가는 것을, 봤다.',
    'hide.enter': '숨을 죽였다.',

    /* ---- 죽음 ---- */
    'death.found': '문이, 밖에서 열렸다.',
    'death.caught': '어깨에 손이 닿았다.',
    'death.again': '다시, 골목이었다.',

    /* ---- 문 / 엔딩 ---- */
    'door.through': '문 너머에서, 아주 작게 울음소리가 났다.',
    'end.traces': '오는 길에 남아 있던 자국들이, 전부 이쪽을 향하고 있었다.',
    'end.1': '…찾았다.',
    'end.2': '고양이는 처음부터 그 자리에 앉아 있었던 것처럼 보였다.',
    'end.3': '품에 안자, 종소리가 멎었다.',
    'end.4': '우리는 왔던 길을 되짚어 걸었다.',
    'end.5': '뒤에서, 문이 하나 조용히 닫혔다.'
  },

  /* ===================== English ===================== */
  en: {
    _name: 'ENGLISH',
    _speed: 46,

    'doc.title': 'In Search of the Cat',
    'game.title': 'IN SEARCH OF THE CAT',
    'game.titleSpaced': 'IN SEARCH OF THE CAT',
    'game.sub': 'A Monochrome Maze',
    'game.end': 'THE END',

    'title.lang': '언어 · LANGUAGE',
    'title.startKey': 'PRESS ANY KEY',
    'title.startTouch': 'TAP THE SCREEN',
    'title.ctrlKeys': 'MOVE W A S D / ← ↑ → ↓  ·  INTERACT E',
    'title.ctrlTouch': 'DRAG THE LEFT SIDE TO MOVE  ·  TAP THE RIGHT TO INTERACT',
    'title.sound': 'PLAY WITH THE SOUND ON',
    'rotate': 'PLEASE TURN THE PHONE SIDEWAYS',

    'hint.skipKey': 'SPACE — SKIP',
    'hint.skipTouch': 'E — SKIP',
    'hint.moveKeys': 'W A S D — MOVE   ·   E — SEARCH / HIDE',
    'hint.moveTouch': 'DRAG THE LEFT SIDE TO MOVE   ·   E — SEARCH / HIDE',
    'hint.restartKey': 'R — RESTART',
    'hint.restartTouch': 'E — RESTART',
    'hint.exitHide': 'E — CLIMB OUT',
    'hint.gateLocked': 'IRON GATE — LOCKS {have} / {need}',
    'hint.gateOpen': 'E — OPEN THE GATE',
    'hint.doorLocked': 'LOCKED — NO KEY',
    'hint.door': 'E — OPEN THE DOOR',
    'hint.cat': 'E — CALL THE CAT',
    'hint.hideNow': 'E — HIDE',
    'hint.hide': 'E — HIDE INSIDE',

    'verb.cabinet': 'OPEN THE CABINET',
    'verb.bed': 'LOOK UNDER THE BED',
    'verb.shelf': 'SEARCH THE SHELF',
    'verb.bin': 'SEARCH THE BIN',
    'verb.drum': 'OPEN THE DRUM',
    'verb.crate': 'OPEN THE CRATE',

    'intro.1': 'A walk at night.',
    'intro.2': 'The cat always walks three steps ahead of me.',
    'intro.3': 'Somewhere far off, a bell rang.',
    'intro.4': 'The cat pricked up its ears.',
    'intro.5': '…and bolted into where the streetlight could not reach.',
    'intro.6': 'I stood there holding nothing but an empty leash.',

    'level.alley.title': 'ONE · A L L E Y',
    'level.alley.lines': [
      'The alley where the cat disappeared.',
      'Every window is dark. Not one house looks out this way.'
    ],
    'level.house.title': 'TWO · O L D  H O U S E',
    'level.house.lines': [
      'Inside was quieter than outside.',
      'Someone lived here and left. Only the furniture stayed.'
    ],
    'level.cellar.title': 'THREE · C E L L A R',
    'level.cellar.lines': [
      'The stairs only led down.',
      'Bulbs in the ceiling are lit one by one, at even intervals.'
    ],

    'lock.key': 'The door leading down was locked. The key must be somewhere inside.',
    'lock.shard': 'Three locks on the iron gate. All three shards have to be found.',

    'gate.rattle': 'The locks will not budge. {n} more {shard} needed.',
    'gate.opened': 'The bar slid loose, and the iron gate pushed inward.',
    'door.rattle': 'The handle will not turn. The key is somewhere in this house.',
    'key.take': 'A small key. It belongs to the door leading down.',
    'key.last': 'The last shard. ({have} / {need})  The gate will open now.',
    'key.shard': 'A rusted shard of a key. ({have} / {need})',

    'flavor.empty': [
      'Only empty hangers are left.',
      'Dust lies thick. It has not been opened in a long time.',
      'Nothing. And nothing at all is a little strange.',
      'Someone has emptied it already.',
      'A few sheets of newspaper on the bottom. The date will not read.'
    ],
    'flavor.trace': [
      'A few strands of cat fur. Still warm, somehow.',
      'Small pawprints, scattered toward the back.',
      'A ring fallen off the collar rolls out.',
      'Something curled up here for a long while.'
    ],
    'flavor.noise': [
      'Something collapsed deeper inside.',
      'Something darted past. A rat, probably.',
      'As it shut, one more sound came from within.',
      'Something fell over behind me. Nothing there when I turned.'
    ],

    'dread.figure': '…someone was standing inside.',
    'dread.torch': 'The moment it opened, the flashlight went out.',
    'dread.bell': 'A bell rang right beside my ear.',
    'dread.deep': 'The inside is far deeper than this thing could be.',
    'dread.behind': 'A door shut behind me. Somewhere I had just walked through.',

    'fig.wake': '…the standing thing turned its head this way.',
    'fig.outOfBox': 'It stepped out of the box.',
    'fig.atDoor': 'The footsteps stopped right outside the door.',
    'fig.sawMe': '…it saw me climb in.',
    'hide.enter': 'I held my breath.',

    'death.found': 'The door opened from the outside.',
    'death.caught': 'A hand touched my shoulder.',
    'death.again': 'The alley again.',

    'door.through': 'Beyond the door, very faintly, something cried.',
    'end.traces': 'Every trace left along the way had been pointing here.',
    'end.1': '…found you.',
    'end.2': 'The cat looked as if it had been sitting there all along.',
    'end.3': 'When I gathered it up, the bells went quiet.',
    'end.4': 'We walked back the way we came.',
    'end.5': 'Behind us, one door closed quietly.'
  }
};

const I18N = {
  LANGS: ['ko', 'en'],
  KEY: 'pixelcat.lang',
  lang: 'ko',
  locked: false,          // 판이 시작되면 더 바꾸지 않는다

  init() {
    let saved = null;
    try { saved = localStorage.getItem(this.KEY); } catch (e) { /* 사생활 모드 */ }
    if (!this.LANGS.includes(saved))
      saved = (navigator.language || '').toLowerCase().startsWith('ko') ? 'ko' : 'en';
    this.el = document.getElementById('lang');
    if (this.el) {
      this.el.addEventListener('click', e => {
        const b = e.target.closest('[data-lang]');
        if (b) this.set(b.dataset.lang);
      });
    }
    this.set(saved, true);
  },

  set(lang, silent) {
    if (this.locked || !this.LANGS.includes(lang)) return;
    const changed = lang !== this.lang;
    this.lang = lang;
    try { localStorage.setItem(this.KEY, lang); } catch (e) { /* 무시 */ }

    document.documentElement.lang = lang;
    document.title = this.t('doc.title');
    document.body.classList.toggle('lang-en', lang === 'en');
    if (typeof Narrator !== 'undefined') Narrator.SPEED = STRINGS[lang]._speed;

    for (const n of document.querySelectorAll('[data-i18n]'))
      n.textContent = this.t(n.dataset.i18n);
    for (const b of document.querySelectorAll('[data-lang]'))
      b.classList.toggle('on', b.dataset.lang === lang);
    if (changed && !silent && typeof Snd !== 'undefined' && Snd.ctx) Snd.pickup();
  },

  /* 화살표(또는 A/D)로 언어를 넘긴다. 넘겼으면 true — 그 키는 '시작' 으로 치지 않는다. */
  cycleByKey() {
    let d = 0;
    if (Input.pressed('arrowleft', 'a')) d = -1;
    else if (Input.pressed('arrowright', 'd')) d = 1;
    if (!d) return false;
    const i = this.LANGS.indexOf(this.lang);
    this.set(this.LANGS[(i + d + this.LANGS.length) % this.LANGS.length]);
    return true;
  },

  /* 터치 기기에서는 조작 레이어가 화면을 통째로 덮는다.
     타이틀 화면에서 언어 버튼 위를 눌렀다면 그 터치는 여기서 먹는다. */
  hitTest(touches) {
    if (this.locked || !this.el) return false;
    for (const b of this.el.querySelectorAll('[data-lang]')) {
      const r = b.getBoundingClientRect();
      for (const t of touches) {
        if (t.clientX < r.left - 12 || t.clientX > r.right + 12) continue;
        if (t.clientY < r.top - 12 || t.clientY > r.bottom + 12) continue;
        this.set(b.dataset.lang);
        return true;
      }
    }
    return false;
  },

  has(key) {
    return (STRINGS[this.lang] && STRINGS[this.lang][key] !== undefined) ||
           STRINGS.ko[key] !== undefined;
  },

  t(key, params) {
    const tbl = STRINGS[this.lang] || STRINGS.ko;
    let s = tbl[key];
    if (s === undefined) s = STRINGS.ko[key];
    if (s === undefined) return key;
    if (Array.isArray(s)) s = s.join(' ');
    if (params)
      s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] === undefined ? m : params[k]));
    return s;
  },

  /* 여러 줄짜리. 부르는 쪽에서 밀어 넣는 경우가 있으므로 사본을 준다. */
  ta(key) {
    const tbl = STRINGS[this.lang] || STRINGS.ko;
    const s = tbl[key] !== undefined ? tbl[key] : STRINGS.ko[key];
    if (Array.isArray(s)) return s.slice();
    return s === undefined ? [] : [s];
  },

  /* 영어는 복수형이 갈린다. 지금 갈리는 것은 이 하나뿐이라 여기서 처리한다. */
  plural(n, one, many) { return this.lang === 'en' ? (n === 1 ? one : many) : one; }
};

/* 이름을 T 로 두면 안 된다 — 게임 코드 곳곳에서 타일 크기를 담는 지역변수
   const T = map.T 가 이 이름을 가린다. 실제로 startStage() 안에서 T('...') 가
   16('...') 이 되어 터졌다. */
const TXT = (key, params) => I18N.t(key, params);
const TXTA = key => I18N.ta(key);
