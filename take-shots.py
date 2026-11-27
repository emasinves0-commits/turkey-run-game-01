#!/usr/bin/env python3
"""Take the game's screenshots with the invisible-playwright Firefox build.

Usage: take-shots.py [--port 8080] [--seed 7] [--out DIR]
Reads shots.json next to the repo root for the shot list (name + query).
Each shot loads the game at 1280x720, waits for window.__shotReady, and saves a
JPEG (quality 82, kept under the 256 KiB gate cap). Prints console errors too.
"""
import argparse, json, os, sys
from urllib.parse import urlparse
sys.path.insert(0, "/home/hatch/workspace/spider-ai/venv/lib/python3.12/site-packages")
from invisible_playwright import InvisiblePlaywright

def _proxy_from_env():
    # The VM has no direct egress: the geo/egress-IP discovery in the launcher
    # hangs without a proxy (27 Nov: 3/3 IP endpoints read_timeout). Pass the
    # runtime egress proxy through so discovery (and any fetch) works.
    raw = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY") or ""
    if not raw:
        return None
    parts = urlparse(raw)
    proxy = {"server": f"{parts.scheme}://{parts.hostname}:{parts.port}"}
    if parts.username:
        proxy["username"] = parts.username
    if parts.password:
        proxy["password"] = parts.password
    return proxy

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8080)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--out", default="/home/hatch/workspace/makefun/turkey-run-game-01/screenshots")
    ap.add_argument("--root", default="/home/hatch/workspace/makefun/turkey-run-game-01")
    args = ap.parse_args()
    shots = json.load(open(f"{args.root}/shots.json"))
    with InvisiblePlaywright(seed=7, headless=True, proxy=_proxy_from_env(),
                              timezone="Asia/Jakarta", locale="en-US") as browser:
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        errors = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        for shot in shots:
            query = shot["query"]
            if "&seed=" not in query:
                query += f"&seed={args.seed}"
            url = f"http://127.0.0.1:{args.port}/{query}"
            page.goto(url)
            try:
                page.wait_for_function("window.__shotReady === true", timeout=60000)
            except Exception as e:
                print(f"[{shot['name']}] TIMEOUT waiting for __shotReady: {e}")
                print("  console errors:", errors)
                continue
            page.wait_for_timeout(300)
            out = f"{args.out}/{shot['name']}"
            page.screenshot(path=out, type="jpeg", quality=82)
            print(f"[{shot['name']}] saved -> {out}")
        if errors:
            print("CONSOLE ERRORS:")
            for e in errors:
                print("  ", e)

if __name__ == "__main__":
    main()
