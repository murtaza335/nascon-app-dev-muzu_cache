// Local Android PDF/save adapter. No new runtime library or storage permission.
const { withDangerousMod, withMainApplication, withAndroidManifest } = require('@expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');
const source = `package com.nascon.sports;
import android.app.Activity;
import android.content.Intent;
import android.util.Base64;

import android.net.Uri;
import androidx.core.content.FileProvider;
import com.facebook.react.bridge.*;
import com.facebook.react.ReactPackage;
import com.facebook.react.uimanager.ViewManager;
import java.io.*;
import java.util.*;

public class ReceiptPackage implements ReactPackage {
  public List<NativeModule> createNativeModules(ReactApplicationContext context) { return Collections.singletonList(new ReceiptModule(context)); }
  public List<ViewManager> createViewManagers(ReactApplicationContext context) { return Collections.emptyList(); }
  static class ReceiptModule extends ReactContextBaseJavaModule {
    private static final int REQUEST=4417;
    private Promise pending;
    private File pendingFile;
    ReceiptModule(ReactApplicationContext context) {
      super(context);
      context.addActivityEventListener(new BaseActivityEventListener() {
        public void onActivityResult(Activity activity, int requestCode, int resultCode, Intent data) {
          if(requestCode!=REQUEST || pending==null)return;
          Promise result=pending; File file=pendingFile; pending=null;pendingFile=null;
          if(resultCode!=Activity.RESULT_OK || data==null || data.getData()==null){result.resolve("cancelled");return;}
          try(InputStream input=new FileInputStream(file); OutputStream output=context.getContentResolver().openOutputStream(data.getData())) {
            if(output==null)throw new IOException("Destination unavailable");
            byte[] buffer=new byte[8192];int count;while((count=input.read(buffer))!=-1)output.write(buffer,0,count);
            result.resolve("saved");
          }catch(Exception e){result.reject("PDF_SAVE_FAILED","Could not save the receipt. Choose another location.");}
        }
      });
    }
    public String getName(){return "NaSConReceipt";}
    @ReactMethod public void exportReceipt(String base64, String filename, boolean download, Promise promise) {
      Activity activity=getReactApplicationContext().getCurrentActivity();
      if(activity==null){promise.reject("NO_ACTIVITY","Open the app before exporting a receipt.");return;}
      if(pending!=null){promise.reject("PDF_BUSY","Finish saving the previous receipt first.");return;}
      try {
        File folder=new File(getReactApplicationContext().getCacheDir(),"receipts");folder.mkdirs();
        File file=new File(folder,filename.replaceAll("[^a-zA-Z0-9_.-]","_"));
        byte[] bytes=Base64.decode(base64,Base64.DEFAULT);
        if(bytes.length<5 || !new String(bytes,0,5,"US-ASCII").equals("%PDF-"))throw new IOException("Invalid PDF");
        try(FileOutputStream output=new FileOutputStream(file)){output.write(bytes);}
        if(download){
          pending=promise;pendingFile=file;Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("application/pdf");intent.putExtra(Intent.EXTRA_TITLE,file.getName());activity.startActivityForResult(intent,REQUEST);
        }else{
          Uri uri=FileProvider.getUriForFile(getReactApplicationContext(),getReactApplicationContext().getPackageName()+".receipts",file);
          Intent intent=new Intent(Intent.ACTION_VIEW);intent.setDataAndType(uri,"application/pdf");intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);activity.startActivity(intent);promise.resolve("opened");
        }
      }catch(Exception e){pending=null;pendingFile=null;promise.reject("PDF_EXPORT_FAILED","Could not open the receipt. Try Download receipt or install a PDF viewer.");}
    }
  }
}`;
module.exports = config => {
  config=withMainApplication(config, mod=>{
    if(!mod.modResults.contents.includes('add(ReceiptPackage())'))mod.modResults.contents=mod.modResults.contents.replace('PackageList(this).packages.apply {','PackageList(this).packages.apply {\n              add(ReceiptPackage())');
    return mod;
  });
  config=withAndroidManifest(config,mod=>{
    const application=mod.modResults.manifest.application[0];application.provider ||= [];
    if(!application.provider.some(x=>x.$?.['android:authorities']==='${applicationId}.receipts'))application.provider.push({$:{'android:name':'androidx.core.content.FileProvider','android:authorities':'${applicationId}.receipts','android:exported':'false','android:grantUriPermissions':'true'},'meta-data':[{$:{'android:name':'android.support.FILE_PROVIDER_PATHS','android:resource':'@xml/receipt_paths'}}]});
    return mod;
  });
  return withDangerousMod(config,['android',async mod=>{
    const root=mod.modRequest.platformProjectRoot;
    const java=path.join(root,'app/src/main/java/com/nascon/sports');const xml=path.join(root,'app/src/main/res/xml');
    fs.mkdirSync(java,{recursive:true});fs.mkdirSync(xml,{recursive:true});
    fs.writeFileSync(path.join(java,'ReceiptPackage.java'),source);
    fs.writeFileSync(path.join(xml,'receipt_paths.xml'),'<?xml version="1.0" encoding="utf-8"?><paths xmlns:android="http://schemas.android.com/apk/res/android"><cache-path name="receipts" path="receipts/"/></paths>');
    return mod;
  }]);
};
