"""验证筛选框输入时不丢焦点、不丢光标。"""
import functools, http.server, os, socketserver, threading, time
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT=8911
def serve():
    h=functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address=True
    s=socketserver.TCPServer(("127.0.0.1",PORT),h); threading.Thread(target=s.serve_forever,daemon=True).start(); return s
srv=serve(); time.sleep(0.4)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1560,"height":1000})
    base=f"http://127.0.0.1:{PORT}/index.html"
    pg.goto(base+"#/exercise/tasks", wait_until="networkidle"); pg.wait_for_timeout(300)
    box = pg.locator("#tk-q")
    box.click(); box.type("Qwen", delay=90); pg.wait_for_timeout(400)
    st = pg.evaluate("""() => ({id: document.activeElement.id, val: document.querySelector('#tk-q').value,
        rows: document.querySelectorAll('table.grid tbody tr').length})""")
    print("任务列表搜索:", st)
    pg.goto(base+"#/exercise/results", wait_until="networkidle"); pg.wait_for_timeout(300)
    box = pg.locator("#rs-q"); box.click(); box.type("Qwen", delay=90); pg.wait_for_timeout(400)
    st = pg.evaluate("""() => ({id: document.activeElement.id, val: document.querySelector('#rs-q').value,
        rows: document.querySelectorAll('table.grid tbody tr').length})""")
    print("结果列表搜索:", st)
    b.close()
srv.shutdown()
