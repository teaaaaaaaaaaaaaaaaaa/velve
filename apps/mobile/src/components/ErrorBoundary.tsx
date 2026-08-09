import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 items-center justify-center bg-base-canvas p-4">
          <Text className="mb-4 font-display text-xl text-ink-dark">Something went wrong</Text>
          <Text className="mb-6 text-center font-sans text-sm text-ink-dark/60">
            Sorry about that. The team has been notified.
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false })}
            className="rounded-lg bg-brand-accent-deep px-6 py-3"
          >
            <Text className="font-sans text-base-canvas">Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}
