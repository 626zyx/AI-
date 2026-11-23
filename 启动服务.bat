@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (
  echo 请先安装 Python 3，然后重新打开此文件。
  pause
  exit /b 1
)
echo 正在启动本地服务：http://127.0.0.1:8093/
start "" http://127.0.0.1:8093/
py -3 -c "import http.server; http.server.SimpleHTTPRequestHandler.extensions_map.update({'.js':'text/javascript','.css':'text/css','.json':'application/json'}); http.server.ThreadingHTTPServer(('127.0.0.1',8093),http.server.SimpleHTTPRequestHandler).serve_forever()"
pause
