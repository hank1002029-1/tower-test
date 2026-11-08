/**
 * 中文 3D 文字工具：使用 Canvas 2D 绘制文字 → CanvasTexture → 贴到 Plane 上。
 * 这是 Unity TextMesh 在 Web 端的替代方案，可支持任意中文/字体，且可缓存复用。
 */
import * as THREE from "three";
import { COLORS } from "../config/gameConfig";

export interface TextOptions {
  /** 画布分辨率（越大越清晰，注意显存/性能）。 */
  fontSize?: number;
  /** 文字颜色。 */
  color?: string;
  /** 描边颜色。 */
  strokeColor?: string;
  /** 描边宽度（像素）。 */
  strokeWidth?: number;
  /** 背景色，默认透明。 */
  background?: string;
  /** 平面在世界中的高度（世界单位）。宽度按画布比例自动计算。 */
  planeHeight?: number;
  /** 是否加发光（用于武将激活表现）。 */
  glow?: boolean;
}

/** 文字纹理缓存，key 由内容+样式组成，避免重复绘制。 */
const textureCache = new Map<string, { tex: THREE.CanvasTexture; aspect: number }>();

/** 生成（或复用）一张文字贴图，返回贴图与其宽高比。 */
export function getTextTexture(
  text: string,
  opts: Required<Pick<TextOptions, "fontSize" | "color" | "strokeColor" | "strokeWidth" | "glow">> &
    Pick<TextOptions, "background">
): { tex: THREE.CanvasTexture; aspect: number } {
  const key = `${text}|${opts.fontSize}|${opts.color}|${opts.strokeColor}|${opts.strokeWidth}|${opts.glow}|${opts.background ?? "none"}`;
  const hit = textureCache.get(key);
  if (hit) return hit;

  const fontSize = opts.fontSize;
  const pad = Math.ceil(fontSize * 0.25 + opts.strokeWidth);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  const font = `bold ${fontSize}px "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif`;
  ctx.font = font;
  const metrics = ctx.measureText(text);
  const textW = Math.ceil(metrics.width);

  canvas.width = textW + pad * 2;
  canvas.height = fontSize + pad * 2;

  // 尺寸变更后需重设 font（canvas resize 会重置上下文状态）
  if (opts.background) {
    ctx.fillStyle = opts.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (opts.glow) {
    ctx.shadowColor = opts.color;
    ctx.shadowBlur = fontSize * 0.5;
  }

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  if (opts.strokeWidth > 0) {
    ctx.lineWidth = opts.strokeWidth;
    ctx.strokeStyle = opts.strokeColor;
    ctx.lineJoin = "round";
    ctx.strokeText(text, cx, cy);
  }
  ctx.fillStyle = opts.color;
  ctx.fillText(text, cx, cy);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;

  const result = { tex, aspect: canvas.width / canvas.height };
  textureCache.set(key, result);
  return result;
}

/**
 * 创建一个文字平面 Mesh（带透明贴图，双面/贴地放置）。
 * 返回的 Mesh 尺寸：高度 = planeHeight，宽度 = planeHeight * aspect。
 */
export function makeTextMesh(text: string, options: TextOptions = {}): THREE.Mesh {
  const opts = {
    fontSize: options.fontSize ?? 128,
    color: options.color ?? COLORS.textDefault,
    strokeColor: options.strokeColor ?? COLORS.textStroke,
    strokeWidth: options.strokeWidth ?? 6,
    glow: options.glow ?? false,
    background: options.background,
  };
  const { tex, aspect } = getTextTexture(text, opts);

  const h = options.planeHeight ?? 0.9;
  const w = h * aspect;
  const geo = new THREE.PlaneGeometry(w, h);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 1;
  return mesh;
}

/** 清除文字纹理缓存（一般不需要调用）。 */
export function clearTextCache(): void {
  for (const { tex } of textureCache.values()) tex.dispose();
  textureCache.clear();
}
