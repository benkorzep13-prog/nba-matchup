import { useEffect, useState } from "react";

const DB = "nba-matchup";
const STORE = "snapshots";

export type LoadState = {
  snapshot: SlateSnapshot | null;
  source: string;
  error: string | null;
  espnStatus: string;
  updatedAt: number;
};

type SlateSnapshot = {
  generatedAt: string;
  slateDate: string;
  label: string;
  statusLine: string;
  games: Array<{ id: string; status?: string; homeScore?: number | null; awayScore?: number | null; clock?: string | null }>;
  [key: string]: unknown;
};

function idbGet(): Promise<SlateSnapshot | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE);
      };
      req.onerror = () => resolve(null);
      req.onsuccess = () => {
        const tx = req.result.transaction(STORE, "readonly");
        const g = tx.objectStore(STORE).get("latest");
        g.onsuccess = () => resolve((g.result as SlateSnapshot) || null);
        g.onerror = () => resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

function idbSet(snapshot: SlateSnapshot) {
  try {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => {
      const tx = req.result.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(snapshot, "latest");
    };
  } catch {
    /* cache is optional */
  }
}

async function fetchSnapshot(): Promise<{ snapshot: SlateSnapshot; source: string } | null> {
  const urls = ["/data/latest.json", "/site/data/latest.json"];
  const attempts = urls.map(async (url) => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const snapshot = (await res.json()) as SlateSnapshot;
    if (!snapshot?.generatedAt) throw new Error("shape");
    return { snapshot, source: url };
  });
  try {
    return await Promise.any(attempts);
  } catch {
    return null;
  }
}

async function overlayScores(snapshot: SlateSnapshot): Promise<{ snapshot: SlateSnapshot; espnStatus: string }> {
  return { snapshot, espnStatus: "scores on the snapshot" };
}

export function useSlate(initial: SlateSnapshot | null): LoadState {
  const [state, setState] = useState<LoadState>({
    snapshot: initial,
    source: initial ? "server snapshot" : "loading",
    error: null,
    espnStatus: initial ? "scores on the snapshot" : "pending",
    updatedAt: 0,
  });

  useEffect(() => {
    let stop = false;
    async function load(reason: string) {
      const net = await fetchSnapshot();
      const base = net?.snapshot || (await idbGet());
      if (stop) return;
      if (!base) {
        if (!initial) {
          setState({
            snapshot: null,
            source: "none",
            error: "No snapshot and no saved copy.",
            espnStatus: "not requested",
            updatedAt: Date.now(),
          });
        }
        return;
      }
      if (net) idbSet(net.snapshot);
      const merged = await overlayScores(base);
      if (stop) return;
      setState({
        snapshot: merged.snapshot,
        source: net ? `${net.source} · ${reason}` : "IndexedDB last-good",
        error: net ? null : "Snapshot URLs failed. Showing the on-phone copy.",
        espnStatus: merged.espnStatus,
        updatedAt: Date.now(),
      });
    }
    void load("refresh");
    const scoreTimer = window.setInterval(() => {
      setState((cur) => {
        if (!cur.snapshot) return cur;
        void overlayScores(cur.snapshot).then((merged) => {
          if (!stop) {
            setState((prev) => ({
              ...prev,
              snapshot: merged.snapshot,
              espnStatus: merged.espnStatus,
              updatedAt: Date.now(),
            }));
          }
        });
        return cur;
      });
    }, 60_000);
    const snapTimer = window.setInterval(() => void load("20-minute snapshot refetch"), 20 * 60_000);
    return () => {
      stop = true;
      window.clearInterval(scoreTimer);
      window.clearInterval(snapTimer);
    };
  }, [initial?.generatedAt]);

  return state;
}
