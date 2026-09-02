#!/usr/bin/env python3
"""Ensure aimatex-music/secrets/bendoudou.env exists with required keys (no UTF-8 BOM)."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "secrets" / "bendoudou.env"
REQUIRED = [
    "TENCENTCLOUD_SECRET_ID",
    "TENCENTCLOUD_SECRET_KEY",
    "BENDOUDOU_NETEASE_MUSIC_U",
    "BENDOUDOU_NETEASE_CSRF",
    "SPRING_MAIL_USERNAME",
    "SPRING_MAIL_PASSWORD",
]
CANDIDATES = [
    ROOT / "secrets" / "bendoudou.env",
    Path(r"F:\dev\proj2\bendoudoudounai\secrets\bendoudou.env"),
    ROOT.parent / "bendoudoudounai" / "secrets" / "bendoudou.env",
]


def parse_env(text: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip()
    return out


def write_env(path: Path, data: dict[str, str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [f"{k}={data[k]}" for k in REQUIRED if k in data and data[k]]
    # keep any extra keys
    for k, v in data.items():
        if k not in REQUIRED and v:
            lines.append(f"{k}={v}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")  # no BOM


def main() -> int:
    source_data: dict[str, str] = {}
    source_path: Path | None = None
    for cand in CANDIDATES:
        if not cand.is_file():
            continue
        source_path = cand
        source_data = parse_env(cand.read_text(encoding="utf-8-sig"))
        break

    if not source_data:
        print("ERROR: no secrets source found. Create secrets/bendoudou.env", file=sys.stderr)
        print("Required keys:", ", ".join(REQUIRED), file=sys.stderr)
        return 1

    missing = [k for k in REQUIRED if not source_data.get(k)]
    if missing:
        print(f"ERROR: source {source_path} missing: {', '.join(missing)}", file=sys.stderr)
        return 1

    write_env(DEST, source_data)
    print(f"OK wrote {DEST} (from {source_path})")
    for k in REQUIRED:
        print(f"  {k}=<set len={len(source_data[k])}>")
    print("Restart the backend from repo root so ./secrets/bendoudou.env is loaded.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
