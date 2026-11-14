; The standard finish callback opens a .lnk synchronously through Explorer.
; Hide the completed wizard first and CreateProcess directly for a normal
; current-user install. Never start an elevated pet from an elevated wizard.
!macro customFinishPage
  !ifndef HIDE_RUN_AFTER_FINISH
    Function MoleStartApp
      ${IfNot} ${FileExists} "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
        MessageBox MB_OK|MB_ICONSTOP "无法启动：主程序不存在。请用本安装包覆盖修复，勿删除存档。$\r$\n$INSTDIR\${APP_EXECUTABLE_FILENAME}"
        Return
      ${EndIf}
      HideWindow
      ${If} ${isUpdated}
        StrCpy $1 "--updated"
      ${Else}
        StrCpy $1 ""
      ${EndIf}
      SetOutPath "$INSTDIR"
      ${If} ${UAC_IsAdmin}
        ; Keep Explorer's original user token for elevated/all-users installs.
        ${StdUtils.ExecShellAsUser} $0 "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "open" "$1"
      ${Else}
        ClearErrors
        Exec '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" $1'
        ${If} ${Errors}
          ShowWindow $HWNDPARENT ${SW_SHOW}
          MessageBox MB_OK|MB_ICONINFORMATION "Please open the app from its desktop shortcut."
        ${EndIf}
      ${EndIf}
    FunctionEnd
    !define MUI_FINISHPAGE_RUN
    !define MUI_FINISHPAGE_RUN_FUNCTION "MoleStartApp"
  !endif
  !insertmacro MUI_PAGE_FINISH
!macroend

; electron-builder preserves existing .lnk files on upgrades. An old shortcut
; can therefore survive with a missing target even after a successful install.
; Resolve every entry against the final installation directory and repair it
; after the standard installer has finished extracting/registering the app.
!macro customInstall
  StrCpy $appExe "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  ${IfNot} ${FileExists} "$appExe"
    MessageBox MB_OK|MB_ICONSTOP "主程序未成功安装或已被系统移除。请保留存档，检查 Windows 安全中心的保护历史记录，再重新运行安装包。$\r$\n安装目录：$INSTDIR$\r$\n主程序：${APP_EXECUTABLE_FILENAME}"
    Abort
  ${EndIf}
  ${IfNot} ${FileExists} "$INSTDIR\resources\app.asar"
    MessageBox MB_OK|MB_ICONSTOP "应用文件未完整写入，不能完成安装。请保留存档后重试。$\r$\n$INSTDIR\resources\app.asar"
    Abort
  ${EndIf}
  ClearErrors
  FileOpen $R0 "$appExe" r
  ${If} ${Errors}
    MessageBox MB_OK|MB_ICONSTOP "主程序无法读取，不能完成安装。请检查磁盘权限后覆盖安装。存档无需删除。$\r$\n$appExe"
    Abort
  ${EndIf}
  FileSeek $R0 0 END $R1
  FileClose $R0
  ${If} $R1 < 1000000
    MessageBox MB_OK|MB_ICONSTOP "主程序不完整，不能完成安装。请重新下载安装包并覆盖安装，存档会保留。$\r$\n$appExe"
    Abort
  ${EndIf}
  SetOutPath "$INSTDIR"
  ClearErrors
  CreateShortCut "$INSTDIR\${PRODUCT_FILENAME}.lnk" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
  ${If} ${Errors}
    MessageBox MB_OK|MB_ICONSTOP "无法创建安装目录中的启动入口，请检查安装目录的写入权限后重试。$\r$\n$INSTDIR"
    Abort
  ${EndIf}
  WinShell::SetLnkAUMI "$INSTDIR\${PRODUCT_FILENAME}.lnk" "${APP_ID}"
  !ifndef DO_NOT_CREATE_START_MENU_SHORTCUT
    !insertmacro createMenuDirectory
    ClearErrors
    CreateShortCut "$newStartMenuLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
    ${If} ${Errors}
      MessageBox MB_OK|MB_ICONSTOP "无法创建开始菜单入口，请检查安装权限后重试。$\r$\n$newStartMenuLink"
      Abort
    ${EndIf}
    WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"
  !endif
  !ifndef DO_NOT_CREATE_DESKTOP_SHORTCUT
    ${IfNot} ${isNoDesktopShortcut}
      ; The application requests createDesktopShortcut=always. Recreate an
      ; absent entry too, unless /NoDesktopShortcut was explicitly requested.
        ClearErrors
        CreateShortCut "$newDesktopLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
        ${If} ${Errors}
          MessageBox MB_OK|MB_ICONSTOP "无法修复桌面快捷方式，请检查桌面目录的写入权限后重试。$\r$\n$newDesktopLink"
          Abort
        ${EndIf}
        WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
    ${EndIf}
  !endif
  System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
  FileOpen $R0 "$INSTDIR\安装入口检查.txt" w
  FileWriteUTF16LE $R0 "主程序：$appExe$\r$\n工作目录：$INSTDIR$\r$\n桌面入口：$newDesktopLink$\r$\n开始菜单：$newStartMenuLink$\r$\n主程序及 resources\app.asar 已通过安装完成检查。$\r$\n若以后提示主程序不存在，请保留存档并覆盖修复安装；设置中的本地存档检查可显示真实存档目录。$\r$\n"
  FileClose $R0
!macroend
; Explain the supported edition before extracting an incompatible runtime.
!macro customInit
  !ifdef MOLE_LEGACY_WINDOWS
    ${IfNot} ${AtLeastWin7}
      MessageBox MB_OK|MB_ICONSTOP "This compatibility edition requires Windows 7 SP1, 8, 8.1 or newer."
      Quit
    ${EndIf}
    ${If} ${IsWin7}
      ${AndIfNot} ${AtLeastServicePack} 1
      MessageBox MB_OK|MB_ICONSTOP "Please install Windows 7 Service Pack 1 before installing this compatibility edition."
      Quit
    ${EndIf}
  !else
    ${IfNot} ${AtLeastWin10}
      MessageBox MB_OK|MB_ICONSTOP "This edition requires Windows 10 or 11 (64-bit). For Windows 7 SP1, 8 or 8.1, download the legacy x64 or ia32 compatibility installer from the release page."
      Quit
    ${EndIf}
  !endif
!macroend
