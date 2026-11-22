import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import toast from 'react-hot-toast';

/**
 * Universally downloads or saves a file across Web, Android (Capacitor) and iOS.
 * On mobile, saves to device Documents folder and presents the native Android/iOS
 * Share sheet so the user can open with Word/Drive or send via WhatsApp/Email.
 */
export async function saveBlobToDevice(blob, fileName, { share = true, successMsg } = {}) {
  if (!blob) return;
  try {
    if (Capacitor.isNativePlatform()) {
      const reader = new FileReader();
      const base64Promise = new Promise((resolve, reject) => {
        reader.onloadend = () => {
          const res = reader.result;
          const b64 = typeof res === 'string' ? res.split(',')[1] : '';
          resolve(b64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(blob);
      const base64Data = await base64Promise;

      try {
        const perm = await Filesystem.checkPermissions();
        if (perm.publicStorage !== 'granted') {
          await Filesystem.requestPermissions();
        }
      } catch (_) {}

      let fileUri = '';
      try {
        const writeRes = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true,
        });
        fileUri = writeRes.uri;
      } catch (err1) {
        console.warn('Documents write failed, trying Cache directory:', err1);
        const writeRes = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
          recursive: true,
        });
        fileUri = writeRes.uri;
      }

      toast.success(successMsg || `Saved to Documents:\n${fileName}`, { duration: 4000 });

      if (share && fileUri) {
        try {
          await Share.share({
            title: fileName,
            url: fileUri,
            dialogTitle: 'Download or Share Report',
          });
        } catch (shareErr) {
          console.log('Share dismissed or cancelled:', shareErr?.message);
        }
      }
      return fileUri;
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast.success(successMsg || 'Report downloaded');
      return url;
    }
  } catch (err) {
    console.error('File save error:', err);
    toast.error('Could not save file: ' + (err?.message || 'unknown error'));
    throw err;
  }
}
