@echo off
echo Cleaning up old builds...
rmdir /s /q dist

echo Building TimeTracker Agent Desktop Executable...
call npm run build

echo =========================================================
echo Done! 
echo The installer executable (.exe) is located in the 'dist' 
echo folder. You can distribute that Setup.exe to employees.
echo =========================================================
pause
