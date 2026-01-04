# Contributing to Library System

Thank you for your interest in contributing to the Library Management System! This document provides guidelines for contributing.

## 🚀 Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Set up the development environment** (see README.md)
4. **Create a branch** for your changes

## 📝 Development Workflow

### Branch Naming

Use descriptive branch names:
- `feature/add-book-reviews` - New features
- `fix/login-redirect-bug` - Bug fixes
- `docs/update-api-docs` - Documentation
- `refactor/auth-module` - Code refactoring

### Commit Messages

Follow conventional commits:

```
feat: add book review system
fix: resolve login redirect issue
docs: update API documentation
refactor: simplify auth middleware
test: add unit tests for borrows service
```

### Code Style

- Use TypeScript for all code
- Follow ESLint and Prettier configurations
- Write meaningful comments for complex logic
- Use descriptive variable and function names

## 🧪 Testing

Before submitting a PR:

```bash
# Run backend tests
cd apps/api
npm run test
npm run lint

# Run frontend tests
cd apps/web
npm run lint
```

## 📥 Pull Request Process

1. **Update documentation** if needed
2. **Add tests** for new features
3. **Ensure all tests pass**
4. **Update the README** if you've changed functionality
5. **Request review** from maintainers

### PR Checklist

- [ ] Code follows the project's style guidelines
- [ ] Self-review of code completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests added and passing

## 🐛 Reporting Bugs

When reporting bugs, include:

1. **Description** - Clear description of the bug
2. **Steps to Reproduce** - How to trigger the bug
3. **Expected Behavior** - What should happen
4. **Actual Behavior** - What actually happens
5. **Screenshots** - If applicable
6. **Environment** - OS, browser, Node version

## 💡 Feature Requests

For feature requests:

1. **Check existing issues** - It might already be requested
2. **Describe the feature** - What should it do?
3. **Explain the use case** - Why is it needed?
4. **Suggest implementation** - Optional, but helpful

## 📁 Project Structure

```
apps/
├── api/          # NestJS Backend
│   ├── src/      # Source code
│   └── prisma/   # Database schema
└── web/          # Next.js Frontend
    └── app/      # App router pages
```

## 🔧 Common Tasks

### Adding a New API Endpoint

1. Create/update the module in `apps/api/src/`
2. Add DTOs for validation
3. Update Swagger documentation
4. Add to `app.module.ts` if new module
5. Test the endpoint

### Adding a New Page

1. Create page in `apps/web/app/`
2. Add to navigation if needed
3. Implement responsive design
4. Test on different screen sizes

## 📞 Getting Help

- **GitHub Issues** - For bugs and features
- **Discussions** - For questions and ideas

## 📜 Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow

Thank you for contributing! 🎉
