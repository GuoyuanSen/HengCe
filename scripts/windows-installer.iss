#ifndef AppVersion
  #define AppVersion "0.2.0"
#endif
#ifndef SourceDir
  #define SourceDir "..\build\windows\package\HengCe-win32-x64"
#endif
#ifndef OutputDir
  #define OutputDir "..\dist"
#endif
#ifndef IconFile
  #define IconFile "..\Resources\AppIcon.ico"
#endif
#ifndef LanguageFile
  #define LanguageFile "ChineseSimplified.isl"
#endif

[Setup]
AppId={{7F67F47F-8628-4B91-8F84-04D0BB26B544}
AppName=衡策
AppVersion={#AppVersion}
AppVerName=衡策 {#AppVersion}
AppPublisher=GuoyuanSen
AppPublisherURL=https://github.com/GuoyuanSen/HengCe
AppSupportURL=https://github.com/GuoyuanSen/HengCe/issues
AppUpdatesURL=https://github.com/GuoyuanSen/HengCe/releases
DefaultDirName={localappdata}\Programs\HengCe
DefaultGroupName=衡策
DisableProgramGroupPage=yes
OutputDir={#OutputDir}
OutputBaseFilename=HengCe-Windows-x64-Setup
SetupIconFile={#IconFile}
UninstallDisplayIcon={app}\HengCe.exe
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=yes
RestartApplications=no
UsePreviousAppDir=yes
VersionInfoVersion={#AppVersion}.0
VersionInfoCompany=GuoyuanSen
VersionInfoDescription=衡策 Windows x64 安装程序
VersionInfoProductName=衡策

[Languages]
Name: "chinesesimplified"; MessagesFile: "{#LanguageFile}"

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "附加选项:"; Flags: unchecked

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\衡策"; Filename: "{app}\HengCe.exe"
Name: "{autodesktop}\衡策"; Filename: "{app}\HengCe.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\HengCe.exe"; Description: "启动衡策"; Flags: nowait postinstall skipifsilent
