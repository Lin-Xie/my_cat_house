# Windows 打包

`Launcher.cs` 是 Windows GUI 启动器；`app.manifest` 指定普通用户权限。`scripts/build-windows.ps1` 把网页、本机服务、Node.js 和许可压缩为内嵌资源，再使用系统 .NET Framework C# 编译器生成单个 WinExe。用户无需安装 Node.js。目标为 Windows 10/11 x64（使用系统自带的 .NET Framework 4.x）。

在项目根目录运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-windows.ps1 -NodePath 'C:\Program Files\nodejs\node.exe'
```

构建固定使用官方 Node.js v24.16.0 Windows x64 的 `node.exe`，并核验 SHA-256。运行时来源：[官方发行目录](https://nodejs.org/dist/v24.16.0/win-x64/)。许可与校验清单保存在 `third-party/`。升级 Node.js 时需一起更新版本、许可、官方校验清单和构建脚本里的哈希。

输出在 `dist/windows/`；中间文件在构建时自动生成的 `.build/windows/`，完成后可删除。分发只需 EXE，旁边的使用说明和校验文件供用户查阅。项目根目录是唯一源码，不维护重复上传副本。测试保留在 `tests/`，不进入 EXE 或分发目录。

上传 Releases 时，EXE 使用附件名 `MyCatHouse-Windows-x64.exe`，使用说明使用 `Readme-Windows.txt`，避免托管平台替换中文文件名。发布附件中的 `SHA256SUMS.txt` 也应使用上传后的英文文件名；EXE 内容与本地构建产物相同。

启动器使用固定本机地址，保留原浏览器存档。运行时解包到 `%LOCALAPPDATA%\OrangeCatRoom\runtime\<包哈希>`；每次启动校验缓存，损坏文件会重新解包。没有注册表修改、开机启动或管理员权限要求。程序为未签名构建。

同一登录会话通过命名互斥锁防止重复启动，托盘提供打开和退出。后台进程使用 [CreateNoWindow](https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.processstartinfo.createnowindow) 隐藏窗口，并归属 [Windows Job Object](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects)，保证退出或强制结束启动器时清理它创建的服务；发现现有兼容服务则复用，不接管或终止它。

验收脚本：`tests/windows-package.ps1`，默认使用独立端口 14317，不影响运行在 4317 的小屋。内部参数 `--no-browser` 用于不打开浏览器的验收，`--test-port=14317` 选择独立端口，`--quit` 请求相应托盘程序正常退出。测试会暂时移除启动进程 PATH 中的 Node.js 路径，验证独立运行、重复启动、正常退出和强制结束清理。不会停止非测试创建的服务。
