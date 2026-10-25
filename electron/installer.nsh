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
