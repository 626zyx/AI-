"""统计全站带框按钮的宽度种类。"""
import functools, http.server, os, socketserver, threading, time
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT=8909
ROUTES=["#/posture/home","#/exercise/tasks","#/exercise/task-detail/task-tgt-deepseek-chat",
 "#/exercise/results","#/exercise/reports","#/exercise/report-detail/task-tgt-qwen-flash",
 "#/strategy/attack","#/strategy/guard","#/assets/models","#/risk/asr"]
def serve():
    h=functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address=True
    s=socketserver.TCPServer(("127.0.0.1",PORT),h); threading.Thread(target=s.serve_forever,daemon=True).start(); return s
srv=serve(); time.sleep(0.4); seen={}
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1560,"height":1000})
    base=f"http://127.0.0.1:{PORT}/index.html"
    for h in ROUTES:
        pg.goto(base+h, wait_until="networkidle"); pg.wait_for_timeout(200)
        for t in pg.evaluate("""() => [...document.querySelectorAll('.page-heading .btn')].map(b=>
            ({t:b.textContent.trim(), w:Math.round(b.getBoundingClientRect().width), h:Math.round(b.getBoundingClientRect().height)}))"""):
            seen.setdefault((t['w'],t['h']),[]).append(t['t'])
    b.close()
srv.shutdown()
for k,v in sorted(seen.items()):
    print(f"{k[0]}x{k[1]}  {len(v)} 处  {sorted(set(v))}")
