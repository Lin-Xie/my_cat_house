param(
    [string]$NodePath = (Get-Command node -ErrorAction Stop).Source
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$packageRoot = Join-Path $projectRoot 'packaging/windows'
$buildRoot = Join-Path $projectRoot '.build/windows'
$outputRoot = Join-Path $projectRoot 'dist/windows'
New-Item -ItemType Directory -Force -Path $buildRoot, $outputRoot | Out-Null

# Pin the shipped runtime to the matching official checksum and license.
$expectedHash = 'b3094d0b49f9ad602262a9921551737bb97637c05dd357a06ae98188d7290aa3'
if ((Get-FileHash -LiteralPath $NodePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedHash) {
    throw '构建需要官方 Node.js v24.16.0 Windows x64 的 node.exe。请通过 -NodePath 指定，不能混用其他版本的运行时和许可。'
}
$checksumFile = Join-Path $packageRoot 'third-party/SHASUMS256-node.txt'
if (-not (Select-String -LiteralPath $checksumFile -SimpleMatch "$expectedHash  win-x64/node.exe")) { throw '缺少官方运行时校验记录。' }
$license = Join-Path $packageRoot 'third-party/LICENSE-node.txt'
if ((Get-Item -LiteralPath $license).Length -lt 10000) { throw 'Node.js 许可文件不完整。' }

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.Drawing
$payloadPath = Join-Path $buildRoot 'payload.zip'
$stream = [IO.File]::Create($payloadPath)
$zip = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create)
try {
    $files = [ordered]@{
        'node.exe' = $NodePath
        'server.mjs' = (Join-Path $projectRoot 'server.mjs')
        'LICENSE-node.txt' = $license
    }
    foreach ($name in @('index.html','app.js','style.css','room.svg','life.mjs','companion.mjs')) {
        $files["web/$name"] = Join-Path $projectRoot "web/$name"
    }
    foreach ($name in $files.Keys) {
        $entry = $zip.CreateEntry($name, [IO.Compression.CompressionLevel]::Optimal)
        $source = [IO.File]::OpenRead($files[$name])
        $target = $entry.Open()
        try { $source.CopyTo($target) } finally { $source.Dispose(); $target.Dispose() }
    }
} finally { $zip.Dispose(); $stream.Dispose() }

# Pixel cat icon, drawn locally with the same warm palette as the room.
$bitmap = [Drawing.Bitmap]::new(32,32)
$graphics = [Drawing.Graphics]::FromImage($bitmap)
$graphics.Clear([Drawing.Color]::Transparent)
$fur = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#eca259'))
$edge = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#925b3f'))
$face = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#ffe9b9'))
$eye = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#523c32'))
try {
    $graphics.FillRectangle($edge,4,4,6,10); $graphics.FillRectangle($edge,22,4,6,10)
    $graphics.FillRectangle($edge,3,11,26,15); $graphics.FillRectangle($edge,7,25,18,5)
    $graphics.FillRectangle($fur,6,7,3,8); $graphics.FillRectangle($fur,23,7,3,8)
    $graphics.FillRectangle($fur,5,13,22,11); $graphics.FillRectangle($fur,8,23,16,5)
    $graphics.FillRectangle($face,9,22,14,5)
    $graphics.FillRectangle($eye,9,17,3,3); $graphics.FillRectangle($eye,21,17,3,3)
    $graphics.FillRectangle($eye,15,23,3,2)
    $icon = [Drawing.Icon]::FromHandle($bitmap.GetHicon())
    $iconStream = [IO.File]::Create((Join-Path $buildRoot 'cat.ico'))
    try { $icon.Save($iconStream) } finally { $iconStream.Dispose(); $icon.Dispose() }
} finally { $graphics.Dispose(); $bitmap.Dispose(); $fur.Dispose(); $edge.Dispose(); $face.Dispose(); $eye.Dispose() }

$compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw '缺少 Windows .NET Framework C# 编译器。' }
$exe = Join-Path $outputRoot '我的橘猫小屋.exe'
$iconPath = Join-Path $buildRoot 'cat.ico'
$manifestPath = Join-Path $packageRoot 'app.manifest'
$sourcePath = Join-Path $packageRoot 'Launcher.cs'
& $compiler /nologo /target:winexe /platform:x64 /optimize+ "/out:$exe" "/resource:$payloadPath,payload.zip" "/win32icon:$iconPath" "/win32manifest:$manifestPath" /reference:System.dll /reference:System.Core.dll /reference:System.Drawing.dll /reference:System.Windows.Forms.dll /reference:System.IO.Compression.dll /reference:System.Web.Extensions.dll $sourcePath
if ($LASTEXITCODE -ne 0) { throw 'EXE 编译失败。' }
$hash = (Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText((Join-Path $outputRoot 'SHA256SUMS.txt'), "$hash  我的橘猫小屋.exe`r`n", [Text.UTF8Encoding]::new($false))
Copy-Item -LiteralPath (Join-Path $packageRoot '使用说明.txt') -Destination $outputRoot
Write-Output "已生成：$exe"
Write-Output ('大小：{0:N1} MiB；SHA256：{1}' -f ((Get-Item -LiteralPath $exe).Length / 1MB), $hash)
