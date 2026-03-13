/**
 * Tests for CourseManagerView UI component.
 * (order-management tasks 10.1-10.4)
 */

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light" },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { CourseManagerView } from "@/components/orders/CourseManagerView";
import {
  CourseState,
  initialiseCourses,
  assignItemToCourse,
  fireCourse,
} from "@/services/orders/CourseManagementService";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTestState(): CourseState {
  let state = initialiseCourses();
  state = assignItemToCourse(state, "i1", "Caesar Salad", 2, "course-1");
  state = assignItemToCourse(state, "i2", "Tomato Soup", 1, "course-1");
  state = assignItemToCourse(state, "i3", "Ribeye Steak", 1, "course-2");
  state = assignItemToCourse(state, "i4", "Chocolate Cake", 1, "course-3");
  return state;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CourseManagerView", () => {
  const defaultProps = {
    state: makeTestState(),
    onFireCourse: jest.fn(),
    onFireAll: jest.fn(),
    onReassignItem: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it("renders the course manager view", () => {
    const { getByTestId, getByText } = render(
      <CourseManagerView {...defaultProps} />
    );
    expect(getByTestId("course-manager-view")).toBeTruthy();
    expect(getByText("Course Manager")).toBeTruthy();
  });

  it("shows course sections with items", () => {
    const { getByTestId } = render(
      <CourseManagerView {...defaultProps} />
    );
    expect(getByTestId("course-section-course-1")).toBeTruthy();
    expect(getByTestId("course-section-course-2")).toBeTruthy();
    expect(getByTestId("course-section-course-3")).toBeTruthy();
  });

  it("displays course names", () => {
    const { getByText } = render(
      <CourseManagerView {...defaultProps} />
    );
    expect(getByText("Starters")).toBeTruthy();
    expect(getByText("Main Course")).toBeTruthy();
    expect(getByText("Dessert")).toBeTruthy();
  });

  it("displays item names", () => {
    const { getByText } = render(
      <CourseManagerView {...defaultProps} />
    );
    expect(getByText("Caesar Salad")).toBeTruthy();
    expect(getByText("Ribeye Steak")).toBeTruthy();
    expect(getByText("Chocolate Cake")).toBeTruthy();
  });

  it("shows held count", () => {
    const { getByText } = render(
      <CourseManagerView {...defaultProps} />
    );
    expect(getByText("4 held")).toBeTruthy();
  });

  it("shows Fire button for unfired courses with items", () => {
    const { getByTestId } = render(
      <CourseManagerView {...defaultProps} />
    );
    expect(getByTestId("fire-course-course-1")).toBeTruthy();
    expect(getByTestId("fire-course-course-2")).toBeTruthy();
  });

  it("calls onFireCourse when Fire button pressed", () => {
    const { getByTestId } = render(
      <CourseManagerView {...defaultProps} />
    );
    fireEvent.press(getByTestId("fire-course-course-1"));
    expect(defaultProps.onFireCourse).toHaveBeenCalledWith("course-1");
  });

  it("shows Fire All button", () => {
    const { getByTestId } = render(
      <CourseManagerView {...defaultProps} />
    );
    expect(getByTestId("fire-all-button")).toBeTruthy();
  });

  it("calls onFireAll when Fire All pressed", () => {
    const { getByTestId } = render(
      <CourseManagerView {...defaultProps} />
    );
    fireEvent.press(getByTestId("fire-all-button"));
    expect(defaultProps.onFireAll).toHaveBeenCalled();
  });

  it("calls onReassignItem when item tapped", () => {
    const { getByTestId } = render(
      <CourseManagerView {...defaultProps} />
    );
    fireEvent.press(getByTestId("course-item-i1"));
    expect(defaultProps.onReassignItem).toHaveBeenCalledWith("i1", "course-1");
  });

  it("shows Fired badge for fired courses", () => {
    const firedState = fireCourse(defaultProps.state, "course-1", "2025-01-15T12:00:00Z");
    const { getByText, queryByTestId } = render(
      <CourseManagerView {...defaultProps} state={firedState} />
    );
    expect(getByText("Fired")).toBeTruthy();
    // Fire button should not appear for fired course
    expect(queryByTestId("fire-course-course-1")).toBeNull();
  });

  it("shows empty state when no items assigned", () => {
    const emptyState = initialiseCourses();
    const { getByText } = render(
      <CourseManagerView {...defaultProps} state={emptyState} />
    );
    expect(getByText("No items assigned to courses yet")).toBeTruthy();
  });
});
