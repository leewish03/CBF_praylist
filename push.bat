@echo off
git add -A
git commit -m "fix: OOM - sequential Google Sheets calls + singleton service + cache_discovery=False"
git push
del "%~f0"
