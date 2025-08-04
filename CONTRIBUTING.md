# Contributing to Runbar

Thank you for your interest in contributing to Runbar! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Code Style](#code-style)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Feature Requests](#feature-requests)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/runbar.git`
3. Create a feature branch: `git checkout -b feature/amazing-feature`
4. Make your changes
5. Test your changes
6. Commit your changes: `git commit -m 'Add amazing feature'`
7. Push to your fork: `git push origin feature/amazing-feature`
8. Open a Pull Request

## Development Setup

### Prerequisites

- Node.js 18+ 
- npm or yarn
- macOS (for development and testing)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/runbar.git
cd runbar

# Install dependencies
npm install

# Build the project
npm run build

# Start development mode
npm run dev
```

### Available Scripts

- `npm run build` - Build the TypeScript code
- `npm run dev` - Start development mode with hot reload
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues automatically
- `npm run type-check` - Run TypeScript type checking
- `npm run format` - Format code with Prettier

## Code Style

### TypeScript

- Use strict TypeScript configuration
- Prefer explicit return types for public functions
- Use interfaces for object shapes
- Avoid `any` type - use proper typing
- Use async/await over Promises when possible

### General Guidelines

- Follow the existing code style
- Use meaningful variable and function names
- Write self-documenting code
- Add comments for complex logic
- Keep functions small and focused
- Use early returns to reduce nesting

### File Organization

- One class/interface per file
- Group related functionality in directories
- Use index files for clean exports
- Follow the established directory structure

## Testing

### Writing Tests

- Write tests for all new functionality
- Use descriptive test names
- Follow the AAA pattern (Arrange, Act, Assert)
- Mock external dependencies
- Test both success and error cases

### Test Structure

```typescript
describe('ClassName', () => {
  describe('methodName', () => {
    it('should do something when condition', () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = method(input);
      
      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- path/to/test.ts
```

## Pull Request Process

1. **Update Documentation**: Update README.md and other documentation if needed
2. **Add Tests**: Ensure all new functionality is tested
3. **Check Code Style**: Run `npm run lint` and `npm run format`
4. **Type Check**: Run `npm run type-check`
5. **Test**: Run `npm test` to ensure all tests pass
6. **Update Version**: Update version in package.json if needed
7. **Create PR**: Create a pull request with a clear description

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Manual testing completed
- [ ] All tests pass

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No console.log statements left
- [ ] No TODO comments left
```

## Reporting Bugs

When reporting bugs, please include:

1. **Environment**: macOS version, Node.js version
2. **Steps to Reproduce**: Clear, step-by-step instructions
3. **Expected Behavior**: What you expected to happen
4. **Actual Behavior**: What actually happened
5. **Screenshots**: If applicable
6. **Logs**: Any error messages or console output

## Feature Requests

When requesting features, please include:

1. **Use Case**: Why this feature is needed
2. **Proposed Solution**: How you think it should work
3. **Alternatives**: Any alternative approaches considered
4. **Mockups**: If applicable

## Questions?

If you have questions about contributing, please:

1. Check existing issues and discussions
2. Open a new issue with the "question" label
3. Join our community discussions

Thank you for contributing to Runbar! 🚀 