/**
 * Integration Tests for Contact Form
 * 
 * These tests validate that guest users can access and submit the contact form
 * without authentication, and that form validation works correctly.
 * 
 * Task 5.2: Integration Tests for Contact Form
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContactSalesForm } from '@/components/common/ContactSalesForm';
import { apiClient } from '@/lib/api';
import axios from 'axios';

// Mock the API client
jest.mock('@/lib/api', () => ({
  apiClient: {
    post: jest.fn(),
  },
}));

describe('Contact Form Integration Tests', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('Guest User Access', () => {
    /**
     * Test 5.2.1: Test guest user can access contact form
     * Validates Requirement 1.1: Guest users can view the contact form without authentication
     */
    test('should render contact form for guest users without authentication', () => {
      render(<ContactSalesForm />);

      // Form should be visible
      expect(screen.getByText('Contact Us')).toBeInTheDocument();
      
      // All form fields should be present
      expect(screen.getByLabelText('Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Subject')).toBeInTheDocument();
      expect(screen.getByLabelText('Message')).toBeInTheDocument();
      
      // Submit button should be present
      expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
    });

    /**
     * Test that contact form renders with different topics
     */
    test('should render contact form with sales topic', () => {
      render(<ContactSalesForm topic="sales" />);
      
      expect(screen.getByText('Contact Sales')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Contact Sales')).toBeInTheDocument();
    });

    test('should render contact form with support topic', () => {
      render(<ContactSalesForm topic="support" />);
      
      expect(screen.getByText('Contact Support')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Support Request')).toBeInTheDocument();
    });

    test('should render contact form with tier information', () => {
      render(<ContactSalesForm tier="pilot_pro" />);
      
      expect(screen.getByText(/tier=pilot_pro/i)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    /**
     * Test 5.2.3: Test form validation works correctly
     * Validates Requirement 1.3: Form validates all required fields
     */
    test('should require name field', async () => {
      const user = userEvent.setup();
      render(<ContactSalesForm />);

      const submitButton = screen.getByRole('button', { name: /send message/i });
      
      // Try to submit without filling name
      await user.click(submitButton);

      // Form should not submit (HTML5 validation)
      const nameInput = screen.getByLabelText('Name') as HTMLInputElement;
      expect(nameInput.validity.valid).toBe(false);
      expect(nameInput.validity.valueMissing).toBe(true);
    });

    test('should require email field', async () => {
      const user = userEvent.setup();
      render(<ContactSalesForm />);

      const submitButton = screen.getByRole('button', { name: /send message/i });
      
      // Fill name but not email
      await user.type(screen.getByLabelText('Name'), 'John Doe');
      await user.click(submitButton);

      // Email should be invalid
      const emailInput = screen.getByLabelText('Email') as HTMLInputElement;
      expect(emailInput.validity.valid).toBe(false);
      expect(emailInput.validity.valueMissing).toBe(true);
    });

    test('should validate email format', async () => {
      const user = userEvent.setup();
      render(<ContactSalesForm />);

      const emailInput = screen.getByLabelText('Email') as HTMLInputElement;
      
      // Enter invalid email
      await user.type(emailInput, 'invalid-email');
      
      // Check HTML5 validation
      expect(emailInput.validity.valid).toBe(false);
      expect(emailInput.validity.typeMismatch).toBe(true);
    });

    test('should require subject field', async () => {
      const user = userEvent.setup();
      render(<ContactSalesForm />);

      const submitButton = screen.getByRole('button', { name: /send message/i });
      
      // Fill name and email but clear subject
      await user.type(screen.getByLabelText('Name'), 'John Doe');
      await user.type(screen.getByLabelText('Email'), 'john@example.com');
      await user.clear(screen.getByLabelText('Subject'));
      await user.click(submitButton);

      // Subject should be invalid
      const subjectInput = screen.getByLabelText('Subject') as HTMLInputElement;
      expect(subjectInput.validity.valid).toBe(false);
      expect(subjectInput.validity.valueMissing).toBe(true);
    });

    test('should require message field', async () => {
      const user = userEvent.setup();
      render(<ContactSalesForm />);

      const submitButton = screen.getByRole('button', { name: /send message/i });
      
      // Fill all fields except message
      await user.type(screen.getByLabelText('Name'), 'John Doe');
      await user.type(screen.getByLabelText('Email'), 'john@example.com');
      await user.click(submitButton);

      // Message should be invalid
      const messageInput = screen.getByLabelText('Message') as HTMLTextAreaElement;
      expect(messageInput.validity.valid).toBe(false);
      expect(messageInput.validity.valueMissing).toBe(true);
    });

    test('should accept valid form data', async () => {
      const user = userEvent.setup();
      render(<ContactSalesForm />);

      // Fill all required fields with valid data
      await user.type(screen.getByLabelText('Name'), 'John Doe');
      await user.type(screen.getByLabelText('Email'), 'john@example.com');
      await user.type(screen.getByLabelText('Subject'), 'Test Subject');
      await user.type(screen.getByLabelText('Message'), 'This is a test message');

      // All fields should be valid
      const nameInput = screen.getByLabelText('Name') as HTMLInputElement;
      const emailInput = screen.getByLabelText('Email') as HTMLInputElement;
      const subjectInput = screen.getByLabelText('Subject') as HTMLInputElement;
      const messageInput = screen.getByLabelText('Message') as HTMLTextAreaElement;

      expect(nameInput.validity.valid).toBe(true);
      expect(emailInput.validity.valid).toBe(true);
      expect(subjectInput.validity.valid).toBe(true);
      expect(messageInput.validity.valid).toBe(true);
    });
  });

  describe('Form Submission', () => {
    /**
     * Test 5.2.2: Test guest user can submit valid form data
     * Test 5.2.4: Test email is sent successfully
     * Validates Requirement 1.2: Guest users can submit the form successfully
     * Validates Requirement 1.5: Success message is displayed after submission
     */
    test('should submit valid form data successfully', async () => {
      const user = userEvent.setup();
      const mockPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;
      mockPost.mockResolvedValueOnce({ data: { success: true } });

      render(<ContactSalesForm />);

      // Fill all required fields
      await user.type(screen.getByLabelText('Name'), 'John Doe');
      await user.type(screen.getByLabelText('Email'), 'john@example.com');
      const subjectInput = screen.getByLabelText('Subject');
      await user.clear(subjectInput);
      await user.type(subjectInput, 'Test Subject');
      await user.type(screen.getByLabelText('Message'), 'This is a test message');

      // Submit the form
      const submitButton = screen.getByRole('button', { name: /send message/i });
      await user.click(submitButton);

      // Wait for API call
      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/contact', {
          name: 'John Doe',
          email: 'john@example.com',
          subject: 'Test Subject',
          message: 'This is a test message',
          topic: 'general',
          tier: '',
        });
      });

      // Success message should be displayed
      await waitFor(() => {
        expect(screen.getByText(/Thanks — we received your message/i)).toBeInTheDocument();
      });

      // Form fields should be cleared
      expect(screen.getByLabelText('Name')).toHaveValue('');
      expect(screen.getByLabelText('Email')).toHaveValue('');
      expect(screen.getByLabelText('Message')).toHaveValue('');
    });

    test('should submit form with sales topic', async () => {
      const user = userEvent.setup();
      const mockPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;
      mockPost.mockResolvedValueOnce({ data: { success: true } });

      render(<ContactSalesForm topic="sales" tier="pilot_pro" />);

      // Fill all required fields
      await user.type(screen.getByLabelText('Name'), 'Jane Smith');
      await user.type(screen.getByLabelText('Email'), 'jane@company.com');
      await user.type(screen.getByLabelText('Message'), 'Interested in Pilot Pro');

      // Submit the form
      const submitButton = screen.getByRole('button', { name: /send message/i });
      await user.click(submitButton);

      // Wait for API call with correct topic and tier
      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/contact', {
          name: 'Jane Smith',
          email: 'jane@company.com',
          subject: 'Contact Sales',
          message: 'Interested in Pilot Pro',
          topic: 'sales',
          tier: 'pilot_pro',
        });
      });
    });

    test('should disable submit button while submitting', async () => {
      const user = userEvent.setup();
      const mockPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;
      
      // Make the API call take some time
      mockPost.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ data: { success: true } }), 100))
      );

      render(<ContactSalesForm />);

      // Fill all required fields
      await user.type(screen.getByLabelText('Name'), 'John Doe');
      await user.type(screen.getByLabelText('Email'), 'john@example.com');
      await user.type(screen.getByLabelText('Subject'), 'Test Subject');
      await user.type(screen.getByLabelText('Message'), 'This is a test message');

      // Submit the form
      const submitButton = screen.getByRole('button', { name: /send message/i });
      await user.click(submitButton);

      // Button should be disabled and show "Sending…"
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
        expect(submitButton).toHaveTextContent('Sending…');
      });

      // Wait for submission to complete
      await waitFor(() => {
        expect(screen.getByText(/Thanks — we received your message/i)).toBeInTheDocument();
      });

      // Button should be enabled again
      expect(submitButton).not.toBeDisabled();
      expect(submitButton).toHaveTextContent('Send message');
    });

    /**
     * Test 5.2.3: Test form validation works correctly (error handling)
     * Validates Requirement 1.4: Error messages are displayed for invalid submissions
     */
    test('should display error message on submission failure', async () => {
      const user = userEvent.setup();
      const mockPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;
      mockPost.mockRejectedValueOnce(new Error('Network error'));

      render(<ContactSalesForm />);

      // Fill all required fields
      await user.type(screen.getByLabelText('Name'), 'John Doe');
      await user.type(screen.getByLabelText('Email'), 'john@example.com');
      await user.type(screen.getByLabelText('Subject'), 'Test Subject');
      await user.type(screen.getByLabelText('Message'), 'This is a test message');

      // Submit the form
      const submitButton = screen.getByRole('button', { name: /send message/i });
      await user.click(submitButton);

      // Error message should be displayed
      await waitFor(() => {
        expect(screen.getByText(/Something went wrong sending your message/i)).toBeInTheDocument();
      });

      // Form fields should NOT be cleared on error
      expect(screen.getByLabelText('Name')).toHaveValue('John Doe');
      expect(screen.getByLabelText('Email')).toHaveValue('john@example.com');
      expect(screen.getByLabelText('Message')).toHaveValue('This is a test message');
    });

    test('should handle API errors gracefully', async () => {
      const user = userEvent.setup();
      const mockPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;
      
      // Simulate API error
      mockPost.mockRejectedValueOnce({
        response: {
          status: 500,
          data: { detail: 'Internal server error' }
        }
      });

      render(<ContactSalesForm />);

      // Fill and submit form
      await user.type(screen.getByLabelText('Name'), 'John Doe');
      await user.type(screen.getByLabelText('Email'), 'john@example.com');
      await user.type(screen.getByLabelText('Subject'), 'Test Subject');
      await user.type(screen.getByLabelText('Message'), 'This is a test message');
      
      const submitButton = screen.getByRole('button', { name: /send message/i });
      await user.click(submitButton);

      // Error message should be displayed
      await waitFor(() => {
        expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
      });
    });

    test('should allow resubmission after error', async () => {
      const user = userEvent.setup();
      const mockPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;
      
      // First call fails, second succeeds
      mockPost
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: { success: true } });

      render(<ContactSalesForm />);

      // Fill and submit form
      await user.type(screen.getByLabelText('Name'), 'John Doe');
      await user.type(screen.getByLabelText('Email'), 'john@example.com');
      await user.type(screen.getByLabelText('Subject'), 'Test Subject');
      await user.type(screen.getByLabelText('Message'), 'This is a test message');
      
      const submitButton = screen.getByRole('button', { name: /send message/i });
      await user.click(submitButton);

      // Error message should be displayed
      await waitFor(() => {
        expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
      });

      // Try submitting again
      await user.click(submitButton);

      // Success message should be displayed
      await waitFor(() => {
        expect(screen.getByText(/Thanks — we received your message/i)).toBeInTheDocument();
      });

      // Error message should be gone
      expect(screen.queryByText(/Something went wrong/i)).not.toBeInTheDocument();
    });
  });

  describe('Form Behavior', () => {
    test('should clear success message when starting new submission', async () => {
      const user = userEvent.setup();
      const mockPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;
      mockPost.mockResolvedValue({ data: { success: true } });

      render(<ContactSalesForm />);

      // Submit form successfully
      await user.type(screen.getByLabelText('Name'), 'John Doe');
      await user.type(screen.getByLabelText('Email'), 'john@example.com');
      const subjectInput = screen.getByLabelText('Subject');
      await user.clear(subjectInput);
      await user.type(subjectInput, 'Test Subject');
      await user.type(screen.getByLabelText('Message'), 'First message');
      
      const submitButton = screen.getByRole('button', { name: /send message/i });
      await user.click(submitButton);

      // Wait for success message
      await waitFor(() => {
        expect(screen.getByText(/Thanks — we received your message/i)).toBeInTheDocument();
      });

      // Fill form again
      await user.type(screen.getByLabelText('Name'), 'Jane Smith');
      await user.type(screen.getByLabelText('Email'), 'jane@example.com');
      await user.clear(screen.getByLabelText('Subject'));
      await user.type(screen.getByLabelText('Subject'), 'Another Subject');
      await user.type(screen.getByLabelText('Message'), 'Second message');
      
      // Submit again - success message should clear when form is submitted
      await user.click(submitButton);

      // Success message should reappear after successful submission
      await waitFor(() => {
        expect(screen.getByText(/Thanks — we received your message/i)).toBeInTheDocument();
      });
    });

    test('should preserve subject field default value based on topic', () => {
      const { unmount } = render(<ContactSalesForm topic="sales" />);
      expect(screen.getByLabelText('Subject')).toHaveValue('Contact Sales');
      unmount();

      const { unmount: unmount2 } = render(<ContactSalesForm topic="support" />);
      expect(screen.getByLabelText('Subject')).toHaveValue('Support Request');
      unmount2();

      render(<ContactSalesForm topic="general" />);
      expect(screen.getByLabelText('Subject')).toHaveValue('Contact');
    });

    test('should allow user to modify subject field', async () => {
      const user = userEvent.setup();
      render(<ContactSalesForm topic="sales" />);

      const subjectInput = screen.getByLabelText('Subject');
      expect(subjectInput).toHaveValue('Contact Sales');

      // User can change the subject
      await user.clear(subjectInput);
      await user.type(subjectInput, 'Custom Subject');
      expect(subjectInput).toHaveValue('Custom Subject');
    });
  });

  describe('Accessibility', () => {
    test('should have proper form labels', () => {
      render(<ContactSalesForm />);

      // All inputs should have associated labels
      expect(screen.getByLabelText('Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Subject')).toBeInTheDocument();
      expect(screen.getByLabelText('Message')).toBeInTheDocument();
    });

    test('should have proper input types', () => {
      render(<ContactSalesForm />);

      const emailInput = screen.getByLabelText('Email');
      expect(emailInput).toHaveAttribute('type', 'email');

      const nameInput = screen.getByLabelText('Name');
      expect(nameInput).not.toHaveAttribute('type', 'email');
    });

    test('should have proper button type', () => {
      render(<ContactSalesForm />);

      const submitButton = screen.getByRole('button', { name: /send message/i });
      expect(submitButton).toHaveAttribute('type', 'submit');
    });

    test('should have placeholder text for better UX', () => {
      render(<ContactSalesForm />);

      expect(screen.getByPlaceholderText('Your name')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('you@company.com')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('What is this about?')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('How can we help?')).toBeInTheDocument();
    });
  });
});
