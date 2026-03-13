/**
 * CourseManagementService — pure functions for course-based order management.
 * (order-management tasks 10.1-10.4)
 *
 * In fine-dining/restaurant POS, items are grouped into courses
 * (Starter, Main, Dessert, etc.) and fired to the kitchen sequentially.
 * This service provides the logic for:
 *   - Assigning items to courses
 *   - Firing (sending) courses to the kitchen
 *   - Holding items until their course is fired
 *   - Default course per menu category
 *
 * Why pure functions?
 * Course state changes on every "fire" or "assign" action. Pure functions
 * allow us to derive the next state without side effects, making the
 * logic testable and predictable in a busy POS environment.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Course {
  /** Unique ID (e.g. "course-1"). */
  id: string;
  /** Display name (e.g. "Starters", "Main Course", "Dessert"). */
  name: string;
  /** Sort order for display. */
  sortOrder: number;
  /** Whether this course has been fired to the kitchen. */
  fired: boolean;
  /** ISO timestamp when the course was fired, if applicable. */
  firedAt?: string;
}

export interface CourseItem {
  /** Order item ID. */
  itemId: string;
  /** Course ID this item belongs to. */
  courseId: string;
  /** Item name for display. */
  name: string;
  /** Quantity. */
  quantity: number;
}

export interface CourseState {
  /** All courses for this order. */
  courses: Course[];
  /** All items assigned to courses. */
  items: CourseItem[];
}

/** Default course mapping: category name → course name. */
export interface DefaultCourseMapping {
  [categoryName: string]: string;
}

// ---------------------------------------------------------------------------
// Constants: standard restaurant courses
// ---------------------------------------------------------------------------

export const DEFAULT_COURSES: Omit<Course, "id">[] = [
  { name: "Starters", sortOrder: 1, fired: false },
  { name: "Main Course", sortOrder: 2, fired: false },
  { name: "Dessert", sortOrder: 3, fired: false },
  { name: "Drinks", sortOrder: 4, fired: false },
];

/**
 * Default category → course mapping.
 * Starters/soups → Starters, mains/grills → Main Course, etc.
 */
export const DEFAULT_CATEGORY_MAPPING: DefaultCourseMapping = {
  starters: "Starters",
  soups: "Starters",
  appetizers: "Starters",
  mains: "Main Course",
  grills: "Main Course",
  pasta: "Main Course",
  seafood: "Main Course",
  desserts: "Dessert",
  sweets: "Dessert",
  drinks: "Drinks",
  beverages: "Drinks",
  cocktails: "Drinks",
};

// ---------------------------------------------------------------------------
// Task 10.1: Add course support to orders
// ---------------------------------------------------------------------------

/**
 * Initialise a fresh CourseState with the default courses.
 * Each course gets a unique ID based on the provided prefix.
 */
export function initialiseCourses(idPrefix: string = "course"): CourseState {
  return {
    courses: DEFAULT_COURSES.map((c, i) => ({
      ...c,
      id: `${idPrefix}-${i + 1}`,
    })),
    items: [],
  };
}

/**
 * Add a custom course to the state.
 */
export function addCourse(
  state: CourseState,
  id: string,
  name: string,
  sortOrder: number
): CourseState {
  if (state.courses.some((c) => c.id === id)) {
    return state; // No duplicate IDs
  }
  return {
    ...state,
    courses: [...state.courses, { id, name, sortOrder, fired: false }].sort(
      (a, b) => a.sortOrder - b.sortOrder
    ),
  };
}

// ---------------------------------------------------------------------------
// Task 10.4: Default course per item
// ---------------------------------------------------------------------------

/**
 * Assign an item to a course. If categoryName is provided and no explicit
 * courseId is given, uses the default category → course mapping.
 */
export function assignItemToCourse(
  state: CourseState,
  itemId: string,
  name: string,
  quantity: number,
  courseId?: string,
  categoryName?: string
): CourseState {
  // Resolve course ID
  let resolvedCourseId = courseId;

  if (!resolvedCourseId && categoryName) {
    const mappedCourseName =
      DEFAULT_CATEGORY_MAPPING[categoryName.toLowerCase()];
    if (mappedCourseName) {
      const matched = state.courses.find((c) => c.name === mappedCourseName);
      resolvedCourseId = matched?.id;
    }
  }

  // Fallback to first course
  if (!resolvedCourseId && state.courses.length > 0) {
    resolvedCourseId = state.courses[0].id;
  }

  if (!resolvedCourseId) {
    return state; // No courses available
  }

  // Remove existing assignment for this item (re-assignment)
  const filteredItems = state.items.filter((i) => i.itemId !== itemId);

  return {
    ...state,
    items: [
      ...filteredItems,
      { itemId, courseId: resolvedCourseId, name, quantity },
    ],
  };
}

/**
 * Move an item to a different course.
 */
export function moveItemToCourse(
  state: CourseState,
  itemId: string,
  newCourseId: string
): CourseState {
  return {
    ...state,
    items: state.items.map((i) =>
      i.itemId === itemId ? { ...i, courseId: newCourseId } : i
    ),
  };
}

/**
 * Remove an item from all courses.
 */
export function removeItemFromCourses(
  state: CourseState,
  itemId: string
): CourseState {
  return {
    ...state,
    items: state.items.filter((i) => i.itemId !== itemId),
  };
}

// ---------------------------------------------------------------------------
// Task 10.2: Fire by course
// ---------------------------------------------------------------------------

/**
 * Fire a course to the kitchen.
 * Items in fired courses are sent to the KDS.
 *
 * @param now - ISO timestamp for testability (no Date.now() in render paths)
 */
export function fireCourse(
  state: CourseState,
  courseId: string,
  now: string
): CourseState {
  return {
    ...state,
    courses: state.courses.map((c) =>
      c.id === courseId ? { ...c, fired: true, firedAt: now } : c
    ),
  };
}

/**
 * Fire all remaining unfired courses at once.
 */
export function fireAllCourses(
  state: CourseState,
  now: string
): CourseState {
  return {
    ...state,
    courses: state.courses.map((c) =>
      c.fired ? c : { ...c, fired: true, firedAt: now }
    ),
  };
}

// ---------------------------------------------------------------------------
// Task 10.3: Display course on tickets
// ---------------------------------------------------------------------------

/**
 * Get items grouped by course, sorted by course sort order.
 * Used for KDS display and ticket formatting.
 */
export function getItemsByCourse(
  state: CourseState
): { course: Course; items: CourseItem[] }[] {
  return state.courses
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((course) => ({
      course,
      items: state.items.filter((i) => i.courseId === course.id),
    }))
    .filter((group) => group.items.length > 0);
}

/**
 * Get items that are ready to be sent to kitchen (course fired).
 */
export function getFiredItems(state: CourseState): CourseItem[] {
  const firedCourseIds = new Set(
    state.courses.filter((c) => c.fired).map((c) => c.id)
  );
  return state.items.filter((i) => firedCourseIds.has(i.courseId));
}

/**
 * Get items that are held (course not yet fired).
 */
export function getHeldItems(state: CourseState): CourseItem[] {
  const firedCourseIds = new Set(
    state.courses.filter((c) => c.fired).map((c) => c.id)
  );
  return state.items.filter((i) => !firedCourseIds.has(i.courseId));
}

/**
 * Format a course section for a kitchen ticket.
 * Returns a text block like:
 *   === STARTERS ===
 *   2× Caesar Salad
 *   1× Soup of the Day
 */
export function formatCourseTicket(
  state: CourseState,
  courseId: string
): string {
  const course = state.courses.find((c) => c.id === courseId);
  if (!course) return "";

  const courseItems = state.items.filter((i) => i.courseId === courseId);
  if (courseItems.length === 0) return "";

  const header = `=== ${course.name.toUpperCase()} ===`;
  const lines = courseItems.map((i) => `${i.quantity}× ${i.name}`);

  return [header, ...lines].join("\n");
}
