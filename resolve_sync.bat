@echo off
echo Pulling to merge remote changes... > resolve_log.txt
git pull origin main --no-edit >> resolve_log.txt 2>&1

echo Pushing merged changes... >> resolve_log.txt
git push origin main >> resolve_log.txt 2>&1

echo Done. >> resolve_log.txt
