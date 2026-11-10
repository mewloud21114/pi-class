import { Alert as NativeAlert, Platform } from 'react-native';

/**
 * Drop-in replacement for React Native's Alert.alert, which does nothing in a browser.
 * On web: one button -> window.alert, two buttons (cancel + action) -> window.confirm.
 */
export const Alert = {
  alert(title, message, buttons) {
    if (Platform.OS !== 'web') return NativeAlert.alert(title, message, buttons);

    const text = [title, message].filter(Boolean).join('\n\n');
    const cancel = buttons?.find((b) => b.style === 'cancel');
    const actions = (buttons ?? []).filter((b) => b !== cancel);

    if (cancel && actions.length) {
      if (window.confirm(text)) actions[0].onPress?.();
      else cancel.onPress?.();
      return;
    }
    window.alert(text);
    actions[0]?.onPress?.();
  },
};
