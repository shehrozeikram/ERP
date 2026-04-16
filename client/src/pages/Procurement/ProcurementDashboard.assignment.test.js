import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import ProcurementDashboard from './ProcurementDashboard';

jest.mock('../../services/procurementService', () => ({
  __esModule: true,
  default: {
    getRequisitions: jest.fn(),
    getQuotations: jest.fn(),
    getPurchaseOrders: jest.fn()
  }
}));
const procurementService = require('../../services/procurementService').default;
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

describe('ProcurementDashboard assignment overview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows assigned and unassigned requisition counts', async () => {
    procurementService.getRequisitions.mockResolvedValue({
      data: {
        indents: [
          {
            _id: 'r1',
            indentNumber: '1001',
            status: 'Approved',
            procurementAssignment: { status: 'assigned', assignedTo: { _id: 'u1', firstName: 'A', lastName: 'B' } }
          },
          {
            _id: 'r2',
            indentNumber: '1002',
            status: 'Approved',
            procurementAssignment: { status: 'unassigned', assignedTo: null }
          }
        ]
      }
    });
    procurementService.getQuotations.mockResolvedValue({ data: { quotations: [] } });
    procurementService.getPurchaseOrders.mockResolvedValue({ data: { purchaseOrders: [] } });

    render(
      <MemoryRouter>
        <ProcurementDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Assignment Overview')).not.toBeNull();
    });

    expect(screen.getByText('Assigned: 1')).not.toBeNull();
    expect(screen.getByText('Unassigned: 1')).not.toBeNull();
    expect(screen.getByRole('button', { name: /Open Task Assignment/i })).not.toBeNull();
  });
});
