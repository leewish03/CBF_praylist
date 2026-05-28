@echo off
git add -A
git commit -m "feat: add OG/Twitter card meta tags and og-image for rich link preview"
git push
del "%~f0"
