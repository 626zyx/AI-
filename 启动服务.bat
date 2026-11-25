@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在启动本地服务：http://127.0.0.1:8093/
start "" http://127.0.0.1:8093/
py serve.py --port 8093
