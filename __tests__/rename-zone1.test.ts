/**
 * 1.2.3: the app is shown as « Zone1 Volley ». Technical identifiers stay the
 * same so that old backups, old QR codes and the Play Store listing keep working.
 */
import fs from 'fs';
import path from 'path';
import { DB_NAME } from '../src/services/database';
import { BACKUP_FILE_NAME } from '../src/features/backup/driveApi';
import { MATCH_QR_PREFIX } from '../src/features/tournament/matchQr';

const ROOT = path.join(__dirname, '..');
const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8')).expo;
const I18N = path.join(ROOT, 'src/i18n');
const locales = fs.readdirSync(I18N).filter((f) => f.endsWith('.json'));

describe('visible name is Zone1 Volley', () => {
  it('name under the icon', () => {
    expect(appJson.name).toBe('Zone1 Volley');
  });

  it('11 languages, none still says VolleyManager', () => {
    expect(locales).toHaveLength(11);
    for (const f of locales) {
      const json = JSON.parse(fs.readFileSync(path.join(I18N, f), 'utf8'));
      expect(json.home.title).toBe('Zone1 Volley');
      expect(JSON.stringify(json)).not.toMatch(/VolleyManager/);
    }
  });

  it('About screen uses the translated name', () => {
    const about = fs.readFileSync(path.join(ROOT, 'app/about.tsx'), 'utf8');
    expect(about).not.toMatch(/VolleyManager/);
  });
});

describe('technical identifiers are unchanged', () => {
  it('package, slug, scheme', () => {
    expect(appJson.android.package).toBe('com.sylldevlearning.volleymanager');
    expect(appJson.slug).toBe('volleymanager');
    expect(appJson.scheme).toBe('volleymanager');
  });

  it('database, Drive backup file, QR prefix', () => {
    expect(DB_NAME).toBe('volleymanager.db');
    expect(BACKUP_FILE_NAME).toBe('volleymanager-backup.db');
    expect(MATCH_QR_PREFIX).toBe('VMT1:');
  });
});

describe('no foreground service', () => {
  it('FOREGROUND_SERVICE (added by WorkManager through AdMob) is blocked', () => {
    expect(appJson.android.blockedPermissions).toContain('android.permission.FOREGROUND_SERVICE');
  });
});
