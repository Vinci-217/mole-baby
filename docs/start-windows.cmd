@echo off
chcp 65001 >nul
cd /d "%~dp0"
if exist "拉姆.exe" (
 start "" "%~dp0拉姆.exe"
 exit /b 0
)
if exist "拉姆兼容版.exe" (
 start "" "%~dp0拉姆兼容版.exe"
 exit /b 0
)
echo 找不到主程序。请右键 ZIP 选择全部解压，或下载 -Setup.exe 安装包。
echo Source code 源代码不是应用程序包。
pause
exit /b 1
