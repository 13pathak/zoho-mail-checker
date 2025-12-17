@echo off
echo Adding resolved file... > final_sync_log.txt
git add .gitignore >> final_sync_log.txt 2>&1

echo Committing merge... >> final_sync_log.txt
git commit -m "Merge remote-tracking branch 'origin/main' into main" >> final_sync_log.txt 2>&1

echo Pushing to remote... >> final_sync_log.txt
git push origin main >> final_sync_log.txt 2>&1

echo Done. >> final_sync_log.txt
