
declare const pdfjsLib: any;

interface ProcessedPdf {
    text: string;
    thumbnail: string;
}

export const processPdf = async (file: File): Promise<ProcessedPdf> => {
    const typedarray = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjsLib.getDocument(typedarray).promise;

    // Generate Thumbnail
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 0.5 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    if (context) {
        await page.render({ canvasContext: context, viewport: viewport }).promise;
    }
    const thumbnail = canvas.toDataURL('image/jpeg', 0.7);

    // Extract Text
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
    }

    return { text: fullText, thumbnail };
};
