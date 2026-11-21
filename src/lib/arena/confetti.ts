/**
 * Safe wrapper for canvas-confetti.
 * If canvas-confetti is not yet installed in node_modules,
 * this function gracefully no-ops without crashing the application.
 */
export async function fireConfetti(options?: {
  particleCount?: number;
  spread?: number;
  origin?: { x: number; y: number };
  colors?: string[];
}) {
  try {
    const confettiModule = await import("canvas-confetti");
    const confetti = confettiModule.default || confettiModule;
    if (typeof confetti === "function") {
      confetti({
        particleCount: options?.particleCount ?? 80,
        spread: options?.spread ?? 70,
        origin: options?.origin ?? { y: 0.6, x: 0.5 },
        colors: options?.colors ?? ["#06b6d4", "#3b82f6", "#eab308", "#10b981", "#ec4899"],
      });
    }
  } catch {
    // Graceful fallback if canvas-confetti is not installed yet
    console.info("[Arena] Confetti will trigger once canvas-confetti is installed.");
  }
}

export function firePodiumCelebration() {
  void fireConfetti({ particleCount: 100, spread: 80, origin: { x: 0.5, y: 0.5 } });
  setTimeout(() => {
    void fireConfetti({ particleCount: 60, spread: 60, origin: { x: 0.2, y: 0.6 } });
    void fireConfetti({ particleCount: 60, spread: 60, origin: { x: 0.8, y: 0.6 } });
  }, 400);
}
