package com.masiyatunda.milkyway;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;

@CapacitorPlugin(name = "MilkyWayNative")
public class MilkyWayNativePlugin extends Plugin {
    @PluginMethod
    public void exitApp(PluginCall call) {
        call.resolve();
        getActivity().runOnUiThread(this::finishApp);
    }

    @PluginMethod
    public void getInfo(PluginCall call) {
        try {
            PackageInfo info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            JSObject result = new JSObject();
            result.put("versionName", info.versionName == null ? "" : info.versionName);
            result.put("versionCode", Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? info.getLongVersionCode() : info.versionCode);
            result.put("firebaseReady", firebaseReady());
            call.resolve(result);
        } catch (PackageManager.NameNotFoundException error) {
            call.reject("Could not read the installed app version.", error);
        }
    }

    @PluginMethod
    public void openExternal(PluginCall call) {
        String address = call.getString("url");
        Uri uri = address == null ? null : Uri.parse(address);
        if (uri == null || !"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null) {
            call.reject("Only valid HTTPS URLs can be opened.");
            return;
        }

        try {
            getActivity().startActivity(new Intent(Intent.ACTION_VIEW, uri));
            call.resolve();
        } catch (ActivityNotFoundException | SecurityException error) {
            call.reject("Could not open the requested link.", error);
        }
    }

    @PluginMethod
    public void configureFirebase(PluginCall call) {
        String appId = call.getString("appId");
        String apiKey = call.getString("apiKey");
        String projectId = call.getString("projectId");
        String senderId = call.getString("senderId");
        if (isBlank(appId) || isBlank(apiKey) || isBlank(projectId) || isBlank(senderId)) {
            call.reject("Firebase client configuration is incomplete.");
            return;
        }

        try {
            if (!firebaseReady()) {
                FirebaseOptions options = new FirebaseOptions.Builder()
                    .setApplicationId(appId)
                    .setApiKey(apiKey)
                    .setProjectId(projectId)
                    .setGcmSenderId(senderId)
                    .build();
                FirebaseApp.initializeApp(getContext(), options);
            }
            if (!firebaseReady()) {
                call.reject("Firebase did not initialize for this installation.");
                return;
            }
            JSObject result = new JSObject();
            result.put("firebaseReady", true);
            call.resolve(result);
        } catch (IllegalStateException | IllegalArgumentException error) {
            call.reject("Could not configure Firebase for this installation.", error);
        }
    }

    private boolean firebaseReady() {
        for (FirebaseApp app : FirebaseApp.getApps(getContext())) {
            if (FirebaseApp.DEFAULT_APP_NAME.equals(app.getName())) return true;
        }
        return false;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private void finishApp() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getActivity().finishAndRemoveTask();
        } else {
            getActivity().finish();
        }
    }
}
