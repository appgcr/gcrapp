package com.appgcr.valuationapp;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MicPermissionPlugin.class); // app's own plugin (microphone prompt)
        super.onCreate(savedInstanceState);
    }
}
