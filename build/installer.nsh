!include "WinVer.nsh"

!macro customInit
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_OK|MB_ICONSTOP "YAWPS requires Windows 10 or Windows 11.$\r$\n$\r$\nYour operating system is not supported. Modern PHP runtimes, NTFS junctions, and system APIs require Windows 10 or later.$\r$\n$\r$\nPlease upgrade to Windows 10 or 11 to install YAWPS."
    Quit
  ${EndIf}
!macroend

!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION "Do you want to unlink YAWPS from your Windows User PATH?" IDNO skipPathCleanup
    nsExec::Exec 'powershell.exe -NoProfile -WindowStyle Hidden -Command "$current1 = \"$env:USERPROFILE\.yawps\current\"; $current2 = \"$env:USERPROFILE\.win-php\current\"; $old = [Environment]::GetEnvironmentVariable(''Path'', ''User''); $parts = $old -split '';'' | Where-Object { $_ -ne '''' -and $_ -ne $current1 -and $_ -ne $current2 -and $_ -ne ''System.Object[]'' }; [Environment]::SetEnvironmentVariable(''Path'', ($parts -join '';''), ''User''); if (Test-Path $current1) { Remove-Item -Force $current1 }; if (Test-Path $current2) { Remove-Item -Force $current2 }"'
  skipPathCleanup:

  MessageBox MB_YESNO|MB_ICONQUESTION "Do you also want to permanently delete all downloaded PHP runtimes and data in %USERPROFILE%\.yawps?" IDNO skipPurge
    RMDir /r "$PROFILE\.yawps"
    RMDir /r "$PROFILE\.win-php"
  skipPurge:
!macroend
