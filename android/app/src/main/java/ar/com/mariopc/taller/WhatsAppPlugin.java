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
        // Mario PC usa solo WhatsApp Business: se ignora cualquier otra app que llegue
        String pkg = BUSINESS;
        String numero = call.getString("numero", "");
        String texto = call.getString("texto", "");
        String tipo = call.getString("tipo", "application/pdf");

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
            call.reject("WhatsApp Business no está instalado", "NO_WHATSAPP");
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()), "ERROR");
        }
    }

    // Abre un chat en WhatsApp Business con el texto ya escrito (sin archivo).
    // Sin número, abre la lista de chats de Business para elegir a quién mandarlo.
    @PluginMethod
    public void abrirChat(PluginCall call) {
        String numero = call.getString("numero", "");
        String texto = call.getString("texto", "");
        try {
            StringBuilder u = new StringBuilder("whatsapp://send?");
            if (numero != null && !numero.isEmpty()) u.append("phone=").append(Uri.encode(numero)).append("&");
            u.append("text=").append(Uri.encode(texto == null ? "" : texto));
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(u.toString()));
            i.setPackage(BUSINESS);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(i);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("WhatsApp Business no está instalado", "NO_WHATSAPP");
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()), "ERROR");
        }
    }
}
