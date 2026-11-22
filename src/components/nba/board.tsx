import { useEffect, useMemo, useState } from "react";
import { useSlate } from "@/lib/nba/use-slate";

type Game = {
  id: string;
  awayAbbr: string;
  homeAbbr: string;
  awayName?: string;
  homeName?: string;
  status?: string;
  clock?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  tip?: string;
  venue?: string | null;
  city?: string | null;
  altitudeFt?: number | null;
  timezone?: string | null;
  tv?: string | null;
  lockMinutes?: number | null;
  verdict?: string;
  paragraphs?: string[];
  confidence?: { grade: string; score: number; note: string };
  market?: {
    provider?: string;
    homeSpread?: number | null;
    total?: number | null;
    mlHome?: number | null;
    mlAway?: number | null;
    noVigHome?: number | null;
    noVigAway?: number | null;
    devigMethod?: string | null;
    openSpreadHome?: number | null;
    spreadMove?: number | null;
    hold?: number | null;
  };
  model?: { wp?: number; margin?: number; total?: number; poss?: number; lambda?: number; lambdaReason?: string };
  headline?: {
    wp?: number;
    margin?: number;
    total?: number;
    cover?: number | null;
    over?: number | null;
    ot?: number;
    marginQuantiles?: number[];
    totalQuantiles?: number[];
    disagreeFlag?: boolean;
    disagreePts?: number | null;
    edgeLabel?: string;
  };
  inferred?: { lo: number; hi: number } | null;
  officials?: string[];
  series?: { summary?: string; score?: string; events?: number } | null;
  lineups?: {
    confirmed?: boolean;
    home: Player[];
    away: Player[];
    homeMinutesTarget?: number;
    awayMinutesTarget?: number;
  };
  scenarios?: Array<{
    player: string;
    side: string;
    dWp: number;
    dMargin: number;
    dTotal: number;
    teammateDeltas: Array<{ name: string; dMin: number }>;
  }>;
  factors?: Array<{
    id: number;
    group: string;
    name: string;
    role: string;
    value: number | null;
    direction: string;
    posterior: string;
    inProjection: boolean;
  }>;
  trends?: Array<{ family: string; label: string; tier: string; whyNoise: string; detail?: string; inProjection: boolean }>;
  swings?: Array<{ name: string; dWp: number; dTotal: number }>;
  injuries?: Array<{ team: string; name: string; status: string; comment?: string }>;
  reasoning?: string[];
};

type Player = {
  id: string;
  name: string;
  pos?: string;
  team?: string;
  starter?: boolean;
  status?: string;
  pPlay?: number;
  min?: number;
  minLo?: number;
  minHi?: number;
  pts?: number;
  reb?: number;
  ast?: number;
  tpm?: number;
  pra?: number;
  ptsLo?: number;
  ptsHi?: number;
  foulRisk?: number;
  rateSource?: string;
};

type Snapshot = {
  generatedAt: string;
  slateDate: string;
  label: string;
  statusLine: string;
  narrative?: { paragraphs: string[]; source: string };
  games: Game[];
  alerts?: Array<{ id: string; kind: string; text: string }>;
  changes?: Array<{ game: string; field: string; from: unknown; to: unknown; reason: string }>;
  discovery?: { newThisRefresh: string[]; note: string };
  source?: { writer?: string; fetches?: Array<{ url: string; status: number; bytes: number; ms: number; ok?: boolean }> };
  hypothesisCount?: number;
  factorCount?: number;
  league?: { ppg?: number; source?: string };
};

const TABS = ["Slate", "Games", "Players", "Trends", "Changes", "Alerts", "Method", "Health"] as const;

function pct(p?: number | null) {
  if (p == null || Number.isNaN(p)) return "—";
  return `${(p * 100).toFixed(1)}%`;
}

function num(v?: number | null, d = 1) {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toFixed(d);
}

function age(iso?: string) {
  if (!iso) return "no timestamp";
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min old`;
  return `${Math.floor(min / 60)}h ${min % 60}m old`;
}

function spreadTxt(v?: number | null) {
  if (v == null) return "—";
  return v > 0 ? `+${v}` : `${v}`;
}

export function Board({ initial }: { initial: Snapshot | null }) {
  const { snapshot, source, error, espnStatus } = useSlate(initial);
  const data = (snapshot as Snapshot | null) || initial;
  const [tab, setTab] = useState<(typeof TABS)[number]>("Slate");
  const [gameId, setGameId] = useState<string | null>(null);
  const [clockLabel, setClockLabel] = useState("on the snapshot");

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/nba-sw.js").catch(() => {});
  }, []);

  useEffect(() => {
    setClockLabel(age(data?.generatedAt));
    const id = window.setInterval(() => setClockLabel(age(data?.generatedAt)), 30_000);
    return () => window.clearInterval(id);
  }, [data?.generatedAt]);

  const game = data?.games?.find((g) => g.id === gameId) || null;

  const openGame = (id: string) => {
    setGameId(id);
    setTab("Games");
  };

  return (
    <main className="mx-auto min-h-dvh max-w-3xl bg-bg px-4 pb-24 pt-4 text-fg">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs tracking-widest text-accent">SLATE LOCK</p>
          <h1 className="text-2xl font-semibold leading-tight">Tonight’s board</h1>
          <p className="mt-1 text-sm text-muted">{data?.slateDate || "waiting for a slate"} · {data?.label || "loading"}</p>
        </div>
        <div className="max-w-[11rem] rounded-lg border border-line bg-surface px-3 py-2 text-right">
          <p className="font-mono text-xs text-muted">data age</p>
          <p className="text-sm font-semibold" suppressHydrationWarning>
            {clockLabel}
          </p>
          <p className="mt-1 text-xs text-muted">{espnStatus}</p>
        </div>
      </header>

      {error ? (
        <p className="mb-3 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-bad">{error}</p>
      ) : null}
      <p className="mb-3 font-mono text-xs text-muted">source {source}</p>

      <nav className="sticky top-0 z-10 -mx-4 mb-4 flex gap-2 overflow-x-auto bg-bg px-4 py-2">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setTab(name)}
            className={`min-h-11 shrink-0 rounded-full px-3 text-sm ${
              tab === name ? "bg-accent text-accent-ink" : "bg-surface text-fg"
            }`}
          >
            {name}
          </button>
        ))}
      </nav>

      {!data ? (
        <p className="text-muted">Pulling the slate…</p>
      ) : tab === "Slate" ? (
        <Slate data={data} onOpen={openGame} />
      ) : tab === "Games" ? (
        game ? <GameView game={game} onBack={() => setGameId(null)} /> : <GameList games={data.games} onOpen={openGame} />
      ) : tab === "Players" ? (
        <Players games={data.games} />
      ) : tab === "Trends" ? (
        <Trends games={data.games} />
      ) : tab === "Changes" ? (
        <Changes data={data} />
      ) : tab === "Alerts" ? (
        <Alerts data={data} />
      ) : tab === "Method" ? (
        <Method data={data} />
      ) : (
        <Health data={data} />
      )}
    </main>
  );
}

function Slate({ data, onOpen }: { data: Snapshot; onOpen: (id: string) => void }) {
  return (
    <div className="space-y-4">
      {(data.narrative?.paragraphs || []).map((p, i) => (
        <p key={i} className="text-sm leading-relaxed text-fg">
          {p}
        </p>
      ))}
      <p className="font-mono text-xs text-muted">narrative source: {data.narrative?.source || "rules"}</p>
      <ul className="space-y-2">
        {data.games.map((g) => (
          <li key={g.id}>
            <button
              type="button"
              onClick={() => onOpen(g.id)}
              className="w-full rounded-xl border border-line bg-surface px-3 py-3 text-left"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">
                  {g.awayAbbr} @ {g.homeAbbr}
                </span>
                <span className="font-mono text-xs text-accent">
                  {g.confidence?.grade} {g.confidence?.score}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted">{g.verdict}</p>
              <p className="mt-1 font-mono text-xs text-fg">
                {g.awayScore ?? "–"} – {g.homeScore ?? "–"} · {g.clock || g.status}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GameList({ games, onOpen }: { games: Game[]; onOpen: (id: string) => void }) {
  return (
    <div className="space-y-2">
      {games.map((g) => (
        <button
          key={g.id}
          type="button"
          onClick={() => onOpen(g.id)}
          className="block w-full rounded-xl border border-line bg-surface px-3 py-3 text-left"
        >
          <span className="font-semibold">
            {g.awayAbbr} @ {g.homeAbbr}
          </span>
          <span className="mt-1 block text-sm text-muted">{g.verdict}</span>
        </button>
      ))}
    </div>
  );
}

function GameView({ game, onBack }: { game: Game; onBack: () => void }) {
  const [showFactors, setShowFactors] = useState(false);
  const valued = useMemo(
    () => (game.factors || []).filter((f) => f.value != null),
    [game.factors],
  );
  return (
    <article className="space-y-4">
      <button type="button" onClick={onBack} className="min-h-11 text-sm text-accent">
        All games
      </button>
      <header className="rounded-xl border border-line bg-surface p-3">
        <p className="font-mono text-xs text-muted">
          {game.tip} · {game.venue} · {game.city} · {game.altitudeFt ?? "—"} ft · {game.timezone} · {game.tv || "TV n/a"}
        </p>
        <h2 className="mt-1 text-xl font-semibold">
          {game.awayName || game.awayAbbr} at {game.homeName || game.homeAbbr}
        </h2>
        <p className="mt-1 font-mono text-sm">
          {game.awayScore ?? "–"} – {game.homeScore ?? "–"} · {game.clock || game.status}
        </p>
        <p className="mt-2 text-sm font-semibold">{game.verdict}</p>
        <p className="mt-1 text-xs text-muted">
          Grade {game.confidence?.grade} ({game.confidence?.score}). {game.confidence?.note}
        </p>
      </header>

      <section className="rounded-xl border border-line bg-surface p-3">
        <h3 className="text-sm font-semibold">Win probability</h3>
        <dl className="mt-2 grid grid-cols-2 gap-2 font-mono text-xs">
          <Stat k="No-vig home" v={pct(game.market?.noVigHome)} />
          <Stat k="No-vig away" v={pct(game.market?.noVigAway)} />
          <Stat k="Model WP" v={pct(game.model?.wp)} />
          <Stat k="Headline WP" v={pct(game.headline?.wp)} />
          <Stat k="Home spread" v={spreadTxt(game.market?.homeSpread)} />
          <Stat k="Total" v={num(game.market?.total)} />
          <Stat k="Cover" v={pct(game.headline?.cover)} />
          <Stat k="Over" v={pct(game.headline?.over)} />
          <Stat k="Open spread" v={spreadTxt(game.market?.openSpreadHome)} />
          <Stat k="Move" v={spreadTxt(game.market?.spreadMove)} />
          <Stat k="Hold" v={pct(game.market?.hold)} />
          <Stat k="OT" v={pct(game.headline?.ot)} />
        </dl>
        <p className="mt-2 text-sm leading-relaxed">
          {game.market?.provider} devig: {game.market?.devigMethod || "—"}. λ={game.model?.lambda}. {game.model?.lambdaReason}.{" "}
          {game.headline?.edgeLabel}. Gap {num(game.headline?.disagreePts)} pts
          {game.headline?.disagreeFlag ? " (flagged, still not an edge)." : "."}
        </p>
        <p className="mt-2 text-sm">
          INFERRED margin {game.inferred ? `${game.inferred.lo} to ${game.inferred.hi}` : "unavailable"} (market + ESPN predictor, ±5).
        </p>
        <p className="mt-1 font-mono text-xs text-muted">
          Margin q {game.headline?.marginQuantiles?.join(" / ") || "—"} · Total q {game.headline?.totalQuantiles?.join(" / ") || "—"}
        </p>
      </section>

      {(game.paragraphs || []).map((p, i) => (
        <p key={i} className="text-sm leading-relaxed">
          {p}
        </p>
      ))}

      <section className="rounded-xl border border-line bg-surface p-3">
        <h3 className="text-sm font-semibold">Head to head</h3>
        <p className="mt-1 text-sm text-muted">
          {game.series?.summary || "No season series yet."} {game.series?.score || ""} · meetings on the feed: {game.series?.events ?? 0}.
          Each meeting is labeled with its sample. Nothing here is shrunk into the projection.
        </p>
      </section>

      <Lineup title={`${game.awayAbbr} minutes`} players={game.lineups?.away || []} target={game.lineups?.awayMinutesTarget} confirmed={game.lineups?.confirmed} />
      <Lineup title={`${game.homeAbbr} minutes`} players={game.lineups?.home || []} target={game.lineups?.homeMinutesTarget} confirmed={game.lineups?.confirmed} />

      <section className="rounded-xl border border-line bg-surface p-3">
        <h3 className="text-sm font-semibold">If someone sits</h3>
        <ul className="mt-2 space-y-3">
          {(game.scenarios || []).length === 0 ? <li className="text-sm text-muted">No one in the uncertain band.</li> : null}
          {(game.scenarios || []).map((s) => (
            <li key={s.player} className="text-sm">
              <p className="font-semibold">
                If {s.player} sits · WP {(s.dWp * 100).toFixed(1)} pts · margin {num(s.dMargin)} · total {num(s.dTotal)}
              </p>
              <p className="text-muted">
                {s.teammateDeltas.map((t) => `${t.name} ${t.dMin > 0 ? "+" : ""}${t.dMin} min`).join(" · ") || "no teammate minute change"}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-line bg-surface p-3">
        <h3 className="text-sm font-semibold">What changes if</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {(game.swings || []).map((s) => (
            <li key={s.name}>
              {s.name}: WP {(s.dWp * 100).toFixed(1)} pts, total {num(s.dTotal)}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-line bg-surface p-3">
        <h3 className="text-sm font-semibold">Injuries</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {(game.injuries || []).map((i) => (
            <li key={`${i.team}-${i.name}`}>
              {i.team} {i.name} · {i.status}
              {i.comment ? ` · ${i.comment}` : ""}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        {(game.trends || []).map((t) => (
          <div key={t.label} className="rounded-xl border border-line bg-surface p-3">
            <p className="text-sm font-semibold">
              {t.label} · {t.tier} · {t.family}
            </p>
            <p className="mt-1 text-sm text-muted">{t.detail}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{t.whyNoise}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-line bg-surface p-3">
        <h3 className="text-sm font-semibold">Reasoning log</h3>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
          {(game.reasoning || []).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-line bg-surface p-3">
        <button type="button" className="min-h-11 text-sm font-semibold" onClick={() => setShowFactors((v) => !v)}>
          {showFactors ? "Hide" : "Show"} factor catalogue ({game.factors?.length || 0}, {valued.length} with a value)
        </button>
        {showFactors ? (
          <div className="mt-2 max-h-96 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-muted">
                <tr>
                  <th className="py-1 pr-2">#</th>
                  <th className="py-1 pr-2">Factor</th>
                  <th className="py-1 pr-2">Value</th>
                  <th className="py-1">Role</th>
                </tr>
              </thead>
              <tbody>
                {(game.factors || []).map((f) => (
                  <tr key={f.id} className="border-t border-line">
                    <td className="py-1 pr-2 font-mono">{f.id}</td>
                    <td className="py-1 pr-2">{f.name}</td>
                    <td className="py-1 pr-2 font-mono">{f.value ?? "—"}</td>
                    <td className="py-1">{f.inProjection ? "in model" : "display"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </article>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-2 py-2">
      <dt className="text-muted">{k}</dt>
      <dd className="text-sm text-fg">{v}</dd>
    </div>
  );
}

function Lineup({
  title,
  players,
  target,
  confirmed,
}: {
  title: string;
  players: Player[];
  target?: number;
  confirmed?: boolean;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-3">
      <h3 className="text-sm font-semibold">
        {title} · target {num(target)} · {confirmed ? "confirmed" : "projected"}
      </h3>
      <ul className="mt-2 space-y-2">
        {players.map((p) => (
          <li key={p.id} className="text-sm">
            <span className="font-semibold">{p.name}</span>
            <span className="text-muted">
              {" "}
              {p.pos} {p.starter ? "starter" : "bench"} · play {pct(p.pPlay)} · {p.status}
            </span>
            <span className="mt-0.5 block font-mono text-xs">
              {num(p.min)} min ({num(p.minLo)}–{num(p.minHi)}) · {num(p.pts)} pts · {num(p.reb)} reb · {num(p.ast)} ast · {num(p.tpm)} 3pm · PRA {num(p.pra)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Players({ games }: { games: Game[] }) {
  const rows = games.flatMap((g) => [...(g.lineups?.away || []), ...(g.lineups?.home || [])].map((p) => ({ ...p, game: `${g.awayAbbr}@${g.homeAbbr}` })));
  return (
    <ul className="space-y-2">
      {rows
        .filter((p) => (p.min || 0) >= 12)
        .map((p) => (
          <li key={`${p.game}-${p.id}`} className="rounded-xl border border-line bg-surface px-3 py-2 text-sm">
            <span className="font-semibold">{p.name}</span>
            <span className="text-muted"> {p.team} · {p.game}</span>
            <span className="mt-1 block font-mono text-xs">
              {num(p.min)} min · {num(p.pts)}/{num(p.reb)}/{num(p.ast)} · band {num(p.ptsLo)}–{num(p.ptsHi)} · {p.rateSource}
            </span>
          </li>
        ))}
    </ul>
  );
}

function Trends({ games }: { games: Game[] }) {
  return (
    <div className="space-y-3">
      {games.map((g) => (
        <section key={g.id}>
          <h3 className="mb-2 text-sm font-semibold">
            {g.awayAbbr} @ {g.homeAbbr}
          </h3>
          <div className="space-y-2">
            {(g.trends || []).map((t) => (
              <div key={t.label} className="rounded-xl border border-line bg-surface p-3 text-sm">
                <p className="font-semibold">
                  {t.label} · {t.tier}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{t.whyNoise}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Changes({ data }: { data: Snapshot }) {
  const rows = data.changes || [];
  return (
    <div className="space-y-3">
      <p className="text-sm">{data.discovery?.note}</p>
      {rows.length === 0 ? <p className="text-sm text-muted">No diff against a previous snapshot.</p> : null}
      <ul className="space-y-2">
        {rows.map((c, i) => (
          <li key={i} className="rounded-xl border border-line bg-surface px-3 py-2 text-sm">
            {c.game} · {c.field}: {String(c.from)} → {String(c.to)}. {c.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Alerts({ data }: { data: Snapshot }) {
  const rows = data.alerts || [];
  return (
    <ul className="space-y-2">
      {rows.length === 0 ? <li className="text-sm text-muted">No alert thresholds are tripped.</li> : null}
      {rows.map((a) => (
        <li key={a.id} className="rounded-xl border border-line bg-surface px-3 py-2 text-sm">
          <span className="font-mono text-xs text-accent">{a.kind}</span>
          <span className="mt-1 block">{a.text}</span>
        </li>
      ))}
    </ul>
  );
}

function Method({ data }: { data: Snapshot }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      <p className="rounded-xl border border-line bg-surface p-3 font-semibold">{data.statusLine}</p>
      <p>
        {data.factorCount} factors and {data.hypothesisCount} pre-registered hypotheses. League environment on this pull:{" "}
        {data.league?.ppg?.toFixed(1)} ({data.league?.source}).
      </p>
      <p>
        Headline is the market. λ starts at 0.10. A model-versus-market gap is not an edge. Confidence describes sharpness, not a betting result.
        The backtest page is the protocol in the method note: tune through 2023–24, freeze on 2024–25, score 2025–26 once. That run has not happened.
      </p>
      <p>
        Comparable pages (ESPN preview, Action Network, Covers, Rotowire, Dimers) were not line-counted in a finished audit during this build. The 3×
        table stays unfinished rather than padded. See the method doc in the repo for the honest gap.
      </p>
    </div>
  );
}

function Health({ data }: { data: Snapshot }) {
  const fetches = data.source?.fetches || [];
  return (
    <div className="space-y-2">
      <p className="text-sm">Writer {data.source?.writer || "unknown"} · {fetches.length} calls on this snapshot.</p>
      <ul className="space-y-1">
        {fetches.map((f, i) => (
          <li key={i} className="rounded-lg border border-line bg-surface px-2 py-2 font-mono text-xs">
            {f.status} {f.bytes}b {f.ms}ms {f.url}
          </li>
        ))}
      </ul>
    </div>
  );
}
