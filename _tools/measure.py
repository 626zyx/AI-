"""量所有页面的标题位置与按钮高度，验证全局对齐。"""
import functools, http.server, os, socketserver, threading, time, json
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8905
ROUTES = [
 ("posture","#/posture/home"),("tasks","#/exercise/tasks"),
 ("task-detail","#/exercise/task-detail/task-tgt-deepseek-chat"),
 ("results","#/exercise/results"),("reports","#/exercise/reports"),
 ("report-detail","#/exercise/report-detail/task-tgt-qwen-flash"),
 ("strategy-attack","#/strategy/attack"),("strategy-guard","#/strategy/guard"),
 ("assets","#/assets/models"),("risk","#/risk/asr"),
]
def serve():
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    s = socketserver.TCPServer(("127.0.0.1", PORT), h)
    threading.Thread(target=s.serve_forever, daemon=True).start(); return s
srv = serve(); time.sleep(0.4)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width":1560,"height":1000})
    base=f"http://127.0.0.1:{PORT}/index.html"
    print(f"{'route':16s} {'titleX':>7s} {'titleY':>7s} {'sideW':>6s} {'btnH':>5s}")
    for name,h in ROUTES:
        pg.goto(base+h, wait_until="networkidle"); pg.wait_for_timeout(250)
        d = pg.evaluate("""() => {
          const t = document.querySelector('.page-heading h1');
          const r = t ? t.getBoundingClientRect() : null;
          const side = document.querySelector('.app-sidebar').getBoundingClientRect();
          const btns = [...document.querySelectorAll('.page-heading .btn')].map(b=>b.getBoundingClientRect().height);
          return {x: r?Math.round(r.x):-1, y: r?Math.round(r.y):-1, sw: Math.round(side.width), bh: btns.length? Math.round(btns[0]): 0};
        }""")
        print(f"{name:16s} {d['x']:7d} {d['y']:7d} {d['sw']:6d} {d['bh']:5d}")
    b.close()
srv.shutdown()
