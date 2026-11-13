/**
 * Tactical board: no saved play ships with the app any more (1.2.5). Only the
 * plays the user saved are listed, and they are kept as they are.
 */
import fs from 'fs';
import path from 'path';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllPlays, savePlay } from '../src/features/tactical/tacticalService';

const ROOT = path.join(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('saved plays', () => {
  it('lists nothing on a fresh install', async () => {
    expect(await getAllPlays()).toEqual([]);
    expect(await getAllPlays('indoor_6v6')).toEqual([]);
  });

  it('keeps the plays the user saved', async () => {
    const play = await savePlay('Ma réception', 'indoor_6v6', 'reception', [], [], 'note');
    const listed = await getAllPlays('indoor_6v6');
    expect(listed).toEqual([play]);
  });

  it('drops a default play left in storage by an older version', async () => {
    const mine = await savePlay('Mon attaque', 'indoor_6v6', 'attack', [], []);
    const stored = JSON.parse((await AsyncStorage.getItem('@volleymanager/tactical_plays'))!);
    stored.push({ ...mine, id: 'default_play_1', name: 'Réception W', isDefault: true });
    await AsyncStorage.setItem('@volleymanager/tactical_plays', JSON.stringify(stored));
    expect((await getAllPlays()).map((p) => p.id)).toEqual([mine.id]);
  });
});

describe('no default plays left in the code', () => {
  it('the built-in plays file is gone', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/features/tactical/defaultPlays.ts'))).toBe(false);
  });

  it('the playbook has no « default » section and the board seeds nothing', () => {
    expect(read('src/components/tactical/PlaybookSheet.tsx')).not.toMatch(/playbook\.defaults|defaultPlays/);
    expect(read('src/components/tactical/TacticalBoard.tsx')).not.toMatch(/seedDefaultPlays/);
  });

  it.each(['fr', 'en', 'es', 'pt-BR', 'it', 'de', 'pl', 'tr', 'ru', 'ja', 'zh-Hans'])('%s: no unused « defaults » label', (lang) => {
    const json = JSON.parse(read(`src/i18n/${lang}.json`));
    expect(json.tactical.playbook.defaults).toBeUndefined();
    expect(json.tactical.playbook.noPlays).toEqual(expect.any(String));
  });
});
