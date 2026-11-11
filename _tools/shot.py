"""截图：起本地服务，逐路由截图。
跑法：python _tools/shot.py
"""
import functools
import http.server
import os
import socketserver
import threading
import time

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "_shots")
PORT = 8899

ROUTES = [
    ("posture-home", "#/posture/home"),
    ("tasks", "#/exercise/tasks"),
    ("task-detail", "#/exercise/task-detail/task-tgt-deepseek-chat"),
    ("drafts", "#/exercise/drafts"),
    ("results", "#/exercise/results"),
    ("reports", "#/exercise/reports"),
    ("report-detail", "#/exercise/report-detail/task-tgt-qwen-flash"),
    ("strategy-attack", "#/strategy/attack"),
    ("strategy-methods", "#/strategy/methods"),
    ("strategy-banks", "#/strategy/banks"),
    ("compare", "#/exercise/compare/task-tgt-qwen-flash~task-tgt-deepseek-chat"),
    ("strategy-guard", "#/strategy/guard"),
    ("assets-models", "#/assets/models"),
    ("risk-asr", "#/risk/asr"),
]


def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def main():
    os.makedirs(OUT, exist_ok=True)
    srv = serve()
    time.sleep(0.4)
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1560, "height": 1000}, device_scale_factor=2)
        page.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

        for name, hash_ in ROUTES:
            page.goto(f"http://127.0.0.1:{PORT}/index.html{hash_}", wait_until="networkidle")
            page.wait_for_timeout(400)
            path = os.path.join(OUT, f"{name}.png")
            page.screenshot(path=path, full_page=False)
            print(f"{name:18s} -> {os.path.basename(path)}")
        browser.close()
    srv.shutdown()
    if errors:
        print("\n--- 控制台错误 ---")
        for e in dict.fromkeys(errors):
            print(e)
    else:
        print("\n无控制台错误")


if __name__ == "__main__":
    main()
