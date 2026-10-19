package ar.com.mariopc.taller;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WhatsAppPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
