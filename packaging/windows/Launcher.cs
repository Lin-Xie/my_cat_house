using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

internal static class Program
{
    internal static int Port = 4317;
    internal static string Address { get { return "http://127.0.0.1:" + Port; } }
    internal const string Name = "我的橘猫小屋";
    internal static string InstanceName { get { return @"Local\OrangeCatRoom.Desktop.v1." + Port; } }
    internal static bool NoBrowser;

    [STAThread]
    private static int Main(string[] args)
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        NoBrowser = Array.IndexOf(args, "--no-browser") >= 0;
        foreach (string arg in args)
        {
            if (arg.StartsWith("--test-port="))
            {
                int port;
                if (!int.TryParse(arg.Substring(12), out port) || port < 1024 || port > 65535) return 2;
                Port = port;
            }
        }
        if (Array.IndexOf(args, "--quit") >= 0)
        {
            try { using (var signal = EventWaitHandle.OpenExisting(InstanceName + ".exit")) signal.Set(); }
            catch (WaitHandleCannotBeOpenedException) { }
            return 0;
        }
        bool first;
        using (var mutex = new Mutex(true, InstanceName, out first))
        {
            try
            {
                if (!first)
                {
                    for (int i = 0; i < 100; i++)
                    {
                        if (IsReady()) { OpenBrowser(); return 0; }
                        Thread.Sleep(200);
                    }
                    throw new Exception("小屋仍在启动，请稍后再试。也可以从右下角托盘退出后重新打开。");
                }
                using (var context = new RoomContext()) Application.Run(context);
                return Environment.ExitCode;
            }
            catch (Exception error) { ShowError(error); return 1; }
            finally { if (first) mutex.ReleaseMutex(); }
        }
    }

    internal static bool IsReady()
    {
        // HttpWebRequest can report Timeout instead of ConnectionRefused on an idle Windows port.
        // Probe TCP first so a cold start is not mistaken for an unhealthy existing service.
        using (var client = new TcpClient())
        {
            var attempt = client.BeginConnect("127.0.0.1", Port, null, null);
            using (attempt.AsyncWaitHandle)
            {
                if (!attempt.AsyncWaitHandle.WaitOne(2500)) throw new Exception("无法检查本机小屋端口，请稍后重试。");
                try { client.EndConnect(attempt); }
                catch (SocketException error)
                {
                    if (error.SocketErrorCode == SocketError.ConnectionRefused) return false;
                    throw;
                }
            }
        }
        var request = (HttpWebRequest)WebRequest.Create(Address + "/health");
        request.Proxy = null;
        request.Timeout = 2500;
        request.ReadWriteTimeout = 2500;
        request.KeepAlive = false;
        try
        {
            using (var response = request.GetResponse())
            using (var reader = new StreamReader(response.GetResponseStream()))
            {
                var data = new JavaScriptSerializer().Deserialize<Health>(reader.ReadToEnd());
                if (data != null && data.app == "orange-cat-room" && data.version == 1) return true;
            }
        }
        catch (WebException error)
        {
            var socket = error.InnerException as SocketException;
            if (socket != null && socket.SocketErrorCode == SocketError.ConnectionRefused) return false;
            if (error.Response != null) error.Response.Close();
            throw new Exception("无法连接小屋。请检查端口 4317 是否被其他程序或旧版小屋占用。", error);
        }
        catch (ArgumentException) { }
        catch (InvalidOperationException) { }
        throw new Exception("端口 4317 已被其他程序或旧版小屋占用，请先关闭它再打开小屋。");
    }

    internal sealed class Health { public string app { get; set; } public int version { get; set; } }

    internal static void OpenBrowser()
    {
        if (NoBrowser) return;
        try { Process.Start(new ProcessStartInfo(Address) { UseShellExecute = true }); }
        catch { MessageBox.Show("浏览器未能自动打开。请在浏览器中访问：\n" + Address, Name, MessageBoxButtons.OK, MessageBoxIcon.Information); }
    }

    internal static void ShowError(Exception error)
    {
        Environment.ExitCode = 1;
        try
        {
            string root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "OrangeCatRoom");
            Directory.CreateDirectory(root);
            File.WriteAllText(Path.Combine(root, "launcher.log"), DateTimeOffset.Now + "\r\n" + error);
        }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
        MessageBox.Show(error.Message, Name, MessageBoxButtons.OK, MessageBoxIcon.Error);
    }
}

internal sealed class RoomContext : ApplicationContext
{
    private readonly NotifyIcon tray;
    private readonly ToolStripMenuItem open;
    private readonly EventWaitHandle exitSignal;
    private readonly System.Windows.Forms.Timer monitor;
    private Process server;
    private ChildJob job;
    private bool closing;
    private bool starting = true;

    internal RoomContext()
    {
        exitSignal = new EventWaitHandle(false, EventResetMode.AutoReset, Program.InstanceName + ".exit");
        open = new ToolStripMenuItem("打开小屋", null, delegate { Program.OpenBrowser(); }) { Enabled = false };
        var menu = new ContextMenuStrip();
        menu.Items.Add(open);
        menu.Items.Add("退出", null, delegate { ExitThread(); });
        tray = new NotifyIcon { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath), Text = "我的橘猫小屋 · 正在启动", ContextMenuStrip = menu, Visible = true };
        tray.DoubleClick += delegate { if (open.Enabled) Program.OpenBrowser(); };
        monitor = new System.Windows.Forms.Timer { Interval = 200 };
        monitor.Tick += delegate
        {
            if (exitSignal.WaitOne(0)) { ExitThread(); return; }
            if (!starting && server != null && server.HasExited)
            {
                monitor.Stop();
                Program.ShowError(new Exception("小屋服务已停止，请重新打开程序。"));
                ExitThread();
            }
        };
        monitor.Start();
        Application.Idle += Begin;
    }

    private async void Begin(object sender, EventArgs args)
    {
        Application.Idle -= Begin;
        try
        {
            if (Program.IsReady()) { Program.OpenBrowser(); ExitThread(); return; }
            string directory = await Task.Run(() => Bundle.Extract());
            if (closing) return;
            var info = new ProcessStartInfo(Path.Combine(directory, "node.exe"), "\"" + Path.Combine(directory, "server.mjs") + "\"")
            {
                WorkingDirectory = directory, UseShellExecute = false, CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden, RedirectStandardOutput = true, RedirectStandardError = true
            };
            info.EnvironmentVariables.Remove("NODE_OPTIONS");
            info.EnvironmentVariables.Remove("NODE_PATH");
            info.EnvironmentVariables["ORANGE_CAT_ROOM_PORT"] = Program.Port.ToString();
            job = new ChildJob();
            server = Process.Start(info);
            job.Add(server);
            // Drain both pipes so the hidden service cannot block on console output.
            server.OutputDataReceived += delegate { };
            server.ErrorDataReceived += delegate { };
            server.BeginOutputReadLine();
            server.BeginErrorReadLine();
            bool ready = false;
            for (int i = 0; i < 75; i++)
            {
                if (closing) return;
                if (server.HasExited) throw new Exception("小屋服务启动失败，请检查端口 4317 是否被占用，或重新下载程序。");
                if (Program.IsReady()) { ready = true; break; }
                await Task.Delay(200);
            }
            if (!ready) throw new Exception("小屋启动超时，请退出后重试。");
            starting = false;
            open.Enabled = true;
            tray.Text = Program.Name;
            Program.OpenBrowser();
        }
        catch (Exception error)
        {
            if (!closing) { Program.ShowError(error); ExitThread(); }
        }
    }

    protected override void ExitThreadCore()
    {
        if (closing) return;
        closing = true;
        Application.Idle -= Begin;
        monitor.Stop();
        monitor.Dispose();
        tray.Visible = false;
        tray.ContextMenuStrip.Dispose();
        tray.Icon.Dispose();
        tray.Dispose();
        if (job != null) job.Dispose();
        if (server != null)
        {
            try { if (!server.HasExited) server.Kill(); } catch (InvalidOperationException) { }
            server.Dispose();
        }
        exitSignal.Dispose();
        base.ExitThreadCore();
    }
}

internal static class Bundle
{
    internal static string Extract()
    {
        var assembly = Assembly.GetExecutingAssembly();
        string hash;
        using (var stream = assembly.GetManifestResourceStream("payload.zip"))
        using (var sha = SHA256.Create()) hash = BitConverter.ToString(sha.ComputeHash(stream)).Replace("-", "").ToLowerInvariant();
        string root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "OrangeCatRoom", "runtime");
        string directory = Path.Combine(root, hash);
        Directory.CreateDirectory(root);
        using (var stream = assembly.GetManifestResourceStream("payload.zip"))
        using (var zip = new ZipArchive(stream, ZipArchiveMode.Read))
        {
            // Hash each cached file against the embedded archive, repairing incomplete or modified caches.
            foreach (var entry in zip.Entries)
            {
                string path = Path.GetFullPath(Path.Combine(directory, entry.FullName));
                if (!path.StartsWith(directory + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new IOException("安装包中的文件路径无效。");
                bool matches = false;
                if (File.Exists(path))
                {
                    using (var expected = entry.Open())
                    using (var actual = File.OpenRead(path))
                    using (var sha = SHA256.Create())
                        matches = BitConverter.ToString(sha.ComputeHash(expected)) == BitConverter.ToString(sha.ComputeHash(actual));
                }
                if (matches) continue;
                Directory.CreateDirectory(Path.GetDirectoryName(path));
                using (var input = entry.Open())
                using (var output = File.Create(path)) input.CopyTo(output);
            }
        }
        return directory;
    }
}

// Closing the owner (including a forced termination) closes this handle and stops its Node process.
internal sealed class ChildJob : IDisposable
{
    private IntPtr handle;
    internal ChildJob()
    {
        handle = CreateJobObject(IntPtr.Zero, null);
        if (handle == IntPtr.Zero) throw new System.ComponentModel.Win32Exception();
        var limits = new ExtendedLimits();
        limits.Basic.LimitFlags = 0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        int size = Marshal.SizeOf(limits);
        IntPtr pointer = Marshal.AllocHGlobal(size);
        try
        {
            Marshal.StructureToPtr(limits, pointer, false);
            if (!SetInformationJobObject(handle, 9, pointer, (uint)size))
            { int code = Marshal.GetLastWin32Error(); Dispose(); throw new System.ComponentModel.Win32Exception(code); }
        }
        finally { Marshal.FreeHGlobal(pointer); }
    }
    internal void Add(Process process)
    {
        if (!AssignProcessToJobObject(handle, process.Handle))
        {
            int code = Marshal.GetLastWin32Error();
            process.Kill();
            throw new System.ComponentModel.Win32Exception(code, "无法管理小屋后台进程。");
        }
    }
    public void Dispose() { if (handle != IntPtr.Zero) { CloseHandle(handle); handle = IntPtr.Zero; } }
    [StructLayout(LayoutKind.Sequential)] private struct BasicLimits
    {
        internal long ProcessTime, JobTime;
        internal uint LimitFlags;
        internal UIntPtr MinWorkingSet, MaxWorkingSet;
        internal uint ActiveProcessLimit;
        internal UIntPtr Affinity;
        internal uint PriorityClass, SchedulingClass;
    }
    [StructLayout(LayoutKind.Sequential)] private struct IoCounters { internal ulong ReadOps, WriteOps, OtherOps, ReadBytes, WriteBytes, OtherBytes; }
    [StructLayout(LayoutKind.Sequential)] private struct ExtendedLimits
    {
        internal BasicLimits Basic;
        internal IoCounters Io;
        internal UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory;
    }
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern IntPtr CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool SetInformationJobObject(IntPtr job, int type, IntPtr info, uint size);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll")] private static extern bool CloseHandle(IntPtr handle);
}
