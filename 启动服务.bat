@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在启动本地服务：http://127.0.0.1:8080/
start "" http://127.0.0.1:8080/
py _tools\serve.py
