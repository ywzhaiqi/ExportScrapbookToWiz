var wizAppPath = getWizAppPath()
var fileNameExe = wizAppPath + "Wiz.exe";

var exeFile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
exeFile.initWithPath(fileNameExe);

var dllFileName = wizAppPath + "NPWizWebCapture.dll";
var functionName = "WizKMResourceToDocument";

var params = 'e:\\Downloads\\wiz_km_firefox.ini';
params = wiz_km_unicodeToBytes(params, "utf-8");
params = wiz_km_base64Encode(params);
params = "/FileName=" + params;
params = params.replace(/\r/gi, "");
params = params.replace(/\n/gi, "");

var firefoxType = "/firefox=1";

var cmdLineExe = [dllFileName, functionName, params, firefoxType];

wiz_km_runExeFile(exeFile, cmdLineExe, false);


function getWizAppPath() {
  if (window.Wiz) {  // 官方市场的版本
    return window.Wiz.nativeManager.mozillaCtrl.getAppPath()
  } else if (window.wiz_km_getWizAppPath) {  // 很早前的版本
    return window.wiz_km_getWizAppPath();
  }
}