/**
 * FFVolley licence sheets: only the licence number, last name and first name.
 * All names and numbers below are invented.
 */
import { parseNames, splitFullName, type TextBlock } from '../src/features/scanner/ocrParser';

/** OCR result: one block per array, one line per string */
const ocr = (...blocks: string[][]): TextBlock[] =>
  blocks.map((lines) => ({ text: lines.join('\n'), lines: lines.map((text) => ({ text })) }));

const simple = (blocks: TextBlock[]) =>
  parseNames(blocks).map((p) => [p.licenseNumber, p.lastName, p.firstName]);

/** A whole invented licence card, with everything that must be ignored */
const card = (licence: string, civility: string, name: string) => [
  'FFVOLLEY',
  'COMPETITION',
  'LIGUE EXEMPLE DE VOLLEY',
  'SAISON 2026/2027',
  '0990001 V.C.EXEMPLE',
  `${licence} ${civility} ${name}`,
  'NE(E) LE 01/02/2003',
  'SENIOR F',
  'NATIONALITE : FRANCAISE',
  'MUT.REGIONALE',
  'DHO 15/09/2026',
  'N° VERT 0 800 000 000',
  'SPONSORCO',
  '14',
];

describe('one licence', () => {
  it('number, last name and first name; everything else ignored', () => {
    expect(simple(ocr(card('1000001', 'MME', 'ALPHA BETTY')))).toEqual([['1000001', 'Alpha', 'Betty']]);
  });

  it('the club number (7 digits followed by the club name) is not a player', () => {
    const players = simple(ocr(['0990001 V.C.EXEMPLE', '0990002 VOLLEY CLUB TESTVILLE', '1000002 M. BRAVO CARL']));
    expect(players).toEqual([['1000002', 'Bravo', 'Carl']]);
  });

  it.each([
    ['MME', 'Delta', 'Erin'],
    ['M.', 'Delta', 'Erin'],
    ['M', 'Delta', 'Erin'],
    ['MLLE', 'Delta', 'Erin'],
    ['MME.', 'Delta', 'Erin'],
  ])('civility "%s" is removed', (civility, last, first) => {
    expect(simple(ocr([`1000003 ${civility} DELTA ERIN`]))).toEqual([['1000003', last, first]]);
  });

  it('the name stops at a date, a category or a mention on the same line', () => {
    expect(simple(ocr(['1000004 MME ECHO FAY 01/02/2003 SENIOR F']))).toEqual([['1000004', 'Echo', 'Fay']]);
    expect(simple(ocr(['1000005 M. FOXTROT GUS SENIOR']))).toEqual([['1000005', 'Foxtrot', 'Gus']]);
    expect(simple(ocr(['1000006 M. GOLF HUGO MUT.REGIONALE']))).toEqual([['1000006', 'Golf', 'Hugo']]);
  });

  it('handwritten numbers and lines without a licence number make no player', () => {
    expect(simple(ocr(['7', '12', 'HOTEL INDIA', 'COMPETITION SENIOR']))).toEqual([]);
  });
});

describe('a photo of several licences', () => {
  it('extracts every player, in order', () => {
    const sheet = [
      ...card('1000011', 'MME', 'AMBER ANNA'),
      ...card('1000012', 'M.', 'BIRCH BORIS'),
      ...card('1000013', 'MME', 'CEDAR CLARA'),
      ...card('1000014', 'M.', 'DUNE DAVID'),
      ...card('1000015', 'MLLE', 'ELM EMMA'),
      ...card('1000016', 'M.', 'FERN FELIX'),
      ...card('1000017', 'MME', 'GROVE GINA'),
      ...card('1000018', 'M.', 'HAZEL HENRI'),
      ...card('1000019', 'MME', 'IVY IRIS'),
      ...card('1000020', 'M.', 'JUNIPER JULES'),
    ];
    const players = simple(ocr(sheet));
    expect(players).toHaveLength(10);
    expect(players[0]).toEqual(['1000011', 'Amber', 'Anna']);
    expect(players[9]).toEqual(['1000020', 'Juniper', 'Jules']);
  });

  it('the same licence seen twice is kept once', () => {
    expect(simple(ocr(['1000021 M. KILO LEO'], ['1000021 M. KILO LEO']))).toEqual([['1000021', 'Kilo', 'Leo']]);
  });
});

describe('OCR cuts or shifts the line', () => {
  it('number alone, then civility and name on the next line', () => {
    expect(simple(ocr(['1000031', 'MME LIMA MIA']))).toEqual([['1000031', 'Lima', 'Mia']]);
  });

  it('cut after the civility', () => {
    expect(simple(ocr(['1000032 M.', 'MIKE NOAH']))).toEqual([['1000032', 'Mike', 'Noah']]);
  });

  it('cut between last name and first name', () => {
    expect(simple(ocr(['1000033 MME NOVEMBER', 'OLIVIA']))).toEqual([['1000033', 'November', 'Olivia']]);
  });

  it('pieces in separate blocks', () => {
    expect(simple(ocr(['1000034'], ['M. OSCAR PAUL'], ['SENIOR M']))).toEqual([['1000034', 'Oscar', 'Paul']]);
  });

  it('a column of numbers, then a column of names: paired in order', () => {
    const players = simple(ocr(['1000041', '1000042', '1000043'], ['MME PAPA QUINN', 'M. QUEBEC RAY', 'MME ROMEO SARA']));
    expect(players).toEqual([
      ['1000041', 'Papa', 'Quinn'],
      ['1000042', 'Quebec', 'Ray'],
      ['1000043', 'Romeo', 'Sara'],
    ]);
  });

  it('names read before their numbers: paired in order', () => {
    const players = simple(ocr(['MME SIERRA TINA', 'M. TANGO UGO'], ['1000051', '1000052']));
    expect(players).toEqual([
      ['1000051', 'Sierra', 'Tina'],
      ['1000052', 'Tango', 'Ugo'],
    ]);
  });

  it('a club number alone on its line, followed by the club name, is not paired', () => {
    expect(simple(ocr(['0990003', 'V.B. EXEMPLE', '1000061 M. UNIFORM VICTOR']))).toEqual([['1000061', 'Uniform', 'Victor']]);
  });
});

describe('compound names: most likely split, the user can correct it', () => {
  it.each([
    ['WHISKEY XAVIER', 'Whiskey', 'Xavier'],
    ['YANKEE-ZULU ANNE-SOPHIE', 'Yankee-Zulu', 'Anne-Sophie'],
    ['ALPHA JEAN PIERRE', 'Alpha', 'Jean Pierre'],
    ['DE LA BRAVO MARC', 'De La Bravo', 'Marc'],
    ['VAN CHARLIE LUC', 'Van Charlie', 'Luc'],
    ["D'DELTA ROSE", "D'Delta", 'Rose'],
    ["N'ECHO AWA", "N'Echo", 'Awa'],
    ['LE FOX MARIE ANNE', 'Le Fox', 'Marie Anne'],
  ])('%s → %s / %s', (name, last, first) => {
    expect(splitFullName(name.split(' '))).toEqual({ lastName: last, firstName: first });
    expect(simple(ocr([`1000070 M. ${name}`]))).toEqual([['1000070', last, first]]);
  });

  it('a single word: last name only', () => {
    expect(splitFullName(['GOLF'])).toEqual({ lastName: 'Golf', firstName: '' });
  });
});

describe('result screen', () => {
  it('last name and first name are editable before the import', () => {
    const sheet = require('fs').readFileSync(require('path').join(__dirname, '../src/features/scanner/ScannerSheet.tsx'), 'utf8') as string;
    expect(sheet).toContain("updateName(item.id, 'lastName', v)");
    expect(sheet).toContain("updateName(item.id, 'firstName', v)");
    expect(sheet).toContain("placeholder={t('player.lastName')}");
    expect(sheet).toContain("placeholder={t('player.firstName')}");
  });
});
