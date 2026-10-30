import { Alert } from 'react-native';
import { finishedMessage, type FinishedTeam } from '../../features/tournament/phases';
import type { Translate } from '../../features/tournament/display';

/** After a result: tells which teams can leave, then goes on (`next`). Goes on at once when nobody finished. */
export function showFinished(teams: FinishedTeam[], t: Translate, next: () => void): void {
  if (teams.length === 0) {
    next();
    return;
  }
  const { title, message } = finishedMessage(teams, t);
  Alert.alert(title, message, [{ text: t('tournament.finished.ok'), onPress: next }], { cancelable: false });
}
