#!/usr/bin/env python3
"""Bulk-upload Dou Sang photos into Moments (admin COS ticket → put → register + color)."""
from __future__ import annotations

import json
import mimetypes
import os
import sys
import time
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import urllib.error
import urllib.request

from PIL import Image
from qcloud_cos import CosConfig, CosS3Client

API = os.environ.get("BENDOUDOU_API", "http://192.168.0.176:8882").rstrip("/")
SRC = Path(
    os.environ.get(
        "MOMENTS_SRC",
        r"W:\人生备忘录-双备份-18tb-第二备份\人生备忘录-出于个人隐私请勿打开\三星s23+备份\dou",
    )
)
TOKEN_FILE = Path(__file__).resolve().parent / ".moments_upload_token"
STATE_FILE = Path(__file__).resolve().parent / ".moments_upload_state.json"
CONCURRENCY = int(os.environ.get("MOMENTS_UPLOAD_CONCURRENCY", "3"))
EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


def api(method: str, path: str, token: str, body: dict | None = None) -> dict:
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        API + path,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            raw = r.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", "replace")
        raise RuntimeError(f"{method} {path} -> {e.code}: {err[:500]}") from e


def load_state() -> dict:
    if STATE_FILE.is_file():
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    return {}


def save_state(state: dict) -> None:
    STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def rgb_to_hsl(r: int, g: int, b: int) -> tuple[float, float, float]:
    r_, g_, b_ = r / 255.0, g / 255.0, b / 255.0
    mx, mn = max(r_, g_, b_), min(r_, g_, b_)
    l = (mx + mn) / 2
    if mx == mn:
        return 0.0, 0.0, l * 100
    d = mx - mn
    s = d / (2 - mx - mn) if l > 0.5 else d / (mx + mn)
    if mx == r_:
        h = ((g_ - b_) / d + (6 if g_ < b_ else 0)) / 6
    elif mx == g_:
        h = ((b_ - r_) / d + 2) / 6
    else:
        h = ((r_ - g_) / d + 4) / 6
    return h * 360, s * 100, l * 100


def hsl_to_hex(h: float, s: float, l: float) -> str:
    s, l = s / 100.0, l / 100.0
    c = (1 - abs(2 * l - 1)) * s
    x = c * (1 - abs((h / 60) % 2 - 1))
    m = l - c / 2
    if h < 60:
        r, g, b = c, x, 0
    elif h < 120:
        r, g, b = x, c, 0
    elif h < 180:
        r, g, b = 0, c, x
    elif h < 240:
        r, g, b = 0, x, c
    elif h < 300:
        r, g, b = x, 0, c
    else:
        r, g, b = c, 0, x

    def to(v: float) -> str:
        return f"{round((v + m) * 255):02x}"

    return f"#{to(r)}{to(g)}{to(b)}"


def extract_colors(path: Path) -> dict:
    with Image.open(path) as im:
        im = im.convert("RGB")
        im.thumbnail((120, 120))
        pixels = list(im.getdata())
    buckets: dict[int, list[float]] = {}
    total_s = total_l = samples = 0
    for r, g, b in pixels:
        if r > 248 and g > 248 and b > 248:
            continue
        if r < 8 and g < 8 and b < 8:
            continue
        h, s, l = rgb_to_hsl(r, g, b)
        total_s += s
        total_l += l
        samples += 1
        if s < 10 or l < 8 or l > 92:
            continue
        bin_ = int(round(h / 15)) % 24
        cur = buckets.setdefault(bin_, [0.0, 0.0, 0.0])  # w,s,l
        cur[0] += 1
        cur[1] += s
        cur[2] += l
    avg_s = total_s / samples if samples else 0
    avg_l = total_l / samples if samples else 50
    ranked = []
    for bin_, (w, ss, ll) in buckets.items():
        h = (bin_ * 15) % 360
        s = ss / w
        l = ll / w
        ranked.append(
            {
                "hex": hsl_to_hex(h, s, l),
                "h": round(h),
                "s": round(s),
                "l": round(l),
                "w": int(w),
            }
        )
    ranked.sort(key=lambda x: x["w"], reverse=True)
    palette = ranked[:5]
    dominant = palette[0] if palette else None
    dominant_hue = None
    if dominant and avg_s >= 12 and dominant["s"] >= 12:
        dominant_hue = int(dominant["h"]) % 360
    return {
        "dominantHue": dominant_hue,
        "dominantSat": round(avg_s),
        "dominantLight": round(avg_l),
        "paletteJson": json.dumps(palette, ensure_ascii=False)[:1000],
        "width": None,
        "height": None,
    }


def image_size(path: Path) -> tuple[int | None, int | None]:
    try:
        with Image.open(path) as im:
            return im.size
    except Exception:
        return None, None


def upload_one(token: str, path: Path) -> dict:
    ext = path.suffix.lstrip(".").lower() or "jpg"
    if ext == "jpeg":
        ext = "jpg"
    ctype = mimetypes.guess_type(path.name)[0] or "image/jpeg"
    ticket = api(
        "POST",
        "/api/admin/moments/upload-ticket",
        token,
        {"ext": ext, "contentType": ctype},
    )
    key = ticket["objectKey"]
    cfg = CosConfig(
        Region=ticket["region"],
        SecretId=ticket["tmpSecretId"],
        SecretKey=ticket["tmpSecretKey"],
        Token=ticket.get("sessionToken") or None,
        Scheme="https",
    )
    client = CosS3Client(cfg)
    client.upload_file(
        Bucket=ticket["bucket"],
        Key=key,
        LocalFilePath=str(path),
        EnableMD5=False,
    )
    w, h = image_size(path)
    try:
        color = extract_colors(path)
    except Exception:
        color = {
            "dominantHue": None,
            "dominantSat": None,
            "dominantLight": None,
            "paletteJson": None,
        }
    color["width"] = w
    color["height"] = h
    reg = api(
        "POST",
        "/api/admin/moments",
        token,
        {
            "objectKey": key,
            "width": w,
            "height": h,
            "dominantHue": color["dominantHue"],
            "dominantSat": color["dominantSat"],
            "dominantLight": color["dominantLight"],
            "paletteJson": color["paletteJson"],
        },
    )
    return {"id": reg.get("id"), "objectKey": key, "file": path.name}


def main() -> int:
    if not TOKEN_FILE.is_file():
        print("missing token file", TOKEN_FILE, file=sys.stderr)
        return 2
    token = TOKEN_FILE.read_text(encoding="utf-8").strip()
    if not SRC.is_dir():
        print("missing src", SRC, file=sys.stderr)
        return 2
    files = sorted(
        p for p in SRC.iterdir() if p.is_file() and p.suffix.lower() in EXTS
    )
    state = load_state()
    pending = [p for p in files if state.get(p.name, {}).get("status") != "done"]
    print(f"total={len(files)} pending={len(pending)} concurrency={CONCURRENCY} api={API}")
    if not pending:
        print("nothing to do")
        return 0

    ok = fail = 0
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
        futs = {pool.submit(upload_one, token, p): p for p in pending}
        for i, fut in enumerate(as_completed(futs), 1):
            path = futs[fut]
            try:
                info = fut.result()
                state[path.name] = {"status": "done", **info}
                ok += 1
                print(f"[{i}/{len(pending)}] OK {path.name} -> id={info.get('id')}")
            except Exception as e:
                fail += 1
                state[path.name] = {"status": "error", "error": str(e)[:400]}
                print(f"[{i}/{len(pending)}] FAIL {path.name}: {e}")
                traceback.print_exc()
            if i % 5 == 0 or i == len(pending):
                save_state(state)
    save_state(state)
    elapsed = time.time() - t0
    print(f"done ok={ok} fail={fail} elapsed={elapsed:.1f}s")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
