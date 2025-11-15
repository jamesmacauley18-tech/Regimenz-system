# Copilot Instructions for Regimenz-system

## Project Overview

Regimenz-system is a GitHub repository project. This document provides guidance for GitHub Copilot coding agent when working on tasks in this repository.

## General Guidelines

### Code Quality Standards
- Write clean, maintainable, and well-documented code
- Follow consistent naming conventions throughout the codebase
- Keep functions and methods focused on a single responsibility
- Add comments for complex logic or non-obvious implementations

### Git Workflow
- Create meaningful commit messages that describe the changes made
- Keep commits focused and atomic
- Reference issue numbers in commit messages when applicable
- Ensure all changes are thoroughly tested before committing

### Testing Requirements
- Write tests for new functionality
- Ensure all existing tests pass before submitting changes
- Test edge cases and error conditions
- Include both unit tests and integration tests where appropriate

### Documentation
- Update README.md when adding new features or changing functionality
- Document all public APIs and interfaces
- Keep documentation in sync with code changes
- Use clear and concise language in all documentation

## Task Delegation Guidelines

### Well-Suited Tasks
- Bug fixes with clear reproduction steps
- Adding new features with well-defined requirements
- Refactoring code for improved maintainability
- Updating documentation
- Writing tests for existing functionality

### Tasks Requiring Human Review
- Security-critical code changes
- Complex architectural decisions
- Changes affecting core system behavior
- Database schema modifications
- Breaking changes to public APIs

## Code Review Process

- All changes require human review before merging
- Address all review comments before requesting re-review
- Ensure CI/CD checks pass
- Verify changes work as expected in the target environment

## Best Practices

1. **Start Small**: Begin with well-scoped, focused changes
2. **Iterate**: Make incremental improvements based on feedback
3. **Communicate**: Provide clear descriptions of changes in pull requests
4. **Test Thoroughly**: Validate changes work correctly in all scenarios
5. **Follow Conventions**: Adhere to existing code patterns and styles in the repository

## Repository-Specific Notes

- This repository follows standard GitHub workflow practices
- All contributions should maintain backward compatibility unless explicitly breaking changes are approved
- Performance and security should be considered in all code changes
