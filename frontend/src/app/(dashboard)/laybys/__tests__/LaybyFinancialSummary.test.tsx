import { render, screen } from '@testing-library/react';
import { LaybyFinancialSummary } from '../components/LaybyFinancialSummary';

describe('LaybyFinancialSummary', () => {
  it('renders all 4 stat cards', () => {
    render(
      <LaybyFinancialSummary
        totalAmount={5000}
        depositAmount={1000}
        amountPaid={2000}
        balanceDue={3000}
      />
    );

    expect(screen.getByText('Total Amount')).toBeInTheDocument();
    expect(screen.getByText('Deposit')).toBeInTheDocument();
    expect(screen.getByText('Amount Paid')).toBeInTheDocument();
    expect(screen.getByText('Outstanding Balance')).toBeInTheDocument();
  });

  it('formats ZAR amounts correctly with R symbol and 2 decimals', () => {
    render(
      <LaybyFinancialSummary
        totalAmount={5000.5}
        depositAmount={1000.25}
        amountPaid={2000.75}
        balanceDue={3000}
      />
    );

    expect(screen.getByText('R 5 000,50')).toBeInTheDocument();
    expect(screen.getByText('R 1 000,25')).toBeInTheDocument();
    expect(screen.getByText('R 2 000,75')).toBeInTheDocument();
    expect(screen.getByText('R 3 000,00')).toBeInTheDocument();
  });

  it('applies highlight class to outstanding balance card when balance > 0', () => {
    const { container } = render(
      <LaybyFinancialSummary
        totalAmount={5000}
        depositAmount={1000}
        amountPaid={2000}
        balanceDue={3000}
      />
    );

    const cards = container.querySelectorAll('[class*="ring-"]');
    expect(cards.length).toBeGreaterThan(0);
  });

  it('does not apply highlight class when balance is 0', () => {
    const { container } = render(
      <LaybyFinancialSummary
        totalAmount={5000}
        depositAmount={1000}
        amountPaid={5000}
        balanceDue={0}
      />
    );

    const highlightedCards = container.querySelectorAll('[class*="ring-yellow"]');
    expect(highlightedCards.length).toBe(0);
  });
});
