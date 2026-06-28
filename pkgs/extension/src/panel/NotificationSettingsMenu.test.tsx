import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationSettingsMenu } from "./NotificationSettingsMenu";

describe("NotificationSettingsMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(chrome.storage.local.get).mockResolvedValue({});
    vi.mocked(chrome.notifications.getPermissionLevel).mockResolvedValue(
      "granted",
    );
  });

  it("初期値をすべて有効として表示する", async () => {
    const user = userEvent.setup();
    render(<NotificationSettingsMenu />);

    await user.click(screen.getByTestId("notification-settings-button"));

    await waitFor(() => {
      expect(screen.getByTestId("notification-enabled-toggle")).toBeChecked();
    });
    expect(
      screen.getByTestId("notification-task-detected-toggle"),
    ).toBeChecked();
    expect(
      screen.getByTestId("notification-task-completed-toggle"),
    ).toBeChecked();
  });

  it("設定変更をchrome.storage.localへ保存する", async () => {
    const user = userEvent.setup();
    render(<NotificationSettingsMenu />);
    await user.click(screen.getByTestId("notification-settings-button"));
    await user.click(screen.getByTestId("notification-task-detected-toggle"));

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      notificationSettings: {
        enabled: true,
        taskDetected: false,
        taskCompleted: true,
      },
    });
  });

  it("保存済み設定を復元する", async () => {
    vi.mocked(chrome.storage.local.get).mockResolvedValue({
      notificationSettings: {
        enabled: false,
        taskDetected: true,
        taskCompleted: false,
      },
    });
    const user = userEvent.setup();
    render(<NotificationSettingsMenu />);
    await user.click(screen.getByTestId("notification-settings-button"));

    await waitFor(() =>
      expect(
        screen.getByTestId("notification-enabled-toggle"),
      ).not.toBeChecked(),
    );
    expect(
      screen.getByTestId("notification-task-detected-toggle"),
    ).toBeDisabled();
    expect(
      screen.getByTestId("notification-task-completed-toggle"),
    ).toBeDisabled();
  });

  it("OS側で拒否されている場合は設定案内を表示する", async () => {
    vi.mocked(chrome.notifications.getPermissionLevel).mockResolvedValue(
      "denied",
    );
    const user = userEvent.setup();
    render(<NotificationSettingsMenu />);
    await user.click(screen.getByTestId("notification-settings-button"));

    expect(
      await screen.findByTestId("notification-permission-guidance"),
    ).toBeInTheDocument();
  });
});
