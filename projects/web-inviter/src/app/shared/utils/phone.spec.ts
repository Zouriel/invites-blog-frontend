import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '../api/api.service';
import { RegionService } from '../services/region.service';
import { SessionStore } from '../services/session.store';
import { Account } from './types/api.types';
import { formatPhone, knownCountry, phoneCountryOf, phoneProblem, pickDefaultCountry } from './phone';

describe('phone numbers', () => {
  describe('the default country', () => {
    it('is the account’s, else the visitor’s, else none: never a built-in one', () => {
      expect(pickDefaultCountry('GB', 'US')).toBe('GB');
      expect(pickDefaultCountry(null, 'US')).toBe('US');
      expect(pickDefaultCountry(undefined, 'mv')).toBe('MV');
      expect(pickDefaultCountry(null, null)).toBeNull();
      // Cloudflare's "unknown" and "Tor" aren't countries.
      expect(pickDefaultCountry(null, 'XX')).toBeNull();
      expect(pickDefaultCountry('T1', null)).toBeNull();
      expect(knownCountry('gbr')).toBeNull();
    });
  });

  describe('RegionService', () => {
    let account: Account | null;
    let geoCalls: number;
    let geoAnswer: string | null;

    function setup(): RegionService {
      sessionStorage.clear();
      geoCalls = 0;
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          {
            provide: ApiService,
            useValue: {
              geo: () => {
                geoCalls++;
                return of({ country: geoAnswer });
              },
              updateAccountSettings: () => of(null),
            },
          },
          {
            provide: SessionStore,
            useValue: { account: () => account, isSignedIn: () => !!account, setAccount: () => {} },
          },
        ],
      });
      return TestBed.inject(RegionService);
    }

    const flush = () => new Promise((r) => setTimeout(r, 0));

    it('starts on the signed-in account’s country without asking for the visitor’s', async () => {
      account = { id: 'u', country: 'GB', timeZone: 'Europe/London' } as Account;
      geoAnswer = 'US';
      const region = setup();
      expect(region.defaultCountry()).toBe('GB');
      await flush();
      expect(geoCalls).toBe(0);
      expect(region.timeZone()).toBe('Europe/London');
    });

    for (const country of ['GB', 'US', 'MV']) {
      it(`signed out, starts on the visitor’s country from Cloudflare (${country}), asked once`, async () => {
        account = null;
        geoAnswer = country;
        const region = setup();
        expect(region.defaultCountry()).toBeNull();
        await flush();
        expect(region.defaultCountry()).toBe(country);
        expect(geoCalls).toBe(1);
        // Cached for the session: a second service (another page) doesn't ask again.
        TestBed.resetTestingModule();
        const again = (() => {
          TestBed.configureTestingModule({
            providers: [
              { provide: ApiService, useValue: { geo: () => { geoCalls++; return of({ country: 'FR' }); } } },
              { provide: SessionStore, useValue: { account: () => null, isSignedIn: () => false, setAccount: () => {} } },
            ],
          });
          return TestBed.inject(RegionService);
        })();
        expect(again.defaultCountry()).toBe(country);
        await flush();
        expect(geoCalls).toBe(1);
      });
    }

    it('has no default at all when nobody knows the country', async () => {
      account = { id: 'u', country: null } as Account;
      geoAnswer = null;
      const region = setup();
      region.defaultCountry();
      await flush();
      expect(region.defaultCountry()).toBeNull();
    });
  });

  describe('validation (libphonenumber)', () => {
    it('accepts real numbers from anywhere', () => {
      expect(phoneProblem('+447400123456')).toBeNull();
      expect(phoneProblem('+12025550123')).toBeNull();
      expect(phoneProblem('+9607771234')).toBeNull();
      expect(phoneProblem('')).toBeNull();
      expect(phoneProblem(null)).toBeNull();
    });

    it('says what is wrong, naming the country', () => {
      expect(phoneProblem('+44770090')).toBe('That number is too short for United Kingdom. Check the digits.');
      expect(phoneProblem('+96077712345678')).toMatch(/too long/);
      expect(phoneProblem('+9601111111')).toMatch(/doesn't look like a valid number/);
      expect(phoneProblem('7771234')).toBe('Pick the country for this number.');
    });

    it('finds the country of a number and formats it for reading', () => {
      expect(phoneCountryOf('+447400123456')).toBe('GB');
      expect(phoneCountryOf('+12025550123')).toBe('US');
      expect(phoneCountryOf('+9607771234')).toBe('MV');
      expect(formatPhone('+447400123456')).toBe('+44 7400 123456');
    });
  });
});
