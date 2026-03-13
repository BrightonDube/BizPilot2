/**
 * MediaUploader — Upload and manage media files for digital signage displays.
 *
 * Provides a grid-based media library with thumbnail previews, upload progress
 * tracking, and file management. Tablet-first layout with 3-column grid for
 * comfortable browsing of large media libraries.
 *
 * Why 3-column grid?
 * Digital signage operators often manage dozens of images and videos. A
 * 3-column layout maximises thumbnail size on tablet screens while keeping
 * the full library visible without excessive scrolling.
 */

import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MediaItem {
  id: string;
  name: string;
  type: "image" | "video";
  fileSize: number;
  resolution: string;
  thumbnailUrl: string | null;
  uploadedAt: string;
  status: "uploading" | "ready" | "processing" | "error";
  uploadProgress?: number;
}

export interface MediaUploaderProps {
  media: MediaItem[];
  onUpload: () => void;
  onDelete: (mediaId: string) => void;
  onSelect?: (mediaId: string) => void;
  selectedMediaId?: string;
  isUploading?: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  MediaItem["status"],
  { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  uploading: { label: "Uploading", color: "#fbbf24", icon: "cloud-upload-outline" },
  ready: { label: "Ready", color: "#22c55e", icon: "checkmark-circle-outline" },
  processing: { label: "Processing", color: "#3b82f6", icon: "hourglass-outline" },
  error: { label: "Error", color: "#ef4444", icon: "alert-circle-outline" },
};

const NUM_COLUMNS = 3;

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Format bytes into a human-readable string.
 *
 * Why custom formatter?
 * File sizes for signage assets vary widely (KB images to GB videos).
 * A compact, locale-agnostic label keeps the UI clean.
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

/** Single media thumbnail card within the grid. */
const MediaCard = React.memo(function MediaCard({
  item,
  isSelected,
  onSelect,
  onDelete,
}: {
  item: MediaItem;
  isSelected: boolean;
  onSelect?: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const statusCfg = STATUS_CONFIG[item.status];

  const handlePress = useCallback(() => {
    if (onSelect) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSelect(item.id);
    }
  }, [onSelect, item.id]);

  const handleDelete = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onDelete(item.id);
  }, [onDelete, item.id]);

  const cardStyle: ViewStyle[] = [
    styles.mediaCard,
    isSelected && styles.mediaCardSelected,
  ];

  return (
    <TouchableOpacity
      testID={`media-item-${item.id}`}
      style={cardStyle}
      onPress={handlePress}
      activeOpacity={0.7}
      disabled={!onSelect}
      accessibilityLabel={`Media file ${item.name}`}
      accessibilityRole="button"
    >
      {/* Thumbnail area */}
      <View style={styles.thumbnailContainer}>
        {item.thumbnailUrl ? (
          /* Placeholder for actual Image — keeps bundle lean */
          <View style={styles.thumbnailPlaceholder}>
            <Ionicons
              name={item.type === "video" ? "videocam" : "image"}
              size={32}
              color="#9ca3af"
            />
          </View>
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Ionicons name="camera-outline" size={32} color="#6b7280" />
          </View>
        )}

        {/* Type badge */}
        <View style={styles.typeBadge}>
          <Ionicons
            name={item.type === "video" ? "videocam" : "image"}
            size={12}
            color="#f3f4f6"
          />
          <Text style={styles.typeBadgeText}>
            {item.type.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Upload progress bar */}
      {item.status === "uploading" && typeof item.uploadProgress === "number" && (
        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${Math.min(item.uploadProgress, 100)}%` },
            ]}
          />
        </View>
      )}

      {/* Info section */}
      <View style={styles.mediaInfo}>
        <Text style={styles.mediaName} numberOfLines={1}>
          {item.name}
        </Text>

        <View style={styles.mediaMetaRow}>
          <Text style={styles.mediaMetaText}>{formatFileSize(item.fileSize)}</Text>
          <Text style={styles.mediaMetaText}>{item.resolution}</Text>
        </View>

        {/* Status badge */}
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, { backgroundColor: statusCfg.color + "20" }]}>
            <Ionicons name={statusCfg.icon} size={12} color={statusCfg.color} />
            <Text style={[styles.statusBadgeText, { color: statusCfg.color }]}>
              {statusCfg.label}
            </Text>
          </View>

          {/* Delete button */}
          <TouchableOpacity
            testID={`media-delete-${item.id}`}
            style={styles.deleteButton}
            onPress={handleDelete}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={`Delete ${item.name}`}
            accessibilityRole="button"
          >
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ─── Empty State ────────────────────────────────────────────────────────────

const EmptyState = React.memo(function EmptyState() {
  return (
    <View testID="media-empty" style={styles.emptyContainer}>
      <Ionicons name="cloud-upload-outline" size={56} color="#4b5563" />
      <Text style={styles.emptyTitle}>No Media Files</Text>
      <Text style={styles.emptySubtitle}>
        Upload images and videos to use in your signage displays.
      </Text>
    </View>
  );
});

// ─── Main Component ─────────────────────────────────────────────────────────

/**
 * @param props - {@link MediaUploaderProps}
 * @returns Grid-based media library with upload and management controls.
 */
const MediaUploader = React.memo(function MediaUploader({
  media,
  onUpload,
  onDelete,
  onSelect,
  selectedMediaId,
  isUploading = false,
}: MediaUploaderProps) {
  const handleUpload = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onUpload();
  }, [onUpload]);

  const renderItem = useCallback(
    ({ item }: { item: MediaItem }) => (
      <MediaCard
        item={item}
        isSelected={item.id === selectedMediaId}
        onSelect={onSelect}
        onDelete={onDelete}
      />
    ),
    [selectedMediaId, onSelect, onDelete],
  );

  const keyExtractor = useCallback((item: MediaItem) => item.id, []);

  const sortedMedia = useMemo(
    () =>
      [...media].sort((a, b) => {
        // Uploading items first so the operator can track progress
        if (a.status === "uploading" && b.status !== "uploading") return -1;
        if (b.status === "uploading" && a.status !== "uploading") return 1;
        return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
      }),
    [media],
  );

  return (
    <View testID="media-uploader" style={styles.container}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="images-outline" size={24} color="#f3f4f6" />
          <Text style={styles.headerTitle}>Media Library</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{media.length}</Text>
          </View>
        </View>

        <TouchableOpacity
          testID="media-upload-btn"
          style={[styles.uploadButton, isUploading && styles.uploadButtonDisabled]}
          onPress={handleUpload}
          disabled={isUploading}
          accessibilityLabel="Upload media"
          accessibilityRole="button"
        >
          {isUploading ? (
            <ActivityIndicator size="small" color="#f3f4f6" />
          ) : (
            <Ionicons name="cloud-upload-outline" size={20} color="#f3f4f6" />
          )}
          <Text style={styles.uploadButtonText}>
            {isUploading ? "Uploading…" : "Upload"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Media Grid ──────────────────────────────────────────── */}
      <FlatList
        data={sortedMedia}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={NUM_COLUMNS}
        contentContainerStyle={styles.gridContent}
        columnWrapperStyle={styles.gridRow}
        ListEmptyComponent={EmptyState}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
});

export default MediaUploader;

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  countBadge: {
    backgroundColor: "#374151",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9ca3af",
  },

  /* Upload button */
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 48,
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#f3f4f6",
  },

  /* Grid */
  gridContent: {
    padding: 12,
    paddingBottom: 32,
  },
  gridRow: {
    gap: 12,
    marginBottom: 12,
  },

  /* Media card */
  mediaCard: {
    flex: 1,
    backgroundColor: "#1f2937",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  mediaCardSelected: {
    borderColor: "#3b82f6",
  },

  /* Thumbnail */
  thumbnailContainer: {
    height: 120,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  thumbnailPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  typeBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#f3f4f6",
  },

  /* Progress bar */
  progressBarTrack: {
    height: 4,
    backgroundColor: "#374151",
  },
  progressBarFill: {
    height: 4,
    backgroundColor: "#fbbf24",
    borderRadius: 2,
  },

  /* Info */
  mediaInfo: {
    padding: 10,
    gap: 6,
  },
  mediaName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#f3f4f6",
  },
  mediaMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  mediaMetaText: {
    fontSize: 11,
    color: "#9ca3af",
  },

  /* Status row */
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  deleteButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Empty state */
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    maxWidth: 280,
  },
});
