import React, { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { mapPalette } from '../map/tokens';
import { webClass } from '../design/platform';
import { COLOR, FONT, BP_MD } from '../design/constants';
import { updateLocation } from './store';
import type { Location } from '../types';

/**
 * The ••• management menu for a saved location. Options:
 * Edit Location / Change Name (inline) / Monitoring Settings / Alert
 * Settings / Remove Location. Edit + the two settings entries open the same
 * edit flow (it covers name, monitoring, radius and alerts); Change Name
 * renames inline.
 */
export function LocationMenuModal({
  visible,
  location,
  onClose,
  onEdit,
  onRemove,
}: {
  visible: boolean;
  location: Location | null;
  onClose: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isMd = width >= BP_MD;
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState('');

  // Reset the rename input each time the menu opens for a location.
  const [lastKey, setLastKey] = useState<string | null>(null);
  if (visible && location && lastKey !== location.id) {
    setLastKey(location.id);
    setRenaming(false);
    setDraft(location.name);
  }

  const commitRename = useCallback(() => {
    if (location && draft.trim()) updateLocation(location.id, { name: draft.trim() });
    setRenaming(false);
    onClose();
  }, [location, draft, onClose]);

  if (!location) return null;

  const panelWidth = isMd ? 400 : width - 24;

  const rows: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    danger?: boolean;
    onPress: () => void;
  }[] = [
    {
      icon: 'create-outline',
      label: 'Edit Location',
      onPress: () => {
        onClose();
        onEdit();
      },
    },
    { icon: 'text-outline', label: 'Change Name', onPress: () => setRenaming(true) },
    {
      icon: 'options-outline',
      label: 'Monitoring Settings',
      onPress: () => {
        onClose();
        onEdit();
      },
    },
    {
      icon: 'notifications-outline',
      label: 'Alert Settings',
      onPress: () => {
        onClose();
        onEdit();
      },
    },
    {
      icon: 'trash-outline',
      label: 'Remove Location',
      danger: true,
      onPress: () => {
        onClose();
        onRemove();
      },
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, isMd && styles.backdropMd]} pointerEvents="box-none">
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close menu" />
        <View
          style={[
            styles.panel,
            { width: panelWidth, paddingBottom: insets.bottom + 12 },
          ]}
          {...webClass('lc-blur')}
        >
          <Text style={styles.sectionLabel}>{location.name.toUpperCase()}</Text>

          {renaming ? (
            <View style={styles.renameBox}>
              <Text style={styles.renameLabel}>NEW NAME</Text>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Location name"
                placeholderTextColor={mapPalette.textFaint}
                style={styles.renameInput}
                maxLength={40}
                autoFocus={!isMd}
                accessibilityLabel="New location name"
              />
              <View style={styles.renameActions}>
                <Pressable
                  onPress={() => setRenaming(false)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.7 }]}
                  {...webClass('lc-tap')}
                >
                  <Text style={styles.ghostText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={commitRename}
                  disabled={!draft.trim()}
                  accessibilityRole="button"
                  accessibilityLabel="Save new name"
                  style={({ pressed }) => [
                    styles.renameBtn,
                    !draft.trim() && { opacity: 0.4 },
                    pressed && draft.trim() && { opacity: 0.85 },
                  ]}
                  {...webClass('lc-tap')}
                >
                  <Text style={styles.renameBtnText}>Save</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            rows.map((r) => (
              <Pressable
                key={r.label}
                onPress={r.onPress}
                accessibilityRole="button"
                accessibilityLabel={r.label}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
                {...webClass('lc-tap')}
              >
                <Ionicons name={r.icon} size={17} color={r.danger ? '#E57B7B' : mapPalette.textMuted} />
                <Text style={[styles.rowText, r.danger && styles.rowTextDanger]}>{r.label}</Text>
                <Ionicons name="chevron-forward" size={14} color={mapPalette.textFaint} />
              </Pressable>
            ))
          )}
        </View>
      </View>
    </Modal>
  );
}

/** \"Remove Home?\" confirmation — the destructive action is explicit. */
export function RemoveConfirmModal({
  visible,
  location,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  location: Location | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isMd = width >= BP_MD;
  if (!location) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, isMd && styles.backdropMd]} pointerEvents="box-none">
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cancel removal" />
        <View
          style={[styles.panel, { width: isMd ? 380 : width - 24, paddingBottom: insets.bottom + 12 }]}
          {...webClass('lc-blur')}
        >
          <View style={styles.removeIcon}>
            <Ionicons name="trash-outline" size={20} color="#E57B7B" />
          </View>
          <Text style={styles.removeTitle}>Remove {location.name}?</Text>
          <Text style={styles.removeBody}>
            You will no longer see activity associated with this location.
          </Text>
          <View style={styles.removeActions}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.75 }]}
              {...webClass('lc-tap')}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${location.name}`}
              style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.85 }]}
              {...webClass('lc-tap')}
            >
              <Text style={styles.removeBtnText}>Remove</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end', alignItems: 'center' },
  backdropMd: { justifyContent: 'center' },
  panel: {
    backgroundColor: 'rgba(13,18,24,0.97)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
    borderRadius: 22,
    padding: 10,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: -8 },
    elevation: 18,
  },
  sectionLabel: {
    fontFamily: FONT.interSemiBold,
    fontSize: 9.5,
    letterSpacing: 1.6,
    color: mapPalette.textFaint,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  rowText: { flex: 1, fontFamily: FONT.interMedium, fontSize: 14.5, color: COLOR.white },
  rowTextDanger: { color: '#E57B7B' },

  renameBox: { paddingHorizontal: 12, paddingBottom: 8 },
  renameLabel: {
    fontFamily: FONT.interMedium,
    fontSize: 9,
    letterSpacing: 1.2,
    color: mapPalette.textFaint,
    marginBottom: 5,
  },
  renameInput: {
    fontFamily: FONT.interRegular,
    fontSize: 15,
    color: COLOR.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  renameActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  ghostBtn: { paddingHorizontal: 14, paddingVertical: 9 },
  ghostText: { fontFamily: FONT.interMedium, fontSize: 13.5, color: mapPalette.textMuted },
  renameBtn: {
    backgroundColor: COLOR.accent,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  renameBtnText: { fontFamily: FONT.interSemiBold, fontSize: 13.5, color: '#fff' },

  removeIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(229,123,123,0.12)',
    alignSelf: 'center',
    marginTop: 8,
  },
  removeTitle: {
    fontFamily: FONT.interSemiBold,
    fontSize: 19,
    letterSpacing: -0.3,
    color: COLOR.white,
    textAlign: 'center',
    marginTop: 12,
  },
  removeBody: {
    fontFamily: FONT.interRegular,
    fontSize: 13.5,
    lineHeight: 20,
    color: mapPalette.textMuted,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 16,
  },
  removeActions: { flexDirection: 'row', gap: 10, marginTop: 18, paddingHorizontal: 4 },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingVertical: 12,
  },
  cancelText: { fontFamily: FONT.interMedium, fontSize: 14, color: mapPalette.textMuted },
  removeBtn: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#B33A3A',
    paddingVertical: 12,
  },
  removeBtnText: { fontFamily: FONT.interSemiBold, fontSize: 14, color: '#fff' },
});