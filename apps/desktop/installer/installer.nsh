; Script incluído pelo electron-builder (nsis.include) — 034-encerramento-backend-orfao, T3408 (RF-3412, C-3405).
;
; Antes de instalar ou desinstalar, encerra backends do MLab que ficaram órfãos, para que a cópia dos arquivos não
; falhe com "arquivo em uso". Só age com o MLab.exe fechado: com o app aberto, a verificação padrão do
; electron-builder pede para fechá-lo, e o backend dele é encerrado junto (procedimento de encerramento do app).
;
; - mlab-backend.exe: nome exclusivo do MLab, encerrado por nome.
; - server.exe (legado, até a 1.15.x): nome genérico; só é encerrado o processo cujo caminho é
;   <pasta>\resources\bin\server.exe com MLab.exe em <pasta>. Programas de terceiros nunca são encerrados.
; Falhas (PowerShell bloqueado, acesso negado) não interrompem a instalação.

!macro mlabKillOrphanBackends
  nsExec::ExecToStack `"$SYSDIR\cmd.exe" /d /c "$SYSDIR\tasklist.exe /FI "IMAGENAME eq MLab.exe" /NH | $SYSDIR\find.exe /I "MLab.exe""`
  Pop $0
  Pop $1
  ${If} $0 != 0
    DetailPrint "Encerrando backends órfãos do MLab..."
    nsExec::Exec `"$SYSDIR\taskkill.exe" /F /T /IM mlab-backend.exe`
    Pop $0
    ; O instalador é 32 bits: $SYSDIR leva ao PowerShell 32 bits, em que Get-Process não lê o caminho de processos
    ; 64 bits. Win32_Process.ExecutablePath funciona nas duas arquiteturas.
    nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $$_.Name -eq 'server.exe' -and $$_.ExecutablePath -and $$_.ExecutablePath.ToLower().EndsWith('\resources\bin\server.exe') -and (Test-Path (Join-Path (Split-Path (Split-Path (Split-Path $$_.ExecutablePath))) 'MLab.exe')) } | ForEach-Object { Stop-Process -Id $$_.ProcessId -Force -ErrorAction SilentlyContinue }"`
    Pop $0
    Sleep 500
  ${EndIf}
!macroend

!macro customInit
  !insertmacro mlabKillOrphanBackends
!macroend

!macro customUnInit
  !insertmacro mlabKillOrphanBackends
!macroend
