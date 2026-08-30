import React from 'react';
import { Image, StyleSheet } from 'react-native';

export function CornerWatermark() {
  return (
    <Image
      source={require('../../assets/imagemlogosecundaria.png')}
      style={styles.watermark}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  watermark: {
    position: 'absolute',
    top: 34,
    right: 18,
    width: 28,
    height: 28,
    borderRadius: 7,
    opacity: 0.5,
    zIndex: -1,
    pointerEvents: 'none'
  }
});
