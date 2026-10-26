// Turns any picture the browser can open into a small square image for a group: centre-cropped, resized to
// 384px and encoded as WebP (JPEG where the browser can't encode WebP). The upload is usually 15 to 40 KB.

import { CHAT_LIMITS } from "../../shared/limits";

const MAX_INPUT_BYTES = 20 * 1024 * 1024;

export class PhotoError extends Error {}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Fall through to <img>, which some browsers decode more formats with.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new PhotoError("This picture can’t be opened. Use a JPG, PNG or WebP file.");
  }
}

/** Returns a `data:` URL ready for `chatApi.setGroupPhoto`. */
export async function prepareGroupPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") throw new PhotoError("Choose a JPG, PNG or WebP picture.");
  if (file.size > MAX_INPUT_BYTES) throw new PhotoError("This picture is over 20 MB. Choose a smaller one.");

  const { source, width, height, close } = await decode(file);
  try {
    if (!width || !height) throw new PhotoError("This picture is empty.");
    const size = CHAT_LIMITS.groupPhotoPixels;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new PhotoError("Your browser couldn’t process the picture.");
    const side = Math.min(width, height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, (width - side) / 2, (height - side) / 2, side, side, 0, 0, size, size);

    const limit = CHAT_LIMITS.groupPhotoMaxBytes;
    for (const quality of [0.88, 0.8, 0.7, 0.6]) {
      let url = canvas.toDataURL("image/webp", quality);
      // Browsers that can't encode WebP quietly return PNG instead.
      if (!url.startsWith("data:image/webp")) url = canvas.toDataURL("image/jpeg", quality);
      const bytes = Math.floor(((url.length - url.indexOf(",") - 1) * 3) / 4);
      if (bytes <= limit) return url;
    }
    throw new PhotoError("This picture is too detailed to upload. Try another one.");
  } finally {
    close();
  }
}
