Components.utils.import("resource://gre/modules/devtools/Console.jsm")

var mainWindow = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                     .getInterface(Components.interfaces.nsIWebNavigation)
                     .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
                     .rootTreeItem
                     .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                     .getInterface(Components.interfaces.nsIDOMWindow);

var ExportToWiz = {
    export: function() {
        var aRes = sbTreeUI.resource;
        if (!aRes)
          return;

        var id = ScrapBookData.getProperty(aRes, "id"),
          title = ScrapBookData.getProperty(aRes, "title"),
          url = ScrapBookData.getProperty(aRes, "source");

        var aFolder = ScrapBookUtils.getContentDir(id),
          indexPath = aFolder.path + '\\index.html',
          preUrl = url.replace(/[^\/]+\/?$/, '');

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

        // console.log(contentConfig);
        
        this.launchWiz(contentConfig);
    },
    launchWiz: function(contentConfig) {
      var wiz_km_writeFileWithCharset = mainWindow.wiz_km_writeFileWithCharset,
        wiz_km_getWizAppPath = mainWindow.wiz_km_getWizAppPath,
        wiz_km_unicodeToBytes = mainWindow.wiz_km_unicodeToBytes,
        wiz_km_base64Encode = mainWindow.wiz_km_base64Encode,
        wiz_km_runExeFile = mainWindow.wiz_km_runExeFile;

      var tmpDir = Components.classes["@mozilla.org/file/directory_service;1"]
                          .getService(Components.interfaces.nsIProperties)
                          .get("TmpD", Components.interfaces.nsIFile);

      var fileNameConfig = tmpDir.clone();
      fileNameConfig.append("wiz_km_firefox.ini");

      wiz_km_writeFileWithCharset(fileNameConfig, contentConfig, "utf-8");

      var fileNameExe = wiz_km_getWizAppPath() + "Wiz.exe";

      var exeFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
      exeFile.initWithPath(fileNameExe);

      var dllFileName = wiz_km_getWizAppPath() + "NPWizWebCapture.dll";
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
    }
};
