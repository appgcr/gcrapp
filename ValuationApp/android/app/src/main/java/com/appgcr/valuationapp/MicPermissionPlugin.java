package com.appgcr.valuationapp;

import android.Manifest;
import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Asks Android for the microphone before the web page records (Speak the site details).
 * The WebView alone does not always show the system prompt on every phone.
 */
@CapacitorPlugin(
    name = "MicPermission",
    permissions = { @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }) }
)
public class MicPermissionPlugin extends Plugin {

    private JSObject state() {
        JSObject r = new JSObject();
        PermissionState s = getPermissionState("microphone");
        r.put("microphone", s == null ? "prompt" : s.toString());
        return r;
    }

    @PluginMethod
    public void check(PluginCall call) {
        call.resolve(state());
    }

    @PluginMethod
    public void request(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            call.resolve(state());
            return;
        }
        requestPermissionForAlias("microphone", call, "afterRequest");
    }

    @PermissionCallback
    private void afterRequest(PluginCall call) {
        call.resolve(state());
    }

    /** Opens this app's page in Android Settings (when the microphone was refused for good). */
    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", getContext().getPackageName(), null));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }
}
