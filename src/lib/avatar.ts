// Project avatars are uploaded to Layerwise Storage as public files, since the
// board header and favicon show them to everyone.

export const maxAvatarBytes = 2 * 1024 * 1024;
export const avatarAccept = 'image/png,image/jpeg,image/webp,image/gif';
export const avatarTooLarge = 'Choose an image up to 2 MB.';

type AvatarType = { contentType: string; extension: string };

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) => signature.every((byte, index) => bytes[offset + index] === byte);
const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

/**
 * The image type from the file's first bytes. The browser's declared type is
 * only a claim, and a public file must not be something other than an image.
 * SVG is excluded because it can carry script.
 */
export function detectAvatarType(bytes: Uint8Array): AvatarType | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { contentType: 'image/png', extension: 'png' };
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { contentType: 'image/jpeg', extension: 'jpg' };
  if (startsWith(bytes, ascii('GIF87a')) || startsWith(bytes, ascii('GIF89a'))) return { contentType: 'image/gif', extension: 'gif' };
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)) return { contentType: 'image/webp', extension: 'webp' };
  return null;
}
