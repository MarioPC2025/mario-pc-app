package ar.com.mariopc.taller;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

// Manda un archivo (PDF) directo a WhatsApp, sin pasar por el menú "Compartir" de Android.
// Si se le pasa el número, WhatsApp intenta abrir directamente el chat de ese cliente.
@CapacitorPlugin(name = "WhatsApp")
public class WhatsAppPlugin extends Plugin {

    static final String NORMAL = "com.whatsapp";
    static final String BUSINESS = "com.whatsapp.w4b";

    private boolean instalada(String pkg) {
        try {
            getContext().getPackageManager().getPackageInfo(pkg, 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }

    @PluginMethod
    public void disponibles(PluginCall call) {
        JSObject r = new JSObject();
        r.put("whatsapp", instalada(NORMAL));
        r.put("business", instalada(BUSINESS));
        call.resolve(r);
    }

    @PluginMethod
    public void enviarArchivo(PluginCall call) {
        String ruta = call.getString("uri", "");
        String pkg = call.getString("app", NORMAL);
        String numero = call.getString("numero", "");
        String texto = call.getString("texto", "");
        String tipo = call.getString("tipo", "application/pdf");
        if (!NORMAL.equals(pkg) && !BUSINESS.equals(pkg)) pkg = NORMAL;

        try {
            String path = Uri.parse(ruta).getPath();
            if (path == null) throw new IllegalArgumentException("ruta vacía");
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", new File(path));

            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType(tipo);
            i.setPackage(pkg);
            i.putExtra(Intent.EXTRA_STREAM, uri);
            if (texto != null && !texto.isEmpty()) i.putExtra(Intent.EXTRA_TEXT, texto);
            if (numero != null && !numero.isEmpty()) i.putExtra("jid", numero + "@s.whatsapp.net");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(i);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("WhatsApp no está instalado", "NO_WHATSAPP");
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()), "ERROR");
        }
    }
}
