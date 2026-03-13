/**
 * CourseManagerView — visual course management panel for POS orders.
 * (order-management tasks 10.1-10.4)
 *
 * Layout: Vertical list of course sections, each showing assigned items.
 * Each course has a "Fire" button to send it to the kitchen.
 * Items can be dragged/tapped to reassign to different courses.
 *
 * Why vertical sections instead of horizontal tabs?
 * In a restaurant POS, the operator needs to see ALL courses at once
 * to understand the full order flow. Vertical sections give a clear
 * top-to-bottom timeline of the meal sequence.
 */

import React, { useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  CourseState,
  Course,
  CourseItem,
  getItemsByCourse,
  getHeldItems,
} from "@/services/orders/CourseManagementService";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CourseManagerViewProps {
  /** Current course state. */
  state: CourseState;
  /** Called when user fires a course to the kitchen. */
  onFireCourse: (courseId: string) => void;
  /** Called when user fires all remaining courses. */
  onFireAll: () => void;
  /** Called when user taps an item to reassign its course. */
  onReassignItem?: (itemId: string, currentCourseId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function CourseManagerViewInner({
  state,
  onFireCourse,
  onFireAll,
  onReassignItem,
}: CourseManagerViewProps) {
  const groupedItems = useMemo(() => getItemsByCourse(state), [state]);
  const heldItems = useMemo(() => getHeldItems(state), [state]);
  const hasUnfiredCourses = state.courses.some((c) => !c.fired);

  const renderCourseItem = useCallback(
    (item: CourseItem, courseId: string) => (
      <TouchableOpacity
        key={item.itemId}
        style={styles.itemRow}
        onPress={() => onReassignItem?.(item.itemId, courseId)}
        disabled={!onReassignItem}
        testID={`course-item-${item.itemId}`}
      >
        <Text style={styles.itemQty}>{item.quantity}×</Text>
        <Text style={styles.itemName}>{item.name}</Text>
        {onReassignItem && (
          <Ionicons name="swap-horizontal" size={16} color="#4b5563" />
        )}
      </TouchableOpacity>
    ),
    [onReassignItem]
  );

  const renderCourseSection = useCallback(
    (course: Course, items: CourseItem[]) => (
      <View
        key={course.id}
        style={[styles.courseSection, course.fired && styles.courseFired]}
        testID={`course-section-${course.id}`}
      >
        {/* Course header */}
        <View style={styles.courseHeader}>
          <View style={styles.courseHeaderLeft}>
            <View
              style={[
                styles.courseIndicator,
                course.fired ? styles.indicatorFired : styles.indicatorHeld,
              ]}
            />
            <Text style={styles.courseName}>{course.name}</Text>
            {course.fired && (
              <View style={styles.firedBadge}>
                <Ionicons name="flame" size={14} color="#f97316" />
                <Text style={styles.firedBadgeText}>Fired</Text>
              </View>
            )}
          </View>
          {!course.fired && items.length > 0 && (
            <TouchableOpacity
              style={styles.fireButton}
              onPress={() => onFireCourse(course.id)}
              testID={`fire-course-${course.id}`}
            >
              <Ionicons name="flame-outline" size={18} color="#fff" />
              <Text style={styles.fireButtonText}>Fire</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Items */}
        {items.length === 0 ? (
          <Text style={styles.emptyText}>No items assigned</Text>
        ) : (
          items.map((item) => renderCourseItem(item, course.id))
        )}
      </View>
    ),
    [onFireCourse, renderCourseItem]
  );

  return (
    <View style={styles.container} testID="course-manager-view">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Course Manager</Text>
        <View style={styles.headerRight}>
          <Text style={styles.heldCount}>{heldItems.length} held</Text>
          {hasUnfiredCourses && (
            <TouchableOpacity
              style={styles.fireAllButton}
              onPress={onFireAll}
              testID="fire-all-button"
            >
              <Ionicons name="flame" size={16} color="#f97316" />
              <Text style={styles.fireAllText}>Fire All</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Course sections */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
      >
        {groupedItems.map(({ course, items }) =>
          renderCourseSection(course, items)
        )}

        {groupedItems.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="restaurant-outline" size={48} color="#4b5563" />
            <Text style={styles.emptyStateText}>
              No items assigned to courses yet
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

export const CourseManagerView = React.memo(CourseManagerViewInner);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: "#1e293b",
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#f3f4f6" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  heldCount: { fontSize: 13, color: "#fbbf24", fontWeight: "600" },
  fireAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#7c2d12",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  fireAllText: { color: "#f97316", fontWeight: "600", fontSize: 13 },
  body: { flex: 1 },
  bodyContent: { padding: 16, gap: 12 },
  /* Course section */
  courseSection: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#374151",
  },
  courseFired: {
    borderLeftColor: "#f97316",
    opacity: 0.85,
  },
  courseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  courseHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  courseIndicator: { width: 8, height: 8, borderRadius: 4 },
  indicatorHeld: { backgroundColor: "#fbbf24" },
  indicatorFired: { backgroundColor: "#f97316" },
  courseName: { fontSize: 16, fontWeight: "700", color: "#f3f4f6" },
  firedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#7c2d12",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  firedBadgeText: { color: "#f97316", fontSize: 11, fontWeight: "600" },
  fireButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ea580c",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  fireButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  /* Items */
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  itemQty: { color: "#9ca3af", fontSize: 14, fontWeight: "600", minWidth: 30 },
  itemName: { flex: 1, color: "#f3f4f6", fontSize: 14 },
  emptyText: { color: "#6b7280", fontSize: 13, fontStyle: "italic" },
  emptyState: { alignItems: "center", paddingVertical: 48 },
  emptyStateText: { color: "#6b7280", fontSize: 16, marginTop: 12 },
});
