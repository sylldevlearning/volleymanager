import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { palette } from '../../theme/tokens';

interface InfoTooltipProps {
  textKey: string;
}

export function InfoTooltip({ textKey }: InfoTooltipProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setVisible(true)}
        style={styles.btn}
        accessibilityRole="button"
        accessibilityLabel="Info"
        hitSlop={8}
      >
        <Text style={styles.btnText}>?</Text>
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setVisible(false)}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={styles.popup}>
                <Text style={styles.text}>{t(textKey)}</Text>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#21262D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: '#8B949E',
    lineHeight: 14,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingTop: 60,
    paddingRight: 16,
  },
  popup: {
    backgroundColor: palette.backgroundSurface,
    borderRadius: 12,
    padding: 16,
    maxWidth: 280,
  },
  text: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#F0F6FC',
    lineHeight: 20,
  },
});
