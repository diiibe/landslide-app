/** Serial polling: no overlap; hidden tabs pause, visibility resumes a fresh read. */
export function startPolling(
  task: (signal: AbortSignal) => Promise<void>,
  automatic: boolean,
): () => void {
  const ac = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined,
    running = false;
  async function run() {
    if (ac.signal.aborted || running) return;
    if (timer) clearTimeout(timer);
    if (document.hidden && automatic) return;
    running = true;
    try {
      await task(ac.signal);
    } finally {
      running = false;
      if (automatic && !ac.signal.aborted && !document.hidden)
        timer = setTimeout(() => void run(), 60000);
    }
  }
  const visible = () => {
    if (!document.hidden && automatic) void run();
    else if (timer) clearTimeout(timer);
  };
  document.addEventListener("visibilitychange", visible);
  void run();
  return () => {
    ac.abort();
    if (timer) clearTimeout(timer);
    document.removeEventListener("visibilitychange", visible);
  };
}
