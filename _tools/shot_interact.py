"""交互态截图：新建/复测弹窗、更多下拉、选择对比任务、方法抽屉、新建题库。
跑法：python _tools/shot_interact.py"""
import functools, http.server, os, socketserver, threading, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "_shots")
PORT = 8901

def serve():
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    s = socketserver.TCPServer(("127.0.0.1", PORT), h)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s

STEPS = [
    ("x-new", "#/exercise/tasks", "App.newTask('model');document.getElementById('wiz-strategy').value='stg-advbench-base';document.getElementById('wiz-strategy').dispatchEvent(new Event('change'))"),
    ("x-retest", "#/exercise/tasks", "App.retest('task-tgt-qwen-flash')"),
    ("x-more", "#/exercise/tasks", "document.querySelector('.dd .link-btn').click()"),
    ("x-pick", "#/exercise/results", "App.compareOpen('task-tgt-qwen-flash');App.comparePick('task-tgt-deepseek-chat')"),
    ("x-method", "#/strategy/methods", "App.openMethod('PAIR')"),
    ("x-bank", "#/strategy/banks", "App.openBank('bank-advbench')"),
    ("x-report", "#/exercise/report-detail/task-tgt-deepseek-chat", "App.rpTab('analysis')"),
    ("x-units", "#/exercise/report-detail/task-tgt-deepseek-chat", "App.rpTab('detail');App.rdPick('task-tgt-deepseek-chat','u-task-tgt-deepseek-chat-Direct-001',true)"),
    ("x-unit", "#/exercise/report-detail/task-tgt-deepseek-chat", "App.openUnit('task-tgt-deepseek-chat','u-task-tgt-deepseek-chat-PAIR-001')"),
    ("x-rpexport", "#/exercise/report-detail/task-tgt-deepseek-chat", "App.popToggle(new Event('click'),'rp-export')"),
    ("x-compare", "#/exercise/compare/task-tgt-qwen-flash~task-tgt-deepseek-chat", ""),
    ("x-detail", "#/exercise/task-detail/task-tgt-deepseek-chat", ""),
    ("x-newbank", "#/strategy/banks", "App.newBank()"),
]

def main():
    os.makedirs(OUT, exist_ok=True)
    srv = serve(); time.sleep(0.4); errs = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1560, "height": 1000}, device_scale_factor=2)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        for name, h, js in STEPS:
            pg.goto(f"http://127.0.0.1:{PORT}/index.html{h}", wait_until="networkidle")
            pg.wait_for_timeout(300)
            pg.evaluate(f"() => {{ {js} }}")
            pg.wait_for_timeout(300)
            pg.screenshot(path=os.path.join(OUT, f"{name}.png"))
            print(name)
        b.close()
    srv.shutdown()
    print("\n".join(errs) if errs else "无控制台错误")

if __name__ == "__main__":
    main()
