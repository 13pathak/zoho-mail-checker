@echo off
echo Setting remote URL... > sync_log.txt
git remote set-url origin https://github.com/13pathak/zoho-mail-checker.git >> sync_log.txt 2>&1

echo Pulling from remote... >> sync_log.txt
git pull origin main --no-edit >> sync_log.txt 2>&1

echo Committing local changes... >> sync_log.txt
git commit -m "Sync local changes: Update icons and config" >> sync_log.txt 2>&1

echo Pushing to remote... >> sync_log.txt
git push origin main >> sync_log.txt 2>&1

echo Done. >> sync_log.txt
