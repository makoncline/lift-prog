import React, { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  type ModalProps,
  Platform,
  Pressable,
  type StyleProp,
  Text,
  View,
  type ViewStyle,
} from "react-native";

import { styles } from "./styles";

export type AppDialogAction = {
  label: string;
  onPress?: () => void | Promise<void>;
  testID?: string;
  variant?: "default" | "primary" | "danger" | "cancel";
};

export type AppDialogState = {
  actions: AppDialogAction[];
  message?: string;
  title: string;
};

type AppDialogPresenter = (dialog: AppDialogState) => void;

const AppDialogContext = React.createContext<AppDialogPresenter | null>(null);
const AppModalLayerOpenContext = React.createContext(false);
const AppModalLayerRegisterContext = React.createContext<
  (() => () => void) | null
>(null);

export function useAppDialog() {
  const presentDialog = React.use(AppDialogContext);
  if (!presentDialog) {
    throw new Error("useAppDialog must be used inside AppDialogProvider");
  }
  return presentDialog;
}

export function useAppModalLayerOpen() {
  return React.use(AppModalLayerOpenContext);
}

function useRegisterAppModalLayer(open: boolean) {
  const registerModal = React.use(AppModalLayerRegisterContext);

  useEffect(() => {
    if (!open || !registerModal) return undefined;
    return registerModal();
  }, [open, registerModal]);
}

export function AppModalLayerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [openCount, setOpenCount] = useState(0);
  const registerModal = useCallback(() => {
    let released = false;
    setOpenCount((count) => count + 1);

    return () => {
      if (released) return;
      released = true;
      setOpenCount((count) => Math.max(0, count - 1));
    };
  }, []);

  return (
    <AppModalLayerRegisterContext.Provider value={registerModal}>
      <AppModalLayerOpenContext.Provider value={openCount > 0}>
        {children}
      </AppModalLayerOpenContext.Provider>
    </AppModalLayerRegisterContext.Provider>
  );
}

export function AppModal({ visible, children, ...props }: ModalProps) {
  useRegisterAppModalLayer(Boolean(visible));
  return (
    <Modal visible={visible} {...props}>
      {children}
    </Modal>
  );
}

export function AppDialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<AppDialogState | null>(null);
  const presentDialog = useCallback((nextDialog: AppDialogState) => {
    setDialog(nextDialog);
  }, []);
  const dismissDialog = useCallback(() => setDialog(null), []);

  return (
    <AppDialogContext.Provider value={presentDialog}>
      {children}
      <AppDialogModal dialog={dialog} onDismiss={dismissDialog} />
    </AppDialogContext.Provider>
  );
}

function AppDialogModal({
  dialog,
  onDismiss,
}: {
  dialog: AppDialogState | null;
  onDismiss: () => void;
}) {
  if (!dialog) return null;

  return (
    <AppModal
      visible
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <DismissibleModalShade
        onDismiss={onDismiss}
        style={styles.confirmDialogShade}
      >
        <View
          accessibilityRole="alert"
          accessible={false}
          accessibilityViewIsModal
          style={styles.confirmDialog}
        >
          <View style={styles.confirmDialogCopy}>
            <Text style={styles.confirmDialogTitle}>{dialog.title}</Text>
            {dialog.message ? (
              <Text style={styles.confirmDialogMessage}>{dialog.message}</Text>
            ) : null}
          </View>
          <View style={styles.confirmDialogActions}>
            {dialog.actions.map((action, index) => {
              const variant = action.variant ?? "default";
              return (
                <Pressable
                  key={`${action.label}-${index}`}
                  accessibilityLabel={action.label}
                  accessibilityRole="button"
                  style={[
                    styles.confirmDialogAction,
                    variant === "primary"
                      ? styles.confirmDialogActionPrimary
                      : null,
                  ]}
                  testID={action.testID}
                  onPress={() => {
                    onDismiss();
                    void action.onPress?.();
                  }}
                >
                  <Text
                    style={[
                      styles.confirmDialogActionText,
                      variant === "danger"
                        ? styles.confirmDialogActionTextDanger
                        : null,
                      variant === "cancel"
                        ? styles.confirmDialogActionTextMuted
                        : null,
                    ]}
                  >
                    {action.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </DismissibleModalShade>
    </AppModal>
  );
}

export function DismissibleModalShade({
  children,
  contentStyle,
  keyboardAvoiding = false,
  keyboardAvoidingStyle,
  onDismiss,
  style = styles.modalShade,
}: {
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  keyboardAvoiding?: boolean;
  keyboardAvoidingStyle?: StyleProp<ViewStyle>;
  onDismiss: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const content = (
    <View
      accessible={false}
      style={[styles.dismissibleModalContent, contentStyle]}
    >
      {children}
    </View>
  );

  return (
    <View accessibilityViewIsModal style={style}>
      <Pressable
        accessibilityLabel="Dismiss"
        accessibilityRole="button"
        style={styles.dismissibleModalBackdrop}
        onPress={onDismiss}
      />
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={[styles.keyboardAvoidingModalContent, keyboardAvoidingStyle]}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </View>
  );
}
