/**
 * Code Quality Review Prompts
 * Focus on clean code, best practices, SOLID principles
 */

export const QUALITY_SYSTEM_PROMPT = `You are an expert code reviewer specializing in code quality, clean code principles, and software engineering best practices.

Your focus areas:
1. Clean Code principles (readable, maintainable, simple)
2. SOLID principles (Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion)
3. Design patterns and anti-patterns
4. Code organization and structure
5. Error handling and edge cases
6. Performance considerations
7. Code duplication (DRY principle)
8. Naming conventions and clarity`;

export const QUALITY_USER_PROMPT = `Please analyze this code diff for code quality issues, best practices violations, and potential improvements.

Code diff:
\`\`\`diff
{diff}
\`\`\`

## Code Quality Checks

### Critical Issues (Fix Immediately):
- **Unhandled Errors**: Missing try-catch, ignored errors, no error propagation
- **Breaking Changes**: API changes without backward compatibility
- **Race Conditions**: Concurrent access without synchronization
- **Resource Leaks**: Unclosed files, connections, or memory leaks

### High Priority:
- **Single Responsibility Violations**: Functions/classes doing too many things
- **Dead Code**: Unused functions, variables, or commented-out code
- **Deep Nesting**: Excessive if-else or loop nesting (>3 levels)
- **Long Functions**: Functions >50 lines that could be split
- **Magic Numbers**: Hardcoded values without explanation
- **Error Swallowing**: Empty catch blocks, generic error messages

### Medium Priority:
- **Code Duplication**: Repeated logic that should be extracted
- **Inconsistent Naming**: Not following project conventions
- **Missing Edge Cases**: Input validation, null checks, boundary conditions
- **Complex Conditionals**: Hard-to-understand boolean logic
- **Tight Coupling**: Components too dependent on each other
- **Missing Documentation**: Complex logic without comments

### Low Priority:
- **Minor Style Issues**: Formatting, spacing (if not auto-fixed)
- **Verbose Code**: Can be simplified without losing clarity
- **Suboptimal Patterns**: Working code with better alternatives
- **Missing Type Annotations**: In typed languages

### Info (Suggestions):
- **Performance Optimizations**: Potential improvements (profile first)
- **Modern Syntax**: Using newer language features
- **Design Pattern Suggestions**: Alternative architectural approaches
- **Testing Suggestions**: Areas that need test coverage

## Compliance Checks:
- **Consistent Naming Conventions**: camelCase, PascalCase, snake_case per language
- **No Dead or Commented-Out Code**: Keep codebase clean
- **Robust Error Handling**: All error scenarios handled gracefully
- **Single Responsibility for Functions**: Each function has one clear purpose
- **Early Returns**: Prefer early returns over deep nesting

## For Each Issue:
1. **Identify the specific problem** (with line numbers)
2. **Explain why it matters** (impact on maintainability, readability, performance)
3. **Suggest concrete fix** (with code example when helpful)
4. **Classify severity** (critical, high, medium, low, info)

Focus on actionable feedback that improves code quality without bikeshedding minor style preferences.

## IMPORTANT - Output Format:
Return ONLY valid JSON objects in the issues array. Do NOT include:
- String comments or notes
- Empty strings
- Explanatory text outside the schema
Each issue MUST be a complete JSON object with all required fields.

## CRITICAL - Do NOT Include Security Fields:
Quality reviews should NOT include these fields (they are for security reviews only):
- securityCategory (omit this field)
- exploitability (omit this field)
- impact (omit this field)

Only include: title, severity, description, explanation, location, suggestion, codeSnippet`;

export function buildQualityPrompt(diff: string): string {
  return QUALITY_USER_PROMPT.replace("{diff}", diff);
}
