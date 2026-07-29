export default function ReadFile(file: Blob): Promise<FileReader['result']> {
  return new Promise<FileReader['result']>((resolve) => {
    const reader = new FileReader();
    reader.addEventListener('load', (event) => {
      if (event.target) {
        const result = event.target.result;
        resolve(result);
      }
    });
    reader.readAsDataURL(file);
  });
}
