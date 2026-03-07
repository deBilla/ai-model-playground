# Engineering Rules

All agents and contributors must follow these principles. Apply them with judgment — the goal is clean, maintainable code, not mechanical rule-following.

---

## Foundational Principles

### KISS — Keep It Simple, Stupid
Write the simplest solution that correctly solves the problem. Avoid clever abstractions, over-engineering, and unnecessary complexity. If a junior developer would struggle to understand it, simplify it.

### DRY — Don't Repeat Yourself
Every piece of knowledge must have a single, authoritative representation. Extract shared logic into a named abstraction only when it is used in three or more places and the abstraction is genuinely simpler than the duplication.

### YAGNI — You Aren't Gonna Need It
Do not add functionality, configuration, or abstraction for hypothetical future requirements. Build only what is needed right now. Speculative generality is technical debt.

### Separation of Concerns
Each module, file, and function should own one concern. Network layer code does not contain business logic. UI components do not fetch data directly. Services do not format responses for HTTP.

### Law of Demeter
A unit should only talk to its immediate collaborators. Avoid deep chaining (`a.b.c.d()`). Pass only what a function needs — do not pass entire objects so the function can reach into them.

---

## SOLID

### SRP — Single Responsibility Principle
A class or module should have one reason to change. If you find yourself writing "and" when describing what something does, split it.

### OCP — Open/Closed Principle
Software entities should be open for extension, closed for modification. Add behaviour by adding new code, not by changing existing tested code. Use composition and dependency injection.

### LSP — Liskov Substitution Principle
Subtypes must be substitutable for their base types without altering correctness. Do not override methods in ways that weaken preconditions or strengthen postconditions.

### ISP — Interface Segregation Principle
Clients should not depend on interfaces they do not use. Prefer many small, focused interfaces over one large general-purpose interface.

### DIP — Dependency Inversion Principle
High-level modules must not depend on low-level modules. Both should depend on abstractions. Inject dependencies; do not construct them inside business logic.

---

## OOP Concepts

### Encapsulation
Hide internal state and implementation details. Expose only what callers need through a deliberate public interface. Mutation of state should go through controlled methods.

### Abstraction
Expose what something does, not how it does it. Name things by their intent. Callers should not need to know implementation details to use a component correctly.

### Polymorphism
Use shared interfaces or base types to write code that works across multiple concrete implementations without branching on type. Prefer polymorphism over `switch`/`if-else` chains on type tags.

### Inheritance
Use inheritance only when a true "is-a" relationship exists and behaviour genuinely needs to be shared. Prefer composition over inheritance. Never inherit solely for code reuse.

---

## Design Patterns

Apply patterns only when the problem they solve is actually present. Never introduce a pattern preemptively.

### Creational

**Factory**
Use when object creation logic is complex or when the concrete type to instantiate is determined at runtime. Centralise construction behind a factory function or class rather than scattering `new` calls.

**Builder**
Use when constructing an object requires many optional parameters or a multi-step configuration process. Provides a fluent, readable API and prevents invalid intermediate states.

**Singleton**
Use sparingly and only for truly global, stateless resources (e.g. a database connection pool, a logger). Never use Singleton to avoid passing dependencies — that is hidden global state.

### Structural

**Decorator**
Use to add behaviour to an object at runtime without modifying its class. Stack decorators for cross-cutting concerns (logging, caching, auth checks) instead of polluting core logic.

**Facade**
Use to provide a simplified interface over a complex subsystem. The facade hides complexity; callers interact with a clean, intention-revealing API. Do not leak subsystem types through the facade.

### Behavioural

**Strategy**
Use to define a family of interchangeable algorithms behind a common interface. Inject the strategy rather than hard-coding it. Eliminates conditionals that select between implementations.

**Observer**
Use to decouple producers of events from consumers. Producers emit events without knowing who listens. Consumers subscribe without knowing who publishes. Keep event payloads minimal and immutable.

**State Machine**
Use when an entity's behaviour changes meaningfully depending on its current state, and invalid transitions must be prevented. Model states and transitions explicitly rather than scattering boolean flags.

---

## How Agents Must Apply These Rules

1. **Before writing new code**, check whether an existing utility, hook, or service already solves the problem. Reuse before creating.
2. **Before adding abstraction**, count the actual use sites. Abstract at three or more; duplicate at two or fewer.
3. **Before adding a parameter or option**, confirm it is required by the current task. YAGNI.
4. **When a function does two things**, split it into two functions before proceeding.
5. **When adding a pattern**, name the intent in the code (e.g. `createChatService`, `withRetry`, `StreamingState`) so the pattern is legible without comments.
6. **Do not gold-plate**. A working, readable, correct solution is always preferred over an elegant one that is harder to understand.
7. **Before declaring improvements complete**, trace each significant operation end-to-end across the full request lifecycle (e.g. prompt submitted → stream → persist → client receives ID). Separation of Concerns, reliability, and DRY violations are most often found at module boundaries — not within individual files. A file-by-file review is insufficient.
8. **When moving async work from background to foreground**, account for the latency cost. A fire-and-forget client-side operation (e.g. a POST after a stream ends) adds no perceived latency to the stream. Moving that same work into the stream's critical path (e.g. a DB write that blocks stream close) adds real latency even if the visible UI state appears unchanged. Document the tradeoff explicitly — reliability gained vs latency added — before making the change.
