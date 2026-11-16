import { describe, it, expect } from 'vitest'
import { readCertificate, findDates, findExpiry, namesPlace, CERTIFIERS } from '../src/lib/certificate.js'

const today = new Date(2026, 10, 16) // 16 Nov 2026
const iso = (d) => d.toISOString().slice(0, 10)

describe('findDates', () => {
  const one = (s) => findDates(s).map((d) => d.options.map(iso))
  it('reads the common written forms', () => {
    expect(one('2027-03-31')).toEqual([['2027-03-31']])
    expect(one('31/12/2026')).toEqual([['2026-12-31']])
    expect(one('12/31/2026')).toEqual([['2026-12-31']])
    expect(one('31.12.26')).toEqual([['2026-12-31']])
    expect(one('31 December 2026')).toEqual([['2026-12-31']])
    expect(one('31st Dec. 2026')).toEqual([['2026-12-31']])
    expect(one('December 31, 2026')).toEqual([['2026-12-31']])
    expect(one('31 décembre 2026')).toEqual([['2026-12-31']])
    expect(one('31 de diciembre de 2026')).toEqual([['2026-12-31']])
    expect(one('31. März 2027')).toEqual([['2027-03-31']])
  })
  it('reads "Month Year" as the end of that month', () => {
    expect(one('valid until February 2028')).toEqual([['2028-02-29']])
  })
  it('keeps both readings when day and month can swap', () => {
    expect(one('03/04/2027')).toEqual([['2027-04-03', '2027-03-04']])
  })
  it('ignores impossible dates, Hijri years and phone numbers', () => {
    expect(one('31/02/2027')).toEqual([])
    expect(one('Issued 12/05/1447 AH')).toEqual([])
    expect(one('Tel 12-34-56')).toEqual([])
    expect(one('Tel 01-23-45')).toEqual([])
  })
  it('does not double count a full date', () => {
    expect(findDates('Expiry: 31 December 2026')).toHaveLength(1)
  })
})

describe('findExpiry', () => {
  it('prefers the date after an expiry word', () => {
    const e = findExpiry('Valid until: 30/06/2026. Issued on 01/07/2027 (typo on the certificate)')
    expect(e.options.map(iso)).toEqual(['2026-06-30'])
    expect(e.cued).toBe(true)
  })
  it('otherwise takes the latest date (the issue date comes first)', () => {
    const e = findExpiry('Date: 01/01/2026 — 31/12/2027')
    expect(e.options.map(iso)).toEqual(['2027-12-31'])
    expect(e.cued).toBe(false)
  })
  it('understands Arabic and Malay expiry words', () => {
    expect(iso(findExpiry('صالحة حتى 2027-01-15').options[0])).toBe('2027-01-15')
    expect(iso(findExpiry('Tarikh tamat: 15/01/2027, dikeluarkan 15/01/2025').options[0])).toBe('2027-01-15')
  })
  it('returns null without dates', () => expect(findExpiry('Halal certificate')).toBeNull())
})

describe('namesPlace', () => {
  it('finds the distinctive words of the name, ignoring accents and case', () => {
    expect(namesPlace('This certifies that CAFÉ ISTANBUL GRILL LTD complies', 'Café Istanbul')).toBe(true)
    expect(namesPlace('certifies that Bosphorus Kebab House', 'Café Istanbul')).toBe(false)
  })
  it('has no opinion when the name is only generic words', () => {
    expect(namesPlace('anything', 'Halal Restaurant')).toBeNull()
  })
})

describe('readCertificate', () => {
  const hmc = `HALAL MONITORING COMMITTEE
  Certificate of Halal Compliance
  This certifies that ISTANBUL GRILL, 12 High Street, London
  meets the HMC standard.
  Certificate No. 4471   Issued: 01/02/2026   Expiry date: 31/01/2027`

  it('reads a current certificate', () => {
    const r = readCertificate(hmc, { placeName: 'Istanbul Grill', today })
    expect(r.status).toBe('valid')
    expect(r.bodies.map((b) => b.id)).toContain('hmc')
    expect(iso(r.expiry)).toBe('2027-01-31')
    expect(r.daysLeft).toBe(76)
    expect(r.names).toBe(true)
  })
  it('flags an expired certificate', () => {
    const r = readCertificate(hmc.replace('31/01/2027', '31/01/2026'), { placeName: 'Istanbul Grill', today })
    expect(r.status).toBe('expired')
  })
  it('notices a certificate made out to another restaurant', () => {
    expect(readCertificate(hmc, { placeName: 'Bosphorus Kebab', today }).names).toBe(false)
  })
  it('asks to check the date when day/month order changes the answer', () => {
    // 10/12/2026 is 10 Dec (still valid) or 12 Oct (already expired)
    const r = readCertificate('Halal Food Authority. Valid until 10/12/2026', { today })
    expect(r.status).toBe('checkDate')
    expect(r.options).toHaveLength(2)
  })
  it('does not ask when both readings agree', () => {
    expect(readCertificate('Halal. Expires 03/04/2028', { today }).status).toBe('valid')
    expect(readCertificate('Halal. Expires 03/04/2024', { today }).status).toBe('expired')
  })
  it('recognises bodies across the world', () => {
    const cases = {
      jakim: 'Sijil Pengesahan Halal Malaysia — JABATAN KEMAJUAN ISLAM MALAYSIA',
      mui: 'Sertifikat Halal LPPOM MUI',
      muis: 'Majlis Ugama Islam Singapura Halal Certificate',
      ifanca: 'IFANCA Halal certified',
      sanha: 'SANHA Halaal certificate',
      esma: 'Emirates Authority for Standardization and Metrology — Halal',
      jha: 'Japan Halal Association certificate',
      avs: 'Certificat halal A.V.S.',
      gimdes: 'GİMDES Helal Sertifikası',
    }
    for (const [id, text] of Object.entries(cases)) {
      expect(readCertificate(text, { today }).bodies.map((b) => b.id), id).toContain(id)
    }
  })
  it('does not count a short acronym that could be any word unless the text says halal', () => {
    expect(readCertificate('AVS garage — service until 2027-01-01', { today }).status).toBe('notCert')
  })
  it('says when the body is unknown but the word halal is there', () => {
    const r = readCertificate('Halal Certificate issued by Best Halal Board. Valid until 2027-06-01', { today })
    expect(r.status).toBe('valid')
    expect(r.bodies).toEqual([])
  })
  it('reads Arabic certificates', () => {
    const r = readCertificate('شهادة حلال — صالحة حتى 2027-03-01', { today })
    expect(r.halal).toBe(true)
    expect(r.status).toBe('valid')
  })
  it('reports no date when there is none', () => {
    expect(readCertificate('HFA Halal Food Authority approved', { today }).status).toBe('noDate')
  })
  it('says it is not a certificate when nothing halal is on it', () => {
    expect(readCertificate('MENU Burger 5.99 Fries 2.50', { today }).status).toBe('notCert')
    expect(readCertificate('', { today }).status).toBe('notCert')
  })
  it('every certifier has an id, name and pattern', () => {
    const ids = new Set()
    for (const c of CERTIFIERS) {
      expect(c.id && c.name && c.re instanceof RegExp).toBeTruthy()
      expect(ids.has(c.id)).toBe(false); ids.add(c.id)
    }
  })
})
