jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("expo-haptics", () => ({ impactAsync: jest.fn(), notificationAsync: jest.fn(), ImpactFeedbackStyle: { Light: "light", Medium: "medium" }, NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" } }));
jest.mock("@/utils/formatters", () => ({ formatCurrency: (v: number) => `R ${v.toFixed(2)}` }));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import FundDashboard from '../components/petty-cash/FundDashboard';
import ExpenseRequestForm from '../components/petty-cash/ExpenseRequestForm';
import ApprovalQueue from '../components/petty-cash/ApprovalQueue';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockFunds = [
  {
    id: 'fund-1',
    name: 'Main',
    currentBalance: 5000,
    availableBalance: 4000,
    initialBalance: 10000,
    singleExpenseLimit: 500,
    dailyExpenseLimit: 2000,
    status: 'active' as const,
    custodianName: 'John',
    lastReconciledAt: null,
  },
];

const mockCategories = [
  { id: 'cat-1', name: 'Office Supplies', spendingLimit: 1000 },
  { id: 'cat-2', name: 'Travel', spendingLimit: null },
];

const mockPendingRequests = [
  {
    id: 'req-1',
    requestedByName: 'Jane Doe',
    categoryName: 'Office Supplies',
    requestedAmount: 250,
    description: 'Printer paper',
    justification: 'Ran out of A4',
    createdAt: '2024-06-15T10:00:00Z',
    fundName: 'Main',
  },
];

// ---------------------------------------------------------------------------
// FundDashboard
// ---------------------------------------------------------------------------

describe('FundDashboard', () => {
  const defaultProps = {
    funds: mockFunds,
    totalBalance: 5000,
    pendingRequestsCount: 3,
    onFundPress: jest.fn(),
    onNewRequest: jest.fn(),
    onReconcile: jest.fn(),
    onBack: jest.fn(),
  };

  it('renders fund cards with balance info', () => {
    const { getByTestId, getByText } = render(<FundDashboard {...defaultProps} />);
    expect(getByTestId('fund-dashboard')).toBeTruthy();
    expect(getByTestId('fund-card-fund-1')).toBeTruthy();
    expect(getByText('Main')).toBeTruthy();
  });

  it('calls onNewRequest when New Request button is pressed', () => {
    const onNewRequest = jest.fn();
    const { getByTestId } = render(
      <FundDashboard {...defaultProps} onNewRequest={onNewRequest} />,
    );
    fireEvent.press(getByTestId('fund-new-request-btn'));
    expect(onNewRequest).toHaveBeenCalledTimes(1);
  });

  it('shows loading state', () => {
    const { getByTestId, queryByTestId } = render(
      <FundDashboard {...defaultProps} isLoading />,
    );
    expect(getByTestId('fund-loading')).toBeTruthy();
    expect(queryByTestId('fund-dashboard')).toBeNull();
  });

  it('shows empty state when no funds', () => {
    const { getByTestId } = render(
      <FundDashboard {...defaultProps} funds={[]} />,
    );
    expect(getByTestId('fund-empty')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// ExpenseRequestForm
// ---------------------------------------------------------------------------

describe('ExpenseRequestForm', () => {
  const defaultProps = {
    fundId: 'fund-1',
    fundName: 'Main Fund',
    availableBalance: 4000,
    categories: mockCategories,
    onSubmit: jest.fn(),
    onCancel: jest.fn(),
  };

  it('renders form fields', () => {
    const { getByTestId } = render(<ExpenseRequestForm {...defaultProps} />);
    expect(getByTestId('expense-form')).toBeTruthy();
    expect(getByTestId('expense-amount-input')).toBeTruthy();
    expect(getByTestId('expense-description-input')).toBeTruthy();
    expect(getByTestId('expense-justification-input')).toBeTruthy();
    expect(getByTestId('expense-category-cat-1')).toBeTruthy();
    expect(getByTestId('expense-category-cat-2')).toBeTruthy();
  });

  it('validates required fields on submit', async () => {
    const onSubmit = jest.fn();
    const { getByTestId, findAllByTestId } = render(
      <ExpenseRequestForm {...defaultProps} onSubmit={onSubmit} />,
    );
    fireEvent.press(getByTestId('expense-submit-btn'));
    const errors = await findAllByTestId('expense-error');
    expect(errors.length).toBeGreaterThan(0);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with correct data when form is valid', () => {
    const onSubmit = jest.fn();
    const { getByTestId } = render(
      <ExpenseRequestForm {...defaultProps} onSubmit={onSubmit} />,
    );

    fireEvent.press(getByTestId('expense-category-cat-1'));
    fireEvent.changeText(getByTestId('expense-amount-input'), '150');
    fireEvent.changeText(getByTestId('expense-description-input'), 'Pens');
    fireEvent.changeText(getByTestId('expense-justification-input'), 'Need for office');
    fireEvent.press(getByTestId('expense-submit-btn'));

    expect(onSubmit).toHaveBeenCalledWith({
      categoryId: 'cat-1',
      amount: 150,
      description: 'Pens',
      justification: 'Need for office',
    });
  });

  it('calls onCancel when cancel button is pressed', () => {
    const onCancel = jest.fn();
    const { getByTestId } = render(
      <ExpenseRequestForm {...defaultProps} onCancel={onCancel} />,
    );
    fireEvent.press(getByTestId('expense-cancel-btn'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// ApprovalQueue
// ---------------------------------------------------------------------------

describe('ApprovalQueue', () => {
  const defaultProps = {
    requests: mockPendingRequests,
    onApprove: jest.fn(),
    onReject: jest.fn(),
    onBack: jest.fn(),
  };

  it('renders pending request cards', () => {
    const { getByTestId, getByText } = render(<ApprovalQueue {...defaultProps} />);
    expect(getByTestId('approval-queue')).toBeTruthy();
    expect(getByTestId('approval-card-req-1')).toBeTruthy();
    expect(getByText('Jane Doe')).toBeTruthy();
  });

  it('shows approve and reject buttons for each request', () => {
    const { getByTestId } = render(<ApprovalQueue {...defaultProps} />);
    expect(getByTestId('approval-approve-req-1')).toBeTruthy();
    expect(getByTestId('approval-reject-req-1')).toBeTruthy();
  });

  it('shows empty state when no requests', () => {
    const { getByTestId } = render(
      <ApprovalQueue {...defaultProps} requests={[]} />,
    );
    expect(getByTestId('approval-empty')).toBeTruthy();
  });

  it('shows loading state', () => {
    const { getByTestId, queryByTestId } = render(
      <ApprovalQueue {...defaultProps} isLoading />,
    );
    expect(getByTestId('approval-loading')).toBeTruthy();
    expect(queryByTestId('approval-queue')).toBeNull();
  });
});
