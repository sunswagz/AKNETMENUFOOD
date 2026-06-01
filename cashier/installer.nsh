; AKNet Cashier - Custom NSIS installer header
; Tùy chỉnh giao diện installer

!macro customHeader
  !system "echo Building AKNet Cashier Installer..."
!macroend

!macro customInit
  ; Kiểm tra Windows version
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_OK|MB_ICONEXCLAMATION "AKNet Cashier yêu cầu Windows 10 trở lên!"
    Abort
  ${EndIf}
!macroend

!macro customInstall
  ; Tạo firewall rule tự động cho server port 3456
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="AKNet Server"'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="AKNet Server" dir=in action=allow protocol=TCP localport=3456 profile=private,domain'
  DetailPrint "Da tao quy tac tuong lua cho cong 3456"
!macroend

!macro customUnInstall
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="AKNet Server"'
!macroend
