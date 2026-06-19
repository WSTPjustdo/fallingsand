Option Explicit

Dim shell
Dim fso
Dim baseDir
Dim htmlFile
Dim browsers
Dim i
Dim browser
Dim command

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

baseDir = fso.GetParentFolderName(WScript.ScriptFullName)
htmlFile = fso.BuildPath(baseDir, "index.html")

browsers = Array( _
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe", _
  "C:\Program Files\Microsoft\Edge\Application\msedge.exe", _
  "C:\Program Files\Google\Chrome\Application\chrome.exe" _
)

For i = 0 To UBound(browsers)
  browser = browsers(i)
  If fso.FileExists(browser) Then
    command = """" & browser & """" & " " & """" & htmlFile & """"
    shell.Run command, 1, False
    WScript.Quit 0
  End If
Next

MsgBox "没有找到可用的 Edge 或 Chrome 浏览器。" & vbCrLf & htmlFile, vbExclamation, "Falling Sand Launcher"
