; The standard finish callback opens a .lnk synchronously through Explorer.
; Hide the completed wizard first and CreateProcess directly for a normal
; current-user install. Never start an elevated pet from an elevated wizard.
!macro customFinishPage
  !ifndef HIDE_RUN_AFTER_FINISH
    Function MoleStartApp
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
  SetOutPath "$INSTDIR"
  ClearErrors
  CreateShortCut "$INSTDIR\${PRODUCT_FILENAME}.lnk" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
  ${If} ${Errors}
    MessageBox MB_OK|MB_ICONSTOP "无法创建安装目录中的启动入口，请检查安装目录的写入权限后重试。$\r$\n$INSTDIR"
    Abort
  ${EndIf}
  !ifndef DO_NOT_CREATE_START_MENU_SHORTCUT
    !insertmacro createMenuDirectory
    ClearErrors
    CreateShortCut "$newStartMenuLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
    ${If} ${Errors}
      MessageBox MB_OK|MB_ICONSTOP "无法创建开始菜单入口，请检查安装权限后重试。$\r$\n$newStartMenuLink"
      Abort
    ${EndIf}
  !endif
  !ifndef DO_NOT_CREATE_DESKTOP_SHORTCUT
    ${IfNot} ${isNoDesktopShortcut}
      ; Keep the user's choice to remove a desktop icon during automatic
      ; updates. Existing icons must always be repaired, even with KeepShortcuts.
      ${If} ${FileExists} "$newDesktopLink"
        ClearErrors
        CreateShortCut "$newDesktopLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
        ${If} ${Errors}
          MessageBox MB_OK|MB_ICONSTOP "无法修复桌面快捷方式，请检查桌面目录的写入权限后重试。$\r$\n$newDesktopLink"
          Abort
        ${EndIf}
      ${EndIf}
    ${EndIf}
  !endif
  System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
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
