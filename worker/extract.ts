import type { DocumentaryAsset } from '../src/features/images/documentaryContract'
import { researchUrl } from '../src/features/images/visualContext'
import { verifiedPortfolioImage, verifiedPortfolioPage } from './security'

type Element = { getAttribute(name: string): string | null; onEndTag(callback: () => void): void }
type Chunk = { text: string; lastInTextNode: boolean }
type Handler = { element?(value: Element): void; text?(value: Chunk): void }
declare class HTMLRewriter {
  on(selector: string, handler: Handler): this
  transform(response: Response): Response
}

export type Extracted = Omit<DocumentaryAsset, 'ticket'>
type Media = Omit<Extracted, 'page' | 'provider'> & { figure?: number; withinArticle?: boolean }
const text = (value: unknown, max: number) => typeof value === 'string'
  ? value.replace(/<[^>]{1,200}>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) || undefined : undefined
const dimension = (value: unknown) => /^\d{1,5}$/.test(String(value)) && Number(value) > 0 && Number(value) <= 40000 ? Number(value) : undefined
const unwanted = /(?:^|[\s/._-])(?:avatar|favicon|sprite|placeholder|tracking|spacer|pixel|advertisement|icon|homepage|sitewide)(?=$|[\s/._-])/i
const logo = /(?:^|[\s/._-])logo(?=$|[\s/._-])/i
const blocked = 'header:not(.entry-header),nav,footer,aside,[role="navigation"],[role="complementary"],.related,.recommended,.more-stories,.advertisement,.ads,.breadcrumb,[class*="teaser"],[class*="related-"],[class*="recommended-"],article[class*="card"],article[class*="preview"]'
const press = /\b(press.?kit|media.?kit|newsroom|press.?release|press.?room|portfolio|case.?study|press assets|still photography|multimedia|sala de imprensa|kit de imprensa)\b/i

const rasterLink = /\.(?:png|jpe?g|webp)(?:\?|$)/i

function srcset(value: string | null) {
  return value?.split(',').map(part => {
    const [src, descriptor] = part.trim().split(/\s+/)
    return { src, size: Number.parseFloat(descriptor) || 1, width: /w$/.test(descriptor ?? '') ? dimension(descriptor.slice(0, -1)) : undefined }
  }).sort((a, b) => b.size - a.size) ?? []
}

export async function extractArticle(html: string | ReadableStream<Uint8Array>, page: URL, provider: 'original' | 'official') {
  const petsPortfolio = provider === 'official' && verifiedPortfolioPage(page)
  const images = new Map<string, Media>()
  const links = new Set<string>()
  const metadata = new Map<string, string>()
  const captions = new Map<number, string>()
  const descriptors: unknown[] = []
  let omitted = 0
  let currentFigure = 0
  let figures = 0
  let articleDepth = 0
  let hasArticle = false
  let heading = ''
  let headingBuffer = ''
  let structured = ''
  let anchor: { href: string; label: string } | undefined
  let unavailable = false
  let channelId: string | undefined
  let requiresRendering = false
  const add = (raw: unknown, fields: Omit<Media, 'url'>) => {
    let url = typeof raw === 'string' && researchUrl(raw.trim().replace(/&amp;/gi, '&'), page.href)
    if (url && url.origin === page.origin && /^\/_next\/image(?:\/|$)/.test(url.pathname)) {
      const original = url.searchParams.get('url')
      url = !!original && /^\/(?!\/)/.test(original) && researchUrl(original, page.href)
    }
    if (!url || unwanted.test(url.pathname) || unwanted.test(fields.caption ?? '') ||
      (fields.width && fields.width < 360) || (fields.height && fields.height < 300) || images.size >= 45) return
    const caption = fields.caption ?? ''
    if ((logo.test(url.pathname) || logo.test(caption)) &&
        !(petsPortfolio && verifiedPortfolioImage(url) && /\b(?:Pets Insurance|Pets Foundation|Pet Pals)\b/i.test(caption))) return
    const before = images.get(url.href)
    if (!before || ['figure', 'poster', 'structured'].includes(fields.evidence) || fields.withinArticle && !before.withinArticle) {
      const defined = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined))
      images.set(url.href, { ...(before ?? fields), ...defined, url: url.href })
    }
  }
  const addLink = (value: string) => {
    const url = researchUrl(value, page.href)
    if (url && url.href !== page.href && links.size < 12) links.add(url.href)
  }
  function jsonImage(value: unknown, evidence: Media['evidence'], depth: number) {
    if (depth > 6) return
    if (Array.isArray(value)) { value.slice(0, 16).forEach(item => jsonImage(item, evidence, depth + 1)); return }
    if (typeof value === 'string') { add(value, { evidence }); return }
    if (!value || typeof value !== 'object') return
    const item = value as Record<string, unknown>
    add(item.contentUrl ?? item.url ?? item['@id'], { evidence, title: text(item.name, 500),
      caption: text(item.caption, 600), description: text(item.description, 1000), width: dimension(item.width), height: dimension(item.height),
      author: text(item.creditText, 500), licenseUrl: typeof item.license === 'string' ? researchUrl(item.license)?.href : undefined })
  }
  function descriptor(value: unknown, depth = 0) {
    if (depth > 5 || !value || typeof value !== 'object') return
    if (Array.isArray(value)) { value.slice(0, 24).forEach(item => descriptor(item, depth + 1)); return }
    const item = value as Record<string, unknown>
    const types = [item['@type']].flat()
    if (provider === 'official' && types.some(type => /^(?:Organization|Corporation|LocalBusiness)$/.test(String(type))) &&
        typeof item.url === 'string' && researchUrl(item.url)?.origin === page.origin) {
      for (const entry of [item.sameAs].flat().slice(0, 20)) {
        if (typeof entry !== 'string') continue
        const social = researchUrl(entry)
        const match = social?.origin === 'https://www.youtube.com' && /^\/channel\/(UC[\w-]{22})\/?$/.exec(social.pathname)
        if (match) { channelId ??= match[1]; break }
      }
    }
    if (types.some(type => /Article|BlogPosting|PressRelease/.test(String(type)))) {
      const title = text(item.headline ?? item.name, 500)
      const pageUri = typeof item.url === 'string' ? researchUrl(item.url, page.href) : undefined
      if ((!title && !pageUri) || (pageUri && pageUri.pathname.replace(/\/$/, '') !== page.pathname.replace(/\/$/, ''))) return
      if (item.isAccessibleForFree === false || item.isAccessibleForFree === 'false') unavailable = true
      if (title && !metadata.has('article:title')) metadata.set('article:title', title)
      const date = text(item.datePublished, 50)
      if (date) metadata.set('article:published_time', date)
      jsonImage(item.image ?? item.primaryImageOfPage, 'structured', depth)
      descriptor(item.video, depth + 1)
    }
    if (types.includes('ImageObject') && (item.caption || item.name)) jsonImage(item, 'structured', depth)
    if (types.includes('VideoObject')) jsonImage(item.thumbnailUrl, 'poster', depth)
    descriptor(item['@graph'], depth + 1)
    descriptor(item.mainEntity, depth + 1)
  }
  const intercept = new HTMLRewriter()
    .on('script,noscript', { element() { requiresRendering = true } })
    .on(blocked, { element(node) { omitted++; node.onEndTag(() => { omitted-- }) } })
    .on('article,[itemprop="articleBody"],.entry-content,.post-content,.elementor-widget-theme-post-content', { element(node) {
      if (omitted) return
      hasArticle = true
      articleDepth++
      node.onEndTag(() => { articleDepth-- })
    } })
    .on('meta', { element(node) {
      const property = node.getAttribute('property') ?? node.getAttribute('name')
      const content = node.getAttribute('content')
      if (property && content && metadata.size < 100) {
        if (!metadata.has(property)) metadata.set(property, content.slice(0, 2048))
        if (/^(?:robots|googlebot)$/.test(property) && /\b(?:noimageindex|none)\b/i.test(content)) unavailable = true
        if (/^(?:og:image(?::(?:secure_url|url))?|twitter:image(?::src)?)$/.test(property)) add(content, { evidence: 'social' })
      }
    } })
    .on('script[type="application/ld+json"]', {
      element(node) {
        structured = ''
        node.onEndTag(() => { try { if (descriptors.length < 24) descriptors.push(JSON.parse(structured)) } catch { /* Invalid structured metadata. */ } })
      },
      text(chunk) { if (structured.length < 45_000) structured += chunk.text.slice(0, 45_000 - structured.length) },
    })
    .on('figure', { element(node) {
      if (omitted) return
      const parent = currentFigure
      currentFigure = ++figures
      node.onEndTag(() => { currentFigure = parent })
    } })
    .on('figcaption', { text(chunk) {
      if (currentFigure && !omitted) captions.set(currentFigure, ((captions.get(currentFigure) ?? '') + chunk.text).slice(0, 600))
    } })
    .on('article h2, article h3, main h2, main h3', {
      element(node) {
        if (omitted) return
        headingBuffer = ''
        node.onEndTag(() => { heading = text(headingBuffer, 300) ?? '' })
      },
      text(chunk) { if (!omitted) headingBuffer = (headingBuffer + chunk.text).slice(0, 300) },
    })
    .on('article img, main img, img.wp-post-image, .elementor-widget-theme-post-content img, .elementor-widget-theme-post-content picture source, [itemprop="articleBody"] img, .entry-content img, .post-content img, .gallery img, figure img, article picture source, main picture source, figure picture source, article video[poster], main video[poster]', {
      element(node) {
        const identity = [node.getAttribute('class'), node.getAttribute('id')].join(' ')
        if (omitted || unwanted.test(identity) || logo.test(identity)) return
        // A thumbnail linking to a different story belongs to that story.
        const destination = anchor && researchUrl(anchor.href, page.href)
        if (destination && destination.origin === page.origin && destination.pathname !== page.pathname &&
            !rasterLink.test(destination.pathname) && !/\/(?:uploads|images|media|attachments)\//i.test(destination.pathname)) return
        const [variant, ...renditions] = srcset(node.getAttribute('data-srcset') ?? node.getAttribute('data-lazy-srcset') ?? node.getAttribute('srcset'))
        const candidate = variant?.src ??
          node.getAttribute('data-original') ?? node.getAttribute('data-src') ?? node.getAttribute('data-lazy-src') ??
          node.getAttribute('data-full') ?? node.getAttribute('poster') ?? node.getAttribute('src')
        // The smaller URLs in this srcset point to the same image as the selected raster.
        const alternateUrls = renditions.slice(0, 12).flatMap(({ src }) => {
          const url = src && researchUrl(src, page.href)
          return url && !unwanted.test(url.pathname) ? [url.href] : []
        })
        const hero = researchUrl(metadata.get('og:image') ?? '', page.href)?.href
        const declaredLead = /(?:^|\s)wp-post-image(?:\s|$)/.test(identity) && !!hero &&
          (researchUrl(candidate ?? '', page.href)?.href === hero || alternateUrls.includes(hero))
        if (articleDepth === 0 && /(?:^|\s)wp-post-image(?:\s|$)/.test(identity) && !declaredLead) return
        add(candidate, { evidence: node.getAttribute('poster') ? 'poster' : currentFigure ? 'figure' : 'body', withinArticle: articleDepth > 0 || declaredLead,
          alternateUrls: alternateUrls.length ? alternateUrls : undefined,
          width: variant?.width ?? dimension(node.getAttribute('width')), height: variant ? undefined : dimension(node.getAttribute('height')),
          caption: text(node.getAttribute('alt') ?? node.getAttribute('title'), 600), section: heading || undefined, figure: currentFigure })
      },
    })
    .on('a[href]', {
      element(node) {
        if (omitted) return
        const current = { href: node.getAttribute('href') ?? '', label: '' }
        anchor = current
        node.onEndTag(() => {
          if (press.test(current.href + ' ' + current.label)) addLink(current.href)
          if (/\b(?:press assets|still photography|press images|imagens de imprensa)\b/i.test(current.label) &&
            rasterLink.test(current.href)) add(current.href, { evidence: 'body', caption: text(current.label, 600) })
          if (anchor === current) anchor = undefined
        })
      },
      text(chunk) { if (anchor) anchor.label = (anchor.label + chunk.text).slice(0, 300) },
    })
  const transformed = intercept.transform(new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } }))
  await transformed.body?.pipeTo(new WritableStream())
  descriptors.forEach(value => descriptor(value))
  if (unavailable) return { images: [], links: [], blocked: true }
  const title = text(metadata.get('og:title') ?? metadata.get('article:title') ?? metadata.get('twitter:title'), 500)
  const description = text(metadata.get('og:description') ?? metadata.get('description'), 1000)
  const publishedAt = text(metadata.get('article:published_time'), 50)
  const ogWidth = dimension(metadata.get('og:image:width'))
  const ogHeight = dimension(metadata.get('og:image:height'))
  return { images: [...images.values()].flatMap(({ figure, withinArticle, ...image }): Extracted[] => hasArticle && withinArticle === false ? [] : [{ ...image, page: page.href, provider,
    title: image.title ?? title, description: image.description ?? description, publishedAt,
    width: image.width ?? (image.evidence === 'social' ? ogWidth : undefined),
    height: image.height ?? (image.evidence === 'social' ? ogHeight : undefined),
    // Attribution-only figcaptions must not erase the object's alt description.
    caption: text([...new Set([image.caption, figure ? captions.get(figure) : undefined].filter(Boolean))].join(' '), 600) }]),
    links: [...links], title, requiresRendering, channelId }
}
