@echo off
git add -A
git commit -m "fix: assignments now fully dynamic from Google Sheets - no hardcoding"
git push
del "%~f0"
