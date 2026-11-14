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
echo 当前目录：%~dp0
echo 安装版可直接重新运行 Setup.exe 覆盖修复，无需先卸载，勿删除用户存档。
echo 如果之前可以启动，请在 Windows 安全中心的保护历史记录中检查主程序是否被移除。
echo Source code 源代码不是应用程序包。
pause
exit /b 1
