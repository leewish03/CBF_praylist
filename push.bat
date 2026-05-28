@echo off
git add -A
git commit -m "fix: ReferenceError - replace deleted fetchConfig with fetchPrayers in JSX"
git push
del "%~f0"
