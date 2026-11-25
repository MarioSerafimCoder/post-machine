import type { ImageCredit } from '../images/contract'
import type { ExpressPhoto } from './expressDraft'
import { readImage } from './images'
import { prepareCollectionImage } from './collections'

export async function imagePhoto(file: File, credit?: ImageCredit, signal?: AbortSignal): Promise<ExpressPhoto> {
    const buffer = await file.arrayBuffer()
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))
    const id = Array.from(hash, byte => byte.toString(16).padStart(2,'0')).join('')
    signal?.throwIfAborted()
    const image = await readImage(file)
    try {
      signal?.throwIfAborted()
      if (credit) image.set({ imageCredit: credit })
      return { id, name:file.name, bytes:file.size, object:prepareCollectionImage(image), file }
    } finally { image.dispose() }
  }
