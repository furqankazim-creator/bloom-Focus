import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../theme';

/** Shown wherever generated sample history stands in for a child who hasn't played yet. */
export function SampleBanner({ name }: { name: string }) {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>👀 Sample data</Text>
      <Text style={styles.text}>This is example progress. {name}’s real results replace it after the first game.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: '#FEF7E6', borderColor: '#F3DFB0', borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 12 },
  title: { fontFamily: font.bold, fontSize: 13, color: '#8A6212' },
  text: { fontFamily: font.regular, fontSize: 12, color: '#8A6212', marginTop: 2, lineHeight: 17 },
});
