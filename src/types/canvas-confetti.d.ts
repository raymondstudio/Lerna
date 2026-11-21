declare module "canvas-confetti" {
  export interface ConfettiOptions {
    particleCount?: number;
    angle?: number;
    spread?: number;
    startVelocity?: number;
    decay?: number;
    gravity?: number;
    drift?: number;
    flat?: boolean;
    ticks?: number;
    origin?: {
      x?: number;
      y?: number;
    };
    colors?: string[];
    shapes?: Array<"square" | "circle">;
    scalar?: number;
    zIndex?: number;
    disableForReducedMotion?: boolean;
  }

  const confetti: {
    (options?: ConfettiOptions): Promise<null> | null;
    create(
      canvas: HTMLCanvasElement,
      options?: { resize?: boolean; useWorker?: boolean }
    ): (options?: ConfettiOptions) => Promise<null> | null;
    reset(): void;
  };

  export default confetti;
}
