param(
    [string]$ExePath = (Join-Path (Split-Path $PSScriptRoot -Parent) 'dist/windows/我的橘猫小屋.exe'),
    [ValidateRange(1024,65535)][int]$Port = 14317
)
$ErrorActionPreference = 'Stop'
$ExePath = (Resolve-Path -LiteralPath $ExePath).Path
$address = "http://127.0.0.1:$Port"
function Is-Listening {
    $client = [Net.Sockets.TcpClient]::new()
    try { $client.Connect('127.0.0.1',$Port); return $true } catch { return $false } finally { $client.Dispose() }
}
if (Is-Listening) { throw '验收端口已被占用，请用 -Port 选择其他端口；测试不会停止已有服务。' }

# PE Subsystem 2 = Windows GUI; 3 would create a console.
$bytes = [IO.File]::ReadAllBytes($ExePath)
$peOffset = [BitConverter]::ToInt32($bytes, 0x3c)
if ([BitConverter]::ToUInt16($bytes, $peOffset + 24 + 68) -ne 2) { throw '产物不是 Windows GUI 可执行文件。' }

function Start-Package([string]$Argument) {
    $info = [Diagnostics.ProcessStartInfo]::new($ExePath, "$Argument --test-port=$Port")
    $info.UseShellExecute = $false
    # Deliberately do not hide the test subject: the EXE itself must be a GUI app.
    $info.EnvironmentVariables['PATH'] = "$env:WINDIR\System32;$env:WINDIR"
    $info.EnvironmentVariables['NODE_OPTIONS'] = '--not-a-real-option'
    return [Diagnostics.Process]::Start($info)
}
function Wait-Ready($Process) {
    for ($i=0; $i -lt 150; $i++) {
        if ($Process.HasExited) { throw "启动器提前退出：$($Process.ExitCode)" }
        $Process.Refresh()
        if ($Process.MainWindowHandle -ne 0) { throw ('启动器出现错误窗口：' + (Get-Content "$env:LOCALAPPDATA\OrangeCatRoom\launcher.log" -Raw -ErrorAction SilentlyContinue)) }
        try {
            $health = Invoke-RestMethod -Uri "$address/health" -TimeoutSec 1
            if ($health.app -eq 'orange-cat-room') { return }
        } catch { }
        Start-Sleep -Milliseconds 200
    }
    throw '启动超时。'
}
function Wait-Stopped($Process, [int]$ChildId) {
    if (-not $Process.WaitForExit(10000)) { throw '启动器未能退出。' }
    for ($i=0; $i -lt 50; $i++) {
        if (-not (Get-Process -Id $ChildId -ErrorAction SilentlyContinue)) { break }
        Start-Sleep -Milliseconds 100
    }
    if (Get-Process -Id $ChildId -ErrorAction SilentlyContinue) { throw '后台 Node.js 进程未清理。' }
    if (Is-Listening) { throw '退出后端口仍被占用。' }
}

$primary = $null
$secondary = $null
try {
    $primary = Start-Package '--no-browser'
    Wait-Ready $primary
    $children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId = $($primary.Id)" | Where-Object Name -eq 'node.exe')
    if ($children.Count -ne 1) { throw '应只有一个内置 Node.js 服务进程。' }
    $childId = [int]$children[0].ProcessId
    if ($children[0].ExecutablePath -notlike '*\OrangeCatRoom\runtime\*\node.exe') { throw '没有使用内置 Node.js。' }
    if ((Get-Process -Id $childId).MainWindowHandle -ne 0) { throw '后台服务出现了窗口。' }
    foreach ($path in @('/','/app.js','/style.css','/room.svg','/life.mjs','/companion.mjs')) {
        if ((Invoke-WebRequest -UseBasicParsing -Uri "$address$path").StatusCode -ne 200) { throw "资源读取失败：$path" }
    }
    $secondary = Start-Package '--no-browser'
    if (-not $secondary.WaitForExit(10000) -or $secondary.ExitCode -ne 0) { throw '重复启动未能正常复用服务。' }
    $after = @(Get-CimInstance Win32_Process -Filter "ParentProcessId = $($primary.Id)" | Where-Object Name -eq 'node.exe')
    if ($after.Count -ne 1 -or $after[0].ProcessId -ne $childId) { throw '重复启动产生了多余服务。' }
    $quit = Start-Package '--quit'
    if (-not $quit.WaitForExit(5000)) { throw '退出请求未完成。' }
    Wait-Stopped $primary $childId
    Write-Output 'PASS：无 Node.js PATH、隐藏后台服务、资源加载、重复启动、正常退出清理。'

    $primary = Start-Package '--no-browser'
    Wait-Ready $primary
    $childId = [int](Get-CimInstance Win32_Process -Filter "ParentProcessId = $($primary.Id)" | Where-Object Name -eq 'node.exe').ProcessId
    $primary.Kill()
    Wait-Stopped $primary $childId
    Write-Output 'PASS：强制结束启动器后，Job Object 自动清理后台服务。'
} finally {
    foreach ($process in @($secondary, $primary)) {
        if ($null -ne $process -and -not $process.HasExited) { $process.Kill(); $process.WaitForExit(5000) | Out-Null }
    }
}
