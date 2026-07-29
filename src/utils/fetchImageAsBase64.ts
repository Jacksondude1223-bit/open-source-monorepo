const mimetics = require('mimetics')


export default async function fetchImageAsBase64(imageUrl: string): Promise<string> {
    try {
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        // const type = await fileTypeFromBuffer(buffer);
        const fileInfo = mimetics.parse(buffer)

        if (!fileInfo || !['jpg', 'png', 'gif'].includes(fileInfo.ext)) {
            throw new Error('Unsupported image type');
        }

        const base64 = buffer.toString('base64');
        return `data:${fileInfo.mime};base64,${base64}`;
    } catch (error) {
        console.error(error);
        return '';
    }
}