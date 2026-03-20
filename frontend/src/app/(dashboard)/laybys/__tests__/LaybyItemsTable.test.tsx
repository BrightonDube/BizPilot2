import { render, screen } from '@testing-library/react';
import { LaybyItemsTable } from '../components/LaybyItemsTable';
import type { LaybyItem } from '../types';

describe('LaybyItemsTable', () => {
  const mockItems: LaybyItem[] = [
    {
      id: '1',
      product_id: 'p1',
      product_name: 'Product A',
      quantity: 2,
      unit_price: 100,
      discount_amount: 0,
      tax_amount: 0,
      total_amount: 200,
    },
    {
      id: '2',
      product_id: 'p2',
      product_name: 'Product B',
      quantity: 1,
      unit_price: 50.5,
      discount_amount: 0,
      tax_amount: 0,
      total_amount: 50.5,
    },
  ];

  it('renders rows with correct product name, quantity, and price', () => {
    render(<LaybyItemsTable items={mockItems} />);

    expect(screen.getByText('Product A')).toBeInTheDocument();
    expect(screen.getByText('Product B')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('R 100,00')).toBeInTheDocument();
    // R 50,50 appears twice (unit price and total), so use getAllByText
    expect(screen.getAllByText('R 50,50').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('R 200,00')).toBeInTheDocument();
  });

  it('shows empty state message when items array is empty', () => {
    render(<LaybyItemsTable items={[]} />);
    expect(screen.getByText('No items found')).toBeInTheDocument();
  });

  it('renders table headers', () => {
    render(<LaybyItemsTable items={mockItems} />);
    expect(screen.getByText('Product')).toBeInTheDocument();
    expect(screen.getByText('Qty')).toBeInTheDocument();
    expect(screen.getByText('Unit Price')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
  });
});
