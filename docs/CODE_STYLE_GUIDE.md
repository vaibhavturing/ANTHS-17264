# Code Style Guide

This document outlines the coding standards and style guidelines for the Healthcare Management Application. Consistency in code style is crucial for maintainability, readability, and collaboration.

## Table of Contents

1. [JavaScript Style Guidelines](#javascript-style-guidelines)
2. [File Organization](#file-organization)
3. [Naming Conventions](#naming-conventions)
4. [Documentation Guidelines](#documentation-guidelines)
5. [Error Handling](#error-handling)
6. [Asynchronous Code](#asynchronous-code)
7. [Security Best Practices](#security-best-practices)
8. [HIPAA Compliance Patterns](#hipaa-compliance-patterns)
9. [Testing Conventions](#testing-conventions)
10. [CSS/SCSS Guidelines (for frontend)](#cssscss-guidelines)

## JavaScript Style Guidelines

We follow the [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript) with some custom modifications. Key rules include:

### Formatting

- Use 2 spaces for indentation
- Use semicolons at the end of statements
- Keep line length under 100 characters
- Use single quotes for strings
- Add a space after keywords (`if`, `for`, `while`, etc.)
- No spaces inside parentheses
- Add spaces around operators (`=`, `+`, `-`, etc.)
- Use trailing commas in multiline object/array literals

### JavaScript Syntax

- Use ES6+ features whenever possible
- Prefer arrow functions for anonymous functions
- Use template literals for string concatenation
- Use destructuring assignments
- Use spread/rest operators when appropriate
- Use `const` for declarations that don't change, `let` for those that do
- Never use `var`

Example:
```javascript
// Good
const getFullName = (user) => {
  const { firstName, lastName } = user;
  return `${firstName} ${lastName}`;
};

// Avoid
function getFullName(user) {
  return user.firstName + ' ' + user.lastName;
}