/**
 * Tests for CourseManagementService — pure function tests for course logic.
 * (order-management tasks 10.1-10.4)
 */

import {
  CourseState,
  DEFAULT_COURSES,
  DEFAULT_CATEGORY_MAPPING,
  initialiseCourses,
  addCourse,
  assignItemToCourse,
  moveItemToCourse,
  removeItemFromCourses,
  fireCourse,
  fireAllCourses,
  getItemsByCourse,
  getFiredItems,
  getHeldItems,
  formatCourseTicket,
} from "@/services/orders/CourseManagementService";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("Constants", () => {
  it("DEFAULT_COURSES has 4 standard courses", () => {
    expect(DEFAULT_COURSES).toHaveLength(4);
    expect(DEFAULT_COURSES.map((c) => c.name)).toEqual([
      "Starters",
      "Main Course",
      "Dessert",
      "Drinks",
    ]);
  });

  it("DEFAULT_CATEGORY_MAPPING maps common categories", () => {
    expect(DEFAULT_CATEGORY_MAPPING["mains"]).toBe("Main Course");
    expect(DEFAULT_CATEGORY_MAPPING["desserts"]).toBe("Dessert");
    expect(DEFAULT_CATEGORY_MAPPING["drinks"]).toBe("Drinks");
    expect(DEFAULT_CATEGORY_MAPPING["starters"]).toBe("Starters");
  });
});

// ---------------------------------------------------------------------------
// initialiseCourses
// ---------------------------------------------------------------------------

describe("initialiseCourses", () => {
  it("creates 4 courses with IDs", () => {
    const state = initialiseCourses();
    expect(state.courses).toHaveLength(4);
    expect(state.courses[0].id).toBe("course-1");
    expect(state.courses[3].id).toBe("course-4");
  });

  it("all courses start unfired", () => {
    const state = initialiseCourses();
    expect(state.courses.every((c) => !c.fired)).toBe(true);
  });

  it("starts with empty items", () => {
    const state = initialiseCourses();
    expect(state.items).toHaveLength(0);
  });

  it("accepts custom ID prefix", () => {
    const state = initialiseCourses("order-42");
    expect(state.courses[0].id).toBe("order-42-1");
  });
});

// ---------------------------------------------------------------------------
// addCourse
// ---------------------------------------------------------------------------

describe("addCourse", () => {
  it("adds a custom course", () => {
    const state = initialiseCourses();
    const updated = addCourse(state, "c-custom", "Cheese Course", 2.5);
    expect(updated.courses).toHaveLength(5);
  });

  it("maintains sort order", () => {
    const state = initialiseCourses();
    const updated = addCourse(state, "c-custom", "Cheese Course", 1.5);
    expect(updated.courses[1].name).toBe("Cheese Course");
  });

  it("prevents duplicate IDs", () => {
    const state = initialiseCourses();
    const updated = addCourse(state, "course-1", "Duplicate", 99);
    expect(updated.courses).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// assignItemToCourse
// ---------------------------------------------------------------------------

describe("assignItemToCourse", () => {
  it("assigns item to explicit course", () => {
    const state = initialiseCourses();
    const updated = assignItemToCourse(state, "item-1", "Burger", 2, "course-2");
    expect(updated.items).toHaveLength(1);
    expect(updated.items[0].courseId).toBe("course-2");
  });

  it("uses category mapping when no courseId given", () => {
    const state = initialiseCourses();
    const updated = assignItemToCourse(state, "item-1", "Ice Cream", 1, undefined, "desserts");
    expect(updated.items[0].courseId).toBe("course-3"); // Dessert
  });

  it("falls back to first course when no match", () => {
    const state = initialiseCourses();
    const updated = assignItemToCourse(state, "item-1", "Special", 1, undefined, "unknown-category");
    expect(updated.items[0].courseId).toBe("course-1");
  });

  it("re-assigns item (removes old assignment)", () => {
    const state = initialiseCourses();
    const s1 = assignItemToCourse(state, "item-1", "Burger", 2, "course-1");
    const s2 = assignItemToCourse(s1, "item-1", "Burger", 2, "course-2");
    expect(s2.items).toHaveLength(1);
    expect(s2.items[0].courseId).toBe("course-2");
  });
});

// ---------------------------------------------------------------------------
// moveItemToCourse
// ---------------------------------------------------------------------------

describe("moveItemToCourse", () => {
  it("moves item to new course", () => {
    let state = initialiseCourses();
    state = assignItemToCourse(state, "item-1", "Burger", 1, "course-1");
    const updated = moveItemToCourse(state, "item-1", "course-2");
    expect(updated.items[0].courseId).toBe("course-2");
  });

  it("does not affect other items", () => {
    let state = initialiseCourses();
    state = assignItemToCourse(state, "item-1", "Burger", 1, "course-1");
    state = assignItemToCourse(state, "item-2", "Salad", 1, "course-1");
    const updated = moveItemToCourse(state, "item-1", "course-2");
    expect(updated.items.find((i) => i.itemId === "item-2")?.courseId).toBe("course-1");
  });
});

// ---------------------------------------------------------------------------
// removeItemFromCourses
// ---------------------------------------------------------------------------

describe("removeItemFromCourses", () => {
  it("removes item", () => {
    let state = initialiseCourses();
    state = assignItemToCourse(state, "item-1", "Burger", 1, "course-1");
    const updated = removeItemFromCourses(state, "item-1");
    expect(updated.items).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// fireCourse / fireAllCourses
// ---------------------------------------------------------------------------

describe("fireCourse", () => {
  it("marks a course as fired", () => {
    const state = initialiseCourses();
    const now = "2025-01-15T12:00:00Z";
    const updated = fireCourse(state, "course-1", now);
    const c = updated.courses.find((c) => c.id === "course-1");
    expect(c?.fired).toBe(true);
    expect(c?.firedAt).toBe(now);
  });

  it("does not affect other courses", () => {
    const state = initialiseCourses();
    const updated = fireCourse(state, "course-1", "2025-01-15T12:00:00Z");
    expect(updated.courses.find((c) => c.id === "course-2")?.fired).toBe(false);
  });
});

describe("fireAllCourses", () => {
  it("fires all unfired courses", () => {
    let state = initialiseCourses();
    state = fireCourse(state, "course-1", "2025-01-15T12:00:00Z");
    const updated = fireAllCourses(state, "2025-01-15T12:05:00Z");
    expect(updated.courses.every((c) => c.fired)).toBe(true);
    // Already-fired course keeps original timestamp
    expect(updated.courses[0].firedAt).toBe("2025-01-15T12:00:00Z");
  });
});

// ---------------------------------------------------------------------------
// getItemsByCourse / getFiredItems / getHeldItems
// ---------------------------------------------------------------------------

describe("getItemsByCourse", () => {
  it("groups items by course in sort order", () => {
    let state = initialiseCourses();
    state = assignItemToCourse(state, "i1", "Soup", 1, "course-1");
    state = assignItemToCourse(state, "i2", "Steak", 1, "course-2");
    state = assignItemToCourse(state, "i3", "Bread", 1, "course-1");
    const groups = getItemsByCourse(state);
    expect(groups).toHaveLength(2); // Starters + Main
    expect(groups[0].items).toHaveLength(2);
    expect(groups[1].items).toHaveLength(1);
  });

  it("excludes empty courses", () => {
    const state = initialiseCourses();
    const groups = getItemsByCourse(state);
    expect(groups).toHaveLength(0);
  });
});

describe("getFiredItems / getHeldItems", () => {
  it("partitions items by fired status", () => {
    let state = initialiseCourses();
    state = assignItemToCourse(state, "i1", "Soup", 1, "course-1");
    state = assignItemToCourse(state, "i2", "Steak", 1, "course-2");
    state = fireCourse(state, "course-1", "2025-01-15T12:00:00Z");

    expect(getFiredItems(state)).toHaveLength(1);
    expect(getFiredItems(state)[0].itemId).toBe("i1");
    expect(getHeldItems(state)).toHaveLength(1);
    expect(getHeldItems(state)[0].itemId).toBe("i2");
  });
});

// ---------------------------------------------------------------------------
// formatCourseTicket
// ---------------------------------------------------------------------------

describe("formatCourseTicket", () => {
  it("formats a course section for kitchen ticket", () => {
    let state = initialiseCourses();
    state = assignItemToCourse(state, "i1", "Caesar Salad", 2, "course-1");
    state = assignItemToCourse(state, "i2", "Soup of the Day", 1, "course-1");

    const ticket = formatCourseTicket(state, "course-1");
    expect(ticket).toContain("=== STARTERS ===");
    expect(ticket).toContain("2× Caesar Salad");
    expect(ticket).toContain("1× Soup of the Day");
  });

  it("returns empty string for unknown course", () => {
    const state = initialiseCourses();
    expect(formatCourseTicket(state, "nonexistent")).toBe("");
  });

  it("returns empty string for course with no items", () => {
    const state = initialiseCourses();
    expect(formatCourseTicket(state, "course-1")).toBe("");
  });
});
