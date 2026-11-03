"""Small I/O helpers: manifest, JSON, downloads with caching."""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

import yaml

from . import config


def read_manifest() -> dict:
    if config.MANIFEST.exists():
        return yaml.safe_load(config.MANIFEST.read_text(encoding="utf-8")) or {}
    return {}


def update_manifest(section: str, values: dict) -> None:
    m = read_manifest()
    m.setdefault(section, {}).update(values)
    m["updated"] = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    config.MANIFEST.write_text(yaml.safe_dump(m, sort_keys=True, allow_unicode=True), encoding="utf-8")


def write_json(path: Path, obj, compact: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    kw = {"separators": (",", ":")} if compact else {"indent": 2}
    path.write_text(json.dumps(obj, ensure_ascii=False, **kw), encoding="utf-8")


def download(url: str, dest: Path, chunk: int = 1 << 20) -> Path:
    """Download once; later runs reuse the cached file unless FORCE=1."""
    import requests

    if dest.exists() and not config.force():
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    with requests.get(url, stream=True, timeout=120) as r:
        r.raise_for_status()
        with open(tmp, "wb") as f:
            for block in r.iter_content(chunk):
                f.write(block)
    tmp.rename(dest)
    return dest


def done(path: Path) -> bool:
    """True when a stage output exists and we are not forcing a rebuild."""
    return path.exists() and not config.force()
