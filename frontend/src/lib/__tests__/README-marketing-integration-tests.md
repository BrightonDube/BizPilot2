# Marketing Flow Integration Tests

This directory contains comprehensive integration tests for the marketing pages redesign feature (Task 8.3).

## Test Files

### 1. `marketing-flow-core-integration.test.ts`
**Status: ✅ Passing**

Core integration tests that validate the business logic and data flow without requiring a running server. These tests focus on:

- **Complete User Journey Integration**: Tests guest user flow through all marketing pages
- **Authentication Redirect Integration**: Validates authenticated user redirection to dashboard
- **Pricing Page Integration**: Tests pricing configuration and AI messaging integration
- **Cross-Page Data Flow Integration**: Validates data consistency across marketing pages
- **Error Handling Integration**: Tests graceful error handling and edge cases
- **Performance Integration**: Validates efficient data access patterns

**Key Features Tested:**
- Middleware authentication logic for marketing routes
- Centralized pricing configuration usage
- AI messaging integration across pages
- Feature comparison data consistency
- Error handling and edge cases
- Performance characteristics

### 2. `marketing-flow-integration.test.ts`
**Status: ⚠️ Browser-based (requires running server)**

End-to-end browser automation tests using Puppeteer. These tests validate:

- **Guest User Journey**: Complete navigation through marketing pages
- **Authentication Redirects**: Browser-based authentication flow testing
- **Pricing Page Functionality**: Interactive pricing page features
- **Performance and Accessibility**: Page load times and accessibility compliance
- **Error Handling**: Browser error scenarios
- **SEO and Meta Tags**: Search engine optimization validation

**Note**: These tests require a running Next.js server and are designed for CI/CD environments or manual testing with a live server.

## Requirements Validation

The integration tests validate all requirements from the marketing pages redesign specification:

### Requirement 1.1: Guest users can access marketing pages
✅ Tested in: Complete User Journey Integration tests
- Validates guest access to /, /features, /industries, /faq, /pricing

### Requirement 1.2: Marketing pages load without authentication
✅ Tested in: Authentication Redirect Integration tests
- Confirms no authentication required for marketing pages

### Requirement 1.3: Navigation between marketing pages works
✅ Tested in: Complete User Journey Integration tests
- Tests seamless navigation flow between all marketing pages

### Requirement 1.4: Marketing content is accessible to guests
✅ Tested in: Cross-Page Data Flow Integration tests
- Validates AI messaging and content accessibility

### Requirement 1.5: Authenticated users are redirected appropriately
✅ Tested in: Authentication Redirect Integration tests
- Confirms authenticated users redirect to dashboard from marketing pages

## Test Architecture

### Core Integration Tests (Unit-style)
- **Fast execution**: No browser automation overhead
- **Reliable**: No network dependencies
- **Comprehensive**: Tests all business logic and data flow
- **CI-friendly**: Runs in any environment

### Browser Integration Tests (E2E-style)
- **Real browser testing**: Uses Puppeteer for authentic user experience
- **Visual validation**: Tests actual rendering and interactions
- **Performance testing**: Measures real page load times
- **Accessibility testing**: Validates WCAG compliance

## Running the Tests

### Core Integration Tests (Recommended)
```bash
cd frontend
pnpm test marketing-flow-core-integration.test.ts
```

### Browser Integration Tests (Requires server)
```bash
# Terminal 1: Start the development server
cd frontend
pnpm run dev

# Terminal 2: Run browser tests
pnpm test marketing-flow-integration.test.ts
```

## Test Coverage

The integration tests provide comprehensive coverage of:

1. **Authentication Flow**: Guest vs authenticated user handling
2. **Data Integration**: Pricing config, AI messaging, feature comparison
3. **Cross-Page Consistency**: Data flow between marketing pages
4. **Error Scenarios**: Network failures, invalid routes, malformed requests
5. **Performance**: Data access efficiency and response times
6. **Edge Cases**: Unusual inputs, boundary conditions

## Integration with Existing Tests

These integration tests complement the existing property-based tests:

- **Property Tests**: Validate universal correctness properties
- **Unit Tests**: Test individual components and utilities
- **Integration Tests**: Test complete user flows and data integration
- **E2E Tests**: Validate real browser behavior and user experience

## Maintenance Notes

### Adding New Marketing Pages
When adding new marketing pages:
1. Add the route to `MARKETING_ROUTES` array in both test files
2. Update the middleware tests to include the new route
3. Add page-specific validation if needed

### Updating Pricing Configuration
When updating pricing data:
1. Update the pricing integration tests if structure changes
2. Verify AI messaging alignment tests still pass
3. Update feature comparison tests if needed

### Performance Benchmarks
Current performance expectations:
- Middleware processing: < 100ms for 10 requests
- Pricing data access: < 100ms for 100 operations
- AI messaging access: < 100ms for 100 operations

## Troubleshooting

### Common Issues

1. **Browser tests failing with localStorage errors**
   - Solution: Tests include error handling for localStorage access
   - Alternative: Run core integration tests only

2. **Network timeout errors in browser tests**
   - Solution: Increase timeout values or check server status
   - Alternative: Use core integration tests for CI/CD

3. **Middleware auth mocking issues**
   - Solution: Ensure global.fetch is properly mocked and restored
   - Check: Mock implementations match expected API responses

### Debug Tips

1. **Enable debug logging**: Set `DEBUG=true` environment variable
2. **Check middleware logs**: Look for authentication flow debug output
3. **Verify test data**: Ensure pricing and AI messaging configs are loaded
4. **Network inspection**: Use browser dev tools for E2E test debugging

## Future Enhancements

Potential improvements for the integration test suite:

1. **Visual regression testing**: Screenshot comparison for UI consistency
2. **Performance monitoring**: Automated performance regression detection
3. **Cross-browser testing**: Test compatibility across different browsers
4. **Mobile device testing**: Validate mobile-specific functionality
5. **Internationalization testing**: Test multi-language support when added