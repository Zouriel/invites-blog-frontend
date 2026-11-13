import { describe, expect, it } from 'vitest';
import { Portfolio, PortfolioSection } from '../../shared/portfolio/portfolio.types';
import { handleFromName, sectionDescription } from './portfolio-shared';

const section = (over: Partial<PortfolioSection>): PortfolioSection => ({
  id: 's', kind: 'about', hidden: false, locked: false, collectionId: null, title: null, body: null, photoId: null, photoUrl: null,
  templateIds: [], packages: [], reviews: [], ...over,
});

describe('portfolio editor helpers', () => {
  it('makes a link name from a studio name', () => {
    expect(handleFromName('Lens & Light Studio')).toBe('lens.light.studio');
    expect(handleFromName('Café Rosé')).toBe('cafe.rose');
    expect(handleFromName('A')).toBe('');
    expect(handleFromName('x'.repeat(40)).length).toBe(30);
  });

  it('says what is in each section in plain words', () => {
    const p = {
      contact: { whatsApp: '+9607771234', viber: null, instagram: 'x', phone: null, email: null, enquiries: true },
      collections: [{ id: 'c1', title: 'Weddings', layout: 'grid', coverPhotoId: null, coverUrl: null, photos: [{}, {}] }],
    } as unknown as Portfolio;
    expect(sectionDescription(section({ kind: 'cover', locked: true }), p)).toBe('Always first');
    expect(sectionDescription(section({ kind: 'collection', collectionId: 'c1' }), p)).toBe('2 photos');
    expect(sectionDescription(section({ kind: 'contact' }), p)).toBe('2 buttons and a message form');
    expect(sectionDescription(section({ kind: 'packages' }), p)).toBe('None yet');
  });
});
