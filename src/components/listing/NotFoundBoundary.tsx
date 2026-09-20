import { Component, type ReactNode } from "react";

/**
 * A query called with a malformed id (a mistyped or truncated link) throws
 * during render. This turns that into the same "not found" view as a missing
 * listing instead of a blank page. Give it a `key` that changes with the id
 * so navigating to another listing clears the failure.
 */
export class NotFoundBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
