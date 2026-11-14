import { FabricImage } from 'fabric'
export async function readImage(file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 20_000_000) throw Error('Use PNG, JPEG ou WebP de até 20 MB.')
  const src = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(Error('Não foi possível ler a imagem.')); reader.readAsDataURL(file) })
  const img = await FabricImage.fromURL(src)
  if (img.width * img.height > 40_000_000 || img.width < 32 || img.height < 32) { img.dispose(); throw Error('Use imagens entre 32 px e 40 megapixels.') }
  return img
}
export function cropImage(image: FabricImage, ratio: number) {
  const original = image.getOriginalSize()
  const w = Math.min(original.width, original.height * ratio)
  const h = w / ratio
  const displayed = image.getScaledWidth()
  image.set({ cropX: (original.width - w) / 2, cropY: (original.height - h) / 2, width: w, height: h, scaleX: displayed / w, scaleY: displayed / w })
  image.setCoords()
}
