export function getMimeByExt(ext: 'img' | 'png' | 'pdf' | string) {
  if (ext === 'img') {
    return 'image/jpeg';
  }
  if (ext === 'png') {
    return 'image/png';
  }
  if (ext === 'pdf') {
    return 'application/pdf';
  }
  return 'application/png';
}
