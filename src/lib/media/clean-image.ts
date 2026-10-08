/**
 * Foto limpa para o anúncio público.
 *
 * A foto do celular traz EXIF com a coordenada GPS de onde foi tirada — dentro
 * do imóvel, isso é o endereço exato. Redesenhar a imagem num canvas e exportar
 * de novo gera um arquivo novo, só com os pixels: nenhum metadado sobrevive.
 * De quebra a foto chega menor (lado maior de até 2560 px) e já na orientação
 * certa, que antes dependia de uma tag EXIF.
 *
 * O ORIGINAL não passa por aqui: vai para o bucket privado, com GPS, para o
 * Master conferir (ver media-uploader.tsx).
 *
 * Só roda no navegador.
 */
export async function cleanImage(file: Blob, maxSide = 2560): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Seu navegador não conseguiu processar a imagem.");
  // PNG com transparência viraria fundo preto no JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Não foi possível converter a imagem."))),
      "image/jpeg",
      0.85,
    );
  });
}
