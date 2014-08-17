var { classes: Cc, interfaces: Ci, utils: Cu } = Components;
Cu.import("resource://gre/modules/devtools/Console.jsm");

function makeURI(aURL, aOriginCharset, aBaseURI) {
    var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
    return ioService.newURI(aURL, aOriginCharset, aBaseURI);
}

var ExportScrapbookToWiz = {
  debug: false,

  mainWindow: window.QueryInterface(Ci.nsIInterfaceRequestor)
    .getInterface(Ci.nsIWebNavigation)
    .QueryInterface(Ci.nsIDocShellTreeItem)
    .rootTreeItem
    .QueryInterface(Ci.nsIInterfaceRequestor)
    .getInterface(Ci.nsIDOMWindow),

  get prefs() {
      delete this.prefs;
      return this.prefs = Cc["@mozilla.org/preferences-service;1"]
                      .getService(Ci.nsIPrefService)
                      .getBranch("extensions.exportscrapbooktowiz.");
  },

  export: function() {
    var aRes = sbTreeUI.resource;
    if (!aRes)
      return;

    this.debug = this.prefs.getBoolPref('debug');

    var id = ScrapBookData.getProperty(aRes, "id"),
      type = ScrapBookData.getProperty(aRes, "type"),
      title = ScrapBookData.getProperty(aRes, "title"),
      url = ScrapBookData.getProperty(aRes, "source");

    url = decodeURIComponent(url);

    // 当 type 为 site 时，有多个 html，会有问题

    var aFolder = ScrapBookUtils.getContentDir(id),
      indexPath = aFolder.path + '\\index.html';

    // 诸如这个网址 https://webcache.googleusercontent.com/search?q=cache:yM_uF1OboPoJ:https://dominustemporis.com/2014/05/dnscrypt-on-windows-update/+&cd=1&hl=en&ct=clnk
    if (/https?:\/\/.*https?:\/\//i.test(url)) {
      var preUrl = makeURI(url).prePath + '/';
    } else {
      var preUrl = url.replace(/[^\/]*$/, '');
    }

    var contentConfig = "[Common]\r\nURL=" + url +
      "\r\nTitle=" + title +
      "\r\nFileNameAll=" + indexPath +
      "\r\nFileNameSel=" + indexPath +
      "\r\n[Resources]";

    var resourceFilesIndex = 0;

    // 罗列该目录下的所有文件
    let files = aFolder.directoryEntries.QueryInterface(Ci.nsISimpleEnumerator);
    while (files.hasMoreElements()) {
      let file = files.getNext().QueryInterface(Ci.nsIFile),
        filename = file.leafName;
      if (filename == 'index.html' || filename == 'index.dat' || filename.endsWith('.ttf'))
        continue;

      contentConfig += "\r\n" + resourceFilesIndex + "_URL=" + preUrl + filename;
      contentConfig += "\r\n" + resourceFilesIndex + "_File=" + file.path;
      resourceFilesIndex += 1;
    }

    contentConfig += "\r\nCount=" + resourceFilesIndex;

    if (this.debug) {
      console.log('type is ', type);
      console.log('contentConfig is ', contentConfig);
    }

    this.launchWiz(contentConfig);
  },
  launchWiz: function(contentConfig) {
    var wiz_km_writeFileWithCharset = this.wiz_km_writeFileWithCharset,
      wizAppPath = this.getWizAppPath(),
      wiz_km_unicodeToBytes = this.wiz_km_unicodeToBytes,
      wiz_km_base64Encode = this.wiz_km_base64Encode,
      wiz_km_runExeFile = this.wiz_km_runExeFile;

    if (!wizAppPath) {
      alert('Wiz 扩展不存在');
      return;
    }

    var tmpDir = Cc["@mozilla.org/file/directory_service;1"]
      .getService(Ci.nsIProperties)
      .get("TmpD", Ci.nsIFile);

    var fileNameConfig = tmpDir.clone();
    fileNameConfig.append("wiz_km_firefox.ini");

    wiz_km_writeFileWithCharset(fileNameConfig, contentConfig, "utf-8");

    var fileNameExe = wizAppPath + "Wiz.exe";

    var exeFile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
    exeFile.initWithPath(fileNameExe);

    var dllFileName = wizAppPath + "NPWizWebCapture.dll";
    var functionName = "WizKMResourceToDocument";

    var params = fileNameConfig.path;
    params = wiz_km_unicodeToBytes(params, "utf-8");
    params = wiz_km_base64Encode(params);
    params = "/FileName=" + params;
    params = params.replace(/\r/gi, "");
    params = params.replace(/\n/gi, "");

    var firefoxType = "/firefox=1";

    var cmdLineExe = [dllFileName, functionName, params, firefoxType];

    wiz_km_runExeFile(exeFile, cmdLineExe, false);
  },

  onload: function() {
    var DATA = [
      ['sbPopupOpen', 'o'],
      ['sbPopupOpenNewTab', 't'],
      ['sbPopupOpenSource', 's'],

      ['sbPopupTools', 'e'],
      ['sbPopupShowFiles', 'f'],
      ['sbPopupSend', 'm'],
      ['sbPopupExport', 'e'],

      ['sbPopupRemove', 'd'],
      ['sbPopupNewFolder', 'f'],
      ['sbPopupNewNote', 'n'],
      ['sbPopupProperty', 'p'],
    ];

    DATA.forEach(function(info){
      var menuitem = document.getElementById(info[0]);
      if (menuitem) {
        menuitem.setAttribute('accesskey', info[1]);
      }
    });
  },

  // wiz 相关 函数
  getWizAppPath: function() {
    if (this.mainWindow.Wiz) {  // 官方市场的版本
      return this.mainWindow.Wiz.nativeManager.mozillaCtrl.getAppPath()
    } else if (this.mainWindow.wiz_km_getWizAppPath) {  // 很早前的版本
      return this.mainWindow.wiz_km_getWizAppPath();
    }
  },
  wiz_km_writeFileWithCharset: function(file, content, charset) {
    try {
      if (file.exists() && file.isFile()) {
        file.remove(false);
      }

      const cc = Components.classes;
      const ci = Components.interfaces;
      const unicodeConverter = cc["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(ci.nsIScriptableUnicodeConverter);
      unicodeConverter.charset = charset;
      content = unicodeConverter.ConvertFromUnicode(content);
      const os = cc["@mozilla.org/network/file-output-stream;1"].createInstance(ci.nsIFileOutputStream);
      os.init(file, 0x02 | 0x08 | 0x20, -1, 0);
      os.write(content, content.length);
      os.close();
    } catch (err) {
      console.error(err);
    }
  },
  wiz_km_unicodeToBytes: function(content, charset) {
    try {
      const unicodeConverter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Ci.nsIScriptableUnicodeConverter);
      unicodeConverter.charset = charset ? charset : 'utf-8';
      content = unicodeConverter.ConvertFromUnicode(content);
      //
      return content;
    } catch (err) {
      throw err;
    }
  },
  wiz_km_base64EncodeChars: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",
  wiz_km_base64Encode: function(str) {
    var wiz_km_base64EncodeChars = ExportScrapbookToWiz.wiz_km_base64EncodeChars;

    var out, i, len;
    var c1, c2, c3;
    len = str.length;
    i = 0;
    out = "";
    while (i < len) {
      c1 = str.charCodeAt(i++) & 0xff;
      if (i == len) {
        out += wiz_km_base64EncodeChars.charAt(c1 >> 2);
        out += wiz_km_base64EncodeChars.charAt((c1 & 0x3) << 4);
        out += "==";
        break;
      }
      c2 = str.charCodeAt(i++);
      if (i == len) {
        out += wiz_km_base64EncodeChars.charAt(c1 >> 2);
        out += wiz_km_base64EncodeChars.charAt(((c1 & 0x3) << 4) | ((c2 & 0xF0) >> 4));
        out += wiz_km_base64EncodeChars.charAt((c2 & 0xF) << 2);
        out += "=";
        break;
      }
      c3 = str.charCodeAt(i++);
      out += wiz_km_base64EncodeChars.charAt(c1 >> 2);
      out += wiz_km_base64EncodeChars.charAt(((c1 & 0x3) << 4) | ((c2 & 0xF0) >> 4));
      out += wiz_km_base64EncodeChars.charAt(((c2 & 0xF) << 2) | ((c3 & 0xC0) >> 6));
      out += wiz_km_base64EncodeChars.charAt(c3 & 0x3F);
    }
    return out;
  },
  wiz_km_runExeFile: function(fileExe, cmdline, block) {
    try {
      var proc = Cc['@mozilla.org/process/util;1'].createInstance(Ci.nsIProcess);
      proc.init(fileExe);
      proc.run(block, cmdline, cmdline.length);
    } catch (err) {
      throw err;
    }
  }

};

window.addEventListener('load', function(){
  ExportScrapbookToWiz.onload();
}, false);