/**
 * 主循环：requestAnimationFrame 驱动，更新 + 渲染，并统计 FPS。
 */
export class Loop {
  private rafId = 0;
  private lastTime = 0;
  private fpsAccum = 0;
  private fpsFrames = 0;
  private running = false;

  /** 每帧回调，参数为秒级 delta。 */
  onUpdate: (dt: number) => void = () => {};
  /** FPS 变化回调（约每 0.5s 一次）。 */
  onFps: (fps: number) => void = () => {};

  start(): void {
    if (this.running) return; // 防止重复启动导致多套 rAF 循环叠加
    this.running = true;
    this.lastTime = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - this.lastTime) / 1000, 0.1); // 限制单帧步长，避免卡顿后跳变
      this.lastTime = now;

      this.onUpdate(dt);

      this.fpsAccum += dt;
      this.fpsFrames++;
      if (this.fpsAccum >= 0.5) {
        this.onFps(this.fpsFrames / this.fpsAccum);
        this.fpsAccum = 0;
        this.fpsFrames = 0;
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }
}
