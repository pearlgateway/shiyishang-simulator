import { useMemo, useState } from 'react'

// ================= 模式配置 =================
type Mode = 'msi' | 'ewc'

interface ModeConfig {
  id: Mode
  title: string
  sub: string
  enemy: string
  enemyTitle: string
  totalRounds: number
  roundsLabel: string
  desc: string[]
  // 机制参数
  greedRiskNoWard: number
  greedRiskWard: number
  farmSoloKillRisk: number
}

const MODES: Record<Mode, ModeConfig> = {
  msi: {
    id: 'msi',
    title: 'MSI 2026 决赛',
    sub: 'BLG vs HLE · 让二追三之路',
    enemy: 'Zeus（蒙多）',
    enemyTitle: '两冠上单 · 团队属性拉满',
    totalRounds: 10,
    roundsLabel: 'BO5 长盘',
    desc: [
      '你 2-1 领先拿到赛点，然后第四局奎桑提有TP不支援……',
      '特色机制：Zeus 的蒙多每次团战都在叠【心之钢】，你不做事他就越肉',
      '决胜局他的血条会告诉你什么叫"纹丝不动"',
    ],
    greedRiskNoWard: 0.5,
    greedRiskWard: 0.28,
    farmSoloKillRisk: 0.12,
  },
  ewc: {
    id: 'ewc',
    title: 'EWC 八强赛',
    sub: 'BLG vs DK · 高配Bin警告',
    enemy: 'Siwoo（小炮）',
    enemyTitle: 'DK新人 · 评论区认证"高配版你"',
    totalRounds: 6,
    roundsLabel: 'BO3 短局',
    desc: [
      '对面也是个不听指挥不参团的独比——但他每条赛道都比你强',
      '特色机制：【被单杀计数】，激进换血会被他反手教育',
      '被单杀满4次直接触发"米勒破防"结局',
    ],
    greedRiskNoWard: 0.62,
    greedRiskWard: 0.38,
    farmSoloKillRisk: 0.2,
  },
}

// ================= 语录 =================
const Q = {
  msi: {
    start: ['2-1了，赛点在我手里，冠军99%稳了。', 'Zeus？蒙多？看我剑魔打穿他。'],
    farm: ['蒙多就一坨肉，压他补刀没意义……但我补刀第一。', '镀层真好吃。'],
    noTp: ['蒙多T就T吧，我多吃两层镀层换他支援，不亏。', '龙给了，我上路通关，蒙多回去守吧。'],
    ganked: ['Kanavi又抓上？1v1我没输。', '这波我大意了，下次必单杀Zeus。'],
    endingBad: '这个又不是冠军，只是优胜者，今年只有一个总冠军。',
  },
  ewc: {
    start: ['MSI是意外。打个DK新人，让他知道什么叫世一上。', 'Siwoo？没听过，让他三招。'],
    farm: ['新人对线还行，但补刀被我压了。', '他也是个不参团的，同行啊。'],
    noTp: ['他不T我也不T，公平1v1。', '队友稳住，我对线要单杀了。'],
    ganked: ['他伤害怎么这么高？？', '不公平，长手打短手。', '高科技打冷兵器。'],
    endingBad: '恶心坏了，是真恶心了。',
  },
  common: {
    ward: ['我做眼？我打对线克制从来不怎么做眼。', '行吧，勉强插一个，别跟别人说。'],
    tp: ['我不想参团但教练逼我T了。', '行吧，T一下给你们看看什么叫世一上。'],
    teamfightWin: ['看到没，我TP下来就是收割。', '这波全靠我。'],
    teamfightLose: ['四打五都打不过，怪我不T？', '队友没跟上我的节奏。'],
    soloKill: ['单杀！看到没，这就是世一上！', '对面上单就这？'],
  },
}

const rand = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)]
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

interface Log { text: string; kind: 'info' | 'good' | 'bad' }
interface G {
  round: number
  cs: number; gold: number; kills: number; deaths: number; plates: number
  teamGold: number; dragons: number; enemyDragons: number; morale: number
  wards: number; tpJoin: number; tpRefuse: number
  soloKills: number; soloKilled: number
  teamfight: boolean; fightStake: string
  log: Log[]; quote: string; over: boolean
  // 模式专属
  steelStacks: number // MSI: 蒙多心之钢层数
}

const init = (m: Mode): G => ({
  round: 1, cs: 0, gold: 500, kills: 0, deaths: 0, plates: 0,
  teamGold: m === 'ewc' ? 2000 : 0, // EWC: 队友开局小优
  dragons: 0, enemyDragons: 0, morale: m === 'ewc' ? 60 : 70,
  wards: 0, tpJoin: 0, tpRefuse: 0, soloKills: 0, soloKilled: 0,
  teamfight: false, fightStake: '',
  log: [{
    text: m === 'msi'
      ? '比赛开始！你自信锁下招牌剑魔，Zeus后手蒙多。队友：Bin哥稳一点。'
      : '比赛开始！EWC八强对DK。队友开局打出2K经济优势（见"团队经济差"面板）——别辜负他们。',
    kind: 'info',
  }],
  quote: rand(Q[m].start),
  over: false,
  steelStacks: 100,
})

export default function Home() {
  const [mode, setMode] = useState<Mode | null>(null)
  const [g, setG] = useState<G | null>(null)
  const cfg = mode ? MODES[mode] : null

  const kp = useMemo(() => {
    if (!g) return 100
    const t = g.tpJoin + g.tpRefuse
    return t === 0 ? 100 : Math.round((g.tpJoin / t) * 100)
  }, [g])

  // ---------- 结局（Hook必须置顶，不能放在条件return之后） ----------
  const ending = useMemo(() => {
    if (!g || !g.over || !mode) return null
    const teamScore = g.teamGold + g.dragons * 600 - g.enemyDragons * 600
    const teamWin = teamScore > 0
    if (mode === 'msi') {
      if (!teamWin && (g.steelStacks >= 700 || g.tpRefuse >= 2))
        return { title: '让二追三结局', tag: '优胜者不是冠军',
          desc: `蒙多心之钢${g.steelStacks}层（你${g.tpRefuse}次拒绝参团喂出来的），决胜团三段Q全中血条没动，团队经济差${g.teamGold}。赛后你发微博："${Q.msi.endingBad}" AL经理爱笑："难道输家是冠军？装什么大尾巴狼。"` }
      if (teamWin)
        return { title: '捧杯结局（陌生）', tag: '史一上体验卡',
          desc: `你参团率${kp}%，TP参团${g.tpJoin}次，蒙多被按死在对线期。管泽元："这Bin被盗号了？"网友：狂气！兑现诺言！` }
      return { title: '奎桑提不TP结局', tag: '参团率倒数第一',
        desc: `参团率${kp}%上单倒数第一，分均经济第一，场均死亡第一。Wayward复盘："下路都把人打残了，他为什么不TP？站在上路不做事啊。"` }
    } else {
      if (g.soloKilled >= 4)
        return { title: '米勒破防结局', tag: '观众评分 4.0',
          desc: `一个BO3被Siwoo单杀${g.soloKilled}次。米勒："恶心坏了，是真恶心了。"网友："你们LPL全票选的世一上，被外赛区新人当猪杀。"` }
      if (!teamWin && g.tpRefuse > g.tpJoin)
        return { title: '高配Bin结局', tag: '领先6K被翻',
          desc: `你决胜局强行越塔被反杀，DK落后6K经济翻盘。评论区："Siwoo也是个不听指挥不参团的独比，但他把你团队+对线全爆了——高配版你。"` }
      if (teamWin)
        return { title: '险胜DK结局', tag: '评分依然4.0',
          desc: `你们赢了，但你KDA ${g.kills}/${g.deaths}、被单杀${g.soloKilled}次，EWC首日评分4.0。观众：赢了跟你有什么关系？` }
      return { title: '止步八强结局', tag: 'LPL全军覆没',
        desc: `同一比赛日JDG、AL、BLG全灭。网友："DK睡网吧吃剩饭开不出工资，直接就能赢BLG。""亚运弃赛是真有远见。"` }
    }
  }, [g, mode, kp])

  const start = (m: Mode) => { setMode(m); setG(init(m)) }
  const back = () => { setMode(null); setG(null) }

  if (!g || !cfg || !mode) return <Menu onStart={start} />

  const push = (s: G, entries: Log[]): G => ({ ...s, log: [...entries.reverse(), ...s.log].slice(0, 60) })

  // 龙归属结算：决胜团（最后一回合必刷）、龙魂后转大龙团
  const decideStake = (s: G): string => {
    if (s.round >= cfg.totalRounds) return mode === 'msi' ? '决胜局龙魂团' : '决胜局大龙团'
    if (s.dragons >= 4 || s.enemyDragons >= 4) return '大龙团'
    if (s.dragons === 3 || s.enemyDragons === 3) return '龙魂团'
    return '小龙团'
  }

  const maybeFight = (s: G): G => {
    const must = s.round >= cfg.totalRounds // 最后一回合必出决胜团
    if (s.round >= 2 && !s.teamfight && (must || Math.random() < 0.5)) {
      const stake = decideStake(s)
      return { ...s, teamfight: true, fightStake: stake,
        log: [{ text: `⚔️ 队友在${stake}集结，疯狂ping你TP！`, kind: 'info' }, ...s.log] }
    }
    return s
  }

  const next = (s: G): G => {
    let n = { ...s, round: s.round + 1 }
    if (n.round > cfg.totalRounds) n.over = true
    return n.over ? n : maybeFight(n)
  }

  // MSI专属：Zeus叠心之钢
  const stackSteel = (s: G, layers: number, why: string): G => {
    if (mode !== 'msi') return s
    const ns = { ...s, steelStacks: s.steelStacks + layers }
    return push(ns, [{ text: `🛡️ ${why}Zeus蒙多心之钢叠到${ns.steelStacks}层了……`, kind: 'bad' }])
  }

  // EWC专属：被单杀达到阈值
  const checkSiwoo = (s: G): G => {
    if (mode !== 'ewc') return s
    if (s.soloKilled === 3)
      return push(s, [{ text: '⚠️ 9分钟内被Siwoo连续三次单杀！二路解说Sask：彬哥发狂了？', kind: 'bad' }])
    if (s.soloKilled >= 4) {
      const ns = push(s, [{ text: '💀 第四次被单杀。米勒当场破防："恶心坏了，是真恶心了，这看完能不喷的都是神人了。"', kind: 'bad' }])
      return { ...ns, over: true }
    }
    return s
  }

  // 团战悬挂时选择其他行动 = 事实上拒绝参团，必须结算四打五
  const autoNoTP = (s: G): G => {
    if (!s.teamfight) return s
    let n = { ...s, teamfight: false, tpRefuse: s.tpRefuse + 1 }
    if (Math.random() < 0.22) {
      n = award(n, true); n.morale = clamp(n.morale - 5, 0, 100)
      n = push(n, [{ text: `😤 你只顾自己操作没看小地图，${n.fightStake}队友四打五居然赢了。`, kind: 'info' }])
    } else {
      n = award(n, false); n.teamGold -= 900; n.morale = clamp(n.morale - 18, 0, 100)
      n = push(n, [{ text: `😤 你没看小地图，${n.fightStake}队友四打五崩盘。这次连"不T"都算不上，是纯没T。`, kind: 'bad' }])
    }
    if (mode === 'msi') n = stackSteel(n, 150, '你没参团的这段时间，')
    return n
  }

  // ---------- 行动 ----------
  const doFarm = () => {
    let s = autoNoTP({ ...g })
    const cs = 26 + Math.floor(Math.random() * 8)
    s.cs += cs; s.gold += 480 + Math.floor(Math.random() * 120)
    s.quote = rand(Q[mode].farm)
    let entries: Log[] = [{ text: `🌾 你稳健吃线：+${cs}补刀。队友在干嘛你不在乎。`, kind: 'good' }]
    if (s.wards === 0 && Math.random() < cfg.farmSoloKillRisk) {
      s.deaths++; s.soloKilled++; s.morale = clamp(s.morale - 8, 0, 100)
      s.quote = rand(Q[mode].ganked)
      entries.push({ text: `💀 你压线太深，被${cfg.enemy}单杀。`, kind: 'bad' })
    } else if (s.wards > 0) {
      s.wards-- // 有眼时的安稳发育消耗一枚视野
    }
    s = push(s, entries)
    s = checkSiwoo(s)
    if (!s.over) setG(next(s)); else setG(s)
  }

  const doGreed = () => {
    let s = autoNoTP({ ...g })
    const risk = s.wards > 0 ? cfg.greedRiskWard : cfg.greedRiskNoWard
    if (Math.random() < risk) {
      s.deaths++; s.soloKilled++; s.morale = clamp(s.morale - 12, 0, 100); s.teamGold -= 300
      s.quote = rand(Q[mode].ganked)
      s = push(s, [{ text: mode === 'msi'
        ? '💀 Kanavi三级抓上！你被蒙多配合打野收下——谁让你不做眼。'
        : `💀 你激进换血想单杀，被${cfg.enemy}反手教育：单杀+1。`, kind: 'bad' }])
      if (s.wards > 0) s.wards--
      if (mode === 'msi') s = stackSteel(s, 80, '你被抓死的功夫，')
    } else if (Math.random() < 0.45 && mode !== 'ewc') {
      s.kills++; s.soloKills++; s.gold += 600; s.plates += 2
      s.quote = rand(Q.common.soloKill)
      s = push(s, [{ text: `⚡ 单杀${cfg.enemy}！+600经济 +2镀层。`, kind: 'good' }])
    } else if (mode === 'ewc' && Math.random() < 0.35) {
      s.kills++; s.soloKills++; s.gold += 600
      s.quote = '单杀新人一次！……但观众评分还是4.0。'
      s = push(s, [{ text: `⚡ 你单杀了Siwoo一次！评论区："即便对线单杀也得不到认可。"`, kind: 'good' }])
    } else {
      s.plates += 2; s.gold += 500; s.cs += 12
      s.quote = rand(Q[mode].farm)
      s = push(s, [{ text: '🗡️ 压掉两层镀层：+500经济 +12补刀。', kind: 'good' }])
    }
    s = checkSiwoo(s)
    if (!s.over) setG(next(s)); else setG(s)
  }

  const doWard = () => {
    let s = autoNoTP({ ...g })
    s = { ...s, wards: s.wards + 2, gold: Math.max(0, s.gold - 75), quote: rand(Q.common.ward) }
    s = push(s, [{ text: '👁️ 你极不情愿地买了两个真眼。（-75经济）', kind: 'info' }])
    setG(next(s))
  }

  // 资源结算：大龙团不加龙数，加团队经济
  const award = (s: G, win: boolean): G => {
    if (s.fightStake.includes('大龙')) { s.teamGold += win ? 1200 : -1200; return s }
    if (win) s.dragons++; else s.enemyDragons++
    return s
  }

  const doTP = () => {
    let s = { ...g, teamfight: false, tpJoin: g.tpJoin + 1, quote: rand(Q.common.tp) }
    const decisive = s.fightStake.includes('决胜')
    let winChance = 0.55 + s.morale / 300
    if (mode === 'msi' && decisive) {
      winChance = Math.max(0.1, 0.8 - s.steelStacks / 800)
    }
    if (Math.random() < winChance) {
      s = award(s, true)
      s.kills += 2; s.teamGold += 800; s.morale = clamp(s.morale + 10, 0, 100)
      s.quote = rand(Q.common.teamfightWin)
      s = push(s, [{ text: `🔥 你TP落地收割，${s.fightStake}拿下！`, kind: 'good' }])
    } else {
      s = award(s, false)
      s.deaths++; s.teamGold -= 500
      if (mode === 'msi' && decisive) {
        s.quote = '三段Q全中……蒙多血条纹丝不动。'
        s = push(s, [{ text: `❌ 决胜团：你三段Q全中，但蒙多${s.steelStacks}层心之钢+狂徒，血条都没动。HLE一波。`, kind: 'bad' }])
      } else {
        s.quote = rand(Q.common.teamfightLose)
        s = push(s, [{ text: '❌ 你T下来了，但团还是输了。', kind: 'bad' }])
      }
    }
    setG(next(s))
  }

  const doNoTP = () => {
    let s = { ...g, teamfight: false, tpRefuse: g.tpRefuse + 1 }
    s.plates += 3; s.gold += 650; s.cs += 15
    const win4v5 = Math.random() < 0.22
    if (win4v5) {
      s = award(s, true); s.morale = clamp(s.morale - 5, 0, 100)
      s.quote = '他们四打五都赢了……那我更不用T了。'
      s = push(s, [{ text: `😤 你拒绝TP爽吃3镀层。队友四打五居然赢了${s.fightStake}？！`, kind: 'info' }])
    } else {
      s = award(s, false); s.teamGold -= 900; s.morale = clamp(s.morale - 18, 0, 100)
      s.quote = rand(Q[mode].noTp)
      s = push(s, [{ text: `😤 你拒绝TP爽吃3镀层（+650）。队友四打五崩盘，${s.fightStake}白给，打野点了个问号。`, kind: 'bad' }])
    }
    if (mode === 'msi') s = stackSteel(s, 150, '你单带的这段时间，')
    setG(next(s))
  }

  // ---------- 结算页 ----------
  if (g.over && ending)
    return (
      <div className="min-h-screen game-bg text-white p-6 flex flex-col items-center justify-center">
        <div className="text-xs text-slate-500 tracking-widest">{cfg.title} · {cfg.sub}</div>
        <h2 className="text-3xl font-black text-amber-400 tracking-widest mt-1">赛后结算</h2>
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-2xl text-center">
          {([
            ['补刀', g.cs], ['镀层', g.plates], ['K/D', `${g.kills}/${g.deaths}`],
            ['参团率', g.tpJoin + g.tpRefuse === 0 ? '—' : `${kp}%`],
            ['分均经济', Math.round(g.gold / ((g.round - 1) * 3))],
            ['团队经济差', (g.teamGold >= 0 ? '+' : '') + g.teamGold],
            ['单杀/被单杀', `${g.soloKills}/${g.soloKilled}`], ['TP/拒绝', `${g.tpJoin}/${g.tpRefuse}`],
          ] as const).map(([k, v]) => (
            <div key={k} className="bg-white/5 border border-white/10 rounded-lg p-3">
              <div className="text-xs text-slate-400">{k}</div>
              <div className="text-2xl font-bold text-amber-300">{v}</div>
            </div>
          ))}
        </div>
        {mode === 'msi' && (
          <div className="mt-3 text-sm text-slate-400">🛡️ Zeus蒙多心之钢最终层数：<span className="text-red-400 font-bold">{g.steelStacks}</span></div>
        )}
        <div className="mt-6 max-w-xl bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/30 rounded-2xl p-6 text-center">
          <div className="text-2xl font-black text-amber-300">{ending.title}</div>
          <p className="mt-3 text-slate-300 leading-relaxed">{ending.desc}</p>
          <div className="mt-4 inline-block px-4 py-1 rounded-full bg-amber-500/20 text-amber-300 text-sm font-bold">{ending.tag}</div>
          <p className="mt-5 text-lg font-bold">“我依然是世一上。”</p>
        </div>
        <div className="mt-8 flex gap-3">
          <button onClick={() => start(mode)} className="px-6 py-3 rounded-xl bg-amber-500 text-black font-bold hover:scale-105 transition-transform">再打一局</button>
          <button onClick={back} className="px-6 py-3 rounded-xl bg-white/10 font-bold hover:bg-white/20">返回选模式</button>
        </div>
      </div>
    )

  // ---------- 对局页 ----------
  return (
    <div className="min-h-screen game-bg text-white p-4 md:p-6">
      <div className="flex flex-wrap gap-2 items-center justify-between max-w-4xl mx-auto">
        <div className="text-amber-400 font-black tracking-widest">{cfg.title} · 第{g.round}/{cfg.totalRounds}回合</div>
        <button onClick={back} className="text-xs text-slate-500 hover:text-slate-300">← 换模式</button>
      </div>
      <div className="max-w-4xl mx-auto mt-1 text-sm text-slate-400">
        对位：<span className="text-red-400 font-bold">{cfg.enemy}</span>
        <span className="text-slate-600">（{cfg.enemyTitle}）</span>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-7 gap-2 mt-3 max-w-4xl mx-auto text-center text-sm">
        {([
          ['💰 经济', g.gold, 'text-amber-300'], ['🌾 补刀', g.cs, 'text-green-300'],
          ['🧱 镀层', g.plates, 'text-yellow-200'], ['⚔️ K/D', `${g.kills}/${g.deaths}`, 'text-red-300'],
          ['🐉 龙', `${g.dragons}:${g.enemyDragons}`, 'text-blue-300'],
          ['📊 团队经济差', (g.teamGold >= 0 ? '+' : '') + g.teamGold, g.teamGold >= 0 ? 'text-green-300' : 'text-red-400'],
          ['😀 队友心态', g.morale, g.morale < 40 ? 'text-red-400' : 'text-slate-200'],
        ] as const).map(([k, v, c]) => (
          <div key={k} className="bg-white/5 border border-white/10 rounded-lg p-2">
            <div className="text-[11px] text-slate-400">{k}</div>
            <div className={`text-lg font-bold ${c}`}>{v}</div>
          </div>
        ))}
      </div>

      {/* 模式专属机制面板 */}
      {mode === 'msi' ? (
        <div className="max-w-4xl mx-auto mt-3 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-red-300">🛡️ Zeus蒙多·心之钢层数（决胜团战力）</span>
            <span className="text-red-400 font-bold">{g.steelStacks}层</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all" style={{ width: `${clamp(g.steelStacks / 10, 5, 100)}%` }} />
          </div>
          <p className="text-[11px] text-slate-500 mt-1">你不做事的每一分钟，他都在变肉。700层以上决胜团基本打不动。</p>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto mt-3 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-red-300">💀 被Siwoo单杀计数（4次=米勒破防）</span>
            <span className="text-red-400 font-bold">{g.soloKilled}/4</span>
          </div>
          <div className="flex gap-1">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className={`h-2 flex-1 rounded-full ${i < g.soloKilled ? 'bg-red-500' : 'bg-white/10'}`} />
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">他是高配版你：激进换血多半是他赢。想做眼？你可是世一上。</p>
        </div>
      )}

      {/* 嘴硬气泡 */}
      <div className="max-w-4xl mx-auto mt-3">
        <div className="bubble-tail relative bg-amber-500/10 border border-amber-500/40 rounded-2xl p-4">
          <span className="absolute -top-3 left-4 bg-amber-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">Bin（你）</span>
          <p className="text-amber-200 font-bold mt-1">“{g.quote}”</p>
        </div>
      </div>

      {/* 行动区 */}
      <div className="max-w-4xl mx-auto mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
        <Btn onClick={doFarm} emoji="🌾" label="稳健吃线" desc="安全发育 +补刀" />
        <Btn onClick={doGreed} emoji="🗡️" label={mode === 'ewc' ? '激进换血' : '激进压线'}
          desc={g.wards > 0 ? `有眼×${g.wards} 风险较低` : mode === 'ewc' ? '无眼！Siwoo在等你' : '无眼！Kanavi在蹲'} warn={g.wards === 0} />
        <Btn onClick={doWard} emoji="👁️" label="买眼做视野" desc="-75经济（极不情愿）" />
        {g.teamfight ? (
          <>
            <Btn onClick={doTP} emoji="🔥" label="TP参团！" desc={`${g.fightStake}需要支援`} highlight />
            <Btn onClick={doNoTP} emoji="😤" label="不T，继续带" desc={mode === 'msi' ? '爽吃镀层，蒙多叠钢' : '爽吃镀层，队友4打5'} warn />
          </>
        ) : (
          <div className="flex items-center justify-center text-xs text-slate-500 border border-dashed border-white/10 rounded-xl p-3">暂无团战</div>
        )}
      </div>

      {/* 参团率羞辱条 */}
      <div className="max-w-4xl mx-auto mt-3 bg-white/5 border border-white/10 rounded-xl p-3">
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>参团率（上单平均 65%）· 参战{g.tpJoin}/{(g.tpJoin + g.tpRefuse)}场</span>
          <span className={kp < 50 ? 'text-red-400 font-bold' : 'text-green-400 font-bold'}>
            {g.tpJoin + g.tpRefuse === 0 ? '—（暂无团战）' : `${kp}%`}
          </span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div className={`h-full transition-all ${kp < 50 ? 'bg-red-500' : 'bg-green-500'}`}
            style={{ width: `${g.tpJoin + g.tpRefuse === 0 ? 0 : kp}%` }} />
        </div>
        {kp <= 45 && g.tpRefuse > 0 && <p className="text-[11px] text-red-400 mt-1">Wayward：那波下路都把人打残了，他为什么不TP支援？站在上路不做事啊。</p>}
      </div>

      {/* 日志 */}
      <div className="max-w-4xl mx-auto mt-3 game-log bg-black/40 border border-white/10 rounded-xl p-3 h-52 overflow-y-auto">
        {g.log.map((l, i) => (
          <p key={i} className={`log-entry text-sm py-1 border-b border-white/5 ${
            l.kind === 'good' ? 'text-green-300' : l.kind === 'bad' ? 'text-red-300' : 'text-slate-300'
          }`}>{l.text}</p>
        ))}
      </div>
    </div>
  )
}

// ================= 主菜单（模式选择） =================
function Menu({ onStart }: { onStart: (m: Mode) => void }) {
  return (
    <div className="min-h-screen game-bg text-white flex flex-col items-center justify-center p-6">
      <div className="text-6xl mb-4">🗡️</div>
      <h1 className="text-4xl md:text-5xl font-black tracking-widest glow-title title-float bg-gradient-to-r from-amber-300 via-yellow-500 to-amber-300 bg-clip-text text-transparent">世一上模拟器</h1>
      <p className="mt-3 text-slate-400 tracking-widest">—— 选择你的耻辱柱 ——</p>
      <div className="mt-8 grid md:grid-cols-2 gap-4 w-full max-w-3xl">
        {(Object.values(MODES)).map(m => (
          <button key={m.id} onClick={() => onStart(m.id)}
            className="mode-card text-left bg-white/5 border border-white/10 hover:border-amber-400/70 hover:shadow-lg hover:shadow-amber-500/20 rounded-2xl p-6 transition-all hover:scale-[1.02] group">
            <div className="text-2xl font-black text-amber-300 group-hover:text-amber-200">{m.title}</div>
            <div className="text-xs text-slate-500 mt-1">{m.sub} · {m.roundsLabel}</div>
            <div className="mt-3 text-sm text-red-300 font-bold">对位：{m.enemy}</div>
            <div className="text-xs text-slate-500">{m.enemyTitle}</div>
            <ul className="mt-3 space-y-1 text-xs text-slate-400">
              {m.desc.map((d, i) => <li key={i}>· {d}</li>)}
            </ul>
            <div className="mt-4 inline-block px-4 py-1.5 rounded-lg bg-amber-500 text-black text-sm font-bold">进入对局 →</div>
          </button>
        ))}
      </div>
      <p className="mt-8 text-xs text-slate-600">基地输赢不重要，嘴硬才是总冠军。</p>
    </div>
  )
}

function Btn({ onClick, emoji, label, desc, warn, highlight }: {
  onClick: () => void; emoji: string; label: string; desc: string; warn?: boolean; highlight?: boolean
}) {
  return (
    <button onClick={onClick}
      className={`rounded-xl p-3 text-left border transition-all hover:scale-[1.03] active:scale-95 ${
        highlight ? 'bg-red-500/20 border-red-400 animate-pulse'
        : warn ? 'bg-orange-500/10 border-orange-500/40 hover:border-orange-400'
        : 'bg-white/5 border-white/10 hover:border-amber-400/60'
      }`}>
      <div className="text-xl">{emoji} <span className="font-bold text-sm">{label}</span></div>
      <div className="text-[11px] text-slate-400 mt-1">{desc}</div>
    </button>
  )
}
