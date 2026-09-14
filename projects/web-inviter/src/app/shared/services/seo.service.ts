import { DOCUMENT, Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

/** The public address every canonical URL and share preview points at, whatever host served the page. */
export const SITE_URL = 'https://invites.blog';

/** The picture a shared link shows when a page has nothing more specific. 1200×630. */
export const DEFAULT_SHARE_IMAGE = `${SITE_URL}/og-image.png`;

export type SeoData = {
  /** The page's own title, without the brand. The brand is appended here. */
  title: string;
  description: string;
  /** Absolute, or a site path like /assets/... Defaults to the site's share image. */
  image?: string | null;
  /** Keeps the page out of search results. Every private screen is this. */
  noindex?: boolean;
  /** schema.org structured data for this page. */
  jsonLd?: object | object[];
};

/**
 * Everything a search engine or a chat app reads about a page: title, description, canonical URL,
 * share preview tags and structured data. One place, so no page can set half of them.
 *
 * <p>Runs during prerendering too, so the tags are in the HTML a crawler receives rather than added
 * after the app boots.</p>
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);

  set(data: SeoData, path: string): void {
    const title = data.title === BRAND ? BRAND : `${data.title} | ${BRAND}`;
    const url = SITE_URL + (path.split(/[?#]/)[0] || '/');
    const image = absolute(data.image) ?? DEFAULT_SHARE_IMAGE;

    this.title.setTitle(title);
    this.name('description', data.description);
    this.name('robots', data.noindex ? 'noindex, nofollow' : 'index, follow');

    this.property('og:site_name', BRAND);
    this.property('og:type', 'website');
    this.property('og:title', title);
    this.property('og:description', data.description);
    this.property('og:url', url);
    this.property('og:image', image);
    this.name('twitter:card', 'summary_large_image');
    this.name('twitter:title', title);
    this.name('twitter:description', data.description);
    this.name('twitter:image', image);

    this.canonical(data.noindex ? null : url);
    this.structuredData(data.noindex ? undefined : data.jsonLd);
  }

  private name(name: string, content: string): void {
    this.meta.updateTag({ name, content });
  }

  private property(property: string, content: string): void {
    this.meta.updateTag({ property, content });
  }

  private canonical(url: string | null): void {
    let link = this.doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!url) {
      link?.remove();
      return;
    }
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  private structuredData(data: object | object[] | undefined): void {
    this.doc.head.querySelector('script#structured-data')?.remove();
    if (!data) return;
    const script = this.doc.createElement('script');
    script.id = 'structured-data';
    script.setAttribute('type', 'application/ld+json');
    // "<" escaped so a template description can never close the script tag.
    script.textContent = JSON.stringify(data).replace(/</g, '\\u003c');
    this.doc.head.appendChild(script);
  }
}

const BRAND = 'invites.blog';

function absolute(image: string | null | undefined): string | null {
  if (!image) return null;
  return /^https?:\/\//.test(image) ? image : SITE_URL + (image.startsWith('/') ? image : `/${image}`);
}
