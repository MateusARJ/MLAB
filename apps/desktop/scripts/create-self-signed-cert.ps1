<#
.SYNOPSIS
    Gera e instala um certificado auto-assinado de assinatura de código (Code Signing)
    na máquina local para evitar que o Windows SmartScreen alerte o app como malicioso em testes locais.
#>

$certName = "MLab Local Dev Code Signing"
Write-Host "Criando certificado de assinatura de código para: $certName..." -ForegroundColor Cyan

# 1. Cria o certificado auto-assinado com uso pretendido de Code Signing
$cert = New-SelfSignedCertificate `
    -Type CodeSigningCert `
    -Subject "CN=$certName" `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -KeyUsage DigitalSignature `
    -FriendlyName "MLab Development Certificate" `
    -NotAfter (Get-Date).AddYears(5)

# 2. Exporta para arquivo temporário
$pwd = ConvertTo-SecureString -String "mlab123" -Force -AsPlainText
$certPath = Join-Path $PSScriptRoot "mlab-codesign.pfx"
Export-PfxCertificate -Cert $cert -FilePath $certPath -Password $pwd | Out-Null

# 3. Adiciona a raiz confiável do usuário atual para que o Windows reconheça sem avisos
$store = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "CurrentUser")
$store.Open("ReadWrite")
$store.Add($cert)
$store.Close()

Write-Host "Certificado criado e instalado com sucesso nas Raízes Confiáveis locais!" -ForegroundColor Green
Write-Host "Arquivo PFX exportado para: $certPath" -ForegroundColor Yellow
Write-Host "Senha do arquivo PFX: mlab123" -ForegroundColor Yellow
