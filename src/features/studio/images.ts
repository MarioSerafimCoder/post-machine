import { FabricImage } from 'fabric'
export async function readImage(file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 20_000_000) throw Error('Use PNG, JPEG ou WebP de até 20 MB.')
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const signature = (offset: number, ...bytes: number[]) => bytes.every((value, index) => header[offset + index] === value)
  const valid = file.type === 'image/png' ? signature(0, 137, 80, 78, 71, 13, 10, 26, 10)
    : file.type === 'image/jpeg' ? signature(0, 255, 216, 255)
    : signature(0, 82, 73, 70, 70) && signature(8, 87, 69, 66, 80)
  if (!valid) throw Error('O arquivo não corresponde ao formato indicado ou está corrompido.')
  const src = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(Error('Não foi possível ler a imagem.')); reader.readAsDataURL(file) })
  const img = await FabricImage.fromURL(src).catch(() => { throw Error('O arquivo não pôde ser decodificado. Baixe ou exporte o original novamente.') })
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

export function restoreFraming(image: FabricImage) {
  const { width, height } = image.getOriginalSize()
  const scale = Math.min(image.width * image.scaleX / width, image.height * image.scaleY / height)
  image.set({ cropX: 0, cropY: 0, width, height, scaleX: scale, scaleY: scale })
  image.setCoords()
}
