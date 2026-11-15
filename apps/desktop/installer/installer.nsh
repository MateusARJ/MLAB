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
    nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Get-Process -Name server -ErrorAction SilentlyContinue | Where-Object { $$_.Path -and $$_.Path.ToLower().EndsWith('\resources\bin\server.exe') -and (Test-Path (Join-Path (Split-Path (Split-Path (Split-Path $$_.Path))) 'MLab.exe')) } | Stop-Process -Force -ErrorAction SilentlyContinue"`
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
