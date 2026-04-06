import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
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
        <View className="flex-1 justify-center items-center bg-base-canvas p-4">
          <Text className="text-ink-dark text-xl font-display mb-4">
            Nešto je pošlo naopako
          </Text>
          <Text className="text-ink-dark/60 text-sm font-sans text-center mb-6">
            Izvinjavamo se zbog problema. Tim je obavešten.
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false })}
            className="bg-brand-accent-deep px-6 py-3 rounded-lg"
          >
            <Text className="text-base-canvas font-sans">Pokušaj ponovo</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}
